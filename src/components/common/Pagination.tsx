import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatCount } from '@/lib/format'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** Plural noun for the count, for example "findings". */
  noun: string
}

/** "Showing 1–25 of 61 findings" with previous and next buttons. */
export function Pagination({ page, pageSize, total, onPageChange, noun }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between gap-4 text-[13px] leading-[18px] text-text-muted">
      <p aria-live="polite">
        {total === 0 ? `No ${noun}` : `Showing ${formatCount(from)}–${formatCount(to)} of ${formatCount(total)} ${noun}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <Button variant="secondary" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
        </Button>
        <Button variant="secondary" size="icon-sm" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
