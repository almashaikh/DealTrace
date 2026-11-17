import { describe, expect, it } from 'vitest'

import { PRESETS, START_FORM, buildHistory, liveFigures, parseForm, sameTerms, type SandboxForm, type SavedEdit } from '@/features/sandbox/model'
import { runDetectors } from '@/lib/detectors'
import { monthlyPayment, totalOfPayments } from '@/lib/finance'

const start = parseForm(START_FORM).terms!

function findingsFor(form: SandboxForm, flags = { priceAgreed: form.priceAgreed, creditApproved: form.creditApproved }) {
  const terms = parseForm(form).terms!
  const edit: SavedEdit = { terms, reason: form.reason.trim() || null }
  return runDetectors(buildHistory(start, [edit], flags)).map((f) => f.type)
}

describe('form and live figures', () => {
  it('turns the starting form into terms and figures from finance.ts', () => {
    expect(start).toEqual({ vehicle_price: 20000, down_payment: 3500, apr: 7.9, term_months: 60, products: [] })
    const f = liveFigures(start)
    expect(f.amount_financed).toBe(16500)
    expect(f.monthly_payment).toBe(monthlyPayment(16500, 7.9, 60))
    expect(f.total_of_payments).toBe(totalOfPayments(16500, 7.9, 60))
    expect(f.total_interest).toBe(Math.round((f.total_of_payments - 16500) * 100) / 100)
  })

  it('adds the products to the amount financed', () => {
    const t = parseForm({ ...START_FORM, products: ['GAP', 'VSC'] }).terms!
    expect(liveFigures(t).amount_financed).toBe(16500 + 900 + 2400)
  })

  it('reports what is wrong with the form', () => {
    expect(parseForm({ ...START_FORM, price: '' }).errors).toEqual({ price: 'Enter a price above $0.00.' })
    expect(parseForm({ ...START_FORM, down: '25000' }).errors).toEqual({ down: 'The down payment must be less than the price.' })
    expect(parseForm({ ...START_FORM, apr: '40' }).errors).toEqual({ apr: 'Enter an APR between 0% and 36%.' })
    expect(parseForm({ ...START_FORM, price: 'abc', apr: '-1' }).errors).toMatchObject({ price: expect.any(String), apr: expect.any(String) })
  })

  it('compares terms', () => {
    expect(sameTerms(start, parseForm(START_FORM).terms!)).toBe(true)
    expect(sameTerms(start, parseForm({ ...START_FORM, term: 72 }).terms!)).toBe(false)
  })
})

describe('the presets produce their expected finding with the real detectors', () => {
  it('GAP added after price agreement: Late add-on, and only that', () => {
    expect(findingsFor(PRESETS[0]!.form)).toEqual(['LATE_ADD_ON'])
  })

  it('Stretch term to hide products: Payment masking (with the late add-on it comes with)', () => {
    expect(findingsFor(PRESETS[1]!.form)).toEqual(['LATE_ADD_ON', 'PAYMENT_MASKING'])
  })

  it('Rate raised after approval: Rate after approval, and only that', () => {
    expect(findingsFor(PRESETS[2]!.form)).toEqual(['RATE_AFTER_APPROVAL'])
  })

  it('each preset names the finding it expects, and gets it', () => {
    for (const p of PRESETS) expect(findingsFor(p.form), p.id).toContain(p.expects)
  })
})

describe('reasons, toggles and untouched deals', () => {
  it('leaving the reason empty on a change adds Missing reason', () => {
    expect(findingsFor({ ...PRESETS[0]!.form, reason: '' })).toEqual(['LATE_ADD_ON', 'MISSING_REASON'])
    expect(findingsFor({ ...PRESETS[2]!.form, reason: '   ' })).toEqual(['RATE_AFTER_APPROVAL', 'MISSING_REASON'])
  })

  it('an empty reason with no change is nothing to report', () => {
    expect(runDetectors(buildHistory(start, [], { priceAgreed: true, creditApproved: true }))).toEqual([])
  })

  it('without a price-agreed event an added product is not late', () => {
    expect(findingsFor(PRESETS[0]!.form, { priceAgreed: false, creditApproved: true })).toEqual([])
  })

  it('without a credit-approved event a rate change is not after approval', () => {
    expect(findingsFor(PRESETS[2]!.form, { priceAgreed: true, creditApproved: false })).toEqual([])
  })

  it('a reason typed for a change keeps Missing reason away', () => {
    expect(findingsFor({ ...START_FORM, term: 72, reason: 'Customer asked' })).toEqual(['PAYMENT_MASKING'])
  })
})

describe('buildHistory', () => {
  it('records versions and events for each saved edit, in order', () => {
    const e1: SavedEdit = { terms: parseForm(PRESETS[0]!.form).terms!, reason: 'First' }
    const e2: SavedEdit = { terms: parseForm({ ...PRESETS[1]!.form }).terms!, reason: null }
    const { versions, events } = buildHistory(start, [e1, e2], { priceAgreed: true, creditApproved: true })
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3])
    expect(versions[0]).toMatchObject({ label: 'Starting deal', monthly_payment: monthlyPayment(16500, 7.9, 60) })
    expect(versions[1]?.reason).toBe('First')
    expect(versions[2]?.reason).toBeNull()
    expect(events.map((e) => e.type)).toEqual(['QUOTE_CREATED', 'PRICE_AGREED', 'CREDIT_APPROVED', 'PRODUCT_ADDED', 'PRODUCT_ADDED', 'PRODUCT_REMOVED', 'TERM_CHANGED'])
    expect(events.filter((e) => e.type === 'PRODUCT_ADDED').map((e) => e.new_value)).toEqual(['GAP', 'VSC'])
    expect(events.at(-1)).toMatchObject({ old_value: '60', new_value: '72', reason: null, version_after: 3 })
  })
})
