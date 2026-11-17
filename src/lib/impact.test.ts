import { describe, expect, it } from 'vitest'

import { allocateCents, allocateWhole, describeChange, estimateImpact, impactShare, type RooftopSignal } from '@/lib/impact'
import { seed } from '@/mocks/db'

const signals: RooftopSignal[] = seed.dealers.map((dealer, i) => ({ dealer, findings: [6, 1, 4, 3, 5][i] ?? 0, scanned: [352, 205, 270, 218, 239][i] ?? 0 }))
const base = { affected_deals: 37, affected_dealers: 4, estimated_refund_exposure: 21486.1 }

describe('allocation', () => {
  it('splits whole numbers so the parts add up to the total', () => {
    for (const total of [0, 1, 7, 37, 143]) {
      const parts = allocateWhole(total, [3.2, 1, 0.4, 5.9, 2])
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
    }
    expect(allocateWhole(10, [1, 1])).toEqual([5, 5])
    expect(allocateWhole(5, [])).toEqual([])
  })

  it('splits cents without losing one', () => {
    const parts = allocateCents(21486.1, [10, 9, 9, 9])
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(2148610)
    expect(parts.every((p) => Math.round(p * 100) === p * 100 || Math.abs(p * 100 - Math.round(p * 100)) < 1e-9)).toBe(true)
  })
})

describe('estimateImpact for CA-CARS-ADDON-01', () => {
  const full = estimateImpact(base, 1, signals)

  it('keeps the headline numbers: 37 deals, 4 rooftops, $21,486.10', () => {
    expect(full).toMatchObject({ affected_deals: 37, affected_dealers: 4, estimated_refund_exposure: 21486.1 })
  })

  it('spreads them over the rooftops and the rows add up exactly', () => {
    expect(full.by_rooftop).toHaveLength(4)
    expect(full.by_rooftop.reduce((s, r) => s + r.deals, 0)).toBe(37)
    expect(Math.round(full.by_rooftop.reduce((s, r) => s + r.refund_exposure, 0) * 100)).toBe(2148610)
    expect(full.by_rooftop.every((r) => r.deals >= 1)).toBe(true)
    // The rooftop with the most findings and scans leads.
    expect(full.by_rooftop[0]?.dealer_id).toBe('DLR-01')
  })

  it('scales down with the share and still adds up', () => {
    const half = estimateImpact(base, 0.5, signals)
    expect(half.affected_deals).toBe(19)
    expect(half.by_rooftop.reduce((s, r) => s + r.deals, 0)).toBe(19)
    expect(Math.round(half.by_rooftop.reduce((s, r) => s + r.refund_exposure, 0) * 100)).toBe(Math.round(half.estimated_refund_exposure * 100))
    expect(half.estimated_refund_exposure).toBeCloseTo((21486.1 * 19) / 37, 2)
  })

  it('has no rooftops when nothing is affected', () => {
    expect(estimateImpact(base, 0, signals)).toEqual({ affected_deals: 0, affected_dealers: 0, estimated_refund_exposure: 0, by_rooftop: [] })
    expect(estimateImpact({ affected_deals: 0, affected_dealers: 0, estimated_refund_exposure: 0 }, 1, signals).by_rooftop).toEqual([])
  })

  it('never lists more rooftops than deals', () => {
    const tiny = estimateImpact(base, 0.05, signals)
    expect(tiny.affected_deals).toBe(2)
    expect(tiny.by_rooftop).toHaveLength(2)
  })
})

describe('impactShare', () => {
  const rule = { effective_from: '2026-10-01' }
  it('is 1 for the current effective date and for disabling the rule', () => {
    expect(impactShare({ type: 'effective_date', effective_date: '2026-10-01' }, rule, seed.scan_stats)).toBe(1)
    expect(impactShare({ type: 'disable' }, rule, seed.scan_stats)).toBe(1)
  })
  it('shrinks when the rule starts later and grows when it starts earlier', () => {
    const later = impactShare({ type: 'effective_date', effective_date: '2026-10-20' }, rule, seed.scan_stats)
    const earlier = impactShare({ type: 'effective_date', effective_date: '2026-09-20' }, rule, seed.scan_stats)
    expect(later).toBeLessThan(1)
    expect(later).toBeGreaterThan(0.4)
    expect(earlier).toBeGreaterThan(1)
    expect(impactShare({ type: 'effective_date', effective_date: '2026-12-01' }, rule, seed.scan_stats)).toBe(0)
  })
  it('a stricter threshold flags more, a looser one fewer', () => {
    expect(impactShare({ type: 'threshold', threshold_pct: 10 }, rule, seed.scan_stats)).toBeCloseTo(1.075, 5)
    expect(impactShare({ type: 'threshold', threshold_pct: -20 }, rule, seed.scan_stats)).toBeCloseTo(0.85, 5)
    expect(impactShare({ type: 'threshold', threshold_pct: 0 }, rule, seed.scan_stats)).toBe(1)
  })
})

describe('describeChange', () => {
  it('writes each change as a sentence', () => {
    const rule = { effective_from: '2026-10-01' }
    expect(describeChange({ type: 'effective_date', effective_date: '2026-10-15' }, rule)).toBe('Effective date moved from Oct 1, 2026 to Oct 15, 2026.')
    expect(describeChange({ type: 'threshold', threshold_pct: 10 }, rule)).toBe('Threshold made 10% stricter.')
    expect(describeChange({ type: 'threshold', threshold_pct: -5 }, rule)).toBe('Threshold made 5% looser.')
    expect(describeChange({ type: 'disable' }, rule)).toContain('Rule disabled')
  })
})
