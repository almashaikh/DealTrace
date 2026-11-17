import { describe, expect, it } from 'vitest'

import { DEFAULT_DEALS_STATE, applyDealsPatch, hasActiveDealFilters, parseDealTab, parseDealsState, parseVersion, toDealsQuery } from '@/features/deals/dealsParams'

const params = (s: string) => new URLSearchParams(s)

describe('deals list URL state', () => {
  it('defaults to the Flagged deals tab sorted by risk score', () => {
    expect(parseDealsState(params(''))).toEqual(DEFAULT_DEALS_STATE)
  })

  it('reads and ignores bad values', () => {
    expect(parseDealsState(params('tab=all&status=Funded,Nope&q=rav4&sort=deal_date&dir=asc&page=2'))).toEqual({
      tab: 'all',
      status: ['Funded'],
      q: 'rav4',
      sort: 'deal_date',
      dir: 'asc',
      page: 2,
    })
    expect(parseDealsState(params('tab=x&sort=y&dir=z&page=0'))).toEqual(DEFAULT_DEALS_STATE)
  })

  it('writes only non-defaults, keeps ?dealer=, and resets the page on a change', () => {
    expect(applyDealsPatch(params('dealer=DLR-02&page=2'), { tab: 'all' }).toString()).toBe('dealer=DLR-02&tab=all')
    expect(applyDealsPatch(params('tab=all'), { tab: 'flagged' }).toString()).toBe('')
    expect(applyDealsPatch(params(''), { page: 2 }).toString()).toBe('page=2')
  })

  it('maps state to api arguments', () => {
    expect(toDealsQuery({ ...DEFAULT_DEALS_STATE, status: ['On hold'], q: ' alvarez ' }, 'DLR-01')).toEqual({
      filters: { status: ['On hold'], dealer_id: 'DLR-01', q: 'alvarez' },
      sort: { field: 'risk_score', direction: 'desc' },
    })
    expect(hasActiveDealFilters(DEFAULT_DEALS_STATE, null)).toBe(false)
    expect(hasActiveDealFilters(DEFAULT_DEALS_STATE, 'DLR-01')).toBe(true)
  })
})

describe('deal detail URL state', () => {
  it('keeps the tab and falls back to Overview', () => {
    expect(parseDealTab('timeline')).toBe('timeline')
    expect(parseDealTab('nope')).toBe('overview')
    expect(parseDealTab(null)).toBe('overview')
  })

  it('keeps versions inside the deal', () => {
    expect(parseVersion('3', 4, 1)).toBe(3)
    expect(parseVersion('9', 4, 1)).toBe(1)
    expect(parseVersion(null, 4, 4)).toBe(4)
  })
})
