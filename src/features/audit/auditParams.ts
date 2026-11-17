import type { AuditFilters } from '@/types'

/** The audit log keeps its filters and page in the URL. */
export interface AuditState {
  actor: string | null
  action: string | null
  /** Pacific calendar days, YYYY-MM-DD, inclusive. */
  from: string | null
  to: string | null
  page: number
}

export const DEFAULT_AUDIT_STATE: AuditState = { actor: null, action: null, from: null, to: null, page: 1 }

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function parseAuditState(params: URLSearchParams): AuditState {
  const page = Number(params.get('page'))
  const from = params.get('from')
  const to = params.get('to')
  return {
    actor: params.get('actor') || null,
    action: params.get('action') || null,
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/** Applies a change to the URL: empty values are left out, other parameters are kept, the page resets unless set. */
export function applyAuditPatch(prev: URLSearchParams, patch: Partial<AuditState>): URLSearchParams {
  const state: AuditState = { ...parseAuditState(prev), ...patch }
  if (!('page' in patch)) state.page = 1
  const next = new URLSearchParams(prev)
  const put = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key))
  put('actor', state.actor)
  put('action', state.action)
  put('from', state.from)
  put('to', state.to)
  put('page', state.page === 1 ? null : String(state.page))
  return next
}

export function toAuditFilters(state: AuditState): AuditFilters {
  const f: AuditFilters = {}
  if (state.actor) f.actor_id = state.actor
  if (state.action) f.action = state.action
  if (state.from) f.from = state.from
  if (state.to) f.to = state.to
  return f
}

export function hasAuditFilters(state: AuditState): boolean {
  return Boolean(state.actor || state.action || state.from || state.to)
}

/** First and last four characters of a hash: "9f3c…a17e". */
export function headLabel(hash: string): string {
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`
}

/** Where an audit record's entity lives in the app, if it has a page. */
export function entityHref(entity: string, id: string): string | null {
  switch (entity) {
    case 'deal':
      return `/deals/${id}`
    case 'finding':
      return `/findings/${id}`
    case 'rule':
      return `/rules?rule=${id}`
    default:
      return null
  }
}
