import type { RowSelectionState } from '@tanstack/react-table'
import { Download, Inbox, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useDealers, useMe, useUsers } from '@/app/queries'
import { useDealerParam } from '@/app/useDealerParam'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { FilterBarSkeleton, PaginationSkeleton } from '@/components/common/skeletons'
import { Button } from '@/components/ui/button'
import { BulkAssignDialog } from '@/features/queue/components/BulkAssignDialog'
import { QueueTable } from '@/features/queue/components/QueueTable'
import { QueueToolbar } from '@/features/queue/components/QueueToolbar'
import { exportFindingsCsv } from '@/features/queue/exportFindings'
import { useFindings } from '@/features/queue/hooks'
import { hasActiveFilters, toApiQuery } from '@/features/queue/queueParams'
import { useQueueParams } from '@/features/queue/useQueueParams'
import { formatCount } from '@/lib/format'
import type { FindingCounts, FindingSortField } from '@/types'

const QUEUE_COLUMNS = [
  { width: 'w-4' },
  { width: 'w-16' },
  { width: 'w-14' },
  { width: 'w-64' },
  { width: 'w-16' },
  { width: 'w-32' },
  { width: 'w-20' },
  { width: 'w-20', align: 'right' as const },
  { width: 'w-8', align: 'right' as const },
  { width: 'w-6' },
  { width: 'w-16' },
]

export function QueuePage() {
  const { state, update, clearFilters } = useQueueParams()
  const { dealerId, setDealer } = useDealerParam()
  const { data: me } = useMe()
  const { data: users } = useUsers()
  const { data: dealers } = useDealers()
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useFindings(state, dealerId)

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [assignOpen, setAssignOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const apiQuery = useMemo(() => toApiQuery(state, dealerId), [state, dealerId])
  const filterKey = JSON.stringify(apiQuery.filters)
  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  // Age is measured from when the page opened, so the column does not tick while it sits idle.
  const [now] = useState(() => Date.now())

  // Keep the tabs and filters on screen when a request fails, using the last counts that loaded.
  const [lastCounts, setLastCounts] = useState<FindingCounts | null>(null)
  if (data && data.counts !== lastCounts) setLastCounts(data.counts)
  const counts = data?.counts ?? lastCounts

  // A different tab or filter is a different list, so earlier selections no longer apply.
  const [selectionKey, setSelectionKey] = useState(filterKey)
  if (selectionKey !== filterKey) {
    setSelectionKey(filterKey)
    setRowSelection({})
  }

  // A page number past the end (an old link, or a filter that shrank the list) falls back to the last page.
  useEffect(() => {
    if (!data || isPlaceholderData) return
    const pages = Math.max(1, Math.ceil(data.total / data.page_size))
    if (state.page > pages) update({ page: pages }, { replace: true })
  }, [data, isPlaceholderData, state.page, update])

  const onSort = useCallback(
    (field: FindingSortField) => {
      if (state.sort === field) update({ dir: state.dir === 'desc' ? 'asc' : 'desc' })
      else update({ sort: field, dir: 'desc' })
    },
    [state.sort, state.dir, update],
  )

  async function runExport(onlySelected: boolean) {
    if (!users) return
    setExporting(true)
    try {
      const { count, filename } = await exportFindingsCsv({
        ...apiQuery,
        users,
        ids: onlySelected ? new Set(selectedIds) : undefined,
      })
      toast.success(`Exported ${formatCount(count)} ${count === 1 ? 'finding' : 'findings'} to ${filename}`)
    } catch {
      toast.error('Could not export the findings. Try again.')
    } finally {
      setExporting(false)
    }
  }

  const header = (
    <PageHeader
      breadcrumbs={[{ label: 'Review' }, { label: 'Review queue' }]}
      title="Review queue"
      subtitle="Findings waiting for a decision before the lender funds the deal."
    />
  )

  if (isPending || !users || !dealers) {
    return (
      <>
        {header}
        {isError ? (
          <div className="rounded-lg border bg-card">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : (
          <div className="flex flex-col gap-4" aria-busy="true">
            <FilterBarSkeleton tabs={5} filters={4} />
            <LoadingTable rows={10} columns={QUEUE_COLUMNS} />
            <PaginationSkeleton />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        {counts && (
          <QueueToolbar
            state={state}
            update={update}
            counts={counts}
            dealers={dealers}
            users={users}
            meId={me?.id ?? null}
            dealerId={dealerId}
            setDealer={setDealer}
            clearFilters={clearFilters}
            exporting={exporting}
            onExport={() => runExport(false)}
          />
        )}

        {selectedIds.length > 0 && (
          <div role="region" aria-label="Bulk actions" className="flex items-center gap-2 rounded-lg border bg-brand-subtle px-3 py-2 text-[13px] text-text">
            <span className="font-medium tabular-nums">{selectedIds.length} selected</span>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <Button variant="secondary" size="sm" onClick={() => setAssignOpen(true)}>
              <UserPlus />
              Assign
            </Button>
            <Button variant="secondary" size="sm" disabled={exporting} onClick={() => runExport(true)}>
              <Download />
              Export selected
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setRowSelection({})}>
              <X />
              Clear selection
            </Button>
          </div>
        )}

        {isError && (
          <div className="rounded-lg border bg-card">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}

        {!isError && data && data.items.length === 0 && (
          <div className="rounded-lg border bg-card">
            {hasActiveFilters(state, dealerId) ? (
              <EmptyState icon={Inbox} title="No findings match these filters." action={{ label: 'Clear filters', onClick: clearFilters }} />
            ) : (
              <EmptyState icon={Inbox} title="No findings in this tab." action={{ label: 'Show all findings', onClick: () => update({ tab: 'all' }) }} />
            )}
          </div>
        )}

        {!isError && data && data.items.length > 0 && (
          <>
            <QueueTable
              rows={data.items}
              users={users}
              sort={state.sort}
              dir={state.dir}
              onSort={onSort}
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              stale={isPlaceholderData}
              now={now}
            />
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} noun="findings" onPageChange={(page) => update({ page })} />
          </>
        )}
      </div>

      <BulkAssignDialog open={assignOpen} onOpenChange={setAssignOpen} ids={selectedIds} users={users} onAssigned={() => setRowSelection({})} />
    </>
  )
}
