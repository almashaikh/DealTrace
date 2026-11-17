import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { GENESIS_HASH, appendRecord, canonicalJson, hashInput, sha256Hex, verifyChain } from '@/lib/hashchain'
import { seed } from '@/mocks/db'
import type { AuditEvent } from '@/types'

describe('canonicalJson', () => {
  it('sorts keys at every level and drops whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: true, y: null }], c: 'x' } })).toBe('{"a":{"c":"x","d":[3,{"y":null,"z":true}]},"b":1}')
  })

  it('drops undefined values', () => {
    expect(canonicalJson({ a: undefined, b: 2 })).toBe('{"b":2}')
  })
})

describe('sha256Hex', () => {
  it('matches node:crypto', async () => {
    const text = `${GENESIS_HASH}{"id":"E-1"}`
    expect(await sha256Hex(text)).toBe(createHash('sha256').update(text).digest('hex'))
  })
})

describe('verifyChain on the seed', () => {
  it('verifies the deal event chain', async () => {
    const r = await verifyChain(seed.events)
    expect(r).toMatchObject({ valid: true, total: seed.events.length, checked: seed.events.length })
    expect(seed.events[0]?.prev_hash).toBe(GENESIS_HASH)
  })

  it('verifies the audit chain', async () => {
    const r = await verifyChain(seed.audit)
    expect(r.valid).toBe(true)
    expect(r.total).toBe(seed.audit.length)
  })

  it('fails at the altered record when one event is changed', async () => {
    const tampered = seed.events.map((e) => ({ ...e }))
    const target = tampered.findIndex((e) => e.id === 'E-1045')
    tampered[target] = { ...tampered[target]!, reason: 'Customer asked for a lower payment' }
    const r = await verifyChain(tampered)
    expect(r.valid).toBe(false)
    expect(r.first_invalid_id).toBe('E-1045')
    expect(r.first_invalid_index).toBe(target)
  })

  it('fails when a record is removed from the middle', async () => {
    const shortened = seed.audit.filter((_, i) => i !== 40)
    const r = await verifyChain(shortened)
    expect(r.valid).toBe(false)
    expect(r.first_invalid_index).toBe(40)
  })

  it('appendRecord links a new record that still verifies', async () => {
    const next = await appendRecord<AuditEvent>(seed.audit, {
      id: 'AU-99999',
      timestamp: '2026-11-12T23:00:00.000Z',
      actor_id: 'U-01',
      action: 'Decision recorded: fix_before_funding',
      entity: 'finding',
      entity_id: 'F-2291',
    })
    expect(next.prev_hash).toBe(seed.audit[seed.audit.length - 1]?.hash)
    expect(next.hash).toBe(createHash('sha256').update(hashInput(next)).digest('hex'))
    expect((await verifyChain([...seed.audit, next])).valid).toBe(true)
  })
})
