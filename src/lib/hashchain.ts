import type { ChainVerification } from '@/types'

/**
 * Hash chain shared by the seed script (node:crypto) and the browser verifier (Web Crypto).
 *   hash = SHA-256 hex of (prev_hash + canonical JSON of the record without its `hash` field)
 * Canonical JSON: keys sorted alphabetically at every level, no whitespace, undefined values dropped.
 */

export const GENESIS_HASH = '0'.repeat(64)

export interface ChainRecord {
  id: string
  hash: string
  prev_hash: string
}

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`
  switch (typeof value) {
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('canonicalJson: numbers must be finite')
      return JSON.stringify(value)
    case 'string':
    case 'boolean':
      return JSON.stringify(value)
    case 'object': {
      const obj = value as Record<string, unknown>
      const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort()
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
    }
    default:
      throw new TypeError(`canonicalJson: unsupported type ${typeof value}`)
  }
}

/** The exact string that gets hashed for a record. */
export function hashInput(record: { prev_hash: string; hash?: string }): string {
  // Strip the hash field; everything else (including prev_hash) is part of the payload.
  const { hash: _ignored, ...rest } = record
  return record.prev_hash + canonicalJson(rest)
}

/** SHA-256 hex digest using Web Crypto (browser, and Node 20+ via globalThis.crypto). */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function computeHash(record: { prev_hash: string; hash?: string }): Promise<string> {
  return sha256Hex(hashInput(record))
}

/** Appends a record to the end of a chain, filling prev_hash and hash. */
export async function appendRecord<T extends ChainRecord>(
  chain: readonly T[],
  record: Omit<T, 'hash' | 'prev_hash'>,
): Promise<T> {
  const prev_hash = chain.length > 0 ? (chain[chain.length - 1] as T).hash : GENESIS_HASH
  const withPrev = { ...record, prev_hash } as Omit<T, 'hash'>
  const hash = await computeHash(withPrev)
  return { ...withPrev, hash } as T
}

/** Recomputes every hash and checks every link. Stops at the first broken record. */
export async function verifyChain(records: readonly ChainRecord[]): Promise<ChainVerification> {
  let expectedPrev = GENESIS_HASH
  for (let i = 0; i < records.length; i++) {
    const r = records[i] as ChainRecord
    if (r.prev_hash !== expectedPrev) {
      return {
        valid: false,
        total: records.length,
        checked: i + 1,
        first_invalid_index: i,
        first_invalid_id: r.id,
        reason: `prev_hash of ${r.id} does not match the hash of the record before it`,
        head_hash: null,
      }
    }
    const recomputed = await computeHash(r)
    if (recomputed !== r.hash) {
      return {
        valid: false,
        total: records.length,
        checked: i + 1,
        first_invalid_index: i,
        first_invalid_id: r.id,
        reason: `Recomputed hash of ${r.id} does not match the stored hash; the record was changed after it was written`,
        head_hash: null,
      }
    }
    expectedPrev = r.hash
  }
  return { valid: true, total: records.length, checked: records.length, first_invalid_index: null, first_invalid_id: null, reason: null, head_hash: records.length > 0 ? (records[records.length - 1] as ChainRecord).hash : null }
}
