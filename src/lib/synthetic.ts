import { PRODUCT_NAMES, PRODUCT_PRICE_RANGES } from '@/lib/catalog'
import { runDetectors } from '@/lib/detectors'
import { amountFinancedFor, HistoryBuilder, type DealTerms, type PricedProduct } from '@/lib/history'
import { roundCents, monthlyPayment } from '@/lib/finance'
import { createRng, type Rng } from '@/lib/prng'
import type { DealVersion, DetectorType, ProductCode, SyntheticJobParams, SyntheticJobResult } from '@/types'

/**
 * Synthetic deal generator. It builds deals with known injected issues, runs the real detectors on them and scores
 * the result. The same settings and seed always give the same data.
 */

export const SYNTHETIC_DETECTORS: readonly DetectorType[] = ['LATE_ADD_ON', 'PAYMENT_MASKING', 'RATE_AFTER_APPROVAL', 'MISSING_REASON']

/** The steps the job shows, with the progress (0 to 100) at which each one ends. */
export const SYNTHETIC_STEPS = [
  { key: 'sampling', label: 'Sampling vehicles', until: 20 },
  { key: 'versions', label: 'Building versions', until: 45 },
  { key: 'injecting', label: 'Injecting issues', until: 65 },
  { key: 'payments', label: 'Computing payments', until: 85 },
  { key: 'events', label: 'Writing events', until: 100 },
] as const

/** Index of the step running at a given progress. */
export function stepIndexAt(progress: number): number {
  const i = SYNTHETIC_STEPS.findIndex((s) => progress < s.until)
  return i === -1 ? SYNTHETIC_STEPS.length - 1 : i
}

export const SYNTHETIC_DEFAULTS: Omit<SyntheticJobParams, 'detectors'> = {
  deal_count: 480,
  products_per_deal: 1.57,
  vsc_rate: 0.45,
  gap_rate: 0.4,
  issue_rate: 0.18,
  seed: 42,
}

export const SYNTHETIC_LIMITS = {
  deal_count: { min: 100, max: 5000, step: 50 },
  products_per_deal: { min: 0.5, max: 3, step: 0.01 },
  rate: { min: 0, max: 1, step: 0.01 },
  issue_rate: { min: 0.02, max: 0.5, step: 0.01 },
} as const

const DEALERS = ['DLR-01', 'DLR-02', 'DLR-03', 'DLR-04', 'DLR-05']
const MINOR_PRODUCTS: ProductCode[] = ['TIRE_WHEEL', 'PAINT_FABRIC', 'PREPAID_MAINT', 'THEFT_ETCH']
const TERMS = [48, 60, 72, 84]

/** Minutes after midnight for the steps of a deal day (Pacific time). */
const T = { quote: 600, change: 610, agreed: 615, approved: 625, edit: 645, signed: 675 } as const

export interface SyntheticDeal {
  id: string
  dealer_id: string
  deal_date: string
  versions: DealVersion[]
  /**
   * The issues the deal really has. An injected issue, plus payment masking when a late add-on moves the
   * payment by less than 5% (the definition of masking), which is how the hero deal looks.
   */
  injected: DetectorType[]
  /** What the detectors flagged. */
  detected: DetectorType[]
}

function unround(n: number): number {
  return n % 50 === 0 ? n + 7 : n
}

function pickProducts(rng: Rng, p: SyntheticJobParams): PricedProduct[] {
  const codes: ProductCode[] = []
  if (rng.chance(p.gap_rate)) codes.push('GAP')
  if (rng.chance(p.vsc_rate)) codes.push('VSC')
  // The rest of the target average is spread over the four minor products.
  const minor = Math.max(0, Math.min(1, (p.products_per_deal - p.gap_rate - p.vsc_rate) / MINOR_PRODUCTS.length))
  for (const c of MINOR_PRODUCTS) if (rng.chance(minor)) codes.push(c)
  return codes.map((code) => {
    const [lo, hi] = PRODUCT_PRICE_RANGES[code]
    return { code, price: unround(rng.int(lo, hi)) }
  })
}

function nextTerm(term: number): number {
  return TERMS.find((t) => t > term) ?? term
}

interface Plan {
  issue: DetectorType | null
  /** A documented, customer-requested term extension. It looks like payment masking, and the detector cannot tell. */
  legitExtension: boolean
  /** The price-agreed event is missing from the log, so a late add-on cannot be seen. */
  droppedAgreement: boolean
  /** A price change before the price was agreed, with a recorded reason. Harmless. */
  documentedPriceChange: boolean
}

