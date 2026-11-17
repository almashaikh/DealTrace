import { lowerFirst } from '@/lib/catalog'
import { diffVersions } from '@/lib/diff'
import { amountFinanced, monthlyPayment, productsTotal, roundCents, totalOfPayments } from '@/lib/finance'
import { formatApr, formatMoney, formatSignedMoney } from '@/lib/format'
import type { DealVersion, GraphEdge, GraphExplanation, GraphNode, GraphNodeId, GraphValues } from '@/types'

/**
 * A small typed dependency graph of how deal terms feed the payment.
 * Inputs: vehicle price, down payment, products, APR, term.
 * Derived: amount financed -> monthly payment -> total of payments.
 */

export const GRAPH_NODES: readonly GraphNode[] = [
  { id: 'vehicle_price', label: 'Vehicle price', kind: 'input', unit: 'money' },
  { id: 'down_payment', label: 'Down payment', kind: 'input', unit: 'money' },
  { id: 'products', label: 'Add-on products', kind: 'input', unit: 'money' },
  { id: 'apr', label: 'APR', kind: 'input', unit: 'percent' },
  { id: 'term_months', label: 'Term', kind: 'input', unit: 'months' },
  { id: 'amount_financed', label: 'Amount financed', kind: 'derived', unit: 'money' },
  { id: 'monthly_payment', label: 'Monthly payment', kind: 'derived', unit: 'money' },
  { id: 'total_of_payments', label: 'Total of payments', kind: 'derived', unit: 'money' },
]

export const GRAPH_EDGES: readonly GraphEdge[] = [
  { from: 'vehicle_price', to: 'amount_financed' },
  { from: 'down_payment', to: 'amount_financed' },
  { from: 'products', to: 'amount_financed' },
  { from: 'amount_financed', to: 'monthly_payment' },
  { from: 'apr', to: 'monthly_payment' },
  { from: 'term_months', to: 'monthly_payment' },
  { from: 'monthly_payment', to: 'total_of_payments' },
  { from: 'term_months', to: 'total_of_payments' },
]

/** Values the graph needs that are not nodes of their own (trade-in is folded into amount financed). */
export interface GraphInputs {
  vehicle_price: number
  down_payment: number
  trade_in_value: number
  trade_in_payoff: number
  products: number
  apr: number
  term_months: number
}

type Computer = (values: Partial<GraphValues>, inputs: GraphInputs) => number

function need(values: Partial<GraphValues>, id: GraphNodeId): number {
  const v = values[id]
  if (v === undefined) throw new Error(`Node ${id} was read before it was computed`)
  return v
}

const COMPUTE: Record<GraphNodeId, Computer> = {
  vehicle_price: (_v, i) => i.vehicle_price,
  down_payment: (_v, i) => i.down_payment,
  products: (_v, i) => i.products,
  apr: (_v, i) => i.apr,
  term_months: (_v, i) => i.term_months,
  amount_financed: (v, i) =>
    amountFinanced({
      vehicle_price: need(v, 'vehicle_price'),
      down_payment: need(v, 'down_payment'),
      trade_in_value: i.trade_in_value,
      trade_in_payoff: i.trade_in_payoff,
      products: [{ price: need(v, 'products') }],
    }),
  monthly_payment: (v) => monthlyPayment(need(v, 'amount_financed'), need(v, 'apr'), need(v, 'term_months')),
  // Total of payments uses the unrounded payment, so it is computed from its inputs, not the rounded node value.
  total_of_payments: (v) => totalOfPayments(need(v, 'amount_financed'), need(v, 'apr'), need(v, 'term_months')),
}

/** Kahn's algorithm. Throws if the graph has a cycle. Ties keep node declaration order, so the result is stable. */
export function topologicalOrder(
  nodes: readonly GraphNode[] = GRAPH_NODES,
  edges: readonly GraphEdge[] = GRAPH_EDGES,
): GraphNodeId[] {
  const indegree = new Map<GraphNodeId, number>(nodes.map((n) => [n.id, 0]))
  for (const e of edges) indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1)
  const ready = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id)
  const order: GraphNodeId[] = []
  while (ready.length > 0) {
    const id = ready.shift() as GraphNodeId
    order.push(id)
    for (const e of edges) {
      if (e.from !== id) continue
      const left = (indegree.get(e.to) ?? 0) - 1
      indegree.set(e.to, left)
      if (left === 0) ready.push(e.to)
    }
  }
  if (order.length !== nodes.length) throw new Error('Dependency graph has a cycle')
  return order
}

