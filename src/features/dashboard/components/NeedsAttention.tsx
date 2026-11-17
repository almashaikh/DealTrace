import { CheckCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { Money } from '@/components/common/Money'
import { SectionCard } from '@/components/common/SectionCard'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useNeedsAttention } from '@/features/dashboard/hooks'
import { useDealerParam } from '@/app/useDealerParam'

/** The five open findings with the largest refund exposure. */
export function NeedsAttention({ dealerId }: { dealerId: string | null }) {
  const { data, isPending, isError, error, refetch } = useNeedsAttention(dealerId)
  const { search } = useDealerParam()
  const navigate = useNavigate()
  const queueHref = `/queue${search}`

  return (
    <SectionCard
      title="Needs attention"
      description="Open findings with the largest refund exposure"
      flush
      className="xl:col-span-2"
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to={queueHref}>View queue</Link>
        </Button>
      }
    >
      {isPending && <LoadingTable framed={false} rows={5} columns={[{ width: 'w-16' }, { width: 'w-14' }, { width: 'w-64' }, { width: 'w-16' }, { width: 'w-20', align: 'right' }]} />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} compact />}
      {data && data.items.length === 0 && <EmptyState compact icon={CheckCheck} title="No open findings for this rooftop." action={{ label: 'Open the review queue', to: queueHref }} />}
      {data && data.items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-24">Severity</TableHead>
              <TableHead className="w-20">Finding</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-24">Deal</TableHead>
              <TableHead className="w-28 text-right">Refund exposure</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((f) => (
              <TableRow key={f.id} className="cursor-pointer" onClick={() => navigate(`/findings/${f.id}`)}>
                <TableCell>
                  <SeverityBadge severity={f.severity} />
                </TableCell>
                <TableCell>
                  <Link to={`/findings/${f.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-brand hover:underline">
                    {f.id}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[360px] truncate" title={f.title}>
                  {f.title}
                </TableCell>
                <TableCell className="font-mono text-xs">{f.deal_id}</TableCell>
                <TableCell className="text-right">
                  <Money mono value={f.refund_exposure} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
