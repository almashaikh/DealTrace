import { Info, Play } from 'lucide-react'
import { useNavigate } from 'react-router'

import { useUsers } from '@/app/queries'
import { useDealerParam } from '@/app/useDealerParam'
import { ErrorState } from '@/components/common/ErrorState'
import { MonoId } from '@/components/common/MonoId'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useRule, useRuleVersions } from '@/features/rules/hooks'
import { formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

interface RuleSheetProps {
  /** The rule to show; null keeps the sheet closed. */
  ruleId: string | null
  onClose: () => void
}

function Dated({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs leading-4 text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] leading-[18px] text-text">{children}</dd>
    </div>
  )
}

/** A rule's description, illustrative clause text, dates and version history, with a way into the blast radius. */
export function RuleSheet({ ruleId, onClose }: RuleSheetProps) {
  const rule = useRule(ruleId)
  const versions = useRuleVersions(ruleId)
  const { data: users } = useUsers()
  const navigate = useNavigate()
  const { search } = useDealerParam()
  const r = rule.data

  return (
    <Sheet open={ruleId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[480px]">
        <SheetHeader className="gap-1 border-b pr-12">
          <SheetTitle>{r ? r.name : 'Rule'}</SheetTitle>
          <SheetDescription>{ruleId ?? ''}</SheetDescription>
        </SheetHeader>

        {rule.isError ? (
          <ErrorState compact error={rule.error} onRetry={() => rule.refetch()} />
        ) : !r ? (
          <div className="space-y-3 p-4" role="status" aria-label="Loading rule">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <MonoId value={r.id} />
                <StatusBadge status={r.status} />
                {r.status === 'Draft' && <Badge variant="outline" className="h-5 border-dashed bg-card font-medium text-text-muted">Coming soon</Badge>}
                <span className="text-xs leading-4 text-text-muted">v{r.version}</span>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                <Dated label="Jurisdiction">{r.jurisdiction}</Dated>
                <Dated label="Category">{r.category}</Dated>
                <Dated label="Source">{r.source}</Dated>
                <Dated label="Enforcement">{r.status === 'Draft' ? 'Not enforced yet' : r.enabled ? 'Enabled' : 'Disabled'}</Dated>
                <Dated label="In force from">{formatDate(r.effective_from)}</Dated>
                <Dated label="Recorded in DealTrace">{formatDateTime(r.recorded_at)}</Dated>
              </dl>

              <section aria-label="Clause">
                <h3 className="text-[13px] leading-5 font-semibold text-text">Clause</h3>
                <blockquote className="mt-1.5 border-l-2 border-brand/40 pl-3 text-[13px] leading-5 text-text">{r.description}</blockquote>
                <p className="mt-2 flex items-center gap-1.5 text-xs leading-4 text-text-muted">
                  <Info className="size-3.5 shrink-0" aria-hidden="true" />
                  Illustrative summary, not legal advice
                </p>
              </section>

              <section aria-label="Version history">
                <h3 className="text-[13px] leading-5 font-semibold text-text">Version history</h3>
                {versions.isPending && <Skeleton className="mt-2 h-16 w-full" />}
                {versions.isError && <ErrorState compact error={versions.error} onRetry={() => versions.refetch()} />}
                {versions.data && (
                  <ol className="mt-2 space-y-3">
                    {versions.data.map((v, i) => (
                      <li key={v.version} className="relative pl-5">
                        <span className={cn('absolute top-1.5 left-0 size-2 rounded-full', i === 0 ? 'bg-brand' : 'bg-border')} aria-hidden="true" />
                        {i < versions.data.length - 1 && <span className="absolute top-4 bottom-[-12px] left-[3px] w-px bg-border" aria-hidden="true" />}
                        <p className="flex flex-wrap items-center gap-2 text-[13px] leading-[18px] font-medium text-text">
                          <span className="font-mono text-xs">v{v.version}</span>
                          {i === 0 && <Badge variant="outline" className="h-5 bg-card font-medium text-brand">Current</Badge>}
                        </p>
                        <p className="text-[13px] leading-[18px] text-text">{v.change}</p>
                        <p className="text-xs leading-4 text-text-muted">
                          {formatDateTime(v.recorded_at)} · {users?.find((u) => u.id === v.actor_id)?.name ?? v.actor_id}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>

            <SheetFooter className="border-t">
              <Button onClick={() => navigate({ pathname: `/rules/${r.id}/blast-radius`, search })}>
                <Play />
                Simulate change
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
