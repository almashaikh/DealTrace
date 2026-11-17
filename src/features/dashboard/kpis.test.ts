import { describe, expect, it } from 'vitest'

import { buildKpiCards } from '@/features/dashboard/kpis'
import { api } from '@/lib/api'

describe('buildKpiCards', () => {
  it('shows the numbers that must agree with docs/DATA.md', async () => {
    const cards = buildKpiCards(await api.dashboardSummary('all', '30d'))
    expect(cards.map((c) => [c.label, c.value])).toEqual([
      ['Deals scanned (30 days)', '1,284'],
      ['Open findings', '61'],
      ['High severity', '9'],
      ['Refund exposure', '$48,920.40'],
      ['Median time to decision', '3h 12m'],
    ])
  })

  it('compares with the previous period and marks good and bad news', async () => {
    const cards = Object.fromEntries(buildKpiCards(await api.dashboardSummary('all', '30d')).map((c) => [c.id, c.change]))
    expect(cards.scanned).toEqual({ text: '+12% vs last 30 days', direction: 'up', tone: 'neutral' })
    expect(cards.open).toEqual({ text: '+7 vs last 30 days', direction: 'up', tone: 'negative' })
    expect(cards.high).toEqual({ text: '−2 vs last 30 days', direction: 'down', tone: 'positive' })
    expect(cards.refund).toEqual({ text: '+12% vs last 30 days', direction: 'up', tone: 'negative' })
    expect(cards.median).toEqual({ text: '−20% vs last 30 days', direction: 'down', tone: 'positive' })
  })

  it('handles no change and no earlier period', () => {
    const k = { deals_scanned: 0, open_findings: 5, high_severity_open: 0, refund_exposure: 0, median_decision_minutes: 60 }
    const cards = buildKpiCards({ kpis: k, previous: { ...k, open_findings: 5 } })
    expect(cards.find((c) => c.id === 'open')?.change).toEqual({ text: 'No change vs last 30 days', direction: 'flat', tone: 'neutral' })
    expect(cards.find((c) => c.id === 'scanned')?.change.text).toBe('No earlier period to compare')
  })
})
