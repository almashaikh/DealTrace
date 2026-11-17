import { monthlyPayment, roundCents, totalOfPayments } from '@/lib/finance'
import { HistoryBuilder, amountFinancedFor, type DealTerms, type PricedProduct } from '@/lib/history'
import type { DealEvent, DealVersion, DetectorType, ProductCode } from '@/types'

/** The live sandbox. Everything here is plain logic: the form becomes deal terms, terms become a history, and the real detectors read it. */

export const SANDBOX_PRODUCTS: readonly ProductCode[] = ['GAP', 'VSC', 'TIRE_WHEEL', 'PAINT_FABRIC', 'PREPAID_MAINT', 'THEFT_ETCH']

/** What each product costs in the sandbox. */
export const SANDBOX_PRODUCT_PRICES: Record<ProductCode, number> = {
  GAP: 900,
  VSC: 2400,
  TIRE_WHEEL: 699,
  PAINT_FABRIC: 549,
  PREPAID_MAINT: 799,
  THEFT_ETCH: 349,
}

export const TERM_CHOICES = [48, 60, 72, 84] as const

/** The form as the person types it: numbers stay text until they are valid. */
export interface SandboxForm {
  price: string
  down: string
  apr: string
  term: number
  products: ProductCode[]
  reason: string
  /** A PRICE_AGREED event is in the log. */
  priceAgreed: boolean
  /** A CREDIT_APPROVED event is in the log. */
  creditApproved: boolean
}

/**
 * The starting deal. The loan is small enough that a $900.00 GAP waiver moves the payment by more than 5%,
 * so a late add-on is not also mistaken for payment masking.
 */
export const START_FORM: SandboxForm = {
  price: '20000',
  down: '3500',
  apr: '7.9',
  term: 60,
  products: [],
  reason: '',
  priceAgreed: true,
  creditApproved: true,
}

export type FieldErrors = Partial<Record<'price' | 'down' | 'apr', string>>

