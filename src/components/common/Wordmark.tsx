import { cn } from '@/lib/utils'

interface WordmarkProps {
  /** Show only the square mark (collapsed sidebar). */
  markOnly?: boolean
  className?: string
}

/** DealTrace wordmark: a brand square with a "D" stroke, then the name. No gradient, no illustration. */
export function Wordmark({ markOnly = false, className }: WordmarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand" aria-hidden="true">
        <svg viewBox="0 0 32 32" className="size-4" fill="none">
          <path d="M9 8h7a8 8 0 0 1 0 16H9z" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
        </svg>
      </span>
      {markOnly ? <span className="sr-only">DealTrace</span> : <span className="text-[15px] leading-6 font-semibold tracking-tight text-text">DealTrace</span>}
    </span>
  )
}
