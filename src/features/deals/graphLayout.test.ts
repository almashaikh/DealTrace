import { describe, expect, it } from 'vitest'

import { NODE_POSITIONS, defaultGraphPair, formatNodeValue, nodeData } from '@/features/deals/graphLayout'
import { GRAPH_EDGES, GRAPH_NODES, explainChange } from '@/lib/graph'
import { seed } from '@/mocks/db'
import { heroDeal, version } from '@/test/hero'

const { deal } = heroDeal()

describe('graph layout', () => {
  it('places every node and flows left to right along every edge', () => {
    expect(Object.keys(NODE_POSITIONS).sort()).toEqual(GRAPH_NODES.map((n) => n.id).sort())
    for (const e of GRAPH_EDGES) expect(NODE_POSITIONS[e.to].x, `${e.from} -> ${e.to}`).toBeGreaterThan(NODE_POSITIONS[e.from].x)
  })

  it('does not overlap two nodes', () => {
    const spots = Object.values(NODE_POSITIONS).map((p) => `${p.x}:${p.y}`)
    expect(new Set(spots).size).toBe(spots.length)
  })
})

describe('node data for v2 to v3 on DT-10482', () => {
  const e = explainChange(version(deal, 2), version(deal, 3), version(deal, 1))
  const changed = new Set([...e.changed_inputs, ...e.affected])
  const data = (id: string) => nodeData(GRAPH_NODES.find((n) => n.id === id)!, e.before, e.after, changed)

  it('marks term, payment and total as changed with old and new values', () => {
    expect(data('term_months')).toMatchObject({ changed: true, before: '60 months', after: '72 months' })
    expect(data('monthly_payment')).toMatchObject({ changed: true, before: '$633.15', after: '$547.26' })
    expect(data('total_of_payments')).toMatchObject({ changed: true, before: '$37,989.25', after: '$39,402.96' })
  })

  it('leaves price, down payment, products, APR and amount financed unchanged', () => {
    for (const id of ['vehicle_price', 'down_payment', 'products', 'apr', 'amount_financed']) expect(data(id).changed, id).toBe(false)
  })
})

describe('defaultGraphPair', () => {
  it('opens on the last step that changed something: v2 to v3 for the hero deal', () => {
    expect(defaultGraphPair(deal.versions)).toEqual([2, 3])
  })
  it('falls back to first and last for a deal that never changed', () => {
    const same = seed.deals.find((d) => d.versions.length === 1) ?? { versions: [deal.versions[3]!] }
    expect(defaultGraphPair(same.versions).length).toBe(2)
  })
  it('formats values by unit', () => {
    expect(formatNodeValue({ unit: 'money' }, 1234.5)).toBe('$1,234.50')
    expect(formatNodeValue({ unit: 'percent' }, 7.9)).toBe('7.9%')
    expect(formatNodeValue({ unit: 'months' }, 72)).toBe('72 months')
  })
})
