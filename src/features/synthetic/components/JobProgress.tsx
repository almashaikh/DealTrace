import { Check, LoaderCircle } from 'lucide-react'

import { ErrorState } from '@/components/common/ErrorState'
import { SectionCard } from '@/components/common/SectionCard'
import { SYNTHETIC_STEPS, stepIndexAt } from '@/lib/synthetic'
import { cn } from '@/lib/utils'
import type { SyntheticJob } from '@/types'

/** A progress bar with the five named steps. Steps before the current one are checked. */
export function JobProgress({ job, dealCount }: { job: SyntheticJob; dealCount: number }) {
  const current = stepIndexAt(job.progress)
  return (
    <SectionCard title={`Generating ${dealCount.toLocaleString('en-US')} deals`} description={`Job ${job.id}`}>
      <div className="flex items-center gap-3">
        <div role="progressbar" aria-label="Generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress} className="h-2 flex-1 overflow-hidden rounded-md bg-border">
          <div className="h-full rounded-md bg-brand transition-[width] duration-200 ease-out" style={{ width: `${job.progress}%` }} />
        </div>
        <span className="w-10 text-right text-[13px] leading-[18px] font-medium text-text tabular-nums">{job.progress}%</span>
      </div>
      <ol className="mt-4 space-y-2" aria-label="Steps" aria-live="polite">
        {SYNTHETIC_STEPS.map((s, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={s.key} className={cn('flex items-center gap-2 text-[13px] leading-[18px]', done || active ? 'text-text' : 'text-text-muted')} data-state={done ? 'done' : active ? 'active' : 'pending'}>
              {done ? (
                <Check className="size-4 text-success" aria-label="Done" />
              ) : active ? (
                <LoaderCircle className="size-4 animate-spin text-brand" aria-label="Working" />
              ) : (
                <span className="grid size-4 place-items-center" aria-label="Waiting">
                  <span className="size-1.5 rounded-full bg-border" />
                </span>
              )}
              {s.label}
            </li>
          )
        })}
      </ol>
    </SectionCard>
  )
}

export function JobError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="rounded-lg border bg-card">
      <ErrorState error={error} onRetry={onRetry} />
    </div>
  )
}
