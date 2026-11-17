import { Download, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { SectionCard } from '@/components/common/SectionCard'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadSyntheticCsv } from '@/features/synthetic/downloadCsv'
import { formatScore } from '@/features/metrics/accuracyText'
import { DETECTOR_LABELS } from '@/lib/catalog'
import { formatCount, formatPercent } from '@/lib/format'
import type { SyntheticJob, SyntheticJobResult } from '@/types'

function Compare({ label, asked, got, format }: { label: string; asked: number; got: number; format: (n: number) => string }) {
  return (
    <TableRow>
      <TableCell className="px-4">{label}</TableCell>
      <TableCell className="px-2 text-right tabular-nums">{format(asked)}</TableCell>
      <TableCell className="px-4 text-right tabular-nums">{format(got)}</TableCell>
    </TableRow>
  )
}

/** What the run produced: the numbers, how the detectors did, how close the data is to the settings, and the CSV. */
export function JobSummary({ job, result, onAgain }: { job: SyntheticJob; result: SyntheticJobResult; onAgain: () => void }) {
  const p = job.params

  function download() {
    try {
      const { count, filename } = downloadSyntheticCsv(job)
      toast.success(`Downloaded ${formatCount(count)} deals as ${filename}`)
    } catch {
      toast.error('Could not build the CSV. Try again.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Summary"
        description={`${formatCount(result.deals_generated)} deals generated · job ${job.id}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onAgain}>
              <RotateCcw />
              Generate again
            </Button>
            <Button size="sm" onClick={download}>
              <Download />
              Download CSV
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Issues injected" value={formatCount(result.issues_injected)} />
          <StatCard label="Found by the detectors" value={formatCount(result.true_positives)} />
          <StatCard label="Missed" value={formatCount(result.false_negatives)} />
          <StatCard label="False alarms" value={formatCount(result.false_positives)} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div>
            <p className="text-xs leading-4 text-text-muted">Precision</p>
            <p className="mt-0.5 text-xl leading-7 font-semibold text-text tabular-nums">{formatScore(result.precision)}</p>
          </div>
          <div>
            <p className="text-xs leading-4 text-text-muted">Recall</p>
            <p className="mt-0.5 text-xl leading-7 font-semibold text-text tabular-nums">{formatScore(result.recall)}</p>
          </div>
          <div>
            <p className="text-xs leading-4 text-text-muted">F1</p>
            <p className="mt-0.5 text-xl leading-7 font-semibold text-text tabular-nums">{formatScore(result.f1)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-4 text-text-muted">
          Scores are for this run only, from the real detectors on the deals just generated. A false alarm is a flag on a deal that has no injected issue, such as a documented, customer-requested term extension.
        </p>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="By detector" flush>
          <Table aria-label="Results by detector">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Detector</TableHead>
                <TableHead className="px-2 text-right">Injected</TableHead>
                <TableHead className="px-2 text-right">Found</TableHead>
                <TableHead className="px-2 text-right">Missed</TableHead>
                <TableHead className="px-4 text-right">False alarms</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.per_detector.map((r) => (
                <TableRow key={r.detector}>
                  <TableCell className="px-4">{DETECTOR_LABELS[r.detector]}</TableCell>
                  <TableCell className="px-2 text-right tabular-nums">{r.injected}</TableCell>
                  <TableCell className="px-2 text-right tabular-nums">{r.true_positives}</TableCell>
                  <TableCell className="px-2 text-right tabular-nums">{r.false_negatives}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{r.false_positives}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <SectionCard title="Settings and result" description="How close the generated deals are to what you asked for" flush>
          <Table aria-label="Settings against result">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4">Measure</TableHead>
                <TableHead className="px-2 text-right">Asked</TableHead>
                <TableHead className="px-4 text-right">Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <Compare label="Products per deal" asked={p.products_per_deal} got={result.actual.products_per_deal} format={(n) => n.toFixed(2)} />
              <Compare label="Service-contract rate" asked={p.vsc_rate} got={result.actual.vsc_rate} format={(n) => formatPercent(n, 1)} />
              <Compare label="GAP rate" asked={p.gap_rate} got={result.actual.gap_rate} format={(n) => formatPercent(n, 1)} />
              <Compare label="Issue rate" asked={p.issue_rate} got={result.actual.issue_rate} format={(n) => formatPercent(n, 1)} />
            </TableBody>
          </Table>
        </SectionCard>
      </div>
    </div>
  )
}
