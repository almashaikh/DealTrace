import { describe, expect, it } from 'vitest'

import { downstreamOf, explainChange, inputsFromVersion, recalculate, topologicalOrder } from '@/lib/graph'
import { seed } from '@/mocks/db'
import { heroDeal, version } from '@/test/hero'

describe('dependency graph', () => {
  it('orders inputs before amount financed, payment and total', () => {
    const order = topologicalOrder()
    expect(order.indexOf('products')).toBeLessThan(order.indexOf('amount_financed'))
    expect(order.indexOf('amount_financed')).toBeLessThan(order.indexOf('monthly_payment'))
    expect(order.indexOf('monthly_payment')).toBeLessThan(order.indexOf('total_of_payments'))
  })

  it('throws on a cycle', () => {
    expect(() =>
      topologicalOrder(
        [
          { id: 'apr', label: 'APR', kind: 'input', unit: 'percent' },
          { id: 'term_months', label: 'Term', kind: 'input', unit: 'months' },
        ],
        [
          { from: 'apr', to: 'term_months' },
          { from: 'term_months', to: 'apr' },
        ],
      ),
    ).toThrow(/cycle/)
  })

  it('recalculates every stored version in the seed exactly', () => {
    for (const deal of seed.deals) {
      for (const v of deal.versions) {
        const values = recalculate(inputsFromVersion(v))
        expect(values.amount_financed).toBe(v.amount_financed)
        expect(values.monthly_payment).toBe(v.monthly_payment)
        expect(values.total_of_payments).toBe(v.total_of_payments)
      }
    }
  })

  it('knows what a term change affects', () => {
    expect(downstreamOf(['term_months'])).toEqual(['monthly_payment', 'total_of_payments'])
  })

  it('writes the payment headline for the hero deal', () => {
    const { deal } = heroDeal()
    const v = (n: number) => version(deal, n)
    // v2 to v3: the products were added earlier, the term is what moved the payment.
    expect(explainChange(v(2), v(3), v(1)).headline).toBe('Payment fell $85.89 because the term rose from 60 to 72 months, even though $3,300.00 of products was added.')
    // v1 to v3: the products are added in the same step.
    expect(explainChange(v(1), v(3), v(1)).headline).toBe('Payment fell $19.14 because the term rose from 60 to 72 months, even though $3,300.00 of products was added.')
    // v1 to v2: the products raise the payment.
    expect(explainChange(v(1), v(2), v(1)).headline).toBe('Payment rose $66.75 because $3,300.00 of products was added.')
    expect(explainChange(v(3), v(4), v(1)).headline).toBe('Payment did not change between v3 and v4.')
  })

  it('names an APR increase as the cause of a higher payment', () => {
    const { deal } = heroDeal()
    const v3 = version(deal, 3)
    const higher = { ...v3, version: 9, apr: 8.9, monthly_payment: 559.1 }
    expect(explainChange(v3, higher, version(deal, 1)).headline).toBe('Payment rose $11.84 because the APR rose from 7.9% to 8.9%.')
  })

  it('explains the hero deal from v1 to v3 in plain English', () => {
    const { deal } = heroDeal()
    const e = explainChange(version(deal, 1), version(deal, 3))
    expect(e.changed_inputs).toEqual(['products', 'term_months'])
    expect(e.affected).toEqual(['amount_financed', 'monthly_payment', 'total_of_payments'])
    expect(e.summary).toBe('From v1 to v3, the monthly payment fell by $19.14 and the total of payments rose by $5,418.96.')
    expect(e.sentences).toContain('Term changed from 60 months to 72 months.')
    expect(e.sentences[0]).toBe(
      'Add-on products went from $0.00 to $3,300.00: added GAP waiver ($900.00), added service contract ($2,400.00).',
    )
  })
})
