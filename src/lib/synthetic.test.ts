import { describe, expect, it } from 'vitest'

import { SYNTHETIC_DEFAULTS, SYNTHETIC_DETECTORS, SYNTHETIC_STEPS, dealsCsvRows, generateDeals, quotePayment, runSynthetic, scoreDeals, stepIndexAt } from '@/lib/synthetic'
import { totalOfPayments } from '@/lib/finance'
import type { SyntheticJobParams } from '@/types'

const params: SyntheticJobParams = { ...SYNTHETIC_DEFAULTS, detectors: [...SYNTHETIC_DETECTORS] }

describe('generateDeals', () => {
  const deals = generateDeals(params)

  it('is deterministic: the same settings and seed give the same deals', () => {
    expect(generateDeals(params)).toEqual(deals)
    expect(generateDeals({ ...params, seed: 43 })).not.toEqual(deals)
  })

  it('makes the number of deals asked for, each with at least a quote and a signed version', () => {
    expect(deals).toHaveLength(480)
    expect(deals.every((d) => d.versions.length >= 2 && d.versions[d.versions.length - 1]?.label === 'Contract signed')).toBe(true)
    expect(new Set(deals.map((d) => d.id)).size).toBe(480)
  })

  it('computes every payment and total with finance.ts', () => {
    for (const d of deals.slice(0, 80)) {
      for (const v of d.versions) {
        expect(v.total_of_payments).toBe(totalOfPayments(v.amount_financed, v.apr, v.term_months))
      }
      expect(quotePayment(d)).toBe(d.versions[0]?.monthly_payment)
    }
  })

  it('follows the rates it is given', () => {
    const big = scoreDeals(generateDeals({ ...params, deal_count: 4000 }), { ...params, deal_count: 4000 })
    expect(big.actual.gap_rate).toBeGreaterThan(0.37)
    expect(big.actual.gap_rate).toBeLessThan(0.43)
    expect(big.actual.vsc_rate).toBeGreaterThan(0.42)
    expect(big.actual.vsc_rate).toBeLessThan(0.48)
    expect(big.actual.issue_rate).toBeGreaterThan(0.16)
    expect(big.actual.issue_rate).toBeLessThan(0.2)
    expect(big.actual.products_per_deal).toBeGreaterThan(1.45)
    expect(big.actual.products_per_deal).toBeLessThan(1.7)
  })

  it('has no products when the rates and the average are zero', () => {
    const none = generateDeals({ ...params, deal_count: 200, products_per_deal: 0, gap_rate: 0, vsc_rate: 0 })
    expect(none.every((d) => d.versions[0]?.products.length === 0)).toBe(true)
  })
})

describe('the real detectors on generated deals', () => {
  const big = { ...params, deal_count: 3000 }
  const deals = generateDeals(big)
  const result = scoreDeals(deals, big)

  it('find nearly all injected issues, with a few honest misses and false alarms', () => {
    expect(result.recall).toBeGreaterThan(0.93)
    expect(result.recall).toBeLessThan(1)
    expect(result.precision).toBeGreaterThan(0.9)
    expect(result.precision).toBeLessThan(1)
    expect(result.false_negatives).toBeGreaterThan(0)
    expect(result.false_positives).toBeGreaterThan(0)
  })

  it('catches each kind of issue it injects', () => {
    for (const row of result.per_detector) {
      expect(row.injected, row.detector).toBeGreaterThan(50)
      expect(row.true_positives / row.injected, row.detector).toBeGreaterThan(0.9)
    }
  })

  it('has counts that add up', () => {
    expect(result.issues_detected).toBe(result.true_positives + result.false_positives)
    expect(result.issues_injected).toBe(result.true_positives + result.false_negatives)
    expect(result.per_detector.reduce((s, r) => s + r.injected, 0)).toBe(result.issues_injected)
    expect(result.per_detector.reduce((s, r) => s + r.true_positives, 0)).toBe(result.true_positives)
    expect(result.f1).toBeCloseTo((2 * result.precision * result.recall) / (result.precision + result.recall), 2)
  })

  it('flags nothing on most clean deals', () => {
    const clean = deals.filter((d) => d.injected.length === 0)
    expect(clean.filter((d) => d.detected.length === 0).length / clean.length).toBeGreaterThan(0.97)
  })

  it('runSynthetic gives the same result as generating and scoring', () => {
    expect(runSynthetic(big)).toEqual(result)
  })

  it('scores only the detectors that are switched on', () => {
    const one = scoreDeals(deals, { ...big, detectors: ['RATE_AFTER_APPROVAL'] })
    expect(one.per_detector.map((r) => r.detector)).toEqual(['RATE_AFTER_APPROVAL'])
    expect(one.issues_injected).toBeLessThan(result.issues_injected)
  })
})

describe('steps and CSV rows', () => {
  it('names the five steps in order and maps progress to them', () => {
    expect(SYNTHETIC_STEPS.map((s) => s.label)).toEqual(['Sampling vehicles', 'Building versions', 'Injecting issues', 'Computing payments', 'Writing events'])
    expect([0, 19, 20, 44, 45, 64, 65, 84, 85, 99, 100].map(stepIndexAt)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4])
  })

  it('makes one row per deal from its signed version', () => {
    const deals = generateDeals({ ...params, deal_count: 30 })
    const rows = dealsCsvRows(deals)
    expect(rows).toHaveLength(30)
    const r = rows[0]!
    const v = deals[0]!.versions[deals[0]!.versions.length - 1]!
    expect(r).toMatchObject({ deal: 'SD-00001', monthly_payment: v.monthly_payment, total_of_payments: v.total_of_payments, versions: deals[0]!.versions.length })
  })
})
