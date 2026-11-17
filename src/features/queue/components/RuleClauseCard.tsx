import { Info } from 'lucide-react'
import { Link } from 'react-router'

import { MonoId } from '@/components/common/MonoId'
import { SectionCard } from '@/components/common/SectionCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { Rule } from '@/types'

/** The rule behind the finding, as an illustrative paraphrase, applied as of the deal date. */
export function RuleClauseCard({ rule, dealDate }: { rule: Rule | null; dealDate: string }) {
  if (!rule) {
    return (
      <SectionCard title="Rule" description="Process check">
        <p className="text-[13px] leading-[18px] text-text-muted">
          This finding comes from a check on how the deal changed over time, not from a single rule clause.
        </p>
      </SectionCard>
    )
  }
  return (
    <SectionCard
      title="Rule clause"
      description={rule.source}
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to={`/rules/${rule.id}/blast-radius`}>Blast radius</Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <MonoId value={rule.id} />
        <StatusBadge status={rule.status} />
        <span className="text-xs leading-4 text-text-muted">v{rule.version}</span>
      </div>
      <h3 className="mt-2 text-sm leading-5 font-medium text-text">{rule.name}</h3>
      <blockquote className="mt-2 border-l-2 border-brand/40 pl-3 text-[13px] leading-5 text-text">{rule.description}</blockquote>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs leading-4">
        <div className="flex gap-1.5">
          <dt className="text-text-muted">Applied as of</dt>
          <dd className="font-medium text-text">{formatDate(dealDate)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-text-muted">In force from</dt>
          <dd className="text-text">{formatDate(rule.effective_from)}</dd>
        </div>
      </dl>
      <p className="mt-3 flex items-center gap-1.5 text-xs leading-4 text-text-muted">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        Illustrative summary, not legal advice
      </p>
    </SectionCard>
  )
}
