import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney, formatShortDate, rooftopShortName } from '@/lib/format'
import type { DashboardSummary } from '@/types'

/* Severity colours only appear in the severity chart. The other charts use the brand colour. */

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'var(--dt-sev-critical)' },
  high: { label: 'High', color: 'var(--dt-sev-high)' },
  medium: { label: 'Medium', color: 'var(--dt-sev-medium)' },
  low: { label: 'Low', color: 'var(--dt-sev-low)' },
} satisfies ChartConfig

/** Legend order, most severe first. */
const LEGEND_ORDER = ['critical', 'high', 'medium', 'low']

/** Findings detected per day, stacked by severity. Axis for scale, no value labels. */
export function FindingsPerDayChart({ data }: { data: DashboardSummary['findings_by_day'] }) {
  const rows = data.map((d) => ({ ...d, label: formatShortDate(d.date) }))
  return (
    <ChartContainer config={SEVERITY_CONFIG} className="aspect-auto h-[304px] w-full" role="img" aria-label="Findings per day, stacked by severity">
      <BarChart data={rows} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
        <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} itemSorter={(item) => LEGEND_ORDER.indexOf(String(item.dataKey))} />
        <Bar dataKey="low" stackId="severity" fill="var(--color-low)" isAnimationActive={false} />
        <Bar dataKey="medium" stackId="severity" fill="var(--color-medium)" isAnimationActive={false} />
        <Bar dataKey="high" stackId="severity" fill="var(--color-high)" isAnimationActive={false} />
        <Bar dataKey="critical" stackId="severity" fill="var(--color-critical)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  )
}

const TYPE_CONFIG = { count: { label: 'Open findings', color: 'var(--dt-brand)' } } satisfies ChartConfig

/** Open findings by type, horizontal bars with the count at the end of each bar (no value axis). */
export function FindingsByTypeChart({ data }: { data: DashboardSummary['findings_by_type'] }) {
  const height = Math.max(120, data.length * 32 + 8)
  return (
    <ChartContainer config={TYPE_CONFIG} className="aspect-auto w-full" style={{ height }} role="img" aria-label="Open findings by type">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }} barCategoryGap={6}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="label" width={132} tickLine={false} axisLine={false} />
        <Bar dataKey="count" fill="var(--color-count)" radius={3} isAnimationActive={false}>
          <LabelList dataKey="count" position="right" className="fill-foreground text-xs tabular-nums" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

const EXPOSURE_CONFIG = { refund_exposure: { label: 'Refund exposure', color: 'var(--dt-brand)' } } satisfies ChartConfig

/** Refund exposure per rooftop, with the amount at the end of each bar. */
export function ExposureByRooftopChart({ data }: { data: DashboardSummary['exposure_by_dealer'] }) {
  const rows = data.map((d) => ({ ...d, short: rooftopShortName(d.dealer_name) }))
  const height = Math.max(120, rows.length * 44 + 8)
  return (
    <ChartContainer config={EXPOSURE_CONFIG} className="aspect-auto w-full" style={{ height }} role="img" aria-label="Refund exposure by rooftop">
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 84, left: 0, bottom: 0 }} barCategoryGap={10}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="short" width={84} tickLine={false} axisLine={false} />
        <Bar dataKey="refund_exposure" fill="var(--color-refund_exposure)" radius={3} isAnimationActive={false}>
          <LabelList dataKey="refund_exposure" position="right" formatter={(v: unknown) => formatMoney(Number(v))} className="fill-foreground text-xs tabular-nums" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
