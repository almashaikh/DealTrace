import { LoadingTable } from '@/components/common/LoadingTable'
import { ChartCardSkeleton, KpiRowSkeleton, SkeletonCard } from '@/components/common/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Matches the final dashboard layout: KPIs, two chart rows, a table and the activity feed. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <KpiRowSkeleton count={5} />
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCardSkeleton className="xl:col-span-2" />
        <SkeletonCard>
          <Skeleton className="h-4 w-40" />
          <div className="mt-5 space-y-4">
            {[72, 58, 44, 36, 28, 22].map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-4" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonCard className="p-0 xl:col-span-2">
          <div className="flex items-center justify-between px-4 py-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-24" />
          </div>
          <LoadingTable framed={false} rows={5} columns={[{ width: 'w-16' }, { width: 'w-14' }, { width: 'w-64' }, { width: 'w-16' }, { width: 'w-20', align: 'right' }]} />
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-4 w-36" />
          <div className="mt-5 space-y-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </SkeletonCard>
      </div>
    </div>
  )
}
