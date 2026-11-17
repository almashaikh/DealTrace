import { PRODUCT_NAMES, PRODUCT_PROVIDER } from '@/lib/catalog'
import { amountFinanced, monthlyPayment, totalOfPayments } from '@/lib/finance'
import { pacificToIso } from '@/lib/format'
import type { DealEvent, DealVersion, EventType, Product, ProductCode } from '@/types'

/**
 * Builds a deal history (versions and events) from deal terms, with every payment computed by finance.ts.
 * The live sandbox and the synthetic data generator both use it, so both feed the real detectors.
 */

export interface PricedProduct {
  code: ProductCode
  price: number
}

export interface DealTerms {
  vehicle_price: number
  down_payment: number
  apr: number
  term_months: number
  products: PricedProduct[]
}

/** A product as it appears on a contract. GAP follows the loan term; the rest have their own terms. */
export function contractProduct(p: PricedProduct, loanTerm: number): Product {
  const base = { code: p.code, name: PRODUCT_NAMES[p.code], provider_id: PRODUCT_PROVIDER[p.code], price: p.price }
  switch (p.code) {
    case 'GAP':
      return { ...base, term_months: loanTerm }
    case 'VSC':
      return { ...base, term_months: 72, max_miles: 75000 }
    case 'PREPAID_MAINT':
      return { ...base, term_months: 36, max_miles: 36000 }
    default:
      return { ...base, term_months: 60 }
  }
}

export function amountFinancedFor(terms: DealTerms): number {
  return amountFinanced({ vehicle_price: terms.vehicle_price, down_payment: terms.down_payment, trade_in_value: 0, trade_in_payoff: 0, products: terms.products })
}

export class HistoryBuilder {
  readonly versions: DealVersion[] = []
  readonly events: DealEvent[] = []

  constructor(
    readonly dealId: string,
    readonly date: string,
    private terms: DealTerms,
    private readonly actor = 'U-03',
  ) {}

  get current(): DealTerms {
    return this.terms
  }

  /** Change the terms; the next snapshot records them. */
  set(terms: DealTerms): void {
    this.terms = terms
  }

  /** Records the current terms as a new version at `minute` minutes after midnight, Pacific time. */
  snapshot(minute: number, label: string, reason: string | null): number {
    const t = this.terms
    const financed = amountFinancedFor(t)
    this.versions.push({
      version: this.versions.length + 1,
      created_at: pacificToIso(this.date, minute),
      actor_id: this.actor,
      reason,
      vehicle_price: t.vehicle_price,
      down_payment: t.down_payment,
      trade_in_value: 0,
      trade_in_payoff: 0,
      amount_financed: financed,
      apr: t.apr,
      term_months: t.term_months,
      monthly_payment: monthlyPayment(financed, t.apr, t.term_months),
      total_of_payments: totalOfPayments(financed, t.apr, t.term_months),
      products: t.products.map((p) => contractProduct(p, t.term_months)),
      label,
    })
    return this.versions.length
  }

  event(minute: number, type: EventType, opts: { field?: string | null; old?: string | null; next?: string | null; reason?: string | null } = {}): void {
    this.events.push({
      id: `${this.dealId}-E${this.events.length + 1}`,
      deal_id: this.dealId,
      seq: this.events.length + 1,
      type,
      field: opts.field ?? null,
      old_value: opts.old ?? null,
      new_value: opts.next ?? null,
      actor_id: this.actor,
      reason: opts.reason ?? null,
      timestamp: pacificToIso(this.date, minute),
      version_after: this.versions.length,
      // Sandbox and synthetic events are not part of the audit chain.
      hash: '',
      prev_hash: '',
    })
  }
}
