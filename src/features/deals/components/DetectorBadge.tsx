import { Flag } from 'lucide-react'
import { Link } from 'react-router'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DETECTOR_LABELS } from '@/lib/catalog'
import { SEVERITY_TINT } from '@/lib/severity'
import { cn } from '@/lib/utils'
import type { DetectorType, Finding } from '@/types'

/** A detector's finding shown inline on the row that triggered it. Links to the finding. */
export function DetectorBadge({ finding }: { finding: Finding }) {
  const label = DETECTOR_LABELS[finding.type as DetectorType] ?? finding.type
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={`/findings/${finding.id}`}
          className={cn(
            'inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-xs leading-4 font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-brand',
            SEVERITY_TINT[finding.severity],
          )}
        >
          <Flag className="size-3" aria-hidden="true" />
          {label}
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        {finding.id} · Potential violation – human review required
      </TooltipContent>
    </Tooltip>
  )
}
