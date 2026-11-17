/** CSV built in the browser. No library, no network. */

export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

const FORMULA_START = /^[=+\-@\t\r]/

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'number' ? String(value) : value
  // Spreadsheet apps run text that starts with = + - or @ as a formula. Prefix text (not numbers) so it stays text.
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** RFC 4180 CSV with CRLF line endings. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(',')]
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(','))
  return `${lines.join('\r\n')}\r\n`
}

/** Saves text as a file through a temporary link. */
export function downloadCsv(filename: string, csv: string): void {
  // The byte order mark makes Excel read UTF-8 (the minus sign and en dashes) correctly.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
