import { api } from '@/lib/api'
import { downloadCsv, toCsv, type CsvColumn } from '@/lib/csv'
import { formatDateTime, pacificDate } from '@/lib/format'
import type { AuditEvent, AuditFilters, User } from '@/types'

/** Builds a CSV of the audit events that match the filters and downloads it. Returns the row count. */
export async function exportAuditCsv(filters: AuditFilters, users: readonly User[]): Promise<{ count: number; filename: string }> {
  const result = await api.listAudit(filters, 1, 10000)
  const actor = (id: string) => (id === 'system' ? 'DealTrace' : (users.find((u) => u.id === id)?.name ?? id))
  const columns: CsvColumn<AuditEvent>[] = [
    { header: 'Event', value: (a) => a.id },
    { header: 'Time (UTC)', value: (a) => a.timestamp },
    { header: 'Time (Pacific)', value: (a) => formatDateTime(a.timestamp) },
    { header: 'Actor', value: (a) => actor(a.actor_id) },
    { header: 'Action', value: (a) => a.action },
    { header: 'Entity', value: (a) => a.entity },
    { header: 'Entity ID', value: (a) => a.entity_id },
    { header: 'Hash', value: (a) => a.hash },
    { header: 'Previous hash', value: (a) => a.prev_hash },
  ]
  const filename = `dealtrace-audit-${pacificDate(new Date().toISOString())}.csv`
  downloadCsv(filename, toCsv(result.items, columns))
  return { count: result.items.length, filename }
}
