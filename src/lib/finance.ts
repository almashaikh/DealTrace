import { PRODUCT_NAMES } from '@/lib/catalog'
import type { DealVersion, LoanFigures, Product, WhatIfParams, WhatIfResult } from '@/types'

/** Round to cents, avoiding binary floating point drift (1.005 -> 1.01). */
export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Unrounded monthly payment, standard amortisation:
 *   payment = P·r / (1 − (1 + r)^−n), r = APR / 12
 * `aprPercent` is the annual rate in percent (7.9 means 7.9%).
 */
export function monthlyPaymentExact(principal: number, aprPercent: number, termMonths: number): number {
  if (!Number.isFinite(principal) || principal < 0) throw new RangeError('principal must be a non-negative number')
  if (!Number.isInteger(termMonths) || termMonths <= 0) throw new RangeError('termMonths must be a positive integer')
  if (!Number.isFinite(aprPercent) || aprPercent < 0) throw new RangeError('apr must be a non-negative number')
  const r = aprPercent / 100 / 12
  if (r === 0) return principal / termMonths
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths))
}

/** Monthly payment rounded to cents (what the customer sees). */
export function monthlyPayment(principal: number, aprPercent: number, termMonths: number): number {
  return roundCents(monthlyPaymentExact(principal, aprPercent, termMonths))
}

/** Total of payments = UNROUNDED payment × term, rounded to cents. */
export function totalOfPayments(principal: number, aprPercent: number, termMonths: number): number {
  return roundCents(monthlyPaymentExact(principal, aprPercent, termMonths) * termMonths)
}

/** Finance charge = total of payments − amount financed. */
export function totalInterest(principal: number, aprPercent: number, termMonths: number): number {
  return roundCents(totalOfPayments(principal, aprPercent, termMonths) - principal)
}

export function productsTotal(products: readonly Pick<Product, 'price'>[]): number {
  return roundCents(products.reduce((sum, p) => sum + p.price, 0))
}

export interface FinancedInputs {
  vehicle_price: number
  down_payment: number
  trade_in_value: number
  trade_in_payoff: number
  products: readonly Pick<Product, 'price'>[]
}

/** Amount financed = price − down payment − trade-in value + trade-in payoff + add-on products. */
export function amountFinanced(inputs: FinancedInputs): number {
  return roundCents(
    inputs.vehicle_price -
      inputs.down_payment -
      inputs.trade_in_value +
      inputs.trade_in_payoff +
      productsTotal(inputs.products),
  )
}

export function loanFigures(principal: number, aprPercent: number, termMonths: number): LoanFigures {
  const top = totalOfPayments(principal, aprPercent, termMonths)
  return {
    amount_financed: roundCents(principal),
    apr: aprPercent,
    term_months: termMonths,
    monthly_payment: monthlyPayment(principal, aprPercent, termMonths),
    total_of_payments: top,
    total_interest: roundCents(top - principal),
  }
}

/** Loan figures recomputed from a version's own amount financed, APR and term. */
export function versionFigures(version: Pick<DealVersion, 'amount_financed' | 'apr' | 'term_months'>): LoanFigures {
  return loanFigures(version.amount_financed, version.apr, version.term_months)
}

/**
 * What-if: remove products, change the term or the APR, and compare with the version as signed.
 * Removing a product lowers the amount financed by its price.
 */
export function whatIf(version: DealVersion, params: WhatIfParams): WhatIfResult {
  const base = versionFigures(version)
  const removeCodes = new Set(params.removeProducts ?? [])
  const removed = version.products.filter((p) => removeCodes.has(p.code))
  const principal = roundCents(base.amount_financed - productsTotal(removed))
  const scenario = loanFigures(principal, params.apr ?? version.apr, params.termMonths ?? version.term_months)
  return {
    base,
    scenario,
    removed_products: removed.map((p) => ({ code: p.code, name: PRODUCT_NAMES[p.code], price: p.price })),
    difference: {
      amount_financed: roundCents(scenario.amount_financed - base.amount_financed),
      monthly_payment: roundCents(scenario.monthly_payment - base.monthly_payment),
      total_of_payments: roundCents(scenario.total_of_payments - base.total_of_payments),
      total_interest: roundCents(scenario.total_interest - base.total_interest),
    },
  }
}
