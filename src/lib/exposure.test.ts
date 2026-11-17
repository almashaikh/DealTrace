import { describe, expect, it } from 'vitest'

import { dealRefundExposure, findingProductCodes } from '@/lib/exposure'
import { seed } from '@/mocks/db'
import { heroDeal } from '@/test/hero'

const hero = heroDeal()
const heroFindings = seed.findings.filter((f) => f.deal_id === 'DT-10482')
const final = hero.deal.versions[hero.deal.versions.length - 1]!.products

describe('findingProductCodes', () => {
  it('reads products from the finding text', () => {
    expect(heroFindings.map((f) => findingProductCodes(f))).toEqual([['GAP', 'VSC'], [], ['VSC'], []])
  })
})

describe('dealRefundExposure', () => {
  it('matches the stored hero exposure with all four findings open', () => {
    expect(dealRefundExposure(heroFindings, final)).toBe(3300)
  })

  it('counts the service contract once while any finding still claims it', () => {
    const [lateAddOn, , overlap] = heroFindings
    expect(dealRefundExposure([overlap!], final)).toBe(2400)
    expect(dealRefundExposure([lateAddOn!], final)).toBe(3300)
    expect(dealRefundExposure([], final)).toBe(0)
  })

  it('matches the stored exposure of every seeded deal', () => {
    for (const d of seed.deals) {
      const open = seed.findings.filter((f) => f.deal_id === d.id && (f.status === 'Open' || f.status === 'In review'))
      expect(dealRefundExposure(open, d.versions[d.versions.length - 1]!.products)).toBe(d.refund_exposure)
    }
  })
})
