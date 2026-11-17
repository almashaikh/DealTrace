import { describe, expect, it } from 'vitest'

import { toCsv } from '@/lib/csv'

const cols = [
  { header: 'ID', value: (r: { id: string; title: string; amount: number | null }) => r.id },
  { header: 'Title', value: (r: { id: string; title: string; amount: number | null }) => r.title },
  { header: 'Amount', value: (r: { id: string; title: string; amount: number | null }) => r.amount },
]

describe('toCsv', () => {
  it('writes a header row and CRLF line endings', () => {
    expect(toCsv([{ id: 'F-2291', title: 'Late add-on', amount: 3300 }], cols)).toBe('ID,Title,Amount\r\nF-2291,Late add-on,3300\r\n')
  })

  it('quotes commas, quotes and line breaks', () => {
    const csv = toCsv([{ id: 'F-1', title: 'GAP, "optional"\nnote', amount: null }], cols)
    expect(csv).toBe('ID,Title,Amount\r\nF-1,"GAP, ""optional""\nnote",\r\n')
  })

  it('keeps text that looks like a formula as text, and leaves negative numbers alone', () => {
    const csv = toCsv([{ id: 'F-2', title: '=HYPERLINK("x")', amount: -19.14 }], cols)
    expect(csv.split('\r\n')[1]).toBe('F-2,"\'=HYPERLINK(""x"")",-19.14')
  })

  it('writes only the header for no rows', () => {
    expect(toCsv([], cols)).toBe('ID,Title,Amount\r\n')
  })
})
