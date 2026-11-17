import { downloadCsv, toCsv, type CsvColumn } from '@/lib/csv'
import { dealsCsvRows, generateDeals } from '@/lib/synthetic'
import type { SyntheticJob } from '@/types'

type Row = ReturnType<typeof dealsCsvRows>[number]

/** Builds the dataset of a finished job in the browser (same settings and seed give the same deals) and downloads it. */
export function downloadSyntheticCsv(job: SyntheticJob): { count: number; filename: string } {
  const rows = dealsCsvRows(generateDeals(job.params))
  const keys = Object.keys(rows[0] ?? {}) as (keyof Row)[]
  const columns: CsvColumn<Row>[] = keys.map((k) => ({ header: k, value: (r) => r[k] }))
  const filename = `dealtrace-synthetic-${job.id.toLowerCase()}.csv`
  downloadCsv(filename, toCsv(rows, columns))
  return { count: rows.length, filename }
}
