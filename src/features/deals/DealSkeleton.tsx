import { KpiRowSkeleton, LinesCardSkeleton, SkeletonCard } from '@/components/common/skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/** Matches the deal page: summary strip, tab bar, then the overview layout. */
export function DealSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" role="status" aria-label="Loading deal">
      <KpiRowSkeleton count={4} className="xl:grid-cols-4" />
      <div className="flex items-center gap-5 border-b pb-2.5" aria-hidden="true">
        {[20, 18, 28, 26, 18, 32, 18].map((w, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <LinesCardSkeleton lines={4} />
          <SkeletonCard>
            <Skeleton className="h-4 w-44" />
            <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>
        <LinesCardSkeleton lines={3} />
      </div>
    </div>
  )
}
