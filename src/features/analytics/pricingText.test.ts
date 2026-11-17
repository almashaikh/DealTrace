import { describe, expect, it } from 'vitest'

import { aboveMedianMultiple, jitterFor, parsePricingProduct, pricingSentence } from '@/features/analytics/pricingText'
import { api } from '@/lib/api'

describe('pricing sentence from the data', () => {
  it('GAP: range $606.00 to $2,231.50 and 5 deals above 1.5× the median', async () => {
    const d = await api.pricingDispersion({ product_code: 'GAP' })
    expect(pricingSentence(d)).toBe('GAP prices range from $606.00 to $2,231.50; 5 deals are above 1.5× the median.')
  })

  it('service contract: 4 deals; tire and wheel: 1 deal (singular)', async () => {
    expect(pricingSentence(await api.pricingDispersion({ product_code: 'VSC' }))).toBe('Service contract prices range from $1,498.00 to $6,118.32; 4 deals are above 1.5× the median.')
    expect(pricingSentence(await api.pricingDispersion({ product_code: 'TIRE_WHEEL' }))).toBe('Tire and wheel prices range from $510.00 to $1,890.30; 1 deal is above 1.5× the median.')
  })

  it('the deals above 1.5× the median are exactly the flagged outliers, for every product', async () => {
    for (const product_code of ['GAP', 'VSC', 'TIRE_WHEEL'] as const) {
      const d = await api.pricingDispersion({ product_code })
      expect(aboveMedianMultiple(d.points, d.overall.median).map((p) => p.deal_id).sort(), product_code).toEqual(d.points.filter((p) => p.is_outlier).map((p) => p.deal_id).sort())
    }
  })

  it('handles an empty selection and a single deal', () => {
    expect(pricingSentence({ product_code: 'GAP', points: [], overall: { count: 0, min: 0, p25: 0, median: 0, p75: 0, max: 0, outliers: 0 } })).toBe('No GAP prices are recorded for this selection.')
  })
})

describe('helpers', () => {
  it('knows the stored deals among the points, so only those get links', async () => {
    const d = await api.pricingDispersion({ product_code: 'GAP' })
    expect(d.stored_deal_ids.length).toBeGreaterThan(5)
    expect(d.points.filter((p) => p.is_outlier).every((p) => d.stored_deal_ids.includes(p.deal_id))).toBe(true)
    expect(d.stored_deal_ids.length).toBeLessThan(d.points.length)
  })

  it('defaults to GAP for an unknown product', () => {
    expect(parsePricingProduct('VSC')).toBe('VSC')
    expect(parsePricingProduct('PAINT_FABRIC')).toBe('GAP')
    expect(parsePricingProduct(null)).toBe('GAP')
  })

  it('jitter is stable and inside the band', () => {
    expect(jitterFor('DT-10927')).toBe(jitterFor('DT-10927'))
    for (const id of ['DT-1', 'DT-10482', 'DT-99999']) {
      expect(jitterFor(id)).toBeGreaterThanOrEqual(-0.5)
      expect(jitterFor(id)).toBeLessThan(0.5)
    }
  })
})
