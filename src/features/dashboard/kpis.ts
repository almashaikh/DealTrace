import type { StatChange } from '@/components/common/StatCard'
import { formatCount, formatDuration, formatMoney } from '@/lib/format'
import type { DashboardKpis, DashboardSummary } from '@/types'

export interface KpiCard {
  id: 'scanned' | 'open' | 'high' | 'refund' | 'median'
  label: string
  value: string
  change: StatChange
}

/** Findings detected across the days of a findings-per-day series. */
export function totalFindings(days: DashboardSummary['findings_by_day']): number {
  return days.reduce((n, d) => n + d.critical + d.high + d.medium + d.low, 0)
}

export const COMPARISON_LABEL = 'vs last 30 days'

const MINUS = '−'

function sign(n: number): string {
  return n > 0 ? '+' : MINUS
}

/**
 * Change against the previous period.
 * `better` says which direction is good news: fewer open findings is good, more deals scanned is neutral.
 */
function change(current: number, previous: number, mode: 'percent' | 'count', better: 'down' | 'neutral'): StatChange {
  const delta = current - previous
  if (previous === 0 && mode === 'percent') return { text: 'No earlier period to compare', direction: 'flat', tone: 'neutral' }
  const size = mode === 'percent' ? Math.round((Math.abs(delta) / previous) * 100) : Math.abs(delta)
  if (delta === 0 || size === 0) return { text: `No change ${COMPARISON_LABEL}`, direction: 'flat', tone: 'neutral' }
  const text = `${sign(delta)}${size}${mode === 'percent' ? '%' : ''} ${COMPARISON_LABEL}`
  const direction = delta > 0 ? 'up' : 'down'
  const tone = better === 'neutral' ? 'neutral' : delta < 0 ? 'positive' : 'negative'
  return { text, direction, tone }
}

/** The five KPI cards, with values and changes computed from api.dashboardSummary. */
export function buildKpiCards(summary: Pick<DashboardSummary, 'kpis' | 'previous'>): KpiCard[] {
  const k: DashboardKpis = summary.kpis
  const p: DashboardKpis = summary.previous
  return [
    { id: 'scanned', label: 'Deals scanned (30 days)', value: formatCount(k.deals_scanned), change: change(k.deals_scanned, p.deals_scanned, 'percent', 'neutral') },
    { id: 'open', label: 'Open findings', value: formatCount(k.open_findings), change: change(k.open_findings, p.open_findings, 'count', 'down') },
    { id: 'high', label: 'High severity', value: formatCount(k.high_severity_open), change: change(k.high_severity_open, p.high_severity_open, 'count', 'down') },
    { id: 'refund', label: 'Refund exposure', value: formatMoney(k.refund_exposure), change: change(k.refund_exposure, p.refund_exposure, 'percent', 'down') },
    {
      id: 'median',
      label: 'Median time to decision',
      value: formatDuration(k.median_decision_minutes),
      change: change(k.median_decision_minutes, p.median_decision_minutes, 'percent', 'down'),
    },
  ]
}
