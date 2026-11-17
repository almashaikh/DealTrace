import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type OnChangeFn, type RowSelectionState } from '@tanstack/react-table'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { Money } from '@/components/common/Money'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { SortButton } from '@/components/common/SortButton'
import { StatusBadge } from '@/components/common/StatusBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAge } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { FindingListItem, FindingSortField, SortDirection, User } from '@/types'

/** Header cell ids that can be sorted, and the api field each one sorts by. */
const SORT_FIELD_BY_COLUMN: Record<string, FindingSortField> = {
  severity: 'severity',
  refund: 'refund_exposure',
  age: 'detected_at',
}

const AGE_SORT_TITLE = 'Newest first when descending'

interface QueueTableProps {
  rows: FindingListItem[]
  users: readonly User[]
  sort: FindingSortField
  dir: SortDirection
  onSort: (field: FindingSortField) => void
  rowSelection: RowSelectionState
  onRowSelectionChange: OnChangeFn<RowSelectionState>
  /** Dim the rows while a new page or filter loads. */
  stale: boolean
  /** Reference time for the Age column. */
  now: number
}

export function QueueTable({ rows, users, sort, dir, onSort, rowSelection, onRowSelectionChange, stale, now }: QueueTableProps) {
  const navigate = useNavigate()
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const columns = useMemo<ColumnDef<FindingListItem>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all findings on this page"
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.id}`}
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(v === true)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        id: 'severity',
        header: () => <SortButton label="Severity" field="severity" sort={sort} dir={dir} onSort={onSort} />,
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
      },
      {
        id: 'finding',
        header: 'Finding',
        cell: ({ row }) => (
          <Link
            to={`/findings/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-sm font-mono text-xs text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
          >
            {row.original.id}
          </Link>
        ),
      },
      {
        id: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <span className="block max-w-[270px] truncate" title={row.original.title}>
            {row.original.title}
          </span>
        ),
      },
      { id: 'deal', header: 'Deal', cell: ({ row }) => <span className="font-mono text-xs">{row.original.deal_id}</span> },
      {
        id: 'rooftop',
        header: 'Rooftop',
        cell: ({ row }) => (
          <span className="block max-w-[132px] truncate" title={row.original.dealer_name}>
            {row.original.dealer_name}
          </span>
        ),
      },
      { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customer_display },
      {
        id: 'refund',
        header: () => <SortButton label="Refund exposure" field="refund_exposure" sort={sort} dir={dir} onSort={onSort} align="right" />,
        cell: ({ row }) => <Money mono value={row.original.refund_exposure} />,
      },
      {
        id: 'age',
        header: () => <SortButton label="Age" field="detected_at" sort={sort} dir={dir} onSort={onSort} align="right" title={AGE_SORT_TITLE} />,
        cell: ({ row }) => <span className="tabular-nums text-text-muted">{formatAge(row.original.detected_at, now)}</span>,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => {
          const u = userById.get(row.original.assignee_id)
          return u ? <UserAvatar name={u.name} initials={u.initials} /> : <span className="text-text-muted">Unassigned</span>
        },
      },
      { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [sort, dir, onSort, now, userById],
  )

  // TanStack Table returns functions React Compiler cannot memoize; nothing here is passed to memoized children.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange,
  })

  const rightAligned = new Set(['refund', 'age'])

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table containerClassName="max-h-[calc(100vh-380px)] min-h-[280px] overflow-auto" aria-label="Findings" className={cn(stale && 'opacity-60 transition-opacity')}>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => {
                const field = SORT_FIELD_BY_COLUMN[header.column.id]
                const ariaSort = field ? (sort === field ? (dir === 'desc' ? 'descending' : 'ascending') : 'none') : undefined
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={ariaSort}
                    className={cn('px-2', header.column.id === 'select' && 'w-10 pr-0', rightAligned.has(header.column.id) && 'text-right')}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? 'selected' : undefined}
              className="cursor-pointer"
              onClick={() => navigate(`/findings/${row.original.id}`)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={cn('px-2', cell.column.id === 'select' && 'pr-0', rightAligned.has(cell.column.id) && 'text-right')}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
