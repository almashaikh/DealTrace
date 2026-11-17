import { CheckCheck } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { SectionCard } from '@/components/common/SectionCard'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { useRelatedFindings } from '@/features/queue/hooks'

/** Other findings on the same deal. */
export function RelatedFindings({ dealId, currentId }: { dealId: string; currentId: string }) {
  const { data, isPending, isError, error, refetch } = useRelatedFindings(dealId)
  const others = data?.items.filter((f) => f.id !== currentId) ?? []
  return (
    <SectionCard title="Related findings" description={`Other findings on ${dealId}`} flush>
      {isPending && (
        <div className="space-y-3 p-4" role="status" aria-label="Loading related findings">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      )}
      {isError && <ErrorState compact error={error} onRetry={() => refetch()} />}
      {data && others.length === 0 && <EmptyState compact icon={CheckCheck} title="No other findings on this deal." />}
      {others.length > 0 && (
        <ul className="divide-y">
          {others.map((f) => (
            <li key={f.id}>
              <Link to={`/findings/${f.id}`} className="flex items-center gap-3 px-4 py-2.5 outline-none hover:bg-app focus-visible:bg-app">
                <SeverityBadge severity={f.severity} />
                <span className="font-mono text-xs text-brand">{f.id}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-text" title={f.title}>
                  {f.title}
                </span>
                <StatusBadge status={f.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
