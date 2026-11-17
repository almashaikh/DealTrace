import { describe, expect, it } from 'vitest'

import {
  DEFAULT_QUEUE_STATE,
  HIGH_EXPOSURE_MIN,
  activeViewId,
  applyQueuePatch,
  hasActiveFilters,
  parseQueueState,
  savedViews,
  toApiQuery,
} from '@/features/queue/queueParams'

const params = (s: string) => new URLSearchParams(s)

describe('parseQueueState', () => {
  it('returns the defaults for an empty URL', () => {
    expect(parseQueueState(params(''))).toEqual(DEFAULT_QUEUE_STATE)
  })

  it('reads every parameter', () => {
    const s = parseQueueState(params('tab=resolved&severity=high,medium&type=LATE_ADD_ON,PRICE_OUTLIER&assignee=U-02&q=alvarez&minRefund=2000&sort=severity&dir=asc&page=3'))
    expect(s).toEqual({ tab: 'resolved', severity: ['high', 'medium'], type: ['LATE_ADD_ON', 'PRICE_OUTLIER'], assignee: 'U-02', q: 'alvarez', minRefund: 2000, sort: 'severity', dir: 'asc', page: 3 })
  })

  it('ignores invalid values instead of failing', () => {
    const s = parseQueueState(params('tab=nope&severity=high,urgent&type=X&sort=title&dir=up&page=-2&minRefund=abc'))
    expect(s).toEqual({ ...DEFAULT_QUEUE_STATE, severity: ['high'] })
  })
})

describe('applyQueuePatch', () => {
  it('writes only non-default values and keeps other parameters', () => {
    const next = applyQueuePatch(params('dealer=DLR-03'), { tab: 'in_review', severity: ['high'] })
    expect(next.toString()).toBe('dealer=DLR-03&tab=in_review&severity=high')
  })

  it('removes a parameter when it goes back to its default', () => {
    const next = applyQueuePatch(params('tab=resolved&sort=severity&dir=asc&page=2'), { tab: 'open', sort: 'refund_exposure', dir: 'desc' })
    expect(next.toString()).toBe('')
  })

  it('returns to page 1 when a filter changes, but keeps a page that is set explicitly', () => {
    expect(applyQueuePatch(params('page=3'), { q: 'gap' }).get('page')).toBeNull()
    expect(applyQueuePatch(params('tab=all'), { page: 2 }).toString()).toBe('tab=all&page=2')
  })

  it('round-trips through parse', () => {
    const state = { ...DEFAULT_QUEUE_STATE, tab: 'all' as const, type: ['MISSING_REASON' as const], minRefund: 1500, sort: 'detected_at' as const, page: 2 }
    expect(parseQueueState(applyQueuePatch(params(''), state))).toEqual(state)
  })
})

describe('toApiQuery', () => {
  it('maps tabs to statuses', () => {
    expect(toApiQuery(DEFAULT_QUEUE_STATE, null).filters.status).toBe('open')
    expect(toApiQuery({ ...DEFAULT_QUEUE_STATE, tab: 'in_review' }, null).filters.status).toEqual(['In review'])
    expect(toApiQuery({ ...DEFAULT_QUEUE_STATE, tab: 'all' }, null).filters.status).toBeUndefined()
  })

  it('adds the rooftop, filters and sort', () => {
    const q = toApiQuery({ ...DEFAULT_QUEUE_STATE, severity: ['high'], assignee: 'U-01', minRefund: 2000, q: ' gap ' }, 'DLR-01')
    expect(q.filters).toEqual({ status: 'open', severity: ['high'], dealer_id: 'DLR-01', assignee_id: 'U-01', min_refund: 2000, q: 'gap' })
    expect(q.sort).toEqual({ field: 'refund_exposure', direction: 'desc' })
  })
})

describe('saved views', () => {
  const views = savedViews('U-01')

  it('My open findings is open + assigned to me; High exposure sets the minimum refund', () => {
    expect(views.find((v) => v.id === 'my-open')?.patch).toMatchObject({ tab: 'open', assignee: 'U-01' })
    expect(views.find((v) => v.id === 'high-exposure')?.patch).toMatchObject({ tab: 'open', minRefund: HIGH_EXPOSURE_MIN })
  })

  it('recognises the active view from the URL state', () => {
    expect(activeViewId(DEFAULT_QUEUE_STATE, views)).toBe('all-open')
    expect(activeViewId({ ...DEFAULT_QUEUE_STATE, assignee: 'U-01' }, views)).toBe('my-open')
    expect(activeViewId({ ...DEFAULT_QUEUE_STATE, minRefund: HIGH_EXPOSURE_MIN }, views)).toBe('high-exposure')
    expect(activeViewId({ ...DEFAULT_QUEUE_STATE, assignee: 'U-01', severity: ['high'] }, views)).toBeNull()
  })

  it('reports active filters', () => {
    expect(hasActiveFilters(DEFAULT_QUEUE_STATE, null)).toBe(false)
    expect(hasActiveFilters(DEFAULT_QUEUE_STATE, 'DLR-01')).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_QUEUE_STATE, q: 'x' }, null)).toBe(true)
  })
})
