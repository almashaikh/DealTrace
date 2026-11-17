import { ChartNoAxesColumn } from 'lucide-react'

import { useDealers } from '@/app/queries'
import { useDealerParam } from '@/app/useDealerParam'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { StatCard } from '@/components/common/StatCard'
import { ActivityFeed } from '@/features/dashboard/components/ActivityFeed'
import { ExposureByRooftopChart, FindingsByTypeChart, FindingsPerDayChart } from '@/features/dashboard/components/Charts'
import { NeedsAttention } from '@/features/dashboard/components/NeedsAttention'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { useDashboard } from '@/features/dashboard/hooks'
import { buildKpiCards, totalFindings } from '@/features/dashboard/kpis'
import { formatCount } from '@/lib/format'

export function DashboardPage() {
  const { dealerId } = useDealerParam()
  const { data: dealers } = useDealers()
  const { data, isPending, isError, error, refetch } = useDashboard(dealerId)
  const dealerName = dealers?.find((d) => d.id === dealerId)?.name

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Overview' }, { label: 'Dashboard' }]}
        title="Dashboard"
        subtitle={`Findings, refund exposure and review speed ${dealerName ? `at ${dealerName}` : 'across Harborline Auto Group'}.`}
      />
      {isPending && <DashboardSkeleton />}
      {isError && (
        <div className="rounded-lg border bg-card">
          <ErrorState error={error} onRetry={() => refetch()} />
        </div>
      )}
      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {buildKpiCards(data).map((card) => (
              <StatCard key={card.id} label={card.label} value={card.value} change={card.change} />
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              title="Findings per day"
              description={`${formatCount(totalFindings(data.findings_by_day))} findings detected in the last 30 days, by severity`}
              className="xl:col-span-2"
            >
              {totalFindings(data.findings_by_day) === 0 ? (
                <EmptyState compact icon={ChartNoAxesColumn} title="No findings were detected in this period." />
              ) : (
                <FindingsPerDayChart data={data.findings_by_day} />
              )}
            </SectionCard>
            <SectionCard title="Open findings by type" description={`${formatCount(data.kpis.open_findings)} open`}>
              {data.findings_by_type.length === 0 ? (
                <EmptyState compact icon={ChartNoAxesColumn} title="No open findings to chart." />
              ) : (
                <FindingsByTypeChart data={data.findings_by_type} />
              )}
            </SectionCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <NeedsAttention dealerId={dealerId} />
            <SectionCard title="Exposure by rooftop" description="Refund exposure on open findings">
              <ExposureByRooftopChart data={data.exposure_by_dealer} />
            </SectionCard>
          </div>

          <ActivityFeed dealerId={dealerId} />
        </div>
      )}
    </>
  )
}
