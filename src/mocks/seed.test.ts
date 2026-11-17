import { describe, expect, it } from 'vitest'

import { amountFinanced, monthlyPayment, totalOfPayments } from '@/lib/finance'
import { formatTime } from '@/lib/format'
import { seed } from '@/mocks/db'
import { heroDeal } from '@/test/hero'

const open = seed.findings.filter((f) => f.status === 'Open' || f.status === 'In review')

describe('seed counts (docs/DATA.md "Numbers that must agree everywhere")', () => {
  it('has 28 deals, 74 findings and 61 open findings', () => {
    expect(seed.deals).toHaveLength(28)
    expect(seed.findings).toHaveLength(74)
    expect(open).toHaveLength(61)
  })

  it('has 9 open high-severity findings and $48,920.40 refund exposure', () => {
    expect(open.filter((f) => f.severity === 'high')).toHaveLength(9)
    const refund = Math.round(seed.deals.reduce((s, d) => s + d.refund_exposure, 0) * 100) / 100
    expect(refund).toBe(48920.4)
  })

  it('stores per-deal open finding counts that match the findings', () => {
    for (const d of seed.deals) expect(d.open_findings).toBe(open.filter((f) => f.deal_id === d.id).length)
  })

  it('has 1,284 deals scanned in the last 30 days and a 3h 12m median time to decision', () => {
    const last30 = seed.scan_stats.daily.slice(-30)
    expect(last30.reduce((s, d) => s + Object.values(d.by_dealer).reduce((a, b) => a + b, 0), 0)).toBe(1284)
    expect(seed.scan_stats.median_decision_minutes['30d'].all).toBe(192)
  })

  it('has the other volumes from docs/DATA.md', () => {
    expect(seed.users).toHaveLength(5)
    expect(seed.dealers).toHaveLength(5)
    expect(seed.lenders).toHaveLength(3)
    expect(seed.providers).toHaveLength(3)
    expect(seed.rules).toHaveLength(9)
    expect(seed.rules.filter((r) => r.jurisdiction === 'California' && r.status === 'Active')).toHaveLength(6)
    expect(seed.rules.filter((r) => r.status === 'Draft')).toHaveLength(3)
    expect(seed.blast_radius).toHaveLength(9)
    expect(seed.notifications).toHaveLength(8)
    expect(seed.events.length).toBeGreaterThan(140)
    expect(seed.events.length).toBeLessThan(180)
    expect(seed.audit.length).toBeGreaterThan(280)
    expect(seed.pricing.length).toBeGreaterThan(200)
    const products = seed.deals.flatMap((d) => d.versions[d.versions.length - 1]?.products ?? [])
    expect(seed.benefit_checks).toHaveLength(products.length)
  })

  it('every finding carries the human review label and never the word fraud', () => {
    for (const f of seed.findings) expect(f.label).toBe('Potential violation – human review required')
    expect(JSON.stringify(seed).toLowerCase()).not.toContain('fraud')
  })
})

describe('seed realism rules', () => {
  it('computes every payment and total with finance.ts', () => {
    for (const d of seed.deals) {
      for (const v of d.versions) {
        expect(v.amount_financed).toBe(amountFinanced(v))
        expect(v.monthly_payment).toBe(monthlyPayment(v.amount_financed, v.apr, v.term_months))
        expect(v.total_of_payments).toBe(totalOfPayments(v.amount_financed, v.apr, v.term_months))
      }
    }
  })

  it('keeps deal dates, APRs, terms and VINs in range', () => {
    for (const d of seed.deals) {
      expect(d.deal_date >= '2026-10-01' && d.deal_date <= '2026-11-12').toBe(true)
      expect(d.vehicle.vin).toMatch(/^[A-HJ-NPR-Z0-9]{17}$/)
      for (const v of d.versions) {
        expect(v.apr).toBeGreaterThanOrEqual(4.9)
        expect(v.apr).toBeLessThanOrEqual(13.9 + 1.5)
        expect([48, 60, 72, 84]).toContain(v.term_months)
      }
    }
  })

  it('keeps every event inside business hours, Pacific time', () => {
    for (const e of seed.events) {
      const [hm, ampm] = formatTime(e.timestamp).split(' ') as [string, string]
      const hour = (Number(hm.split(':')[0]) % 12) + (ampm === 'PM' ? 12 : 0)
      expect(hour).toBeGreaterThanOrEqual(9)
      expect(hour).toBeLessThan(18)
    }
  })
})