function planDeal(rng: Rng, p: SyntheticJobParams): Plan {
  const issue = rng.chance(p.issue_rate) ? rng.pick(SYNTHETIC_DETECTORS) : null
  return {
    issue,
    legitExtension: issue === null && rng.chance(0.006),
    droppedAgreement: issue === 'LATE_ADD_ON' && rng.chance(0.08),
    documentedPriceChange: issue === null && rng.chance(0.25),
  }
}

/** Builds one deal's history: quote, price agreed, credit approved, then the planned changes, then signing. */
function buildDeal(rng: Rng, index: number, p: SyntheticJobParams): SyntheticDeal {
  const plan = planDeal(rng, p)
  const price = unround(rng.int(19000, 62000))
  const terms: DealTerms = {
    vehicle_price: price,
    down_payment: unround(Math.round(price * rng.float(0.04, 0.2, 4))),
    apr: rng.float(4.9, 13.9, 1),
    // A term extension needs a longer term to move to, so those deals start below 84 months.
    term_months: rng.pick(plan.issue === 'PAYMENT_MASKING' || plan.legitExtension ? TERMS.slice(0, 3) : TERMS),
    products: pickProducts(rng, p),
  }
  const day = rng.int(1, 43) // Oct 1 to Nov 12
  const date = day <= 31 ? `2026-10-${String(day).padStart(2, '0')}` : `2026-11-${String(day - 31).padStart(2, '0')}`
  const id = `SD-${String(index + 1).padStart(5, '0')}`
  const h = new HistoryBuilder(id, date, terms)
  const injected: DetectorType[] = plan.issue ? [plan.issue] : []

  h.snapshot(T.quote, 'Quote', 'Initial quote')
  h.event(T.quote, 'QUOTE_CREATED', { field: 'vehicle_price', next: String(price), reason: 'Initial quote' })

  // Before the price is agreed: a change with a reason (harmless), or one without (missing reason).
  if (plan.issue === 'MISSING_REASON' || plan.documentedPriceChange) {
    const cut = unround(rng.int(250, 1400))
    h.set({ ...terms, vehicle_price: price - cut })
    const reason = plan.issue === 'MISSING_REASON' ? null : 'Matched a competing offer'
    h.snapshot(T.change, 'Price revised', reason)
    h.event(T.change, 'PRICE_CHANGED', { field: 'vehicle_price', old: String(price), next: String(price - cut), reason })
  }
  if (!plan.droppedAgreement) h.event(T.agreed, 'PRICE_AGREED', { field: 'vehicle_price', next: String(h.current.vehicle_price), reason: 'Customer accepted price' })
  h.event(T.approved, 'CREDIT_APPROVED', { field: 'apr', next: String(terms.apr), reason: 'Approved by the lender' })

  const base = h.current
  if (plan.issue === 'LATE_ADD_ON') {
    // Add the product that moves the payment by 5% or more, so the add-on cannot be put down to a rounding difference.
    const have = new Set(base.products.map((x) => x.code))
    const candidates = (Object.keys(PRODUCT_NAMES) as ProductCode[]).filter((c) => !have.has(c)).sort((a, b) => PRODUCT_PRICE_RANGES[b][1] - PRODUCT_PRICE_RANGES[a][1])
    const code = candidates[0] ?? 'THEFT_ETCH'
    const [lo, hi] = PRODUCT_PRICE_RANGES[code]
    const added: PricedProduct = { code, price: unround(rng.int(Math.round((lo + hi) / 2), hi)) }
    const after = { ...base, products: [...base.products, added] }
    // Ground truth for masking, from the definition: the payment rose by less than 5%.
    const before = monthlyPayment(amountFinancedFor(base), base.apr, base.term_months)
    const now = monthlyPayment(amountFinancedFor(after), after.apr, after.term_months)
    if ((now - before) / before < 0.05) injected.push('PAYMENT_MASKING')
    h.set(after)
    h.snapshot(T.edit, 'Add-on added', 'Customer asked for coverage')
    h.event(T.edit, 'PRODUCT_ADDED', { field: 'products', next: code, reason: 'Customer asked for coverage' })
  } else if (plan.issue === 'PAYMENT_MASKING' || plan.legitExtension) {
    const longer = nextTerm(base.term_months)
    const reason = plan.legitExtension ? 'Customer asked for a lower payment' : 'Lender offered a longer term'
    h.set({ ...base, term_months: longer })
    h.snapshot(T.edit, 'Term extended', reason)
    h.event(T.edit, 'TERM_CHANGED', { field: 'term_months', old: String(base.term_months), next: String(longer), reason })
  } else if (plan.issue === 'RATE_AFTER_APPROVAL') {
    const raised = roundCents(base.apr + rng.float(0.5, 2, 2))
    h.set({ ...base, apr: raised })
    h.snapshot(T.edit, 'Rate changed', 'Lender re-tiered the buyer')
    h.event(T.edit, 'RATE_CHANGED', { field: 'apr', old: String(base.apr), next: String(raised), reason: 'Lender re-tiered the buyer' })
  }

  h.snapshot(T.signed, 'Contract signed', null)
  h.event(T.signed, 'CONTRACT_SIGNED')

  const detected = [...new Set(runDetectors({ versions: h.versions, events: h.events }).map((f) => f.type as DetectorType))]
  return { id, dealer_id: rng.pick(DEALERS), deal_date: date, versions: h.versions, injected, detected }
}

