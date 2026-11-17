import { Send } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { SUGGESTED_QUESTIONS } from '@/features/agent/answers'
import { suggestedActionTargets } from '@/features/agent/actions'
import { AssistantMessageView } from '@/features/agent/components/AssistantMessageView'
import { useAgentSummary } from '@/features/agent/hooks'
import { useAssistant } from '@/features/agent/useAssistant'
import { useBenefitChecks, useDealDetail, useDealFindings } from '@/features/deals/hooks'
import { DecisionDialog } from '@/features/queue/components/DecisionDialog'
import type { DecisionAction, Deal, Finding, BenefitCheck, AgentSummary } from '@/types'

interface BodyProps {
  deal: Deal
  findings: Finding[]
  benefit: BenefitCheck[]
  summary: AgentSummary | null
  onClose: () => void
}

function AssistantBody({ deal, findings, benefit, summary, onClose }: BodyProps) {
  const ctx = useMemo(() => ({ deal, findings, benefit, summary }), [deal, findings, benefit, summary])
  const { messages, busy, ask, regenerate, giveFeedback } = useAssistant(summary, ctx)
  const [draft, setDraft] = useState('')
  const [decision, setDecision] = useState<{ findingId: string; action: DecisionAction } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const targets = useMemo(() => suggestedActionTargets(summary?.suggested_actions ?? [], findings), [summary, findings])

  // Follow the answer as it streams, unless the reader has scrolled up.
  useEffect(() => {
    const el = scroller.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !draft.trim()) return
    ask(draft)
    setDraft('')
    stickToBottom.current = true
  }

  return (
    <>
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg bg-brand-subtle px-3 py-2 text-[13px] leading-5 text-text">{m.text}</p>
            </div>
          ) : (
            <AssistantMessageView
              key={m.id}
              message={m}
              dealId={deal.id}
              targets={m.kind === 'summary' ? targets : []}
              onNavigate={onClose}
              onRegenerate={() => regenerate(m.id)}
              onFeedback={(v) => giveFeedback(m.id, v)}
              onDecide={(findingId, action) => setDecision({ findingId, action })}
            />
          ),
        )}
      </div>

      <div className="border-t bg-card px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <Button key={q} variant="secondary" size="xs" disabled={busy} onClick={() => ask(q)}>
              {q}
            </Button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask about this deal" aria-label="Ask a follow-up question" disabled={busy} className="h-8 text-[13px]" />
          <Button type="submit" size="icon-sm" aria-label="Send question" disabled={busy || !draft.trim()}>
            <Send />
          </Button>
        </form>
      </div>

      <DecisionDialog findingId={decision?.findingId ?? ''} action={decision?.action ?? null} onClose={() => setDecision(null)} />
    </>
  )
}

interface ReviewAssistantProps {
  dealId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The review assistant. A 480px right sheet that drafts a case summary and answers a few follow-ups.
 * It is scripted and says so; it reads the deal and cannot change it.
 */
export function ReviewAssistant({ dealId, open, onOpenChange }: ReviewAssistantProps) {
  const detail = useDealDetail(dealId)
  const findings = useDealFindings(dealId)
  const benefit = useBenefitChecks(dealId)
  const summary = useAgentSummary(dealId)
  const queries = [detail, findings, benefit, summary]
  const failed = queries.find((q) => q.isError)
  const loading = queries.some((q) => q.isPending)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-[480px]">
        <SheetHeader className="gap-1 border-b pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>Review assistant</SheetTitle>
            <span className="inline-flex h-5 items-center gap-1.5 rounded-md border bg-card px-2 text-xs leading-4 text-text-muted">
              <span className="size-1.5 rounded-full bg-sev-medium" aria-hidden="true" />
              Prototype mode · scripted responses
            </span>
          </div>
          <SheetDescription>The assistant drafts only. It cannot change deals.</SheetDescription>
        </SheetHeader>

        {failed ? (
          <ErrorState error={failed.error} onRetry={() => queries.filter((q) => q.isError).forEach((q) => q.refetch())} compact />
        ) : loading || !detail.data || !findings.data || !benefit.data || summary.data === undefined ? (
          <div className="space-y-3 p-4" role="status" aria-label="Loading the deal record">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        ) : (
          <AssistantBody deal={detail.data.deal} findings={findings.data.items} benefit={benefit.data} summary={summary.data} onClose={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}