describe('hero deal DT-10482 matches docs/DATA.md', () => {
  const { deal, events } = heroDeal()

  it('has the header facts', () => {
    expect(deal).toMatchObject({
      dealer_id: 'DLR-01',
      customer_display: 'M. Alvarez',
      lender_id: 'LND-01',
      deal_date: '2026-10-20',
      status: 'In review',
      fi_manager_id: 'U-03',
      salesperson_id: 'U-04',
      risk_score: 87,
      refund_exposure: 3300,
      customer_exposure: 5418.96,
      open_findings: 4,
      current_version: 4,
    })
    expect(deal.vehicle).toMatchObject({ year: 2026, make: 'Toyota', model: 'RAV4', trim: 'XLE', condition: 'new', factory_warranty_months: 36 })
  })

  it('has the four versions with exact times and amounts', () => {
    expect(
      deal.versions.map((v) => [formatTime(v.created_at), v.amount_financed, v.term_months, v.monthly_payment, v.total_of_payments, v.reason]),
    ).toEqual([
      ['10:05 AM', 28000, 60, 566.4, 33984, 'Customer accepted price'],
      ['10:40 AM', 31300, 60, 633.15, 37989.25, null],
      ['10:55 AM', 31300, 72, 547.26, 39402.96, null],
      ['11:10 AM', 31300, 72, 547.26, 39402.96, null],
    ])
    expect(deal.versions[0]).toMatchObject({ vehicle_price: 34000, down_payment: 6000, apr: 7.9 })
    expect(deal.versions[1]?.products.map((p) => [p.code, p.price, p.provider_id])).toEqual([
      ['GAP', 900, 'PRV-01'],
      ['VSC', 2400, 'PRV-02'],
    ])
    expect(deal.versions[1]?.products[1]).toMatchObject({ term_months: 72, max_miles: 75000 })
  })

  it('has events E-1040 to E-1046', () => {
    expect(events.map((e) => [e.id, e.type, formatTime(e.timestamp), e.version_after, e.reason === null])).toEqual([
      ['E-1040', 'QUOTE_CREATED', '10:05 AM', 1, false],
      ['E-1041', 'PRICE_AGREED', '10:05 AM', 1, false],
      ['E-1042', 'CREDIT_APPROVED', '10:20 AM', 1, false],
      ['E-1043', 'PRODUCT_ADDED', '10:40 AM', 2, true],
      ['E-1044', 'PRODUCT_ADDED', '10:40 AM', 2, true],
      ['E-1045', 'TERM_CHANGED', '10:55 AM', 3, true],
      ['E-1046', 'CONTRACT_SIGNED', '11:10 AM', 4, true],
    ])
  })

  it('has findings F-2291 to F-2294', () => {
    const findings = seed.findings.filter((f) => f.deal_id === deal.id)
    expect(findings.map((f) => [f.id, f.type, f.severity])).toEqual([
      ['F-2291', 'LATE_ADD_ON', 'high'],
      ['F-2292', 'PAYMENT_MASKING', 'high'],
      ['F-2293', 'WARRANTY_OVERLAP', 'medium'],
      ['F-2294', 'MISSING_REASON', 'low'],
    ])
    expect(findings.find((f) => f.id === 'F-2293')?.title).toBe('Service contract overlaps factory warranty for 36 months')
  })

  it('has the benefit checks', () => {
    const checks = seed.benefit_checks.filter((b) => b.deal_id === deal.id)
    expect(checks.map((c) => [c.product_code, c.verdict])).toEqual([
      ['GAP', 'Likely benefit'],
      ['VSC', 'Partial benefit'],
    ])
    expect(Math.round((checks[0]?.inputs.ltv ?? 0) * 100)).toBe(92)
    expect(checks[1]?.inputs.warranty_overlap_months).toBe(36)
  })

  it('has a pre-written agent summary', () => {
    expect(seed.agent_summaries.find((s) => s.deal_id === deal.id)?.summary).toContain('[F-2291] [F-2292]')
  })
})
