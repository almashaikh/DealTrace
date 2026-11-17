import { SearchX } from 'lucide-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader, type Crumb } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReviewAssistant } from '@/features/agent/components/ReviewAssistant'
import { DealActions } from '@/features/deals/components/DealActions'
import { DealSummaryStrip } from '@/features/deals/components/DealSummaryStrip'
import { DEAL_TABS, parseDealTab, type DealTab } from '@/features/deals/dealsParams'
import { DealSkeleton } from '@/features/deals/DealSkeleton'
import { useDealDetail } from '@/features/deals/hooks'
import { ActivityTab } from '@/features/deals/tabs/ActivityTab'
import { BenefitTab } from '@/features/deals/tabs/BenefitTab'
import { GraphTab } from '@/features/deals/tabs/GraphTab'
import { OverviewTab } from '@/features/deals/tabs/OverviewTab'
import { TimelineTab } from '@/features/deals/tabs/TimelineTab'
import { VersionsTab } from '@/features/deals/tabs/VersionsTab'
import { WhatIfTab } from '@/features/deals/tabs/WhatIfTab'
import { ApiError } from '@/lib/api'

export function DealPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = parseDealTab(params.get('tab'))
  const { data, isPending, isError, error, refetch } = useDealDetail(id)
  const [assistantOpen, setAssistantOpen] = useState(false)

  const crumbs: Crumb[] = [{ label: 'Review' }, { label: 'Deals', to: '/deals' }, { label: id }]

  /** The active tab lives in the URL as ?tab=. Tab-specific parameters (from, to) are dropped when you leave a tab. */
  function setTab(next: DealTab) {
    setParams((prev) => {
      const n = new URLSearchParams(prev)
      if (next === 'overview') n.delete('tab')
      else n.set('tab', next)
      if (next !== 'versions' && next !== 'graph') {
        n.delete('from')
        n.delete('to')
      }
      return n
    })
  }

  if (isPending) {
    return (
      <>
        <PageHeader breadcrumbs={crumbs} title={`Deal ${id}`} subtitle="Timeline, version changes and customer outcome." />
        <DealSkeleton />
      </>
    )
  }

  if (isError) {
    const notFound = error instanceof ApiError && error.code === 'NOT_FOUND'
    return (
      <>
        <PageHeader breadcrumbs={crumbs} title={`Deal ${id}`} subtitle="Timeline, version changes and customer outcome." />
        <div className="rounded-lg border bg-card">
          {notFound ? (
            <EmptyState icon={SearchX} title={`Deal ${id} does not exist.`} action={{ label: 'Back to deals', to: '/deals' }} />
          ) : (
            <ErrorState error={error} onRetry={() => refetch()} />
          )}
        </div>
      </>
    )
  }

  const { deal, dealer, lender } = data

  return (
    <>
      <PageHeader
        breadcrumbs={crumbs}
        title={`${deal.id} · ${deal.customer_display}`}
        documentTitle={deal.id}
        subtitle={`${deal.vehicle.year} ${deal.vehicle.make} ${deal.vehicle.model} ${deal.vehicle.trim} · ${dealer.name} · ${lender.name}`}
        meta={<StatusBadge status={deal.status} />}
        actions={<DealActions dealId={deal.id} onAskAssistant={() => setAssistantOpen(true)} onOpenActivity={() => setTab('activity')} />}
      />

      <div className="flex flex-col gap-4">
        <DealSummaryStrip deal={deal} />

        <Tabs value={tab} onValueChange={(v) => setTab(v as DealTab)} className="gap-4">
          <div className="overflow-x-auto border-b">
            <TabsList variant="line" className="h-10 p-0 group-data-[orientation=horizontal]/tabs:h-10">
              {DEAL_TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="h-10 flex-none rounded-none px-3 after:bottom-0 after:bg-brand data-[state=active]:text-text">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="overview">
            <OverviewTab detail={data} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab deal={deal} />
          </TabsContent>
          <TabsContent value="versions">
            <VersionsTab deal={deal} />
          </TabsContent>
          <TabsContent value="benefit">
            <BenefitTab deal={deal} />
          </TabsContent>
          <TabsContent value="whatif">
            <WhatIfTab deal={deal} />
          </TabsContent>
          <TabsContent value="graph">
            <GraphTab deal={deal} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab dealId={deal.id} />
          </TabsContent>
        </Tabs>
      </div>

      <ReviewAssistant dealId={deal.id} open={assistantOpen} onOpenChange={setAssistantOpen} />
    </>
  )
}
