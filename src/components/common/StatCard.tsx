import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type ChangeTone = 'positive' | 'negative' | 'neutral'

export interface StatChange {
  /** For example "+12% vs last 30 days". */
  text: string
  direction: 'up' | 'down' | 'flat'
  /** Whether the change is good news. A rise in open findings is negative. */
  tone: ChangeTone
}

interface StatCardProps {
  label: string
  value?: ReactNode
  change?: StatChange
  loading?: boolean
  className?: string
}

const TONE: Record<ChangeTone, string> = {
  positive: 'text-success',
  negative: 'text-sev-high',
  neutral: 'text-text-muted',
}

/** Small muted label, 24px semibold value, small change indicator. */
export function StatCard({ label, value, change, loading = false, className }: StatCardProps) {
  if (loading) return <StatCardSkeleton className={className} />
  const Arrow = change?.direction === 'up' ? ArrowUpRight : change?.direction === 'down' ? ArrowDownRight : Minus
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <p className="text-xs leading-4 text-text-muted">{label}</p>
      <p className="mt-1 text-2xl leading-8 font-semibold tracking-tight text-text tabular-nums">{value}</p>
      {change && (
        <p className={cn('mt-1 flex items-center gap-1 text-xs leading-4 tabular-nums', TONE[change.tone])}>
          <Arrow className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          {change.text}
        </p>
      )}
    </div>
  )
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)} aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-6 w-32" />
      <Skeleton className="mt-3 h-3 w-36" />
    </div>
  )
}
