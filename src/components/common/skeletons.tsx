import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { StatCardSkeleton } from './StatCard'

/** Page-level skeleton building blocks. They match the final layouts so nothing jumps when data arrives. */

export function SkeletonCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)} aria-hidden="true">
      {children}
    </div>
  )
}

export function KpiRowSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5', className)} role="status" aria-label="Loading summary figures">
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

const BAR_HEIGHTS = [38, 54, 46, 70, 62, 48, 80, 66, 52, 74, 58, 44, 68, 60, 50, 76, 64, 56, 72, 46]

export function ChartCardSkeleton({ className, heightClass = 'h-[220px]' }: { className?: string; heightClass?: string }) {
  return (
    <SkeletonCard className={className}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <div className={cn('mt-4 flex items-end gap-1.5 border-b', heightClass)}>
        {BAR_HEIGHTS.map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>
    </SkeletonCard>
  )
}

export function LinesCardSkeleton({ lines = 4, className, title = true }: { lines?: number; className?: string; title?: boolean }) {
  return (
    <SkeletonCard className={className}>
      {title && <Skeleton className="h-4 w-36" />}
      <div className={cn('space-y-3', title && 'mt-4')}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className={cn('h-3.5', i % 2 === 0 ? 'w-36' : 'w-24')} />
          </div>
        ))}
      </div>
    </SkeletonCard>
  )
}

/** Tabs (or a segmented control), a search box and filter buttons above a table. */
export function FilterBarSkeleton({ tabs = 4, filters = 3, className }: { tabs?: number; filters?: number; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)} aria-hidden="true">
      <div className="flex items-center gap-4">
        {Array.from({ length: tabs }, (_, i) => (
          <Skeleton key={i} className={cn('h-5', i === 0 ? 'w-20' : 'w-24')} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-56" />
        {Array.from({ length: filters }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
    </div>
  )
}

export function PaginationSkeleton() {
  return (
    <div className="flex items-center justify-between" aria-hidden="true">
      <Skeleton className="h-3.5 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  )
}

/** Label above a full-width field, repeated. Used for forms and settings. */
export function FieldsSkeleton({ fields = 3, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn('space-y-4', className)} aria-hidden="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  )
}
