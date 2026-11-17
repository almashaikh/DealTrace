import { describe, expect, it } from 'vitest'

import { diffVersions } from '@/lib/diff'
import { heroDeal, version } from '@/test/hero'

describe('diffVersions', () => {
  it('diffs the hero deal from v1 to v3', () => {
    const { deal } = heroDeal()
    const d = diffVersions(version(deal, 1), version(deal, 3))

    expect(d.from_version).toBe(1)
    expect(d.to_version).toBe(3)
    expect(d.has_changes).toBe(true)
    expect(Object.fromEntries(d.changes.map((c) => [c.field, [c.before, c.after, c.delta]]))).toEqual({
      amount_financed: [28000, 31300, 3300],
      term_months: [60, 72, 12],
      monthly_payment: [566.4, 547.26, -19.14],
      total_of_payments: [33984, 39402.96, 5418.96],
    })
    expect(d.products_added.map((p) => [p.code, p.price])).toEqual([
      ['GAP', 900],
      ['VSC', 2400],
    ])
    expect(d.products_removed).toEqual([])
    expect(d.products_changed).toEqual([])
  })

  it('reports removed and repriced products', () => {
    const { deal } = heroDeal()
    const v3 = version(deal, 3)
    const changed = { ...v3, version: 9, products: [{ ...v3.products[1]!, price: 1995 }] }
    const d = diffVersions(v3, changed)
    expect(d.products_removed.map((p) => p.code)).toEqual(['GAP'])
    expect(d.products_changed).toEqual([
      expect.objectContaining({ code: 'VSC', price_delta: -405, before: expect.objectContaining({ price: 2400 }) }),
    ])
  })

  it('finds no changes between v3 and the signed v4', () => {
    const { deal } = heroDeal()
    expect(diffVersions(version(deal, 3), version(deal, 4)).has_changes).toBe(false)
  })
})
