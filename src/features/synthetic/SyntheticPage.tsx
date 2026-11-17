import { DatabaseZap, LoaderCircle, Play } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { JobError, JobProgress } from '@/features/synthetic/components/JobProgress'
import { JobSummary } from '@/features/synthetic/components/JobSummary'
import { ParamSlider } from '@/features/synthetic/components/ParamSlider'
import { useStartSyntheticJob, useSyntheticJob } from '@/features/synthetic/hooks'
import { SYNTHETIC_DEFAULTS, SYNTHETIC_DETECTORS, SYNTHETIC_LIMITS } from '@/lib/synthetic'
import { formatCount, formatPercent } from '@/lib/format'
import type { SyntheticJobParams } from '@/types'

type Settings = Omit<SyntheticJobParams, 'detectors'>

export function SyntheticPage() {
  const [params, setParams] = useSearchParams()
  const jobId = params.get('job')
  const [settings, setSettings] = useState<Settings>(SYNTHETIC_DEFAULTS)
  const start = useStartSyntheticJob()
  const job = useSyntheticJob(jobId)
  const running = start.isPending || job.data?.status === 'running'
  const set = <K extends keyof Settings>(key: K) => (value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }))

  function generate() {
    start.mutate(
      { ...settings, detectors: [...SYNTHETIC_DETECTORS] },
      {
        onSuccess: (j) => {
          setParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set('job', j.id)
            return next
          })
          toast.success(`Started ${j.id}: ${formatCount(j.params.deal_count)} deals`)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not start the job. Try again.'),
      },
    )
  }

  function again() {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('job')
      return next
    })
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Tools' }, { label: 'Synthetic data' }]}
        title="Synthetic data"
        subtitle="Generate labelled deals with known issues to test the detectors."
      />
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard title="Deal mix" description="The same settings and seed always give the same deals">
          <div className="space-y-5">
            <ParamSlider id="deal-count" label="Deals" value={settings.deal_count} {...SYNTHETIC_LIMITS.deal_count} format={formatCount} onChange={set('deal_count')} disabled={running} />
            <ParamSlider id="products-per-deal" label="Products per deal" value={settings.products_per_deal} {...SYNTHETIC_LIMITS.products_per_deal} format={(n) => n.toFixed(2)} onChange={set('products_per_deal')} disabled={running} />
            <ParamSlider id="vsc-rate" label="Service-contract rate" value={settings.vsc_rate} {...SYNTHETIC_LIMITS.rate} format={(n) => formatPercent(n)} onChange={set('vsc_rate')} disabled={running} />
            <ParamSlider id="gap-rate" label="GAP rate" value={settings.gap_rate} {...SYNTHETIC_LIMITS.rate} format={(n) => formatPercent(n)} onChange={set('gap_rate')} disabled={running} />
            <ParamSlider id="issue-rate" label="Issue rate" value={settings.issue_rate} {...SYNTHETIC_LIMITS.issue_rate} format={(n) => formatPercent(n)} onChange={set('issue_rate')} disabled={running} />
          </div>
          <div className="mt-5 flex items-center gap-2">
            <Button onClick={generate} disabled={running}>
              {running ? <LoaderCircle className="animate-spin" /> : <Play />}
              {running ? 'Generating' : 'Generate'}
            </Button>
            <Button variant="ghost" size="sm" disabled={running} onClick={() => {
                setSettings(SYNTHETIC_DEFAULTS)
                toast.success('Settings reset to the defaults')
              }}>
              Reset settings
            </Button>
          </div>
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-4">
          {!jobId && !start.isPending && (
            <div className="rounded-lg border bg-card">
              <EmptyState icon={DatabaseZap} title="Set the deal mix and generate a labelled dataset to test the detectors." />
            </div>
          )}
          {start.isPending && (
            <div className="rounded-lg border bg-card p-4" role="status" aria-label="Starting the job">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-4 h-2 w-full" />
            </div>
          )}
          {jobId && job.isError && <JobError error={job.error} onRetry={() => job.refetch()} />}
          {jobId && job.isPending && !job.isError && (
            <div className="rounded-lg border bg-card p-4" role="status" aria-label="Loading the job">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="mt-4 h-2 w-full" />
              <div className="mt-4 space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-3.5 w-40" />
                ))}
              </div>
            </div>
          )}
          {job.data?.status === 'running' && <JobProgress job={job.data} dealCount={job.data.params.deal_count} />}
          {job.data?.status === 'completed' && job.data.result && <JobSummary job={job.data} result={job.data.result} onAgain={again} />}
        </div>
      </div>
    </>
  )
}
