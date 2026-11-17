import { CircleAlert, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  /** The error that was thrown; an ApiError message is shown as is. */
  error?: unknown
  /** Overrides the default sentence. */
  message?: string
  onRetry: () => void
  compact?: boolean
  className?: string
}

const DEFAULT_MESSAGE = 'We could not load this. Check your connection and try again.'

/** One sentence and a Retry button. */
export function ErrorState({ error, message, onRetry, compact = false, className }: ErrorStateProps) {
  const text = message ?? (error instanceof ApiError ? error.message : DEFAULT_MESSAGE)
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 text-center', compact ? 'px-4 py-8' : 'px-6 py-16', className)}>
      <span className="grid size-9 place-items-center rounded-md border border-sev-high/20 bg-sev-high/10 text-sev-high">
        <CircleAlert className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="max-w-[360px] text-sm leading-5 text-text">{text}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateCw strokeWidth={1.75} />
        Retry
      </Button>
    </div>
  )
}
