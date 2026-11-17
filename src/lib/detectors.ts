import { CHANGE_EVENT_TYPES, EVENT_TYPE_LABELS, PRODUCT_NAMES, productNameInSentence } from '@/lib/catalog'
import { roundCents, totalOfPayments } from '@/lib/finance'
import { formatApr, formatDateTime, formatMoney, formatSignedMoney, minutesBetween } from '@/lib/format'
import type { DealEvent, DealVersion, DetectedFinding, ProductCode } from '@/types'

/**
 * The four process detectors. Each looks at how a deal changed over time
 * (versions plus the event log), not only at the signed contract.
 */

export interface DetectorInput {
  versions: readonly DealVersion[]
  events: readonly DealEvent[]
}

/** Payment changes smaller than this share (or any decrease) count as "masked". */
export const MASKING_THRESHOLD = 0.05

export const ADD_ON_RULE_ID = 'CA-CARS-ADDON-01'
export const RECORD_RULE_ID = 'CA-CARS-RECORD-01'

function sortedVersions(versions: readonly DealVersion[]): DealVersion[] {
  return [...versions].sort((a, b) => a.version - b.version)
}

function sortedEvents(events: readonly DealEvent[]): DealEvent[] {
  return [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.seq - b.seq)
}

/** The version in force at `timestamp`: the latest version created at or before it. */
export function versionAt(versions: readonly DealVersion[], timestamp: string): DealVersion | undefined {
  let found: DealVersion | undefined
  for (const v of sortedVersions(versions)) {
    if (v.created_at <= timestamp) found = v
  }
  return found
}

function firstEvent(events: readonly DealEvent[], type: DealEvent['type']): DealEvent | undefined {
  return sortedEvents(events).find((e) => e.type === type)
}

/** Version the customer agreed to: in force at PRICE_AGREED, or the first version if there is no such event. */
export function agreedBaseline(input: DetectorInput): { version: DealVersion; event: DealEvent | undefined } | undefined {
  const versions = sortedVersions(input.versions)
  const first = versions[0]
  if (!first) return undefined
  const agreed = firstEvent(input.events, 'PRICE_AGREED')
  if (!agreed) return { version: first, event: undefined }
  return { version: versionAt(versions, agreed.timestamp) ?? first, event: agreed }
}

