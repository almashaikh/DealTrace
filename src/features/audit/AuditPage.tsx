import { ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useUsers } from '@/app/queries'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { PaginationSkeleton } from '@/components/common/skeletons'
import { AuditTable } from '@/features/audit/components/AuditTable'
import { AuditToolbar } from '@/features/audit/components/AuditToolbar'
import { VerifyPanel } from '@/features/audit/components/VerifyPanel'
import { toAuditFilters, hasAuditFilters } from '@/features/audit/auditParams'
import { exportAuditCsv } from '@/features/audit/exportAudit'
import { useAudit, useAuditFacets, useAuditParams } from '@/features/audit/hooks'
import { formatCount } from '@/lib/format'

export function AuditPage() {
  const { state, update, clearFilters, tamper } = useAuditParams()
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAudit(state)
  const { data: facets } = useAuditFacets()
  const { data: users } = useUsers()
  const [exporting, setExporting] = useState(false)

  // A page number past the end falls back to the last page.
  useEffect(() => {
    if (!data || isPlaceholderData) return
    const pages = Math.max(1, Math.ceil(data.total / data.page_size))
    if (state.page > pages) update({ page: pages })
  }, [data, isPlaceholderData, state.page, update])

  async function runExport() {
    if (!users) return
    setExporting(true)
    try {
      const { count, filename } = await exportAuditCsv(toAuditFilters(state), users)
      toast.success(`Exported ${formatCount(count)} ${count === 1 ? 'event' : 'events'} to ${filename}`)
    } catch {
      toast.error('Could not export the audit log. Try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Compliance' }, { label: 'Audit log' }]}
        title="Audit log"
        subtitle="Every decision and rule change, linked in a SHA-256 hash chain."
      />
      <div className="flex flex-col gap-4">
        <VerifyPanel tamper={tamper} />
        <AuditToolbar state={state} update={update} clearFilters={clearFilters} facets={facets} exporting={exporting} onExport={runExport} />

        {isPending && !isError && (
          <div className="flex flex-col gap-4" aria-busy="true">
            <LoadingTable rows={12} columns={[{ width: 'w-32' }, { width: 'w-24' }, { width: 'w-44' }, { width: 'w-28' }, { width: 'w-28' }]} />
            <PaginationSkeleton />
          </div>
        )}
        {isError && (
          <div className="rounded-lg border bg-card">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}
        {data && data.items.length === 0 && (
          <div className="rounded-lg border bg-card">
            <EmptyState
              icon={ScrollText}
              title={hasAuditFilters(state) ? 'No audit events match these filters.' : 'The audit log is empty.'}
              action={hasAuditFilters(state) ? { label: 'Clear filters', onClick: clearFilters } : undefined}
            />
          </div>
        )}
        {data && data.items.length > 0 && users && (
          <>
            <AuditTable rows={data.items} users={users} stale={isPlaceholderData} />
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} noun="events" onPageChange={(page) => update({ page })} />
          </>
        )}
      </div>
    </>
  )
}
