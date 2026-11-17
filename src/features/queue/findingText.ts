import { productNameInSentence } from '@/lib/catalog'
import { roundCents } from '@/lib/finance'
import { formatApr, formatDateTime, formatMoney, minutesBetween } from '@/lib/format'
import type { Deal, DealVersion, EvidenceItem, Finding, Product } from '@/types'

/** Plain-English text for a finding, built from the finding, its evidence and the deal versions. */

export type UncertaintyLevel = 'Low' | 'Medium' | 'High'

/** Below 0.15 is low, below 0.30 is medium, anything above is high. */
export function uncertaintyLevel(value: number): UncertaintyLevel {
  if (value < 0.15) return 'Low'
  if (value < 0.3) return 'Medium'
  return 'High'
}

export function uncertaintyLabel(value: number): string {
  return `${uncertaintyLevel(value)} uncertainty`
}

function evidence(f: Finding, label: string): string | undefined {
  const item: EvidenceItem | undefined = f.evidence.find((e) => e.label === label || e.label.startsWith(label))
  return item?.value
}

/** Text before the first " (" or " · ", for values such as "74% (…)" or "72 months / 75,000 miles · DriveCare · $2,400.00". */
function head(value: string | undefined): string | undefined {
  return value?.split(/ \(| · /)[0]
}

function version(deal: Deal, n: number): DealVersion | undefined {
  return deal.versions.find((v) => v.version === n)
}

function addedProducts(from: DealVersion, to: DealVersion): Product[] {
  return to.products.filter((p) => !from.products.some((q) => q.code === p.code))
}

function productList(products: readonly Product[]): string {
  const parts = products.map((p) => `a ${productNameInSentence(p.code)} (${formatMoney(p.price)})`)
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function pct(before: number, after: number): string {
  const ratio = ((after - before) / before) * 100
  return `${ratio < 0 ? '−' : '+'}${Math.abs(ratio).toFixed(1)}%`
}

/** Two or three sentences saying what happened. Falls back to the title and evidence if a value is missing. */
export function describeFinding(f: Finding, deal: Deal): string[] {
  const from = version(deal, f.version_from)
  const to = version(deal, f.version_to)
  const fallback = [`${f.title}.`, ...f.evidence.slice(0, 2).map((e) => `${e.label}: ${e.value}.`)]

  switch (f.type) {
    case 'LATE_ADD_ON': {
      if (!from || !to) return fallback
      const added = addedProducts(from, to)
      if (added.length === 0) return fallback
      const minutes = minutesBetween(from.created_at, to.created_at)
      const priceFrom = from.products.length === 0 ? 'no add-on products' : 'the add-ons listed then'
      const reason = to.reason?.trim() ? `The recorded reason was "${to.reason.trim()}".` : 'No reason was recorded for the change.'
      return [
        `In version ${from.version} (${formatDateTime(from.created_at)}) the price was agreed at ${formatMoney(from.vehicle_price)} with ${priceFrom}.`,
        `In version ${to.version}, ${minutes} minutes later, ${productList(added)} ${added.length > 1 ? 'were' : 'was'} added. The total of payments rose from ${formatMoney(from.total_of_payments)} to ${formatMoney(to.total_of_payments)}.`,
        reason,
      ]
    }
    case 'PAYMENT_MASKING': {
      if (!from || !to) return fallback
      const added = addedProducts(from, to)
      const parts = [
        added.length > 0 ? `${productList(added)} ${added.length > 1 ? 'were' : 'was'} added` : null,
        to.term_months !== from.term_months ? `the term went from ${from.term_months} to ${to.term_months} months` : null,
      ].filter((p): p is string => p !== null)
      const delta = roundCents(to.total_of_payments - from.total_of_payments)
      return [
        `Between version ${from.version} and version ${to.version}, ${parts.join(' and ')}.`,
        `The monthly payment moved from ${formatMoney(from.monthly_payment)} to ${formatMoney(to.monthly_payment)} (${pct(from.monthly_payment, to.monthly_payment)}), so the customer ${to.monthly_payment < from.monthly_payment ? 'saw a lower payment' : 'saw only a small rise'}.`,
        `The total of payments ${delta >= 0 ? 'rose' : 'fell'} by ${formatMoney(Math.abs(delta))}.`,
      ]
    }
    case 'RATE_AFTER_APPROVAL': {
      if (!from || !to) return fallback
      return [
        `Credit was approved at ${formatApr(from.apr)}.`,
        `In version ${to.version} the APR was raised to ${formatApr(to.apr)}, after the approval.`,
        `The higher rate adds ${formatMoney(f.refund_exposure)} in finance charges over ${to.term_months} months.`,
      ]
    }
    case 'WARRANTY_OVERLAP': {
      const factory = evidence(f, 'Factory warranty')
      const contract = evidence(f, 'Service contract')
      const overlap = head(evidence(f, 'Overlap'))
      if (!factory || !contract || !overlap) return fallback
      return [
        `The vehicle's factory warranty covers ${head(factory)}.`,
        `The service contract runs ${head(contract)}.`,
        `For the first ${overlap} the buyer is paying for coverage the factory warranty already provides.`,
      ]
    }
    case 'LOW_BENEFIT_GAP': {
      const ltv = head(evidence(f, 'Loan-to-value'))
      const gap = head(evidence(f, 'GAP waiver'))
      const down = evidence(f, 'Down payment')
      if (!ltv || !gap) return fallback
      return [
        `A GAP waiver (${evidence(f, 'GAP waiver')?.split(' · ').slice(0, 1)}) was sold on a loan with a loan-to-value of ${ltv}${down ? ` and ${down} down` : ''}.`,
        'At that loan-to-value a shortfall between the loan balance and the vehicle value is unlikely, so the waiver may never pay out.',
        'The benefit check rates it little or no benefit.',
      ]
    }
    case 'DUPLICATE_COVERAGE': {
      const existing = evidence(f, 'Existing coverage')
      const gap = evidence(f, 'GAP waiver')
      if (!existing || !gap) return fallback
      return [
        `The buyer already has ${existing.charAt(0).toLowerCase()}${existing.slice(1)}.`,
        `A GAP waiver (${gap.split(' · ')[0]}) was added on top of that coverage.`,
        'The benefit check rates the waiver little or no benefit.',
      ]
    }
    case 'PRICE_OUTLIER': {
      const price = evidence(f, 'Price charged')
      const median = head(evidence(f, 'Group median'))
      const threshold = head(evidence(f, 'Outlier threshold'))
      if (!price || !median || !threshold) return fallback
      return [
        `${price} was charged. The group median for this product over the last 30 days is ${median}.`,
        `That is above the outlier threshold of ${threshold}.`,
        `The ${formatMoney(f.refund_exposure)} above the median is the refund exposure.`,
      ]
    }
    case 'MISSING_REASON': {
      const n = f.evidence.length
      const labels = f.evidence.map((e) => e.label)
      return [
        `${n} ${n === 1 ? 'change' : 'changes'} on this deal ${n === 1 ? 'has' : 'have'} no recorded reason.`,
        `${labels.join('; ')}.`,
        'A reason for each change is part of the deal record and is needed for review.',
      ]
    }
    case 'RECORDKEEPING_GAP': {
      const doc = evidence(f, 'Missing document')
      const signed = evidence(f, 'Contract signed')
      if (!doc) return fallback
      return [
        `${doc}.`,
        'Deal records must be kept for two years.',
        ...(signed ? [`The contract was signed at ${signed}.`] : []),
      ]
    }
  }
}
