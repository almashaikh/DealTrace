import { describe, expect, it } from 'vitest'

import { DEFAULT_AUDIT_STATE, applyAuditPatch, entityHref, hasAuditFilters, headLabel, parseAuditState, toAuditFilters } from '@/features/audit/auditParams'

const params = (s: string) => new URLSearchParams(s)

describe('audit URL state', () => {
  it('defaults to no filters on page 1', () => {
    expect(parseAuditState(params(''))).toEqual(DEFAULT_AUDIT_STATE)
  })

  it('reads the filters and ignores a malformed date', () => {
    expect(parseAuditState(params('actor=U-01&action=Rule%20disabled&from=2026-10-20&to=tomorrow&page=3'))).toEqual({
      actor: 'U-01',
      action: 'Rule disabled',
      from: '2026-10-20',
      to: null,
      page: 3,
    })
  })

  it('writes only what is set, keeps other parameters such as ?tamper=1, and resets the page', () => {
    expect(applyAuditPatch(params('tamper=1&page=4'), { actor: 'U-02' }).toString()).toBe('tamper=1&actor=U-02')
    expect(applyAuditPatch(params('actor=U-02'), { actor: null }).toString()).toBe('')
    expect(applyAuditPatch(params(''), { page: 2 }).toString()).toBe('page=2')
  })

  it('maps state to api filters', () => {
    expect(toAuditFilters({ actor: 'U-01', action: 'Decision recorded', from: '2026-10-01', to: '2026-10-31', page: 1 })).toEqual({
      actor_id: 'U-01',
      action: 'Decision recorded',
      from: '2026-10-01',
      to: '2026-10-31',
    })
    expect(hasAuditFilters(DEFAULT_AUDIT_STATE)).toBe(false)
    expect(hasAuditFilters({ ...DEFAULT_AUDIT_STATE, from: '2026-10-01' })).toBe(true)
  })
})

describe('helpers', () => {
  it('shortens a head hash to four characters at each end', () => {
    expect(headLabel('9f3c0000000000000000000000000000000000000000000000000000000fa17e')).toBe('9f3c…a17e')
  })
  it('links entities to their pages', () => {
    expect(entityHref('deal', 'DT-10482')).toBe('/deals/DT-10482')
    expect(entityHref('finding', 'F-2291')).toBe('/findings/F-2291')
    expect(entityHref('rule', 'CA-GAP-LTV-01')).toBe('/rules?rule=CA-GAP-LTV-01')
    expect(entityHref('user', 'U-01')).toBeNull()
    expect(entityHref('report', 'RPT-1107')).toBeNull()
  })
})
