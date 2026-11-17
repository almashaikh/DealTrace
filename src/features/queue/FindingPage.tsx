import { SearchX, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'

import { useUsers } from '@/app/queries'
import { MessageSquareText } from 'lucide-react'

import { CopyLinkButton } from '@/components/common/CopyLinkButton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { MonoId } from '@/components/common/MonoId'
import { PageHeader, type Crumb } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ReviewAssistant } from '@/features/agent/components/ReviewAssistant'
import { Button } from '@/components/ui/button'
import { DecisionDialog } from '@/features/queue/components/DecisionDialog'
import { DecisionHistory } from '@/features/queue/components/DecisionHistory'
import { EvidenceList } from '@/features/queue/components/EvidenceList'
import { FindingSidebar } from '@/features/queue/components/FindingSidebar'
import { RelatedFindings } from '@/features/queue/components/RelatedFindings'
import { RuleClauseCard } from '@/features/queue/components/RuleClauseCard'
import { UncertaintyMeter } from '@/features/queue/components/UncertaintyMeter'
import { describeFinding } from '@/features/queue/findingText'
import { useFinding } from '@/features/queue/hooks'
import { FindingSkeleton } from '@/features/queue/FindingSkeleton'
import { ApiError } from '@/lib/api'
import type { DecisionAction } from '@/types'

export function FindingPage() {
  const { id = '' } = useParams()
  const { data, isPending, isError, error, refetch } = useFinding(id)
  const { data: users } = useUsers()
  const [action, setAction] = useState<DecisionAction | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)

  const crumbs: Crumb[] = [{ label: 'Review' }, { label: 'Review queue', to: '/queue' }, { label: id }]

  if (isPending) {
    return (
      <>
        <PageHeader breadcrumbs={crumbs} title={`Finding ${id}`} subtitle="Evidence, rule context and the reviewer decision." />
        <FindingSkeleton />
      </>
    )
  }

  if (isError) {
    const notFound = error instanceof ApiError && error.code === 'NOT_FOUND'
    return (
      <>
        <PageHeader breadcrumbs={crumbs} title={`Finding ${id}`} subtitle="Evidence, rule context and the reviewer decision." />
        <div className="rounded-lg border bg-card">
          {notFound ? (
            <EmptyState icon={SearchX} title={`Finding ${id} does not exist.`} action={{ label: 'Back to the review queue', to: '/queue' }} />
          ) : (
            <ErrorState error={error} onRetry={() => refetch()} />
          )}
        </div>
      </>
    )
  }

  const { finding, deal, dealer, rule, decisions } = data
  const sentences = describeFinding(finding, deal)

  return (
    <>
      <PageHeader
        breadcrumbs={crumbs}
        title={finding.title}
        documentTitle={`${finding.id} ${finding.title}`}
        subtitle={`${deal.id} · ${deal.customer_display} · ${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model} · ${dealer.name}`}
        meta={
          <>
            <SeverityBadge severity={finding.severity} />
            <StatusBadge status={finding.status} />
            <MonoId value={finding.id} />
            <span className="inline-flex h-5 items-center gap-1.5 rounded-md border bg-card px-2 text-xs leading-4 text-text">
              <TriangleAlert className="size-3.5 text-sev-medium" aria-hidden="true" />
              {finding.label}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAssistantOpen(true)}>
              <MessageSquareText />
              Ask assistant
            </Button>
            <CopyLinkButton />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <SectionCard title="What happened">
            <div className="space-y-2 text-sm leading-5 text-text">
              {sentences.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
          </SectionCard>
          <EvidenceList dealId={deal.id} items={finding.evidence} />
          <RuleClauseCard rule={rule} dealDate={deal.deal_date} />
          <UncertaintyMeter value={finding.uncertainty} />
          <RelatedFindings dealId={deal.id} currentId={finding.id} />
          <DecisionHistory decisions={decisions} users={users ?? []} />
        </div>
        <FindingSidebar detail={data} onDecide={setAction} />
      </div>

      <DecisionDialog findingId={finding.id} action={action} onClose={() => setAction(null)} />
      <ReviewAssistant dealId={deal.id} open={assistantOpen} onOpenChange={setAssistantOpen} />
    </>
  )
}
