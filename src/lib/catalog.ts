import type { DetectorType, EventType, FindingType, ProductCode, Severity } from '@/types'

export const PRODUCT_NAMES: Record<ProductCode, string> = {
  GAP: 'GAP waiver',
  VSC: 'Service contract',
  TIRE_WHEEL: 'Tire and wheel protection',
  PAINT_FABRIC: 'Paint and fabric protection',
  PREPAID_MAINT: 'Prepaid maintenance',
  THEFT_ETCH: 'Theft deterrent etch',
}

/** Product name for use mid-sentence: "service contract", but "GAP waiver" keeps its acronym. */
export function productNameInSentence(code: ProductCode): string {
  return lowerFirst(PRODUCT_NAMES[code])
}

/** Lowercases the first letter unless the first word is an acronym (GAP, F&I). */
export function lowerFirst(text: string): string {
  const firstWord = text.split(' ')[0] ?? ''
  if (firstWord.length > 1 && firstWord === firstWord.toUpperCase()) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

/** Short names for event titles: "GAP added — $900.00". */
export const PRODUCT_SHORT_NAMES: Record<ProductCode, string> = {
  GAP: 'GAP',
  VSC: 'Service contract',
  TIRE_WHEEL: 'Tire and wheel',
  PAINT_FABRIC: 'Paint and fabric',
  PREPAID_MAINT: 'Prepaid maintenance',
  THEFT_ETCH: 'Theft etch',
}

/** Typical selling price range per product, used for seed and synthetic data. */
export const PRODUCT_PRICE_RANGES: Record<ProductCode, readonly [number, number]> = {
  GAP: [595, 1295],
  VSC: [1495, 3495],
  TIRE_WHEEL: [499, 1099],
  PAINT_FABRIC: [399, 899],
  PREPAID_MAINT: [549, 1249],
  THEFT_ETCH: [199, 499],
}

export const PRODUCT_PROVIDER: Record<ProductCode, string> = {
  GAP: 'PRV-01',
  THEFT_ETCH: 'PRV-01',
  VSC: 'PRV-02',
  PREPAID_MAINT: 'PRV-02',
  TIRE_WHEEL: 'PRV-03',
  PAINT_FABRIC: 'PRV-03',
}

export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  LATE_ADD_ON: 'Late add-on',
  PAYMENT_MASKING: 'Payment masking',
  RATE_AFTER_APPROVAL: 'Rate after approval',
  WARRANTY_OVERLAP: 'Warranty overlap',
  LOW_BENEFIT_GAP: 'Low-benefit GAP',
  DUPLICATE_COVERAGE: 'Duplicate coverage',
  MISSING_REASON: 'Missing change reason',
  PRICE_OUTLIER: 'Price outlier',
  RECORDKEEPING_GAP: 'Recordkeeping gap',
}

export const DETECTOR_LABELS: Record<DetectorType, string> = {
  LATE_ADD_ON: 'Late add-on',
  PAYMENT_MASKING: 'Payment masking',
  RATE_AFTER_APPROVAL: 'Rate after approval',
  MISSING_REASON: 'Missing reason',
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  QUOTE_CREATED: 'Quote created',
  PRICE_AGREED: 'Price agreed',
  CREDIT_APPROVED: 'Credit approved',
  PRODUCT_ADDED: 'Product added',
  PRODUCT_REMOVED: 'Product removed',
  RATE_CHANGED: 'Rate changed',
  TERM_CHANGED: 'Term changed',
  PRICE_CHANGED: 'Price changed',
  CONTRACT_SIGNED: 'Contract signed',
  DECISION_RECORDED: 'Decision recorded',
}

/** Events that change deal terms and therefore need a recorded reason. */
export const CHANGE_EVENT_TYPES: readonly EventType[] = [
  'PRODUCT_ADDED',
  'PRODUCT_REMOVED',
  'RATE_CHANGED',
  'TERM_CHANGED',
  'PRICE_CHANGED',
]

export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }

/** Finding order inside one deal (also the order ids are assigned in). */
export const FINDING_TYPE_ORDER: readonly FindingType[] = [
  'LATE_ADD_ON',
  'PAYMENT_MASKING',
  'RATE_AFTER_APPROVAL',
  'WARRANTY_OVERLAP',
  'LOW_BENEFIT_GAP',
  'DUPLICATE_COVERAGE',
  'PRICE_OUTLIER',
  'MISSING_REASON',
  'RECORDKEEPING_GAP',
]

/** Actor id used for automated actions (scans, detector runs). */
export const SYSTEM_ACTOR_ID = 'system'
