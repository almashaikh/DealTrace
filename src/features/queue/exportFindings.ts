import { FINDING_TYPE_LABELS } from '@/lib/catalog'
import { downloadCsv, toCsv, type CsvColumn } from '@/lib/csv'
import { api } from '@/lib/api'
import { pacificDate } from '@/lib/format'
import type { FindingFilters, FindingListItem, FindingSortField, Sort, User } from '@/types'

function columns(users: readonly User[]): CsvColumn<FindingListItem>[] {
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id
  return [
    { header: 'Finding', value: (f) => f.id },
    { header: 'Severity', value: (f) => f.severity },
    { header: 'Type', value: (f) => FINDING_TYPE_LABELS[f.type] },
    { header: 'Title', value: (f) => f.title },
    { header: 'Deal', value: (f) => f.deal_id },
    { header: 'Rooftop', value: (f) => f.dealer_name },
    { header: 'Customer', value: (f) => f.customer_display },
    { header: 'Refund exposure (USD)', value: (f) => f.refund_exposure.toFixed(2) },
    { header: 'Customer exposure (USD)', value: (f) => f.customer_exposure.toFixed(2) },
    { header: 'Status', value: (f) => f.status },
    { header: 'Assignee', value: (f) => name(f.assignee_id) },
    { header: 'Detected', value: (f) => f.detected_at },
    { header: 'Review label', value: (f) => f.label },
  ]
}

/** Builds a CSV of the findings that match the filters (or only the selected ones) and downloads it. Returns the row count. */
export async function exportFindingsCsv(options: {
  filters: FindingFilters
  sort: Sort<FindingSortField>
  users: readonly User[]
  /** Export only these finding ids. */
  ids?: ReadonlySet<string>
}): Promise<{ count: number; filename: string }> {
  const result = await api.listFindings(options.filters, options.sort, 1, 1000)
  const rows = options.ids ? result.items.filter((f) => options.ids?.has(f.id)) : result.items
  const filename = `dealtrace-findings-${pacificDate(new Date().toISOString())}.csv`
  downloadCsv(filename, toCsv(rows, columns(options.users)))
  return { count: rows.length, filename }
}
