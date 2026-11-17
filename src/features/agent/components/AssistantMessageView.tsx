import { Check, LoaderCircle, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AssistantMarkdown } from '@/features/agent/components/AssistantMarkdown'
import { formatLatency, toolLabel } from '@/features/agent/toolLabels'
import type { AssistantMessage } from '@/features/agent/useAssistant'
import { decisionConfig } from '@/features/queue/decisions'
import type { SuggestedActionTarget } from '@/features/agent/actions'
import { cn } from '@/lib/utils'
import type { DecisionAction } from '@/types'

interface Props {
  message: AssistantMessage
  dealId: string
  /** Suggested-action buttons, shown under the case summary once it has finished. */
  targets: SuggestedActionTarget[]
  onNavigate: () => void
  onRegenerate: () => void
  onFeedback: (value: 'up' | 'down') => void
  onDecide: (findingId: string, action: DecisionAction) => void
}

/** One assistant answer: live tool steps, streamed text, then tools used, response time, feedback and actions. */
export function AssistantMessageView({ message, dealId, targets, onNavigate, onRegenerate, onFeedback, onDecide }: Props) {
  const done = message.status === 'done'
  return (
    <article className="space-y-2" aria-label={message.kind === 'summary' ? 'Case summary' : 'Assistant answer'} aria-busy={!done}>
      {message.steps.length > 0 && (
        <ul role="status" aria-label="Steps" className="space-y-1">
          {message.steps.map((s) => (
            <li key={s.name + s.label} className="flex items-center gap-2 text-xs leading-4 text-text-muted">
              {s.done ? <Check className="size-3.5 text-success" aria-label="Done" /> : <LoaderCircle className="size-3.5 animate-spin" aria-label="Working" />}
              {s.label}
            </li>
          ))}
        </ul>
      )}

      {message.text && <AssistantMarkdown text={message.text} dealId={dealId} onNavigate={onNavigate} />}

      {done && (
        <>
          {targets.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs leading-4 font-medium text-text-muted">Suggested actions</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {targets.map((t) => {
                  const cfg = decisionConfig(t.action)
                  const Icon = cfg.icon
                  return (
                    <Button key={`${t.finding.id}-${t.action}`} variant="secondary" size="sm" title={t.text} onClick={() => onDecide(t.finding.id, t.action)}>
                      <Icon />
                      {cfg.label} · {t.finding.id}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-2">
            {message.tools_used.length > 0 && (
              <ul className="flex flex-wrap items-center gap-1" aria-label="Tools used">
                {message.tools_used.map((t) => (
                  <li key={t} className="rounded-md border bg-card px-1.5 text-xs leading-5 text-text-muted">
                    {toolLabel(t)}
                  </li>
                ))}
              </ul>
            )}
            {message.latency_ms !== undefined && <span className="text-xs leading-4 text-text-muted tabular-nums">Responded in {formatLatency(message.latency_ms)}</span>}
            <span className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Helpful"
                aria-pressed={message.feedback === 'up'}
                className={cn(message.feedback === 'up' && 'bg-brand-subtle text-brand')}
                onClick={() => {
                  onFeedback('up')
                  toast.success('Feedback recorded: helpful')
                }}
              >
                <ThumbsUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Not helpful"
                aria-pressed={message.feedback === 'down'}
                className={cn(message.feedback === 'down' && 'bg-brand-subtle text-brand')}
                onClick={() => {
                  onFeedback('down')
                  toast.success('Feedback recorded: not helpful')
                }}
              >
                <ThumbsDown />
              </Button>
              <Button variant="ghost" size="xs" onClick={onRegenerate}>
                <RotateCcw />
                Regenerate
              </Button>
            </span>
          </div>
        </>
      )}
    </article>
  )
}