function joinNames(codes: readonly ProductCode[]): string {
  const names = codes.map((c, i) => (i === 0 ? PRODUCT_NAMES[c] : productNameInSentence(c)))
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function productEvent(events: readonly DealEvent[], code: ProductCode, version: number): DealEvent | undefined {
  return events.find((e) => e.type === 'PRODUCT_ADDED' && e.new_value === code && e.version_after === version)
}

function pctChange(before: number, after: number): number {
  return before === 0 ? 0 : (after - before) / before
}

function formatPct(ratio: number): string {
  const sign = ratio > 0 ? '+' : ratio < 0 ? '−' : ''
  return `${sign}${Math.abs(ratio * 100).toFixed(1)}%`
}

/* ------------------------------------------------------------------ */

/** Late add-on: a product appears in a version created after the PRICE_AGREED event. */
export function detectLateAddOn(input: DetectorInput): DetectedFinding[] {
  const baseline = agreedBaseline(input)
  if (!baseline?.event) return []
  const agreedAt = baseline.event.timestamp
  const baseCodes = new Set(baseline.version.products.map((p) => p.code))
  const versions = sortedVersions(input.versions)
  const final = versions[versions.length - 1]
  if (!final) return []

  const late: { code: ProductCode; version: DealVersion; price: number }[] = []
  const seen = new Set<ProductCode>()
  for (const v of versions) {
    if (v.created_at <= agreedAt) continue
    for (const p of v.products) {
      if (!baseCodes.has(p.code) && !seen.has(p.code)) {
        seen.add(p.code)
        late.push({ code: p.code, version: v, price: p.price })
      }
    }
  }
  if (late.length === 0) return []

  const firstLate = late.reduce((a, b) => (a.version.version <= b.version.version ? a : b))
  const lastLate = late.reduce((a, b) => (a.version.version >= b.version.version ? a : b))
  const finalCodes = new Set(final.products.map((p) => p.code))
  const stillSold = late.filter((l) => finalCodes.has(l.code))
  const refund = roundCents(stillSold.reduce((s, l) => s + (final.products.find((p) => p.code === l.code)?.price ?? l.price), 0))
  const customer = roundCents(Math.max(0, lastLate.version.total_of_payments - baseline.version.total_of_payments))
  const allReasoned = late.every((l) => {
    const ev = productEvent(input.events, l.code, l.version.version)
    return Boolean(ev?.reason?.trim())
  })
  const minutesAfter = minutesBetween(agreedAt, firstLate.version.created_at)

  return [
    {
      type: 'LATE_ADD_ON',
      title: `Late add-on: ${joinNames(late.map((l) => l.code))} added ${minutesAfter} minutes after price agreed`,
      severity: 'high',
      version_from: baseline.version.version,
      version_to: lastLate.version.version,
      rule_id: ADD_ON_RULE_ID,
      evidence: [
        {
          label: 'Price agreed',
          value: `${formatMoney(baseline.version.vehicle_price)} at ${formatDateTime(agreedAt)}`,
          event_id: baseline.event.id,
        },
        ...late.map((l) => {
          const ev = productEvent(input.events, l.code, l.version.version)
          return {
            label: `${PRODUCT_NAMES[l.code]} added`,
            value: `${formatMoney(l.price)} in v${l.version.version}, ${minutesBetween(agreedAt, l.version.created_at)} min after price agreed`,
            ...(ev ? { event_id: ev.id } : {}),
          }
        }),
        {
          label: 'Total of payments',
          value: `${formatMoney(baseline.version.total_of_payments)} → ${formatMoney(lastLate.version.total_of_payments)} (${formatSignedMoney(customer)})`,
        },
      ],
      uncertainty: allReasoned ? 0.187 : 0.063,
      refund_exposure: refund,
      customer_exposure: customer,
      product_codes: stillSold.map((l) => l.code),
    },
  ]
}

/** Payment masking: term increased, or products were added, while the monthly payment changed by less than 5% or went down. */
export function detectPaymentMasking(input: DetectorInput): DetectedFinding[] {
  const baseline = agreedBaseline(input)
  if (!baseline) return []
  const base = baseline.version
  const baseCodes = new Set(base.products.map((p) => p.code))

  for (const v of sortedVersions(input.versions)) {
    if (v.version <= base.version) continue
    const termUp = v.term_months > base.term_months
    const added = v.products.filter((p) => !baseCodes.has(p.code)).map((p) => p.code)
    const change = pctChange(base.monthly_payment, v.monthly_payment)
    if ((termUp || added.length > 0) && change < MASKING_THRESHOLD) {
      const customer = roundCents(Math.max(0, v.total_of_payments - base.total_of_payments))
      const what = [
        added.length > 0 ? `${joinNames(added)} added` : null,
        termUp ? `term extended to ${v.term_months} months` : null,
      ].filter((s): s is string => s !== null)
      const termEvent = input.events.find((e) => e.type === 'TERM_CHANGED' && e.version_after === v.version)
      const direction = change < 0 ? `payment fell ${formatPct(change).slice(1)}` : `payment rose only ${formatPct(change).slice(1)}`
      return [
        {
          type: 'PAYMENT_MASKING',
          title: `Payment masking: ${what.join(', ')}; ${direction}`,
          severity: 'high',
          version_from: base.version,
          version_to: v.version,
          rule_id: ADD_ON_RULE_ID,
          evidence: [
            {
              label: 'Monthly payment',
              value: `${formatMoney(base.monthly_payment)} (v${base.version}) → ${formatMoney(v.monthly_payment)} (v${v.version}), ${formatPct(change)}`,
            },
            ...(termUp
              ? [
                  {
                    label: 'Term',
                    value: `${base.term_months} → ${v.term_months} months`,
                    ...(termEvent ? { event_id: termEvent.id } : {}),
                  },
                ]
              : []),
            ...(added.length > 0
              ? [
                  {
                    label: 'Products added',
                    value: added
                      .map((c) => `${PRODUCT_NAMES[c]} ${formatMoney(v.products.find((p) => p.code === c)?.price ?? 0)}`)
                      .join(', '),
                  },
                ]
              : []),
            {
              label: 'Total of payments',
              value: `${formatMoney(base.total_of_payments)} → ${formatMoney(v.total_of_payments)} (${formatSignedMoney(customer)})`,
            },
          ],
          uncertainty: 0.118,
          refund_exposure: 0,
          customer_exposure: customer,
          product_codes: [],
        },
      ]
    }
  }
  return []
}

/** Rate after approval: APR increased after the CREDIT_APPROVED event. */
export function detectRateAfterApproval(input: DetectorInput): DetectedFinding[] {
  const approval = firstEvent(input.events, 'CREDIT_APPROVED')
  if (!approval) return []
  const versions = sortedVersions(input.versions)
  const approvedVersion = versionAt(versions, approval.timestamp)
  if (!approvedVersion) return []
  const approvedApr = approvedVersion.apr

  for (const v of versions) {
    if (v.created_at <= approval.timestamp || v.apr <= approvedApr) continue
    const atApprovedRate = totalOfPayments(v.amount_financed, approvedApr, v.term_months)
    const extra = roundCents(v.total_of_payments - atApprovedRate)
    const rateEvent = input.events.find((e) => e.type === 'RATE_CHANGED' && e.version_after === v.version)
    return [
      {
        type: 'RATE_AFTER_APPROVAL',
        title: `APR raised from ${formatApr(approvedApr)} to ${formatApr(v.apr)} after credit approval`,
        severity: 'high',
        version_from: approvedVersion.version,
        version_to: v.version,
        evidence: [
          { label: 'Credit approved', value: `${formatApr(approvedApr)} at ${formatDateTime(approval.timestamp)}`, event_id: approval.id },
          {
            label: 'Rate changed',
            value: `${formatApr(approvedApr)} → ${formatApr(v.apr)} in v${v.version}, ${minutesBetween(approval.timestamp, v.created_at)} min after approval`,
            ...(rateEvent ? { event_id: rateEvent.id } : {}),
          },
          { label: 'Extra finance charge', value: `${formatMoney(extra)} over ${v.term_months} months` },
        ],
        uncertainty: 0.087,
        refund_exposure: extra,
        customer_exposure: extra,
        product_codes: [],
      },
    ]
  }
  return []
}

/** Missing reason: any change event with an empty reason. One finding per deal, one evidence item per event. */
export function detectMissingReason(input: DetectorInput): DetectedFinding[] {
  const missing = sortedEvents(input.events).filter((e) => CHANGE_EVENT_TYPES.includes(e.type) && !e.reason?.trim())
  if (missing.length === 0) return []
  const versionsAfter = missing.map((e) => e.version_after)
  return [
    {
      type: 'MISSING_REASON',
      title: `Missing change reason on ${missing.length} ${missing.length === 1 ? 'event' : 'events'}`,
      severity: 'low',
      version_from: Math.max(1, Math.min(...versionsAfter) - 1),
      version_to: Math.max(...versionsAfter),
      rule_id: RECORD_RULE_ID,
      evidence: missing.map((e) => ({
        label: `${EVENT_TYPE_LABELS[e.type]}${e.new_value ? `: ${e.type.startsWith('PRODUCT') ? PRODUCT_NAMES[e.new_value as ProductCode] ?? e.new_value : e.old_value ? `${e.old_value} → ${e.new_value}` : e.new_value}` : ''}`,
        value: `No reason recorded · ${formatDateTime(e.timestamp)}`,
        event_id: e.id,
      })),
      uncertainty: 0.031,
      refund_exposure: 0,
      customer_exposure: 0,
      product_codes: [],
    },
  ]
}

/** Runs all four detectors in a fixed order. */
export function runDetectors(input: DetectorInput): DetectedFinding[] {
  return [
    ...detectLateAddOn(input),
    ...detectPaymentMasking(input),
    ...detectRateAfterApproval(input),
    ...detectMissingReason(input),
  ]
}
