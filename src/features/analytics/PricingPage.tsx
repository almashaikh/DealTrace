import { ChartScatter, Info } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { useDealers } from '@/app/queries'
import { useDealerParam } from '@/app/useDealerParam'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { Money } from '@/components/common/Money'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { ChartCardSkeleton, SkeletonCard } from '@/components/common/skeletons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PricingChart } from '@/features/analytics/components/PricingChart'
import { usePricing } from '@/features/analytics/hooks'
import { PRICING_PRODUCTS, parsePricingProduct, pricingSentence } from '@/features/analytics/pricingText'
import { PRODUCT_NAMES } from '@/lib/catalog'
import { rooftopShortName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PricingDispersion } from '@/types'

function OutlierTable({ data, dealerName }: { data: PricingDispersion; dealerName: (id: string) => string }) {
  const navigate = useNavigate()
  const stored = new Set(data.stored_deal_ids)
  const rows = data.points.filter((p) => p.is_outlier).sort((a, b) => b.price - a.price)
  return (
    <SectionCard title="Outliers" description="Prices well above the median, for review" flush={rows.length > 0} className="xl:col-span-2">
      {rows.length === 0 ? (
        <EmptyState compact icon={ChartScatter} title="No prices are flagged as outliers for this selection." />
      ) : (
        <Table aria-label="Outliers">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">Deal</TableHead>
              <TableHead className="px-2">Rooftop</TableHead>
              <TableHead className="px-2">Segment</TableHead>
              <TableHead className="px-2 text-right">Price</TableHead>
              <TableHead className="px-2 text-right">× median</TableHead>
              <TableHead className="px-4 text-right">Above median</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => {
              const isStored = stored.has(p.deal_id)
              return (
                <TableRow key={`${p.deal_id}-${p.product_code}`} className={cn(isStored && 'cursor-pointer')} onClick={isStored ? () => navigate(`/deals/${p.deal_id}`) : undefined}>
                  <TableCell className="px-4">
                    {isStored ? (
                      <Link to={`/deals/${p.deal_id}`} onClick={(e) => e.stopPropagation()} className="rounded-sm font-mono text-xs text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand">
                        {p.deal_id}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs" title="Cleared automatically, so it is not stored">
                        {p.deal_id}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-2">{dealerName(p.dealer_id)}</TableCell>
                  <TableCell className="px-2 text-text-muted">{p.segment}</TableCell>
                  <TableCell className="px-2 text-right">
                    <Money mono value={p.price} />
                  </TableCell>
                  <TableCell className="px-2 text-right font-mono text-xs tabular-nums">{(p.price / data.overall.median).toFixed(2)}×</TableCell>
                  <TableCell className="px-4 text-right">
                    <Money mono value={p.price - data.overall.median} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}

function ByRooftop({ data }: { data: PricingDispersion }) {
  return (
    <SectionCard title="By rooftop" description="Median and range of prices" flush>
      <Table aria-label="Prices by rooftop">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">Rooftop</TableHead>
            <TableHead className="px-2 text-right">Deals</TableHead>
            <TableHead className="px-2 text-right">Median</TableHead>
            <TableHead className="px-4 text-right">Outliers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.by_dealer.map((d) => (
            <TableRow key={d.dealer_id}>
              <TableCell className="px-4">{rooftopShortName(d.dealer_name)}</TableCell>
              <TableCell className="px-2 text-right tabular-nums">{d.count}</TableCell>
              <TableCell className="px-2 text-right">
                <Money mono value={d.median} />
              </TableCell>
              <TableCell className="px-4 text-right tabular-nums">{d.outliers}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  )
}

export function PricingPage() {
  const [params, setParams] = useSearchParams()
  const product = parsePricingProduct(params.get('product'))
  const { dealerId } = useDealerParam()
  const { data: dealers } = useDealers()
  const { data, isPending, isError, error, refetch, isPlaceholderData } = usePricing(product, dealerId)
  const dealerName = (id: string) => dealers?.find((d) => d.id === id)?.name ?? id

  const setProduct = (p: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (p === 'GAP') next.delete('product')
      else next.set('product', p)
      return next
    })

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Insights' }, { label: 'Pricing dispersion' }]}
        title="Pricing dispersion"
        subtitle="How add-on prices vary by product, rooftop and vehicle segment."
      />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger size="sm" aria-label="Product" className="w-[240px] bg-surface text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_PRODUCTS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRODUCT_NAMES[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(isPending || !dealers) && !isError && (
          <div className="flex flex-col gap-4" aria-busy="true" role="status" aria-label="Loading prices">
            <SkeletonCard>
              <Skeleton className="h-4 w-[520px] max-w-full" />
              <Skeleton className="mt-2 h-3 w-96 max-w-full" />
            </SkeletonCard>
            <ChartCardSkeleton heightClass="h-[300px]" />
            <LoadingTable rows={4} columns={[{ width: 'w-16' }, { width: 'w-28' }, { width: 'w-28' }, { width: 'w-16', align: 'right' }, { width: 'w-12', align: 'right' }, { width: 'w-16', align: 'right' }]} />
          </div>
        )}
        {isError && (
          <div className="rounded-lg border bg-card">
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        )}

        {data && dealers && data.overall.count === 0 && (
          <div className="rounded-lg border bg-card">
            <EmptyState icon={ChartScatter} title={`No ${PRODUCT_NAMES[product].toLowerCase()} prices are recorded for this rooftop.`} action={dealerId ? { label: 'Show all rooftops', to: `/insights/pricing${product === 'GAP' ? '' : `?product=${product}`}` } : undefined} />
          </div>
        )}

        {data && dealers && data.overall.count > 0 && (
          <div className={cn('flex flex-col gap-4', isPlaceholderData && 'opacity-60 transition-opacity')}>
            <div className="rounded-lg border bg-card px-4 py-3">
              <p className="text-[15px] leading-6 font-medium text-text">{pricingSentence(data)}</p>
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-4 text-text-muted">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                Outliers are flagged for review, not as conclusions. Peer groups are matched on vehicle, term and credit tier.
              </p>
            </div>

            <SectionCard
              title="Prices by rooftop"
              description={`${data.overall.count} deals · median ${PRODUCT_NAMES[product].toLowerCase()}`}
              action={
                <ul className="flex items-center gap-4 text-xs leading-4 text-text-muted" aria-label="Legend">
                  <li className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-text-muted/50" aria-hidden="true" /> Price
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-sev-critical" aria-hidden="true" /> Outlier
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="h-0 w-4 border-t-2 border-dashed border-brand" aria-hidden="true" /> Median
                  </li>
                </ul>
              }
            >
              <PricingChart data={data} dealers={dealers} />
            </SectionCard>

            <div className="grid gap-4 xl:grid-cols-3">
              <OutlierTable data={data} dealerName={dealerName} />
              <ByRooftop data={data} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
