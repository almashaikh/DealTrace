import { SearchCheck } from 'lucide-react'
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'
import { Link, useNavigate } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { Money } from '@/components/common/Money'
import { RiskScorePill } from '@/components/common/RiskScore'
import { SectionCard } from '@/components/common/SectionCard'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCount, formatMoney, rooftopShortName } from '@/lib/format'
import type { ImpactResult } from '@/types'

const CONFIG = { value: { label: 'Impact', color: 'var(--dt-brand)' } } satisfies ChartConfig

function RooftopChart({ result }: { result: ImpactResult }) {
  const byMoney = result.estimated_refund_exposure > 0
  const rows = result.by_rooftop.map((r) => ({ name: rooftopShortName(r.dealer_name), full: r.dealer_name, value: byMoney ? r.refund_exposure : r.deals }))
  const height = Math.max(120, rows.length * 44 + 8)
  return (
    <SectionCard
      title={byMoney ? 'Refund exposure by rooftop' : 'Deals by rooftop'}
      description={byMoney ? 'Estimated, spread over the rooftops the change would touch' : 'Deals the change would touch'}
    >
      {rows.length === 0 ? (
        <EmptyState compact icon={SearchCheck} title="No rooftops would be affected by this change." />
      ) : (
        <ChartContainer config={CONFIG} className="aspect-auto w-full" style={{ height }} role="img" aria-label={byMoney ? 'Estimated refund exposure by rooftop' : 'Deals by rooftop'}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 92, left: 0, bottom: 0 }} barCategoryGap={10}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={84} tickLine={false} axisLine={false} />
            <Bar dataKey="value" fill="var(--color-value)" radius={3} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" formatter={(v: unknown) => (byMoney ? formatMoney(Number(v)) : `${v} deals`)} className="fill-foreground text-xs tabular-nums" />
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </SectionCard>
  )
}

/** Headline numbers, rooftop chart and the stored deals the change would affect most. */
export function ImpactResults({ result, ruleName }: { result: ImpactResult; ruleName: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="rounded-lg border bg-card px-4 py-3">
        <p className="text-sm leading-5 font-medium text-text">{result.change_summary}</p>
        <p className="mt-0.5 text-xs leading-4 text-text-muted">
          {ruleName}. Latest change to this rule: {result.latest_change}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Affected deals" value={formatCount(result.affected_deals)} />
        <StatCard label="Rooftops" value={`${result.affected_dealers}`} />
        <StatCard label="Estimated refund exposure" value={formatMoney(result.estimated_refund_exposure)} />
      </div>
      <p className="-mt-2 text-xs leading-4 text-text-muted">Estimated from {formatCount(result.scanned_deals)} deals scanned in the last 30 days. Most of them were cleared automatically and are not stored.</p>

      <RooftopChart result={result} />

      <SectionCard title="Sample deals" description="Stored deals with a finding that cites this rule, largest refund exposure first" flush={result.sample_deals.length > 0}>
        {result.sample_deals.length === 0 ? (
          <EmptyState compact icon={SearchCheck} title="No stored deals are affected by this change." />
        ) : (
          <Table aria-label="Sample deals">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Deal</TableHead>
                <TableHead className="px-2">Customer</TableHead>
                <TableHead className="px-2">Vehicle</TableHead>
                <TableHead className="px-2">Rooftop</TableHead>
                <TableHead className="px-2">Risk</TableHead>
                <TableHead className="px-2 text-right">Findings</TableHead>
                <TableHead className="px-2 text-right">Refund exposure</TableHead>
                <TableHead className="px-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.sample_deals.map((d) => (
                <TableRow key={d.deal_id} className="cursor-pointer" onClick={() => navigate(`/deals/${d.deal_id}`)}>
                  <TableCell className="px-4">
                    <Link to={`/deals/${d.deal_id}`} onClick={(e) => e.stopPropagation()} className="rounded-sm font-mono text-xs text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand">
                      {d.deal_id}
                    </Link>
                  </TableCell>
                  <TableCell className="px-2">{d.customer_display}</TableCell>
                  <TableCell className="px-2">
                    <span className="block max-w-[200px] truncate" title={d.vehicle_label}>
                      {d.vehicle_label}
                    </span>
                  </TableCell>
                  <TableCell className="px-2">
                    <span className="block max-w-[160px] truncate" title={d.dealer_name}>
                      {d.dealer_name}
                    </span>
                  </TableCell>
                  <TableCell className="px-2">
                    <RiskScorePill score={d.risk_score} />
                  </TableCell>
                  <TableCell className="px-2 text-right tabular-nums">{d.findings_citing_rule}</TableCell>
                  <TableCell className="px-2 text-right">
                    <Money mono value={d.refund_exposure} />
                  </TableCell>
                  <TableCell className="px-4">
                    <StatusBadge status={d.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
