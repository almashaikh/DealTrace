import { LinesCardSkeleton, SkeletonCard } from '@/components/common/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Matches the finding page: narrative, evidence, rule and related findings on the left, decision and details on the right. */
export function FindingSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" aria-busy="true" role="status" aria-label="Loading finding">
      <div className="flex flex-col gap-4">
        <SkeletonCard>
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-4 w-24" />
          <div className="mt-4 divide-y">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-6 py-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3.5 w-64" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-5 w-64" />
          <Skeleton className="mt-3 h-16 w-full" />
        </SkeletonCard>
        <LinesCardSkeleton lines={2} />
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonCard>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-5 w-20" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Skeleton className="col-span-2 h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="col-span-2 h-8" />
          </div>
        </SkeletonCard>
        <LinesCardSkeleton lines={7} />
      </div>
    </div>
  )
}
