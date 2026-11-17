import { describe, expect, it } from 'vitest'

import { explainVerdict } from '@/features/deals/benefitText'
import { seed } from '@/mocks/db'
import { heroDeal } from '@/test/hero'

const { deal } = heroDeal()
const final = deal.versions[deal.versions.length - 1]!
const check = (code: string) => seed.benefit_checks.find((b) => b.deal_id === deal.id && b.product_code === code)!

describe('explainVerdict on the hero deal', () => {
  it('explains GAP from the loan-to-value of 92%', () => {
    const lines = explainVerdict(check('GAP'), final.products.find((p) => p.code === 'GAP'), deal.vehicle)
    expect(lines[0]).toContain('Loan-to-value at signing is 92%')
    expect(lines.at(-1)).toBe('DealTrace scores this 84 out of 100, from 0 (no benefit to this buyer) to 100 (likely to pay off). The verdict is likely benefit.')
  })

  it('explains the service contract from the 36-month overlap', () => {
    const lines = explainVerdict(check('VSC'), final.products.find((p) => p.code === 'VSC'), deal.vehicle)
    expect(lines[0]).toContain('already covers 36 of the 72 contract months')
    expect(lines[1]).toContain('75,000 miles')
  })

  it('writes text for every seeded check without placeholders', () => {
    for (const c of seed.benefit_checks) {
      const d = seed.deals.find((x) => x.id === c.deal_id)!
      const p = d.versions[d.versions.length - 1]!.products.find((x) => x.code === c.product_code)
      expect(explainVerdict(c, p, d.vehicle).join(' ')).not.toMatch(/undefined|NaN/)
    }
  })
})
