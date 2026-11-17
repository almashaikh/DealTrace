import type { DealFilters, DealSortField, DealStatus, Sort, SortDirection } from '@/types'

/** The deals list keeps its tab, filters, search, sort and page in the URL. The rooftop is the global ?dealer=. */

export type DealsTab = 'flagged' | 'all'

export interface DealsState {
  tab: DealsTab
  status: DealStatus[]
  q: string
  sort: DealSortField
  dir: SortDirection
  page: number
}

export const DEFAULT_DEALS_STATE: DealsState = { tab: 'flagged', status: [], q: '', sort: 'risk_score', dir: 'desc', page: 1 }

export const DEAL_STATUSES: readonly DealStatus[] = ['In review', 'Ready to fund', 'Funded', 'On hold']
const SORT_FIELDS: readonly DealSortField[] = ['risk_score', 'deal_date', 'refund_exposure', 'customer_exposure', 'open_findings']

export function parseDealsState(params: URLSearchParams): DealsState {
  const tab = params.get('tab')
  const sort = params.get('sort')
  const dir = params.get('dir')
  const page = Number(params.get('page'))
  const status = (params.get('status') ?? '').split(',').filter((s): s is DealStatus => (DEAL_STATUSES as readonly string[]).includes(s))
  return {
    tab: tab === 'all' ? 'all' : 'flagged',
    status,
    q: params.get('q') ?? '',
    sort: SORT_FIELDS.includes(sort as DealSortField) ? (sort as DealSortField) : DEFAULT_DEALS_STATE.sort,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_DEALS_STATE.dir,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/** Applies a change to the URL: defaults are left out, other parameters are kept, and the page resets unless set. */
export function applyDealsPatch(prev: URLSearchParams, patch: Partial<DealsState>): URLSearchParams {
  const state: DealsState = { ...parseDealsState(prev), ...patch }
  if (!('page' in patch)) state.page = 1
  const next = new URLSearchParams(prev)
  const d = DEFAULT_DEALS_STATE
  const put = (key: string, value: string, isDefault: boolean) => (isDefault || value === '' ? next.delete(key) : next.set(key, value))
  put('tab', state.tab, state.tab === d.tab)
  put('status', state.status.join(','), state.status.length === 0)
  put('q', state.q.trim(), state.q.trim() === '')
  put('sort', state.sort, state.sort === d.sort)
  put('dir', state.dir, state.dir === d.dir)
  put('page', String(state.page), state.page === 1)
  return next
}

export function toDealsQuery(state: DealsState, dealerId: string | null): { filters: DealFilters; sort: Sort<DealSortField> } {
  const filters: DealFilters = {}
  if (state.status.length) filters.status = state.status
  if (dealerId) filters.dealer_id = dealerId
  if (state.q.trim()) filters.q = state.q.trim()
  return { filters, sort: { field: state.sort, direction: state.dir } }
}

export function hasActiveDealFilters(state: DealsState, dealerId: string | null): boolean {
  return state.status.length > 0 || state.q.trim() !== '' || dealerId !== null
}

/* ---------------- Deal detail tabs ---------------- */

export type DealTab = 'overview' | 'timeline' | 'versions' | 'benefit' | 'whatif' | 'graph' | 'activity'

export const DEAL_TABS: readonly { key: DealTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'versions', label: 'Versions & diff' },
  { key: 'benefit', label: 'Benefit checks' },
  { key: 'whatif', label: 'What-if' },
  { key: 'graph', label: 'Dependency graph' },
  { key: 'activity', label: 'Activity' },
]

export function parseDealTab(raw: string | null): DealTab {
  return DEAL_TABS.find((t) => t.key === raw)?.key ?? 'overview'
}

/** A version number from the URL, kept inside 1..max. */
export function parseVersion(raw: string | null, max: number, fallback: number): number {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback
}
