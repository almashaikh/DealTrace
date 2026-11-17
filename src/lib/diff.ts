import { PRODUCT_NAMES } from '@/lib/catalog'
import { roundCents } from '@/lib/finance'
import type { DealVersion, DiffFieldKey, FieldChange, Product, ProductChange, VersionDiff } from '@/types'

export const DIFF_FIELDS: readonly { field: DiffFieldKey; label: string; kind: FieldChange['kind'] }[] = [
  { field: 'vehicle_price', label: 'Vehicle price', kind: 'money' },
  { field: 'down_payment', label: 'Down payment', kind: 'money' },
  { field: 'trade_in_value', label: 'Trade-in value', kind: 'money' },
  { field: 'trade_in_payoff', label: 'Trade-in payoff', kind: 'money' },
  { field: 'amount_financed', label: 'Amount financed', kind: 'money' },
  { field: 'apr', label: 'APR', kind: 'percent' },
  { field: 'term_months', label: 'Term', kind: 'months' },
  { field: 'monthly_payment', label: 'Monthly payment', kind: 'money' },
  { field: 'total_of_payments', label: 'Total of payments', kind: 'money' },
]

function productSummary(p: Product) {
  return {
    code: p.code,
    name: PRODUCT_NAMES[p.code],
    price: p.price,
    term_months: p.term_months,
    ...(p.max_miles !== undefined ? { max_miles: p.max_miles } : {}),
  }
}

function productTerms(p: Product): ProductChange['before'] {
  return { price: p.price, term_months: p.term_months, ...(p.max_miles !== undefined ? { max_miles: p.max_miles } : {}) }
}

/** Field-by-field diff between two versions of the same deal, including products added, removed and repriced. */
export function diffVersions(from: DealVersion, to: DealVersion): VersionDiff {
  const changes: FieldChange[] = []
  for (const { field, label, kind } of DIFF_FIELDS) {
    const before = from[field]
    const after = to[field]
    if (before !== after) {
      const delta = kind === 'months' ? after - before : kind === 'percent' ? Math.round((after - before) * 1000) / 1000 : roundCents(after - before)
      changes.push({ field, label, kind, before, after, delta })
    }
  }

  const fromByCode = new Map(from.products.map((p) => [p.code, p]))
  const toByCode = new Map(to.products.map((p) => [p.code, p]))

  const products_added = to.products.filter((p) => !fromByCode.has(p.code)).map(productSummary)
  const products_removed = from.products.filter((p) => !toByCode.has(p.code)).map(productSummary)
  const products_changed: ProductChange[] = []
  for (const after of to.products) {
    const before = fromByCode.get(after.code)
    if (!before) continue
    if (before.price !== after.price || before.term_months !== after.term_months || before.max_miles !== after.max_miles) {
      products_changed.push({
        code: after.code,
        name: PRODUCT_NAMES[after.code],
        before: productTerms(before),
        after: productTerms(after),
        price_delta: roundCents(after.price - before.price),
      })
    }
  }

  return {
    from_version: from.version,
    to_version: to.version,
    from_created_at: from.created_at,
    to_created_at: to.created_at,
    changes,
    products_added,
    products_removed,
    products_changed,
    has_changes: changes.length + products_added.length + products_removed.length + products_changed.length > 0,
  }
}
