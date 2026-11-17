import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface SectionCardProps {
  title: string
  description?: string
  /** Control on the right of the header (a link or a small button). */
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Remove body padding, for tables and lists that run edge to edge. */
  flush?: boolean
  /** Extra classes for the body. */
  bodyClassName?: string
}

/** Bordered card with a 16/24 semibold title, an optional caption and an action. */
export function SectionCard({ title, description, action, children, className, flush = false, bodyClassName }: SectionCardProps) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-lg border bg-card', className)}>
      <header className={cn('flex items-start justify-between gap-4 px-4 pt-4', flush ? 'pb-3' : 'pb-0')}>
        <div className="min-w-0">
          <h2 className="text-base leading-6 font-semibold text-text">{title}</h2>
          {description && <p className="text-xs leading-4 text-text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn(flush ? 'border-t' : 'p-4', bodyClassName)}>{children}</div>
    </section>
  )
}
