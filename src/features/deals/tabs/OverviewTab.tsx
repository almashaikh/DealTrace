import { CheckCheck, Landmark } from 'lucide-react'
import { Link } from 'react-router'

import { useProviders } from '@/app/queries'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Money } from '@/components/common/Money'
import { MonoId } from '@/components/common/MonoId'
import { SectionCard } from '@/components/common/SectionCard'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useDealFindings } from '@/features/deals/hooks'
import { formatApr, formatDate, formatDateTime } from '@/lib/format'
import type { DealDetail, User } from '@/types'

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-4 text-text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] leading-[18px] text-text">{children}</dd>
    </div>
  )
}

function Person({ user, role }: { user: User; role: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <UserAvatar name={user.name} initials={user.initials} className="size-8 text-xs" />
      <div className="min-w-0">
        <p className="truncate text-[13px] leading-[18px] font-medium text-text">{user.name}</p>
        <p className="truncate text-xs leading-4 text-text-muted">{role}</p>
      </div>
    </li>
  )
}

export function OverviewTab({ detail }: { detail: DealDetail }) {
  const { deal, dealer, lender, fi_manager, salesperson } = detail
  const v = deal.versions[deal.versions.length - 1]
  const findings = useDealFindings(deal.id)
  const providers = useProviders()
  const open = findings.data?.items.filter((f) => f.status === 'Open' || f.status === 'In review') ?? []
  const providerName = (id: string) => providers.data?.find((p) => p.id === id)?.name ?? id

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        <SectionCard title="Key facts" description="The deal and the vehicle">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
            <Fact label="Deal date">{formatDate(deal.deal_date)}</Fact>
            <Fact label="Customer">{deal.customer_display}</Fact>
            <Fact label="Status">
              <StatusBadge status={deal.status} />
            </Fact>
            <Fact label="Vehicle">
              {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model} {deal.vehicle.trim}
            </Fact>
            <Fact label="VIN">
              <MonoId value={deal.vehicle.vin} />
            </Fact>
            <Fact label="Condition">{deal.vehicle.condition === 'new' ? 'New' : 'Used'}</Fact>
            <Fact label="MSRP">
              <Money value={deal.vehicle.msrp} />
            </Fact>
            <Fact label="Factory warranty">
              {deal.vehicle.factory_warranty_months} months / {deal.vehicle.factory_warranty_miles.toLocaleString('en-US')} miles
            </Fact>
            <Fact label="Rooftop">{dealer.name}</Fact>
          </dl>
        </SectionCard>

        {v && (
          <SectionCard title={`Current version · v${v.version}`} description={`${v.label} · ${formatDateTime(v.created_at)}`}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
              <Fact label="Vehicle price">
                <Money value={v.vehicle_price} />
              </Fact>
              <Fact label="Down payment">
                <Money value={v.down_payment} />
              </Fact>
              <Fact label="Trade-in value">
                <Money value={v.trade_in_value} />
              </Fact>
              <Fact label="Trade-in payoff">
                <Money value={v.trade_in_payoff} />
              </Fact>
              <Fact label="Amount financed">
                <Money value={v.amount_financed} />
              </Fact>
              <Fact label="APR">{formatApr(v.apr)}</Fact>
              <Fact label="Term">{v.term_months} months</Fact>
              <Fact label="Monthly payment">
                <Money value={v.monthly_payment} />
              </Fact>
              <Fact label="Total of payments">
                <Money value={v.total_of_payments} />
              </Fact>
            </dl>
            <div className="mt-4 border-t pt-3">
              <p className="text-xs leading-4 text-text-muted">Add-on products</p>
              {v.products.length === 0 ? (
                <p className="mt-1 text-[13px] leading-[18px] text-text-muted">No add-on products on this contract.</p>
              ) : (
                <ul className="mt-1 divide-y">
                  {v.products.map((p) => (
                    <li key={p.code} className="flex items-center justify-between gap-4 py-2 text-[13px] leading-[18px]">
                      <span className="min-w-0 text-text">
                        {p.name} <span className="text-text-muted">· {providerName(p.provider_id)} · {p.term_months} months{p.max_miles ? ` / ${p.max_miles.toLocaleString('en-US')} miles` : ''}</span>
                      </span>
                      <Money mono value={p.price} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>
        )}

        <SectionCard title="Open findings" description={`${open.length} open on this deal`} flush>
          {findings.isPending && (
            <div className="space-y-3 p-4" role="status" aria-label="Loading findings">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3.5 w-12" />
                  <Skeleton className="h-3.5 flex-1" />
                </div>
              ))}
            </div>
          )}
          {findings.isError && <ErrorState compact error={findings.error} onRetry={() => findings.refetch()} />}
          {findings.data && open.length === 0 && <EmptyState compact icon={CheckCheck} title="No open findings on this deal." />}
          {open.length > 0 && (
            <ul className="divide-y">
              {open.map((f) => (
                <li key={f.id}>
                  <Link to={`/findings/${f.id}`} className="flex items-center gap-3 px-4 py-2.5 outline-none hover:bg-app focus-visible:bg-app">
                    <SeverityBadge severity={f.severity} />
                    <span className="font-mono text-xs text-brand">{f.id}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-text" title={f.title}>
                      {f.title}
                    </span>
                    <Money mono className="text-xs text-text-muted" value={f.refund_exposure} />
                    <StatusBadge status={f.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4 lg:self-start">
        <SectionCard title="Lender and staff">
          <div className="flex items-center gap-3 border-b pb-3">
            <span className="grid size-8 place-items-center rounded-md border bg-card text-text-muted">
              <Landmark className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] leading-[18px] font-medium text-text">{lender.name}</p>
              <p className="text-xs leading-4 text-text-muted">Lender</p>
            </div>
          </div>
          <ul className="divide-y">
            <Person user={fi_manager} role={`${fi_manager.role} · structured the deal`} />
            <Person user={salesperson} role={`${salesperson.role} · sold the vehicle`} />
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}
