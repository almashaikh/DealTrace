import { cn } from '@/lib/utils'
import type { Severity } from '@/types'

/** Colour as text plus a 10% tint, never a solid fill. Class names are written out so Tailwind can see them. */
const STYLES: Record<Severity, { label: string; classes: string }> = {
  critical: { label: 'Critical', classes: 'bg-sev-critical/10 text-sev-critical' },
  high: { label: 'High', classes: 'bg-sev-high/10 text-sev-high' },
  medium: { label: 'Medium', classes: 'bg-sev-medium/10 text-sev-medium' },
  low: { label: 'Low', classes: 'bg-sev-low/10 text-sev-low' },
}

/** Coloured dot plus the severity word. */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const { label, classes } = STYLES[severity]
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 rounded-md px-2 text-xs leading-4 font-medium whitespace-nowrap', classes, className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  )
}