function num(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

export function formProducts(form: Pick<SandboxForm, 'products'>): PricedProduct[] {
  return SANDBOX_PRODUCTS.filter((c) => form.products.includes(c)).map((code) => ({ code, price: SANDBOX_PRODUCT_PRICES[code] }))
}

/** Deal terms from the form, or the problems with it. */
export function parseForm(form: SandboxForm): { terms: DealTerms; errors?: undefined } | { terms?: undefined; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const price = num(form.price)
  const down = num(form.down)
  const apr = num(form.apr)
  if (price === null || price <= 0) errors.price = 'Enter a price above $0.00.'
  if (down === null || down < 0) errors.down = 'Enter a down payment of $0.00 or more.'
  else if (price !== null && down >= price) errors.down = 'The down payment must be less than the price.'
  if (apr === null || apr < 0 || apr > 36) errors.apr = 'Enter an APR between 0% and 36%.'
  if (Object.keys(errors).length > 0 || price === null || down === null || apr === null) return { errors }
  return { terms: { vehicle_price: price, down_payment: down, apr, term_months: form.term, products: formProducts(form) } }
}

export interface LiveFigures {
  amount_financed: number
  monthly_payment: number
  total_of_payments: number
  total_interest: number
}

/** Payment, total of payments and total interest for the terms, from finance.ts. */
export function liveFigures(terms: DealTerms): LiveFigures {
  const financed = amountFinancedFor(terms)
  const total = totalOfPayments(financed, terms.apr, terms.term_months)
  return {
    amount_financed: financed,
    monthly_payment: monthlyPayment(financed, terms.apr, terms.term_months),
    total_of_payments: total,
    total_interest: roundCents(total - financed),
  }
}

export function sameTerms(a: DealTerms, b: DealTerms): boolean {
  return (
    a.vehicle_price === b.vehicle_price &&
    a.down_payment === b.down_payment &&
    a.apr === b.apr &&
    a.term_months === b.term_months &&
    a.products.length === b.products.length &&
    a.products.every((p) => b.products.some((q) => q.code === p.code && q.price === p.price))
  )
}

export interface SavedEdit {
  terms: DealTerms
  /** The reason typed for this change, or null when it was left empty. */
  reason: string | null
}

export interface LogFlags {
  priceAgreed: boolean
  creditApproved: boolean
}

const START_MINUTE = 605
const FIRST_EDIT_MINUTE = 640
const EDIT_STEP = 15

/**
 * The deal history for the starting deal plus the saved edits. Each edit becomes a new version, and every changed
 * term becomes an event that carries the reason typed (or none). "Price agreed" and "Credit approved" decide whether
 * those events are in the log, which is what the late add-on and rate detectors look for.
 */
export function buildHistory(start: DealTerms, edits: readonly SavedEdit[], flags: LogFlags): { versions: DealVersion[]; events: DealEvent[] } {
  const h = new HistoryBuilder('SANDBOX', '2026-10-20', start)
  h.snapshot(START_MINUTE, 'Starting deal', 'Customer accepted price')
  h.event(START_MINUTE, 'QUOTE_CREATED', { field: 'vehicle_price', next: String(start.vehicle_price), reason: 'Initial quote' })
  if (flags.priceAgreed) h.event(START_MINUTE, 'PRICE_AGREED', { field: 'vehicle_price', next: String(start.vehicle_price), reason: 'Customer accepted price' })
  if (flags.creditApproved) h.event(START_MINUTE + 15, 'CREDIT_APPROVED', { field: 'apr', next: String(start.apr), reason: 'Approved by the lender' })

  let prev = start
  edits.forEach((edit, i) => {
    const minute = FIRST_EDIT_MINUTE + i * EDIT_STEP
    const next = edit.terms
    h.set(next)
    h.snapshot(minute, `Edit ${i + 1}`, edit.reason)
    const reason = edit.reason
    for (const p of next.products) if (!prev.products.some((q) => q.code === p.code)) h.event(minute, 'PRODUCT_ADDED', { field: 'products', next: p.code, reason })
    for (const p of prev.products) if (!next.products.some((q) => q.code === p.code)) h.event(minute, 'PRODUCT_REMOVED', { field: 'products', old: p.code, next: p.code, reason })
    if (next.term_months !== prev.term_months) h.event(minute, 'TERM_CHANGED', { field: 'term_months', old: String(prev.term_months), next: String(next.term_months), reason })
    if (next.apr !== prev.apr) h.event(minute, 'RATE_CHANGED', { field: 'apr', old: String(prev.apr), next: String(next.apr), reason })
    if (next.vehicle_price !== prev.vehicle_price) h.event(minute, 'PRICE_CHANGED', { field: 'vehicle_price', old: String(prev.vehicle_price), next: String(next.vehicle_price), reason })
    prev = next
  })
  return { versions: h.versions, events: h.events }
}

export interface Preset {
  id: 'gap-late' | 'stretch-term' | 'rate-raise'
  label: string
  /** What the preset does, in a line. */
  description: string
  /** The finding it should produce. */
  expects: DetectorType
  form: SandboxForm
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'gap-late',
    label: 'GAP added after price agreement',
    description: 'Adds a GAP waiver after the price was agreed.',
    expects: 'LATE_ADD_ON',
    form: { ...START_FORM, products: ['GAP'], reason: 'Customer asked about GAP after agreeing' },
  },
  {
    id: 'stretch-term',
    label: 'Stretch term to hide products',
    description: 'Adds a service contract and stretches the term so the payment barely moves.',
    expects: 'PAYMENT_MASKING',
    form: { ...START_FORM, products: ['VSC'], term: 72, reason: 'Customer asked for a lower payment' },
  },
  {
    id: 'rate-raise',
    label: 'Rate raised after approval',
    description: 'Raises the APR after credit was approved.',
    expects: 'RATE_AFTER_APPROVAL',
    form: { ...START_FORM, apr: '9.4', reason: 'Lender re-tiered the buyer' },
  },
]
