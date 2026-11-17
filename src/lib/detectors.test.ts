import { describe, expect, it } from 'vitest'

import {
  detectLateAddOn,
  detectMissingReason,
  detectPaymentMasking,
  detectRateAfterApproval,
  runDetectors,
} from '@/lib/detectors'
import { monthlyPayment, totalOfPayments } from '@/lib/finance'
import { heroDeal, version } from '@/test/hero'
import type { DealEvent, DealVersion } from '@/types'

describe('detectors on the hero deal DT-10482', () => {
  const { deal, events } = heroDeal()
  const input = { versions: deal.versions, events }

  it('late add-on: GAP and service contract added after price agreed', () => {
    const [f, ...rest] = detectLateAddOn(input)
    expect(rest).toHaveLength(0)
    expect(f).toMatchObject({
      type: 'LATE_ADD_ON',
      severity: 'high',
      version_from: 1,
      version_to: 2,
      rule_id: 'CA-CARS-ADDON-01',
      refund_exposure: 3300,
      customer_exposure: 4005.25,
      product_codes: ['GAP', 'VSC'],
    })
    expect(f?.title).toBe('Late add-on: GAP waiver and service contract added 35 minutes after price agreed')
    expect(f?.evidence.map((e) => e.event_id).filter(Boolean)).toEqual(['E-1041', 'E-1043', 'E-1044'])
  })

  it('payment masking: term stretched to 72 months while the payment went down', () => {
    const [f, ...rest] = detectPaymentMasking(input)
    expect(rest).toHaveLength(0)
    expect(f).toMatchObject({ type: 'PAYMENT_MASKING', severity: 'high', version_from: 1, version_to: 3, customer_exposure: 5418.96 })
    expect(f?.evidence.find((e) => e.label === 'Term')?.event_id).toBe('E-1045')
  })

  it('rate after approval: none, the APR stayed at 7.9%', () => {
    expect(detectRateAfterApproval(input)).toEqual([])
  })

  it('missing reason: E-1043, E-1044 and E-1045 have no reason', () => {
    const [f, ...rest] = detectMissingReason(input)
    expect(rest).toHaveLength(0)
    expect(f).toMatchObject({ type: 'MISSING_REASON', severity: 'low', rule_id: 'CA-CARS-RECORD-01', version_from: 1, version_to: 3 })
    expect(f?.evidence.map((e) => e.event_id)).toEqual(['E-1043', 'E-1044', 'E-1045'])
  })

  it('runDetectors returns the three process findings in order', () => {
    expect(runDetectors(input).map((f) => f.type)).toEqual(['LATE_ADD_ON', 'PAYMENT_MASKING', 'MISSING_REASON'])
  })
})

describe('detectors on modified deals', () => {
  const { deal, events } = heroDeal()

  function withVersion(base: DealVersion, changes: Partial<DealVersion>, n: number, createdAt: string): DealVersion {
    const v = { ...base, ...changes, version: n, created_at: createdAt }
    return {
      ...v,
      monthly_payment: monthlyPayment(v.amount_financed, v.apr, v.term_months),
      total_of_payments: totalOfPayments(v.amount_financed, v.apr, v.term_months),
    }
  }

  it('rate after approval: flags an APR raised after CREDIT_APPROVED and prices the difference', () => {
    const v4 = version(deal, 4)
    const v5 = withVersion(v4, { apr: 8.9 }, 5, '2026-10-20T18:20:00.000Z')
    const rateEvent: DealEvent = {
      ...events[events.length - 1]!,
      id: 'E-9001',
      seq: 8,
      type: 'RATE_CHANGED',
      field: 'apr',
      old_value: '7.9',
      new_value: '8.9',
      reason: null,
      timestamp: v5.created_at,
      version_after: 5,
    }
    const [f] = detectRateAfterApproval({ versions: [...deal.versions, v5], events: [...events, rateEvent] })
    expect(f).toMatchObject({ type: 'RATE_AFTER_APPROVAL', severity: 'high', version_from: 1, version_to: 5 })
    expect(f?.refund_exposure).toBe(Math.round((v5.total_of_payments - totalOfPayments(31300, 7.9, 72)) * 100) / 100)
    expect(f?.evidence.map((e) => e.event_id).filter(Boolean)).toEqual(['E-1042', 'E-9001'])
  })

  it('payment masking: not flagged when add-ons raise the payment by 5% or more and the term is unchanged', () => {
    const versions = deal.versions.slice(0, 2) // v1 quote, v2 add-ons (+11.8%)
    expect(detectPaymentMasking({ versions, events })).toEqual([])
  })

  it('late add-on: not flagged when products were in the agreed version', () => {
    const v1 = version(deal, 1)
    const withProducts = { ...v1, products: version(deal, 2).products }
    expect(detectLateAddOn({ versions: [withProducts, ...deal.versions.slice(1)], events })).toEqual([])
  })

  it('missing reason: not flagged once reasons are recorded', () => {
    const reasoned = events.map((e) => ({ ...e, reason: e.reason ?? 'Customer request' }))
    expect(detectMissingReason({ versions: deal.versions, events: reasoned })).toEqual([])
  })
})
