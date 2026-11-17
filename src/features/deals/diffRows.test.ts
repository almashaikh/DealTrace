import { describe, expect, it } from 'vitest'

import { detectorBadges, fieldRows, overlapsDiff, triggeredWithin } from '@/features/deals/diffRows'
import { diffVersions } from '@/lib/diff'
import { seed } from '@/mocks/db'
import { heroDeal, version } from '@/test/hero'

const { deal } = heroDeal()
const findings = seed.findings.filter((f) => f.deal_id === deal.id)
const diff = (a: number, b: number) => diffVersions(version(deal, a), version(deal, b))
const labels = (key: Parameters<ReturnType<typeof detectorBadges>['get']>[0], d: ReturnType<typeof diff>) =>
  (detectorBadges(d, findings).get(key) ?? []).map((f) => f.type)

describe('when a finding applies to a diff', () => {
  it('is triggered inside a diff when its completing version is one of the steps the diff covers', () => {
    expect(triggeredWithin({ version_to: 3 }, 1, 3)).toBe(true)
    expect(triggeredWithin({ version_to: 3 }, 2, 3)).toBe(true)
    expect(triggeredWithin({ version_to: 3 }, 1, 2)).toBe(false)
    expect(triggeredWithin({ version_to: 3 }, 3, 4)).toBe(false)
    expect(triggeredWithin({ version_to: 3 }, 3, 1)).toBe(true) // reversed range
  })
  it('missing reason applies on any overlap', () => {
    expect(overlapsDiff({ version_from: 1, version_to: 3 }, 1, 2)).toBe(true)
    expect(overlapsDiff({ version_from: 1, version_to: 3 }, 3, 4)).toBe(false)
  })
})

describe('detectorBadges for the hero deal v1 to v3', () => {
  const d = diff(1, 3)
  it('puts Late add-on on both added products', () => {
    expect(labels('product:GAP', d)).toEqual(['LATE_ADD_ON'])
    expect(labels('product:VSC', d)).toEqual(['LATE_ADD_ON'])
  })
  it('puts Payment masking on the term and the monthly payment', () => {
    expect(labels('field:term_months', d)).toEqual(['PAYMENT_MASKING'])
    expect(labels('field:monthly_payment', d)).toEqual(['PAYMENT_MASKING'])
  })
  it('flags the missing reason and not the unchanged fields', () => {
    expect(labels('reason', d)).toEqual(['MISSING_REASON'])
    expect(labels('field:vehicle_price', d)).toEqual([])
  })
})

describe('detectorBadges for narrower diffs', () => {
  it('v2 to v3 only has the term change, so only Payment masking applies', () => {
    const d = diff(2, 3)
    expect(labels('product:GAP', d)).toEqual([])
    expect(labels('field:term_months', d)).toEqual(['PAYMENT_MASKING'])
  })
  it('v1 to v2 adds the products but does not yet mask the payment', () => {
    const d = diff(1, 2)
    expect(labels('product:GAP', d)).toEqual(['LATE_ADD_ON'])
    expect(labels('field:monthly_payment', d)).toEqual([])
    expect(labels('reason', d)).toEqual(['MISSING_REASON'])
  })
  it('v3 to v4 has no changes and so no badges', () => {
    expect(detectorBadges(diff(3, 4), findings).get('field:term_months')).toBeUndefined()
  })
})

describe('fieldRows', () => {
  it('lists every field and marks the changed ones', () => {
    const rows = fieldRows(diff(1, 3), version(deal, 1), version(deal, 3))
    expect(rows).toHaveLength(9)
    expect(rows.filter((r) => r.changed).map((r) => r.key)).toEqual(['field:amount_financed', 'field:term_months', 'field:monthly_payment', 'field:total_of_payments'])
    expect(rows.find((r) => r.key === 'field:monthly_payment')).toMatchObject({ before: 566.4, after: 547.26, delta: -19.14 })
  })
})