export function inputsFromVersion(v: DealVersion): GraphInputs {
  return {
    vehicle_price: v.vehicle_price,
    down_payment: v.down_payment,
    trade_in_value: v.trade_in_value,
    trade_in_payoff: v.trade_in_payoff,
    products: productsTotal(v.products),
    apr: v.apr,
    term_months: v.term_months,
  }
}

/** Recomputes every node in topological order. */
export function recalculate(inputs: GraphInputs): GraphValues {
  const values: Partial<GraphValues> = {}
  for (const id of topologicalOrder()) values[id] = COMPUTE[id](values, inputs)
  return values as GraphValues
}

/** Every node downstream of the given nodes (not including them). */
export function downstreamOf(ids: readonly GraphNodeId[], edges: readonly GraphEdge[] = GRAPH_EDGES): GraphNodeId[] {
  const out = new Set<GraphNodeId>()
  const queue = [...ids]
  while (queue.length > 0) {
    const id = queue.shift() as GraphNodeId
    for (const e of edges) {
      if (e.from === id && !out.has(e.to)) {
        out.add(e.to)
        queue.push(e.to)
      }
    }
  }
  return topologicalOrder().filter((id) => out.has(id) && !ids.includes(id))
}

function formatNode(id: GraphNodeId, value: number): string {
  const node = GRAPH_NODES.find((n) => n.id === id)
  if (node?.unit === 'percent') return formatApr(value)
  if (node?.unit === 'months') return `${value} months`
  return formatMoney(value)
}

