import { History } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { MonoId } from '@/components/common/MonoId'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDealActivity } from '@/features/deals/hooks'
import { formatDateTime, shortHash } from '@/lib/format'

/** The deal's audit events: scans, new findings and every decision, each linked into the hash chain. */
export function ActivityTab({ dealId }: { dealId: string }) {
  const { data, isPending, isError, error, refetch } = useDealActivity(dealId)

  if (isPending) return <LoadingTable rows={6} columns={[{ width: 'w-32' }, { width: 'w-44' }, { width: 'w-24' }, { width: 'w-20' }, { width: 'w-28' }]} />
  if (isError) {
    return (
      <div className="rounded-lg border bg-card">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <EmptyState icon={History} title="No audit events are recorded for this deal yet." />
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table aria-label="Audit events for this deal">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">Time</TableHead>
            <TableHead className="px-4">Event</TableHead>
            <TableHead className="px-4">By</TableHead>
            <TableHead className="px-4">Record</TableHead>
            <TableHead className="px-4">Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="px-4 text-text-muted">{formatDateTime(a.timestamp)}</TableCell>
              <TableCell className="px-4">{a.action}</TableCell>
              <TableCell className="px-4">{a.actor_name}</TableCell>
              <TableCell className="px-4">
                {a.entity === 'finding' ? (
                  <Link to={`/findings/${a.entity_id}`} className="font-mono text-xs text-brand hover:underline">
                    {a.entity_id}
                  </Link>
                ) : (
                  <span className="font-mono text-xs">{a.entity_id}</span>
                )}
              </TableCell>
              <TableCell className="px-4">
                <MonoId value={a.hash} display={shortHash(a.hash)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
