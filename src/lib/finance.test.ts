import { describe, expect, it } from 'vitest'

import { amountFinanced, monthlyPayment, monthlyPaymentExact, totalInterest, totalOfPayments, whatIf } from '@/lib/finance'
import { heroDeal, version } from '@/test/hero'

describe('finance on the hero deal numbers', () => {
  it('computes the monthly payment for v1, v2 and v3', () => {
    expect(monthlyPayment(28000, 7.9, 60)).toBe(566.4)
    expect(monthlyPayment(31300, 7.9, 60)).toBe(633.15)
    expect(monthlyPayment(31300, 7.9, 72)).toBe(547.26)
  })

  it('computes total of payments from the unrounded payment', () => {
    expect(totalOfPayments(28000, 7.9, 60)).toBe(33984.0)
    expect(totalOfPayments(31300, 7.9, 60)).toBe(37989.25)
    expect(totalOfPayments(31300, 7.9, 72)).toBe(39402.96)
    // Using the rounded payment would give a different total.
    expect(Math.round(monthlyPayment(31300, 7.9, 72) * 72 * 100) / 100).not.toBe(totalOfPayments(31300, 7.9, 72))
  })

  it('computes total interest and amount financed', () => {
    expect(totalInterest(31300, 7.9, 72)).toBe(8102.96)
    expect(
      amountFinanced({
        vehicle_price: 34000,
        down_payment: 6000,
        trade_in_value: 0,
        trade_in_payoff: 0,
        products: [{ price: 900 }, { price: 2400 }],
      }),
    ).toBe(31300)
  })

  it('handles a 0% APR', () => {
    expect(monthlyPaymentExact(12000, 0, 48)).toBe(250)
    expect(totalOfPayments(12000, 0, 48)).toBe(12000)
  })

  it('rejects invalid input', () => {
    expect(() => monthlyPayment(10000, 5, 0)).toThrow(RangeError)
    expect(() => monthlyPayment(-1, 5, 60)).toThrow(RangeError)
  })

  it('matches every stored payment in the seed', () => {
    const { deal } = heroDeal()
    for (const v of deal.versions) {
      expect(monthlyPayment(v.amount_financed, v.apr, v.term_months)).toBe(v.monthly_payment)
      expect(totalOfPayments(v.amount_financed, v.apr, v.term_months)).toBe(v.total_of_payments)
    }
  })
})

describe('whatIf', () => {
  it('removing both add-ons and going back to 60 months returns to the original quote', () => {
    const { deal } = heroDeal()
    const r = whatIf(version(deal, 4), { removeProducts: ['GAP', 'VSC'], termMonths: 60 })
    expect(r.base.monthly_payment).toBe(547.26)
    expect(r.base.total_of_payments).toBe(39402.96)
    expect(r.scenario.amount_financed).toBe(28000)
    expect(r.scenario.monthly_payment).toBe(566.4)
    expect(r.scenario.total_of_payments).toBe(33984.0)
    expect(r.difference.total_of_payments).toBe(-5418.96)
    expect(r.removed_products.map((p) => p.code)).toEqual(['GAP', 'VSC'])
  })

  it('changing only the APR keeps the amount financed', () => {
    const { deal } = heroDeal()
    const r = whatIf(version(deal, 4), { apr: 6.9 })
    expect(r.scenario.amount_financed).toBe(31300)
    expect(r.scenario.monthly_payment).toBe(monthlyPayment(31300, 6.9, 72))
    expect(r.difference.total_interest).toBeLessThan(0)
  })
})
