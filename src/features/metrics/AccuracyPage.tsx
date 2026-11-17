import { Target } from 'lucide-react'
import { CartesianGrid, Line, LineChart, LabelList, XAxis, YAxis } from 'recharts'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { ChartCardSkeleton, KpiRowSkeleton, SkeletonCard } from '@/components/common/skeletons'
import { StatCard } from '@/components/common/StatCard'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cellShare, formatScore, historyPoints } from '@/features/metrics/accuracyText'
import { useAccuracy } from '@/features/metrics/hooks'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Metrics } from '@/types'

const F1_CONFIG = { f1: { label: 'F1', color: 'var(--dt-brand)' } } satisfies ChartConfig

function ConfusionMatrix({ matrix }: { matrix: Metrics['confusion_matrix'] }) {
  const cells = [
    { row: 'Actual issue', col: 'Predicted issue', label: 'True positive', value: matrix.tp, good: true },
    { row: 'Actual issue', col: 'Predicted no issue', label: 'False negative', value: matrix.fn, good: false },
    { row: 'Actual no issue', col: 'Predicted issue', label: 'False positive', value: matrix.fp, good: false },
    { row: 'Actual no issue', col: 'Predicted no issue', label: 'True negative', value: matrix.tn, good: true },
  ]
  const cell = (row: string, col: string) => cells.find((c) => c.row === row && c.col === col)
  const rows = ['Actual issue', 'Actual no issue']
  const cols = ['Predicted issue', 'Predicted no issue']
  return (
    <table className="w-full border-separate border-spacing-1.5 text-center" aria-label="Confusion matrix">
      <thead>
        <tr>
          <td />
          {cols.map((c) => (
            <th key={c} scope="col" className="pb-1 text-xs leading-4 font-medium text-text-muted">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r}>
            <th scope="row" className="w-24 pr-1 text-right text-xs leading-4 font-medium text-text-muted">
              {r}
            </th>
            {cols.map((c) => {
              const x = cell(r, c)
              if (!x) return <td key={c} />
              return (
                <td key={c} className={cn('rounded-lg border px-3 py-4', x.good ? 'bg-brand-subtle' : 'bg-sev-medium/10')} data-cell={x.label}>
                  <p className={cn('text-2xl leading-8 font-semibold tabular-nums', x.good ? 'text-brand' : 'text-sev-medium')}>{formatCount(x.value)}</p>
                  <p className="text-xs leading-4 text-text">{x.label}</p>
                  <p className="text-xs leading-4 text-text-muted tabular-nums">{cellShare(x.value, matrix)}</p>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AccuracySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" role="status" aria-label="Loading accuracy">
      <KpiRowSkeleton count={3} className="xl:grid-cols-3" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <LoadingTable rows={4} columns={[{ width: 'w-36' }, { width: 'w-14', align: 'right' }, { width: 'w-14', align: 'right' }, { width: 'w-14', align: 'right' }, { width: 'w-10', align: 'right' }]} />
        <SkeletonCard>
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </SkeletonCard>
      </div>
      <ChartCardSkeleton heightClass="h-[200px]" />
    </div>
  )
}

export function AccuracyPage() {
  const { data, isPending, isError, error, refetch } = useAccuracy()

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Insights' }, { label: 'Accuracy' }]}
        title="Accuracy"
        subtitle="Detector precision and recall on labelled synthetic test sets."
      />
      {isPending && <AccuracySkeleton />}
      {isError && (
        <div className="rounded-lg border bg-card">
          <ErrorState error={error} onRetry={() => refetch()} />
        </div>
      )}
      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Precision" value={formatScore(data.overall.precision)} />
            <StatCard label="Recall" value={formatScore(data.overall.recall)} />
            <StatCard label="F1" value={formatScore(data.overall.f1)} />
          </div>
          <p className="-mt-2 text-xs leading-4 text-text-muted">On {data.dataset}. Test sets are synthetic: deals built with known injected issues, scored by the same detectors that review real deals.</p>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <SectionCard title="By detector" description="Support is how many injected issues the detector should find" flush={data.per_detector.length > 0}>
              {data.per_detector.length === 0 ? (
                <EmptyState compact icon={Target} title="No detector results are stored for this test set." />
              ) : (
                <Table aria-label="Accuracy by detector">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4">Detector</TableHead>
                      <TableHead className="px-2 text-right">Precision</TableHead>
                      <TableHead className="px-2 text-right">Recall</TableHead>
                      <TableHead className="px-2 text-right">F1</TableHead>
                      <TableHead className="px-4 text-right">Support</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.per_detector.map((r) => (
                      <TableRow key={r.detector}>
                        <TableCell className="px-4">{r.detector}</TableCell>
                        <TableCell className="px-2 text-right font-mono text-xs tabular-nums">{formatScore(r.precision)}</TableCell>
                        <TableCell className="px-2 text-right font-mono text-xs tabular-nums">{formatScore(r.recall)}</TableCell>
                        <TableCell className="px-2 text-right font-mono text-xs tabular-nums">{formatScore(r.f1)}</TableCell>
                        <TableCell className="px-4 text-right tabular-nums">{formatCount(r.support)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>

            <SectionCard title="Confusion matrix" description={`${formatCount(data.confusion_matrix.tp + data.confusion_matrix.fp + data.confusion_matrix.fn + data.confusion_matrix.tn)} deals`}>
              <ConfusionMatrix matrix={data.confusion_matrix} />
            </SectionCard>
          </div>

          <SectionCard title="F1 across test sets" description="Each test set is larger than the one before it">
            <ChartContainer config={F1_CONFIG} className="aspect-auto h-[220px] w-full" role="img" aria-label="F1 score for test sets v1 to v3">
              <LineChart data={historyPoints(data.history)} margin={{ top: 24, right: 32, left: 32, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="axis" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis hide domain={[0.75, 0.93]} />
                <Line dataKey="f1" type="monotone" stroke="var(--color-f1)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-f1)', strokeWidth: 0 }} isAnimationActive={false}>
                  <LabelList dataKey="f1" position="top" offset={10} formatter={(v: unknown) => formatScore(Number(v))} className="fill-foreground text-xs tabular-nums" />
                </Line>
              </LineChart>
            </ChartContainer>
          </SectionCard>
        </div>
      )}
    </>
  )
}
