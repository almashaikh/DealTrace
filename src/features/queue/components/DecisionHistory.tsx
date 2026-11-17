import { SectionCard } from '@/components/common/SectionCard'
import { decisionConfig } from '@/features/queue/decisions'
import { formatDateTime } from '@/lib/format'
import type { Decision, User } from '@/types'

/** Decisions recorded on this finding, newest first. Each one is also an event in the audit log. */
export function DecisionHistory({ decisions, users }: { decisions: Decision[]; users: readonly User[] }) {
  return (
    <SectionCard title="Decision history" description="Each decision is also recorded in the audit log" flush={decisions.length > 0}>
      {decisions.length === 0 ? (
        <p className="text-[13px] leading-[18px] text-text-muted">No decision has been recorded on this finding yet.</p>
      ) : (
        <ul className="divide-y">
          {decisions.map((d) => (
            <li key={`${d.timestamp}-${d.action}`} className="px-4 py-3">
              <p className="text-[13px] leading-[18px] text-text">
                <span className="font-medium">{users.find((u) => u.id === d.actor_id)?.name ?? d.actor_id}</span> marked this {decisionConfig(d.action).marked}
              </p>
              {d.note && <p className="mt-1 text-[13px] leading-[18px] text-text-muted">{d.note}</p>}
              <p className="mt-1 text-xs leading-4 text-text-muted">{formatDateTime(d.timestamp)}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
