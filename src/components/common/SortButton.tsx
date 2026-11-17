import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { SortDirection } from '@/types'

interface SortButtonProps<F extends string> {
  label: string
  field: F
  /** The field the table is sorted by now. */
  sort: F
  dir: SortDirection
  onSort: (field: F) => void
  /** Right-align the label and put the arrow on its left, for number columns. */
  align?: 'right'
  title?: string
}

/** A column header that sorts the table. Shows the direction when it is the active column. */
export function SortButton<F extends string>({ label, field, sort, dir, onSort, align, title }: SortButtonProps<F>) {
  const active = sort === field
  const Icon = !active ? ArrowUpDown : dir === 'desc' ? ArrowDown : ArrowUp
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      title={title}
      className={cn(
        '-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:text-text focus-visible:ring-2 focus-visible:ring-brand',
        active && 'text-text',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {label}
      <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden="true" />
    </button>
  )
}
