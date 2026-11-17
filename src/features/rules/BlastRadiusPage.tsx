import { Gauge, SearchX } from 'lucide-react'
import { useParams } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { MonoId } from '@/components/common/MonoId'
import { PageHeader } from '@/components/common/PageHeader'
import { SkeletonCard } from '@/components/common/skeletons'
import { StatCardSkeleton } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChangeForm } from '@/features/rules/components/ChangeForm'
import { ImpactResults } from '@/features/rules/components/ImpactResults'
import { useImpactCheck, useRule } from '@/features/rules/hooks'
import { ApiError } from '@/lib/api'
import type { ImpactChange } from '@/types'

/** What the impact check shows while it runs: the same shape as the result. */
function ImpactSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Running impact check" aria-busy="true">
      <SkeletonCard>
        <Skeleton className="h-4 w-80" />
        <Skeleton className="mt-2 h-3 w-96 max-w-full" />
      </SkeletonCard>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <SkeletonCard>
        <Skeleton className="h-4 w-48" />
        <div className="mt-5 space-y-4">
          {[80, 62, 44, 30].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-4" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </SkeletonCard>
      <LoadingTable rows={4} columns={[{ width: 'w-16' }, { width: 'w-20' }, { width: 'w-40' }, { width: 'w-32' }, { width: 'w-8' }, { width: 'w-6', align: 'right' }, { width: 'w-20', align: 'right' }, { width: 'w-16' }]} />
    </div>
  )
}

export function BlastRadiusPage() {
  const { id = '' } = useParams()
  const rule = useRule(id)
  const impact = useImpactCheck(id)
  const crumbs = [{ label: 'Compliance' }, { label: 'Rules', to: '/rules' }, { label: id }, { label: 'Blast radius' }]

  if (rule.isError) {
    const notFound = rule.error instanceof ApiError && rule.error.code === 'NOT_FOUND'
    return (
      <>
        <PageHeader breadcrumbs={crumbs} title="Blast radius" subtitle={`Deals and refund exposure affected by a change to ${id}.`} />
        <div className="rounded-lg border bg-card">
          {notFound ? (
            <EmptyState icon={SearchX} title={`Rule ${id} does not exist.`} action={{ label: 'Back to rules', to: '/rules' }} />
          ) : (
            <ErrorState error={rule.error} onRetry={() => rule.refetch()} />
          )}
        </div>
      </>
    )
  }

  const r = rule.data
  const run = (change: ImpactChange) => impact.mutate(change)

  return (
    <>
      <PageHeader
        breadcrumbs={crumbs}
        title="Blast radius"
        subtitle={`Deals and refund exposure affected by a change to ${id}.`}
        meta={
          r && (
            <>
              <MonoId value={r.id} />
              <span className="text-[13px] leading-[18px] text-text">{r.name}</span>
              <StatusBadge status={r.status} />
              {r.status === 'Draft' && <Badge variant="outline" className="h-5 border-dashed bg-card font-medium text-text-muted">Coming soon</Badge>}
            </>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {!r ? (
          <SkeletonCard aria-busy="true">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-9 w-72" />
          </SkeletonCard>
        ) : (
          <ChangeForm rule={r} running={impact.isPending} onRun={run} />
        )}

        {impact.isPending && <ImpactSkeleton />}
        {impact.isError && (
          <div className="rounded-lg border bg-card">
            <ErrorState error={impact.error} onRetry={() => impact.variables && impact.mutate(impact.variables)} />
          </div>
        )}
        {impact.data && r && <ImpactResults result={impact.data} ruleName={r.name} />}
        {impact.isIdle && (
          <div className="rounded-lg border bg-card">
            <EmptyState icon={Gauge} title="Choose a change and run the impact check to see the deals and rooftops it would touch." />
          </div>
        )}
      </div>
    </>
  )
}
