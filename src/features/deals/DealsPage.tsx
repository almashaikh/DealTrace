import { Car, Info } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { useDealers } from '@/app/queries'
import { useDealerParam } from '@/app/useDealerParam'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { FilterBarSkeleton, PaginationSkeleton } from '@/components/common/skeletons'
import { DealsTable } from '@/features/deals/components/DealsTable'
import { DealsToolbar } from '@/features/deals/components/DealsToolbar'
import { hasActiveDealFilters } from '@/features/deals/dealsParams'
import { useDeals } from '@/features/deals/hooks'
import { useDealsParams } from '@/features/deals/useDealsParams'
import { formatCount } from '@/lib/format'
import type { DealList, DealSortField } from '@/types'

const DEAL_COLUMNS = [
  { width: 'w-16' },
  { width: 'w-20' },
  { width: 'w-40' },
  { width: 'w-32' },
  { width: 'w-8' },
  { width: 'w-20', align: 'right' as const },
  { width: 'w-20', align: 'right' as const },
  { width: 'w-6', align: 'right' as const },
  { width: 'w-16' },
  { width: 'w-24' },
]

export function DealsPage() {
  const { state, update, clearFilters } = useDealsParams()
  const { dealerId, setDealer } = useDealerParam()
  const { data: dealers } = useDealers()
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useDeals(state, dealerId)

  // Keep the tab counts on screen when a request fails, using the last totals that loaded.
  const [lastTotals, setLastTotals] = useState<{ flagged: number; scanned: number } | null>(null)
  if (data && (lastTotals?.flagged !== data.flagged_total || lastTotals?.scanned !== data.total_scanned)) {
    setLastTotals({ flagged: data.flagged_total, scanned: data.total_scanned })
  }
  const totals = data ? { flagged: data.flagged_total, scanned: data.total_scanned } : lastTotals

  // A page number past the end falls back to the last page.
  useEffect(() => {
    if (!data || isPlaceholderData) return
    const pages = Math.max(1, Math.ceil(data.total / data.page_size))
    if (state.page > pages) update({ page: pages }, { replace: true })
  }, [data, isPlaceholderData, state.page, update])

  const onSort = useCallback(
    (field: DealSortField) => {
      if (state.sort === field) update({ dir: state.dir === 'desc' ? 'asc' : 'desc' })
      else update({ sort: field, dir: 'desc' })
    },
    [state.sort, state.dir, update],
  )

  const header = (
    <PageHeader
      breadcrumbs={[{ label: 'Review' }, { label: 'Deals' }]}
      title="Deals"
      subtitle="Flagged deals, and every deal scanned in the last 30 days."
    />
  )

  if (isPending || !dealers) {
    return (
      <>
        {header}
        {isError ? (
          <div className="rounded-lg border bg-card">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : (
          <div className="flex flex-col gap-4" aria-busy="true">
            <FilterBarSkeleton tabs={2} filters={2} />
            <LoadingTable rows={10} columns={DEAL_COLUMNS} />
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
        <DealsToolbar
          state={state}
          update={update}
          dealers={dealers}
          dealerId={dealerId}
          setDealer={setDealer}
          clearFilters={clearFilters}
          flaggedCount={totals?.flagged ?? 0}
          scannedCount={totals?.scanned ?? 0}
        />

        {state.tab === 'all' && data && <ClearedNote data={data} />}

        {isError && (
          <div className="rounded-lg border bg-card">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}

        {!isError && data && data.items.length === 0 && (
          <div className="rounded-lg border bg-card">
            <EmptyState
              icon={Car}
              title={hasActiveDealFilters(state, dealerId) ? 'No deals match these filters.' : 'No flagged deals yet.'}
              action={hasActiveDealFilters(state, dealerId) ? { label: 'Clear filters', onClick: clearFilters } : undefined}
            />
          </div>
        )}

        {!isError && data && data.items.length > 0 && (
          <>
            <DealsTable rows={data.items} dealers={dealers} sort={state.sort} dir={state.dir} onSort={onSort} stale={isPlaceholderData} />
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} noun="deals" onPageChange={(page) => update({ page })} />
          </>
        )}
      </div>
    </>
  )
}

/** The deals that were cleared automatically are not stored, so All deals shows the flagged ones with this note. */
function ClearedNote({ data }: { data: DealList }) {
  const cleared = Math.max(0, data.total_scanned - data.flagged_total)
  return (
    <p role="note" className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[13px] leading-[18px] text-text-muted">
      <Info className="size-4 shrink-0" aria-hidden="true" />
      Showing flagged deals. {formatCount(cleared)} deals were cleared automatically.
    </p>
  )
}
