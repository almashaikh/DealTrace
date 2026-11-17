import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Neutral outline badge for workflow status: Open, In review, Resolved, Ready to fund, and so on. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn('h-5 bg-card font-medium text-text', className)}>
      {status}
    </Badge>
  )
}
