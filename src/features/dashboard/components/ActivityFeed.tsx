import { Car, CircleCheck, FileText, Inbox, Scale, ShieldAlert, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { SectionCard } from '@/components/common/SectionCard'
import { Skeleton } from '@/components/ui/skeleton'
import { useRecentActivity } from '@/features/dashboard/hooks'
import { formatDateTime } from '@/lib/format'
import type { ActivityItem } from '@/types'

const ICONS: Record<ActivityItem['kind'], LucideIcon> = {
  finding: ShieldAlert,
  decision: CircleCheck,
  deal: Car,
  rule: Scale,
  report: FileText,
}

function Row({ item }: { item: ActivityItem }) {
  const Icon = ICONS[item.kind]
  const body = (
    <>
      <span className="grid size-6 shrink-0 place-items-center rounded-md border bg-card text-text-muted">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-[18px] text-text">
          <span className="font-medium">{item.actor_name}</span> {item.text}
        </span>
        <span className="block text-xs leading-4 text-text-muted">{formatDateTime(item.timestamp)}</span>
      </span>
    </>
  )
  const className = 'flex items-start gap-3 px-4 py-2.5'
  return item.href ? (
    <Link to={item.href} className={`${className} outline-none hover:bg-app focus-visible:bg-app`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** Latest decisions, new findings and assignments from the audit log. */
export function ActivityFeed({ dealerId }: { dealerId: string | null }) {
  const { data, isPending, isError, error, refetch } = useRecentActivity(dealerId)
  return (
    <SectionCard title="Recent activity" description="From the audit log" flush>
      {isPending && (
        <div className="space-y-4 p-4" role="status" aria-label="Loading recent activity">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-6 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      )}
      {isError && <ErrorState error={error} onRetry={() => refetch()} compact />}
      {data && data.length === 0 && <EmptyState compact icon={Inbox} title="No activity for this rooftop yet." />}
      {data && data.length > 0 && (
        <ul className="divide-y">
          {data.map((item) => (
            <li key={item.id}>
              <Row item={item} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
