import { DIFF_FIELDS } from '@/lib/diff'
import { findingProductCodes } from '@/lib/exposure'
import type { DealVersion, DetectorType, DiffFieldKey, Finding, FindingType, ProductCode, VersionDiff } from '@/types'

/** The four process detectors, which are the ones that put a badge on a diff row. */
export const DETECTOR_TYPES: readonly FindingType[] = ['LATE_ADD_ON', 'PAYMENT_MASKING', 'RATE_AFTER_APPROVAL', 'MISSING_REASON']

export function isDetectorFinding(f: Pick<Finding, 'type'>): f is Pick<Finding, 'type'> & { type: DetectorType } {
  return DETECTOR_TYPES.includes(f.type)
}

/**
 * A finding is triggered inside a diff when the version that completed it (its `version_to`) is one of the
 * steps the diff covers. A payment masking finding completed in v3 shows on v2 to v3 and v1 to v3, but not on v1 to v2.
 */
export function triggeredWithin(f: Pick<Finding, 'version_to'>, fromVersion: number, toVersion: number): boolean {
  const lo = Math.min(fromVersion, toVersion)
  const hi = Math.max(fromVersion, toVersion)
  return f.version_to > lo && f.version_to <= hi
}

/** A missing-reason finding spans several changes, so any overlap with the compared versions counts. */
export function overlapsDiff(f: Pick<Finding, 'version_from' | 'version_to'>, fromVersion: number, toVersion: number): boolean {
  const lo = Math.min(fromVersion, toVersion)
  const hi = Math.max(fromVersion, toVersion)
  return f.version_to > lo && f.version_from < hi
}

export type RowKey = `field:${DiffFieldKey}` | `product:${ProductCode}` | 'reason'

export interface FieldRow {
  key: `field:${DiffFieldKey}`
  label: string
  kind: 'money' | 'percent' | 'months'
  before: number
  after: number
  delta: number
  changed: boolean
}

/** Every deal field for two versions, with the ones the diff reports as changed marked. */
export function fieldRows(diff: VersionDiff, from: DealVersion, to: DealVersion): FieldRow[] {
  const changed = new Map(diff.changes.map((c) => [c.field, c]))
  return DIFF_FIELDS.map(({ field, label, kind }) => {
    const c = changed.get(field)
    return {
      key: `field:${field}` as const,
      label,
      kind,
      before: from[field],
      after: to[field],
      delta: c?.delta ?? 0,
      changed: Boolean(c),
    }
  })
}

/**
 * Which findings badge which rows of a diff.
 *  - Late add-on: each product it added.
 *  - Payment masking: the term and the monthly payment.
 *  - Rate after approval: the APR.
 *  - Missing reason: the reason row.
 */
export function detectorBadges(diff: VersionDiff, findings: readonly Finding[]): Map<RowKey, Finding[]> {
  const out = new Map<RowKey, Finding[]>()
  const add = (key: RowKey, f: Finding) => out.set(key, [...(out.get(key) ?? []), f])
  const addedCodes = new Set<ProductCode>(diff.products_added.map((p) => p.code))
  const changedFields = new Set(diff.changes.map((c) => c.field))

  for (const f of findings) {
    if (!isDetectorFinding(f)) continue
    const applies = f.type === 'MISSING_REASON' ? overlapsDiff(f, diff.from_version, diff.to_version) : triggeredWithin(f, diff.from_version, diff.to_version)
    if (!applies) continue
    switch (f.type) {
      case 'LATE_ADD_ON':
        for (const code of findingProductCodes(f)) if (addedCodes.has(code)) add(`product:${code}`, f)
        break
      case 'PAYMENT_MASKING':
        for (const field of ['term_months', 'monthly_payment'] as const) if (changedFields.has(field)) add(`field:${field}`, f)
        break
      case 'RATE_AFTER_APPROVAL':
        if (changedFields.has('apr')) add('field:apr', f)
        break
      case 'MISSING_REASON':
        add('reason', f)
        break
    }
  }
  return out
}