/** Generates the deals for a job. Deterministic: the same params always give the same deals. */
export function generateDeals(params: SyntheticJobParams): SyntheticDeal[] {
  const rng = createRng(params.seed)
  return Array.from({ length: params.deal_count }, (_, i) => buildDeal(rng, i, params))
}

function ratio(num: number, den: number): number {
  return den === 0 ? 0 : num / den
}

const r3 = (x: number) => Math.round(x * 1000) / 1000

/** Scores the detectors against the injected issues. */
export function scoreDeals(deals: readonly SyntheticDeal[], params: SyntheticJobParams): SyntheticJobResult {
  const enabled = SYNTHETIC_DETECTORS.filter((d) => params.detectors.includes(d))
  const per = enabled.map((detector) => {
    let tp = 0
    let fp = 0
    let fn = 0
    let injected = 0
    for (const d of deals) {
      const isIssue = d.injected.includes(detector)
      const flagged = d.detected.includes(detector)
      if (isIssue) injected += 1
      if (isIssue && flagged) tp += 1
      else if (!isIssue && flagged) fp += 1
      else if (isIssue && !flagged) fn += 1
    }
    return { detector, injected, detected: tp + fp, true_positives: tp, false_positives: fp, false_negatives: fn }
  })
  const tp = per.reduce((s, r) => s + r.true_positives, 0)
  const fp = per.reduce((s, r) => s + r.false_positives, 0)
  const fn = per.reduce((s, r) => s + r.false_negatives, 0)
  const precision = ratio(tp, tp + fp)
  const recall = ratio(tp, tp + fn)
  const n = deals.length || 1
  const products = deals.reduce((s, d) => s + (d.versions[d.versions.length - 1]?.products.length ?? 0), 0)
  const has = (d: SyntheticDeal, c: ProductCode) => d.versions[d.versions.length - 1]?.products.some((p) => p.code === c) ?? false
  return {
    deals_generated: deals.length,
    issues_injected: per.reduce((s, r) => s + r.injected, 0),
    issues_detected: tp + fp,
    true_positives: tp,
    false_positives: fp,
    false_negatives: fn,
    precision: r3(precision),
    recall: r3(recall),
    f1: r3(ratio(2 * precision * recall, precision + recall)),
    per_detector: per,
    actual: {
      products_per_deal: r3(products / n),
      vsc_rate: r3(deals.filter((d) => has(d, 'VSC')).length / n),
      gap_rate: r3(deals.filter((d) => has(d, 'GAP')).length / n),
      issue_rate: r3(deals.filter((d) => d.injected.length > 0).length / n),
    },
  }
}

/** Generate and score in one step. */
export function runSynthetic(params: SyntheticJobParams): SyntheticJobResult {
  return scoreDeals(generateDeals(params), params)
}

/** One CSV row per deal, from its signed version. */
export function dealsCsvRows(deals: readonly SyntheticDeal[]) {
  return deals.map((d) => {
    const v = d.versions[d.versions.length - 1] as DealVersion
    const start = d.versions[0] as DealVersion
    return {
      deal: d.id,
      rooftop: d.dealer_id,
      date: d.deal_date,
      vehicle_price: v.vehicle_price,
      down_payment: v.down_payment,
      apr: v.apr,
      term_months: v.term_months,
      products: v.products.map((p) => p.code).join(' '),
      amount_financed: v.amount_financed,
      monthly_payment: v.monthly_payment,
      total_of_payments: v.total_of_payments,
      total_interest: roundCents(v.total_of_payments - v.amount_financed),
      versions: d.versions.length,
      quote_monthly_payment: start.monthly_payment,
      injected_issues: d.injected.join(' '),
      detected_issues: d.detected.join(' '),
    }
  })
}

// Used by the tests: payment at the quote for a deal, to check the generator against finance.ts.
export function quotePayment(d: SyntheticDeal): number {
  const v = d.versions[0] as DealVersion
  return monthlyPayment(v.amount_financed, v.apr, v.term_months)
}
export { amountFinancedFor }