function joinAnd(parts: readonly string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * One sentence on why the monthly payment moved between two versions.
 * Causes are listed only when they push the payment the way it moved. Products added while the payment
 * fell come last, as "even though": they are the part a buyer is less likely to notice.
 * `baseline` is the version the buyer first agreed to (v1), used for products added in an earlier step.
 */
export function paymentHeadline(from: DealVersion, to: DealVersion, baseline: DealVersion = from): string {
  const payDelta = roundCents(to.monthly_payment - from.monthly_payment)
  if (payDelta === 0) return `Payment did not change between v${from.version} and v${to.version}.`
  const rose = payDelta > 0
  const causes: string[] = []

  if (to.term_months !== from.term_months && (to.term_months > from.term_months) !== rose) {
    causes.push(`the term ${to.term_months > from.term_months ? 'rose' : 'fell'} from ${from.term_months} to ${to.term_months} months`)
  }
  if (to.apr !== from.apr && (to.apr > from.apr) === rose) {
    causes.push(`the APR ${to.apr > from.apr ? 'rose' : 'fell'} from ${formatApr(from.apr)} to ${formatApr(to.apr)}`)
  }
  const productDelta = roundCents(productsTotal(to.products) - productsTotal(from.products))
  const otherFinanced = roundCents(to.amount_financed - from.amount_financed - productDelta)
  if (productDelta !== 0 && productDelta > 0 === rose) {
    causes.push(`${formatMoney(Math.abs(productDelta))} of products ${productDelta > 0 ? 'was added' : 'was removed'}`)
  }
  if (otherFinanced !== 0 && otherFinanced > 0 === rose) {
    causes.push(`the amount financed ${otherFinanced > 0 ? 'rose' : 'fell'} by ${formatMoney(Math.abs(otherFinanced))} from the price, down payment or trade-in`)
  }

  let even = ''
  if (!rose) {
    const addedSinceQuote = roundCents(productsTotal(to.products.filter((p) => !baseline.products.some((b) => b.code === p.code))))
    const addedAmount = productDelta > 0 ? productDelta : addedSinceQuote
    if (addedAmount > 0) even = `, even though ${formatMoney(addedAmount)} of products was added`
  }
  return `Payment ${rose ? 'rose' : 'fell'} ${formatMoney(Math.abs(payDelta))}${causes.length ? ` because ${joinAnd(causes)}` : ''}${even}.`
}

const INPUT_IDS: readonly GraphNodeId[] = ['vehicle_price', 'down_payment', 'products', 'apr', 'term_months']

/** Plain-English explanation of what changed between two versions and why the payment moved. */
export function explainChange(from: DealVersion, to: DealVersion, baseline?: DealVersion): GraphExplanation {
  const before = recalculate(inputsFromVersion(from))
  const after = recalculate(inputsFromVersion(to))
  const tradeChanged = from.trade_in_value !== to.trade_in_value || from.trade_in_payoff !== to.trade_in_payoff
  const changed_inputs = INPUT_IDS.filter((id) => before[id] !== after[id])
  const affected = topologicalOrder().filter((id) => !INPUT_IDS.includes(id) && before[id] !== after[id])

  const sentences: string[] = []
  const diff = diffVersions(from, to)
  for (const id of changed_inputs) {
    if (id === 'products') {
      const parts = [
        ...diff.products_added.map((p) => `added ${lowerFirst(p.name)} (${formatMoney(p.price)})`),
        ...diff.products_removed.map((p) => `removed ${lowerFirst(p.name)} (${formatMoney(p.price)})`),
        ...diff.products_changed.map((p) => `repriced ${lowerFirst(p.name)} (${formatSignedMoney(p.price_delta)})`),
      ]
      sentences.push(
        `Add-on products went from ${formatMoney(before.products)} to ${formatMoney(after.products)}${parts.length ? `: ${parts.join(', ')}` : ''}.`,
      )
    } else {
      const label = GRAPH_NODES.find((n) => n.id === id)?.label ?? id
      sentences.push(`${label} changed from ${formatNode(id, before[id])} to ${formatNode(id, after[id])}.`)
    }
  }
  if (tradeChanged) {
    sentences.push(
      `Trade-in changed from ${formatMoney(from.trade_in_value)} value / ${formatMoney(from.trade_in_payoff)} payoff to ${formatMoney(to.trade_in_value)} / ${formatMoney(to.trade_in_payoff)}.`,
    )
  }
  if (before.amount_financed !== after.amount_financed) {
    sentences.push(
      `Amount financed moved from ${formatMoney(before.amount_financed)} to ${formatMoney(after.amount_financed)} (${formatSignedMoney(roundCents(after.amount_financed - before.amount_financed))}).`,
    )
  }
  if (before.monthly_payment !== after.monthly_payment) {
    sentences.push(
      `Monthly payment moved from ${formatMoney(before.monthly_payment)} to ${formatMoney(after.monthly_payment)} (${formatSignedMoney(roundCents(after.monthly_payment - before.monthly_payment))}).`,
    )
  }
  if (before.total_of_payments !== after.total_of_payments) {
    sentences.push(
      `Total of payments moved from ${formatMoney(before.total_of_payments)} to ${formatMoney(after.total_of_payments)} (${formatSignedMoney(roundCents(after.total_of_payments - before.total_of_payments))}).`,
    )
  }

  let summary: string
  if (changed_inputs.length === 0 && !tradeChanged) {
    summary = `No deal terms changed between v${from.version} and v${to.version}.`
  } else {
    const payDelta = roundCents(after.monthly_payment - before.monthly_payment)
    const topDelta = roundCents(after.total_of_payments - before.total_of_payments)
    const payPart =
      payDelta === 0 ? 'the monthly payment did not change' : `the monthly payment ${payDelta > 0 ? 'rose' : 'fell'} by ${formatMoney(Math.abs(payDelta))}`
    const topPart =
      topDelta === 0 ? 'the total of payments did not change' : `the total of payments ${topDelta > 0 ? 'rose' : 'fell'} by ${formatMoney(Math.abs(topDelta))}`
    summary = `From v${from.version} to v${to.version}, ${payPart} and ${topPart}.`
  }

  return { changed_inputs, affected, before, after, sentences, summary, headline: paymentHeadline(from, to, baseline) }
}
