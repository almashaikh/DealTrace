import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  /** One sentence. */
  title: string
  action?: { label: string; onClick?: () => void; to?: string }
  /** Tighter spacing for popovers and small panels. */
  compact?: boolean
  className?: string
}

/** Small icon, one sentence, one action. */
export function EmptyState({ icon: Icon, title, action, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 text-center', compact ? 'px-4 py-8' : 'px-6 py-16', className)}>
      <span className="grid size-9 place-items-center rounded-md border bg-card text-text-muted">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="max-w-[320px] text-sm leading-5 text-text-muted">{title}</p>
      {action &&
        (action.to ? (
          <Button asChild variant="secondary" size="sm">
            <Link to={action.to}>{action.label}</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  )
}
