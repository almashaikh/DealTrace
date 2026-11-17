import { useSyncExternalStore } from 'react'

/**
 * Fake session kept in localStorage. There is no backend and no real authentication:
 * any sign-in click opens the workspace as the demo compliance officer.
 */
export interface Session {
  user_id: string
  signed_in_at: string
}

export const DEMO_EMAIL = 'priya.shah@harborline.example'
export const DEMO_PASSWORD = 'harborline-demo'
const DEMO_USER_ID = 'U-01'
const KEY = 'dealtrace.session.v1'

let fallbackRaw: string | null = null // used when localStorage is blocked
let cache: { raw: string | null; value: Session | null } = { raw: null, value: null }
const listeners = new Set<() => void>()

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return fallbackRaw
  }
}

function writeRaw(raw: string | null): void {
  fallbackRaw = raw
  try {
    if (raw === null) window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, raw)
  } catch {
    // Storage blocked: the in-memory copy keeps the session for this tab.
  }
  for (const l of listeners) l()
}

function parse(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (typeof v === 'object' && v !== null && 'user_id' in v && typeof v.user_id === 'string' && 'signed_in_at' in v && typeof v.signed_in_at === 'string') {
      return { user_id: v.user_id, signed_in_at: v.signed_in_at }
    }
  } catch {
    // fall through
  }
  return null
}

/** Stable snapshot: the same object is returned until the stored text changes. */
export function getSession(): Session | null {
  const raw = readRaw()
  if (raw !== cache.raw) cache = { raw, value: parse(raw) }
  return cache.value
}

export function signIn(): void {
  writeRaw(JSON.stringify({ user_id: DEMO_USER_ID, signed_in_at: new Date().toISOString() } satisfies Session))
}

export function signOut(): void {
  writeRaw(null)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, () => null)
}
