import { Link, useNavigate } from 'react-router'

import { Money } from '@/components/common/Money'
import { RiskScorePill } from '@/components/common/RiskScore'
import { SortButton } from '@/components/common/SortButton'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Dealer, Deal, DealSortField, SortDirection } from '@/types'

interface DealsTableProps {
  rows: Deal[]
  dealers: readonly Dealer[]
  sort: DealSortField
  dir: SortDirection
  onSort: (field: DealSortField) => void
  /** Dim the rows while a new page or filter loads. */
  stale: boolean
}

export function DealsTable({ rows, dealers, sort, dir, onSort, stale }: DealsTableProps) {
  const navigate = useNavigate()
  const dealerName = (id: string) => dealers.find((d) => d.id === id)?.name ?? id
  const head = (label: string, field: DealSortField, align?: 'right') => (
    <SortButton label={label} field={field} sort={sort} dir={dir} onSort={onSort} align={align} />
  )
  const ariaSort = (field: DealSortField) => (sort === field ? (dir === 'desc' ? 'descending' : 'ascending') : 'none')

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table containerClassName="max-h-[calc(100vh-380px)] min-h-[280px] overflow-auto" aria-label="Deals" className={cn(stale && 'opacity-60 transition-opacity')}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-2">Deal</TableHead>
            <TableHead className="px-2">Customer</TableHead>
            <TableHead className="px-2">Vehicle</TableHead>
            <TableHead className="px-2">Rooftop</TableHead>
            <TableHead className="px-2" aria-sort={ariaSort('risk_score')}>
              {head('Risk', 'risk_score')}
            </TableHead>
            <TableHead className="px-2 text-right" aria-sort={ariaSort('refund_exposure')}>
              {head('Refund exposure', 'refund_exposure', 'right')}
            </TableHead>
            <TableHead className="px-2 text-right" aria-sort={ariaSort('customer_exposure')}>
              {head('Customer exposure', 'customer_exposure', 'right')}
            </TableHead>
            <TableHead className="px-2 text-right" aria-sort={ariaSort('open_findings')}>
              {head('Findings', 'open_findings', 'right')}
            </TableHead>
            <TableHead className="px-2">Status</TableHead>
            <TableHead className="px-2" aria-sort={ariaSort('deal_date')}>
              {head('Deal date', 'deal_date')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/deals/${d.id}`)}>
              <TableCell className="px-2">
                <Link
                  to={`/deals/${d.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-sm font-mono text-xs text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {d.id}
                </Link>
              </TableCell>
              <TableCell className="px-2">{d.customer_display}</TableCell>
              <TableCell className="px-2">
                <span className="block max-w-[190px] truncate" title={`${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} ${d.vehicle.trim}`}>
                  {d.vehicle.year} {d.vehicle.make} {d.vehicle.model} {d.vehicle.trim}
                </span>
              </TableCell>
              <TableCell className="px-2">
                <span className="block max-w-[150px] truncate" title={dealerName(d.dealer_id)}>
                  {dealerName(d.dealer_id)}
                </span>
              </TableCell>
              <TableCell className="px-2">
                <RiskScorePill score={d.risk_score} />
              </TableCell>
              <TableCell className="px-2 text-right">
                <Money mono value={d.refund_exposure} />
              </TableCell>
              <TableCell className="px-2 text-right">
                <Money mono value={d.customer_exposure} />
              </TableCell>
              <TableCell className="px-2 text-right tabular-nums">{d.open_findings}</TableCell>
              <TableCell className="px-2">
                <StatusBadge status={d.status} />
              </TableCell>
              <TableCell className="px-2 text-text-muted">{formatDate(d.deal_date)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
