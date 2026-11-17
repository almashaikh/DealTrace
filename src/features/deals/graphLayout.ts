import { diffVersions } from '@/lib/diff'
import { formatApr, formatMoney } from '@/lib/format'
import type { DealVersion, GraphNode, GraphNodeId, GraphValues } from '@/types'

/** Fixed left-to-right layout: inputs, then amount financed, then the payment, then the total. No dragging. */
export const NODE_WIDTH = 204
export const NODE_HEIGHT = 64

const COLUMN_X = [0, 252, 504, 756] as const
const ROW_Y = 88

export const NODE_POSITIONS: Record<GraphNodeId, { x: number; y: number }> = {
  vehicle_price: { x: COLUMN_X[0], y: 0 },
  down_payment: { x: COLUMN_X[0], y: ROW_Y },
  products: { x: COLUMN_X[0], y: ROW_Y * 2 },
  apr: { x: COLUMN_X[0], y: ROW_Y * 3 },
  term_months: { x: COLUMN_X[0], y: ROW_Y * 4 },
  amount_financed: { x: COLUMN_X[1], y: ROW_Y * 1 },
  monthly_payment: { x: COLUMN_X[2], y: ROW_Y * 2.5 },
  total_of_payments: { x: COLUMN_X[3], y: ROW_Y * 2.5 },
}

export function formatNodeValue(node: Pick<GraphNode, 'unit'>, value: number): string {
  if (node.unit === 'percent') return formatApr(value)
  if (node.unit === 'months') return `${value} months`
  return formatMoney(value)
}

export interface DealNodeData extends Record<string, unknown> {
  label: string
  kind: GraphNode['kind']
  before: string
  after: string
  changed: boolean
}

/** Node data for the graph: label, value, and old → new when the node changed. */
export function nodeData(node: GraphNode, before: GraphValues, after: GraphValues, changedIds: ReadonlySet<GraphNodeId>): DealNodeData {
  return {
    label: node.label,
    kind: node.kind,
    before: formatNodeValue(node, before[node.id]),
    after: formatNodeValue(node, after[node.id]),
    changed: changedIds.has(node.id),
  }
}

/** The last two versions that differ, so the graph opens on the step that tells the story. Falls back to first and last. */
export function defaultGraphPair(versions: readonly DealVersion[]): [number, number] {
  for (let i = versions.length - 1; i > 0; i--) {
    const a = versions[i - 1]
    const b = versions[i]
    if (a && b && diffVersions(a, b).has_changes) return [a.version, b.version]
  }
  const first = versions[0]
  const last = versions[versions.length - 1]
  return [first?.version ?? 1, last?.version ?? 1]
}
