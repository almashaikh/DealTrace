import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface LoadingColumn {
  /** Tailwind width class for the skeleton bar, for example "w-16". */
  width?: string
  /** Right-align numbers. */
  align?: 'left' | 'right'
}

interface LoadingTableProps {
  /** Number of columns, or one entry per column to match the final layout. */
  columns?: number | LoadingColumn[]
  rows?: number
  /** Wrap the table in a bordered card. Default true. */
  framed?: boolean
  className?: string
}

const WIDTHS = ['w-16', 'w-24', 'w-32', 'w-20', 'w-28', 'w-14']

/** Table skeleton with the same 40px rows and header as the real table. */
export function LoadingTable({ columns = 6, rows = 8, framed = true, className }: LoadingTableProps) {
  const cols: LoadingColumn[] = typeof columns === 'number' ? Array.from({ length: columns }, () => ({})) : columns
  return (
    <div className={cn(framed && 'overflow-hidden rounded-lg border bg-card', className)} role="status" aria-label="Loading table">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {cols.map((c, i) => (
              <TableHead key={i} className={cn(c.align === 'right' && 'text-right')}>
                <Skeleton className={cn('h-3 w-16', c.align === 'right' && 'ml-auto')} />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r} className="hover:bg-transparent">
              {cols.map((c, i) => (
                <TableCell key={i} className={cn(c.align === 'right' && 'text-right')}>
                  <Skeleton className={cn('h-3.5', c.width ?? WIDTHS[(r + i * 2) % WIDTHS.length], c.align === 'right' && 'ml-auto')} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <span className="sr-only">Loading</span>
    </div>
  )
}
