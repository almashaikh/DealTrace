import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { jitterFor } from '@/features/analytics/pricingText'
import { formatMoney, rooftopShortName } from '@/lib/format'
import type { Dealer, PricingDispersion } from '@/types'

const CONFIG = {
  price: { label: 'Price', color: 'var(--dt-text-muted)' },
  outlier: { label: 'Outlier', color: 'var(--dt-sev-critical)' },
} satisfies ChartConfig

interface ChartPoint {
  x: number
  price: number
  deal_id: string
  rooftop: string
  segment: string
  outlier: boolean
}

function Dot({ cx = 0, cy = 0, payload }: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const outlier = payload?.outlier === true
  return (
    <circle
      cx={cx}
      cy={cy}
      r={outlier ? 6 : 4}
      fill={outlier ? 'var(--dt-sev-critical)' : 'var(--dt-text-muted)'}
      fillOpacity={outlier ? 1 : 0.45}
      stroke={outlier ? 'var(--dt-bg-surface)' : 'none'}
      strokeWidth={1.5}
    />
  )
}

/** Tooltip with the deal ID and the price. */
function PriceTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: ChartPoint }> }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs leading-4 shadow-md" role="tooltip">
      <p className="font-mono text-text">{p.deal_id}</p>
      <p className="mt-0.5 text-sm leading-5 font-semibold text-text tabular-nums">{formatMoney(p.price)}</p>
      <p className="text-text-muted">{p.rooftop}</p>
      <p className="text-text-muted">{p.segment}</p>
      {p.outlier && <p className="mt-1 font-medium text-sev-critical">Outlier: flagged for review</p>}
    </div>
  )
}

/** Strip chart: one column per rooftop, every deal a dot, the median as a dashed line, outliers in red. */
export function PricingChart({ data, dealers }: { data: PricingDispersion; dealers: readonly Dealer[] }) {
  const order = dealers.filter((d) => data.points.some((p) => p.dealer_id === d.id) || dealers.length === 1)
  const columns = order.length > 0 ? order : [...dealers]
  const index = new Map(columns.map((d, i) => [d.id, i]))
  const points: ChartPoint[] = data.points
    .filter((p) => index.has(p.dealer_id))
    .map((p) => ({
      x: (index.get(p.dealer_id) ?? 0) + jitterFor(p.deal_id) * 0.6,
      price: p.price,
      deal_id: p.deal_id,
      rooftop: dealers.find((d) => d.id === p.dealer_id)?.name ?? p.dealer_id,
      segment: p.segment,
      outlier: p.is_outlier,
    }))
  const normal = points.filter((p) => !p.outlier)
  const outliers = points.filter((p) => p.outlier)
  const median = data.overall.median

  return (
    <ChartContainer config={CONFIG} className="aspect-auto h-[360px] w-full" role="img" aria-label="Prices by rooftop, with the median and the outliers marked">
      <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          type="number"
          dataKey="x"
          domain={[-0.5, columns.length - 0.5]}
          ticks={columns.map((_, i) => i)}
          tickFormatter={(i: number) => rooftopShortName(columns[Math.round(i)]?.name ?? '')}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
        />
        <YAxis
          type="number"
          dataKey="price"
          domain={[0, (max: number) => Math.ceil((max * 1.05) / 500) * 500]}
          tickFormatter={(v: number) => `$${v.toLocaleString('en-US')}`}
          tickLine={false}
          axisLine={false}
          width={64}
        />
        <ZAxis range={[40, 40]} />
        <Tooltip cursor={false} content={<PriceTooltip />} />
        <ReferenceLine
          y={median}
          stroke="var(--dt-brand)"
          strokeDasharray="5 4"
          strokeWidth={1.5}
          label={{ value: `Median ${formatMoney(median)}`, position: 'insideTopRight', fill: 'var(--dt-brand)', fontSize: 12 }}
        />
        <Scatter name="Price" data={normal} shape={<Dot />} isAnimationActive={false} />
        <Scatter name="Outlier" data={outliers} shape={<Dot />} isAnimationActive={false} />
      </ScatterChart>
    </ChartContainer>
  )
}
