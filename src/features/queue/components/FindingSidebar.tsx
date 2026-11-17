import { Link } from 'react-router'

import { Money } from '@/components/common/Money'
import { SectionCard } from '@/components/common/SectionCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { DECISION_CONFIG } from '@/features/queue/decisions'
import { formatDateTime } from '@/lib/format'
import type { DecisionAction, FindingDetail } from '@/types'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-[13px] leading-[18px] text-text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] leading-[18px] text-text">{children}</dd>
    </div>
  )
}

/** Status and the four decisions, then the facts: assignee, exposures, deal and dates. */
export function FindingSidebar({ detail, onDecide }: { detail: FindingDetail; onDecide: (action: DecisionAction) => void }) {
  const { finding, deal, dealer, assignee } = detail
  return (
    <div className="flex flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
      <SectionCard title="Decision" description="Human review before the lender funds the deal">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] leading-[18px] text-text-muted">Status</span>
          <StatusBadge status={finding.status} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DECISION_CONFIG.map((d, i) => {
            const Icon = d.icon
            return (
              <Button key={d.action} variant={i === 0 ? 'default' : 'secondary'} size="sm" onClick={() => onDecide(d.action)}>
                <Icon />
                {d.label}
              </Button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="Details">
        <dl className="-my-2 divide-y">
          <Row label="Assignee">
            <span className="inline-flex items-center gap-2">
              <UserAvatar name={assignee.name} initials={assignee.initials} />
              {assignee.name}
            </span>
          </Row>
          <Row label="Refund exposure">
            <Money mono value={finding.refund_exposure} />
          </Row>
          <Row label="Customer exposure">
            <Money mono value={finding.customer_exposure} />
          </Row>
          <Row label="Deal">
            <Link to={`/deals/${deal.id}`} className="font-mono text-xs text-brand hover:underline">
              {deal.id}
            </Link>
          </Row>
          <Row label="Customer">{deal.customer_display}</Row>
          <Row label="Vehicle">
            {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
          </Row>
          <Row label="Rooftop">{dealer.name}</Row>
          <Row label="Versions">
            v{finding.version_from} to v{finding.version_to}
          </Row>
          <Row label="Detected">{formatDateTime(finding.detected_at)}</Row>
        </dl>
      </SectionCard>
    </div>
  )
}
