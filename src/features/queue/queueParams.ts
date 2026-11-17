import { FINDING_TYPE_LABELS } from '@/lib/catalog'
import type { FindingFilters, FindingSortField, FindingStatus, FindingType, Severity, Sort, SortDirection } from '@/types'

/**
 * Everything the review queue shows lives in the URL: tab, filters, search, sort and page.
 * The rooftop is the global ?dealer= parameter owned by the top bar.
 */

export type QueueTab = 'open' | 'in_review' | 'resolved' | 'dismissed' | 'all'

export const QUEUE_TABS: readonly { key: QueueTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'in_review', label: 'In review' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'dismissed', label: 'Dismissed' },
  { key: 'all', label: 'All' },
]

export interface QueueState {
  tab: QueueTab
  severity: Severity[]
  type: FindingType[]
  assignee: string | null
  q: string
  /** Only findings with at least this refund exposure. */
  minRefund: number | null
  sort: FindingSortField
  dir: SortDirection
  page: number
}

export const DEFAULT_QUEUE_STATE: QueueState = {
  tab: 'open',
  severity: [],
  type: [],
  assignee: null,
  q: '',
  minRefund: null,
  sort: 'refund_exposure',
  dir: 'desc',
  page: 1,
}

export const SEVERITIES: readonly Severity[] = ['critical', 'high', 'medium', 'low']
export const FINDING_TYPES = Object.keys(FINDING_TYPE_LABELS) as FindingType[]
const SORT_FIELDS: readonly FindingSortField[] = ['severity', 'detected_at', 'refund_exposure', 'customer_exposure', 'uncertainty']

function list<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
  if (!raw) return []
  return raw.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v))
}

export function parseQueueState(params: URLSearchParams): QueueState {
  const tab = params.get('tab')
  const sort = params.get('sort')
  const dir = params.get('dir')
  const page = Number(params.get('page'))
  const minRefund = Number(params.get('minRefund'))
  return {
    tab: QUEUE_TABS.some((t) => t.key === tab) ? (tab as QueueTab) : DEFAULT_QUEUE_STATE.tab,
    severity: list(params.get('severity'), SEVERITIES),
    type: list(params.get('type'), FINDING_TYPES),
    assignee: params.get('assignee') || null,
    q: params.get('q') ?? '',
    minRefund: params.get('minRefund') && Number.isFinite(minRefund) && minRefund > 0 ? minRefund : null,
    sort: SORT_FIELDS.includes(sort as FindingSortField) ? (sort as FindingSortField) : DEFAULT_QUEUE_STATE.sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_QUEUE_STATE.dir,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/**
 * Applies a change to the URL parameters. Other parameters (such as ?dealer=) are kept,
 * values equal to the defaults are left out, and the page returns to 1 unless the patch sets it.
 */
export function applyQueuePatch(prev: URLSearchParams, patch: Partial<QueueState>): URLSearchParams {
  const state: QueueState = { ...parseQueueState(prev), ...patch }
  if (!('page' in patch)) state.page = 1
  const next = new URLSearchParams(prev)
  const d = DEFAULT_QUEUE_STATE
  const put = (key: string, value: string | null, isDefault: boolean) => {
    if (value === null || value === '' || isDefault) next.delete(key)
    else next.set(key, value)
  }
  put('tab', state.tab, state.tab === d.tab)
  put('severity', state.severity.join(','), state.severity.length === 0)
  put('type', state.type.join(','), state.type.length === 0)
  put('assignee', state.assignee, state.assignee === null)
  put('q', state.q.trim(), state.q.trim() === '')
  put('minRefund', state.minRefund === null ? null : String(state.minRefund), state.minRefund === null)
  put('sort', state.sort, state.sort === d.sort)
  put('dir', state.dir, state.dir === d.dir)
  put('page', String(state.page), state.page === 1)
  return next
}

const STATUS_BY_TAB: Record<Exclude<QueueTab, 'open' | 'all'>, FindingStatus[]> = {
  in_review: ['In review'],
  resolved: ['Resolved'],
  dismissed: ['Dismissed'],
}

/** The arguments api.listFindings needs for a queue state. */
export function toApiQuery(state: QueueState, dealerId: string | null): { filters: FindingFilters; sort: Sort<FindingSortField> } {
  const filters: FindingFilters = {}
  if (state.tab === 'open') filters.status = 'open'
  else if (state.tab !== 'all') filters.status = STATUS_BY_TAB[state.tab]
  if (state.severity.length) filters.severity = state.severity
  if (state.type.length) filters.type = state.type
  if (dealerId) filters.dealer_id = dealerId
  if (state.assignee) filters.assignee_id = state.assignee
  if (state.minRefund !== null) filters.min_refund = state.minRefund
  if (state.q.trim()) filters.q = state.q.trim()
  return { filters, sort: { field: state.sort, direction: state.dir } }
}

/** True when anything beyond the tab, sort and page narrows the list. */
export function hasActiveFilters(state: QueueState, dealerId: string | null): boolean {
  return state.severity.length > 0 || state.type.length > 0 || state.assignee !== null || state.q.trim() !== '' || state.minRefund !== null || dealerId !== null
}

/** The filters cleared, keeping the tab. */
export const CLEARED_FILTERS: Partial<QueueState> = { severity: [], type: [], assignee: null, q: '', minRefund: null }

/** Direction a column starts in when first clicked. */
export function defaultDirection(): SortDirection {
  return 'desc'
}

/** Only compliance reviewers take findings. Dealership and lender staff do not. */
export const ASSIGNABLE_ROLES = ['Compliance Officer', 'Internal Auditor']

/* ---------------- Saved views ---------------- */

/**
 * "High exposure" means a refund exposure of at least this much on a single finding.
 * It is a filter setting for the view, not a figure from the data.
 */
export const HIGH_EXPOSURE_MIN = 2000

export interface SavedView {
  id: 'my-open' | 'high-exposure' | 'all-open'
  label: string
  patch: Partial<QueueState>
}

export function savedViews(meId: string | null): SavedView[] {
  const base = { ...CLEARED_FILTERS, tab: 'open' as const, sort: 'refund_exposure' as const, dir: 'desc' as const }
  return [
    { id: 'all-open', label: 'All open findings', patch: base },
    { id: 'my-open', label: 'My open findings', patch: { ...base, assignee: meId } },
    { id: 'high-exposure', label: 'High exposure', patch: { ...base, minRefund: HIGH_EXPOSURE_MIN } },
  ]
}

/** The saved view the current state matches exactly (rooftop ignored), if any. */
export function activeViewId(state: QueueState, views: readonly SavedView[]): SavedView['id'] | null {
  for (const v of views) {
    const want: QueueState = { ...DEFAULT_QUEUE_STATE, ...v.patch, page: state.page }
    if (v.id === 'my-open' && want.assignee === null) continue
    const same =
      want.tab === state.tab &&
      want.assignee === state.assignee &&
      want.minRefund === state.minRefund &&
      want.sort === state.sort &&
      want.dir === state.dir &&
      state.severity.length === 0 &&
      state.type.length === 0 &&
      state.q.trim() === ''
    if (same) return v.id
  }
  return null
}
