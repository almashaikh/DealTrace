import { ChevronDown, ShieldQuestion } from 'lucide-react'
import { Collapsible } from 'radix-ui'

import { useProviders } from '@/app/queries'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Money } from '@/components/common/Money'
import { SkeletonCard } from '@/components/common/skeletons'
import { Skeleton } from '@/components/ui/skeleton'
import { VERDICT_STYLES, explainVerdict } from '@/features/deals/benefitText'
import { useBenefitChecks } from '@/features/deals/hooks'
import { formatMoney, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BenefitCheck, BenefitVerdict, Deal, Product } from '@/types'

const BAR: Record<BenefitVerdict, string> = {
  'Likely benefit': 'bg-success',
  'Partial benefit': 'bg-sev-medium',
  'Little or no benefit': 'bg-sev-high',
}

function Input({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs leading-4 text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] leading-[18px] text-text">{children}</dd>
    </div>
  )
}

function BenefitCard({ check, product, deal, provider }: { check: BenefitCheck; product: Product | undefined; deal: Deal; provider: string }) {
  const { inputs } = check
  const why = explainVerdict(check, product, deal.vehicle)
  return (
    <article className="flex flex-col rounded-lg border bg-card p-4" aria-label={`${product?.name ?? check.product_code} benefit check`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base leading-6 font-semibold text-text">{product?.name ?? check.product_code}</h3>
          <p className="text-xs leading-4 text-text-muted">
            {provider}
            {product ? ` · ${product.term_months} months${product.max_miles ? ` / ${product.max_miles.toLocaleString('en-US')} miles` : ''} · ` : ''}
            {product && <Money value={product.price} />}
          </p>
        </div>
        <span className={cn('inline-flex h-5 shrink-0 items-center rounded-md px-2 text-xs leading-4 font-medium whitespace-nowrap', VERDICT_STYLES[check.verdict])}>{check.verdict}</span>
      </header>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-xs leading-4 text-text-muted">Benefit score</span>
          <span className="text-[13px] leading-[18px] font-medium text-text tabular-nums">{check.score} / 100</span>
        </div>
        <div role="meter" aria-label="Benefit score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={check.score} aria-valuetext={`${check.score} out of 100, ${check.verdict}`} className="mt-1 h-2 overflow-hidden rounded-md bg-border">
          <div className={cn('h-full rounded-md transition-[width] duration-200 ease-out', BAR[check.verdict])} style={{ width: `${check.score}%` }} />
        </div>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-4 text-[13px] leading-[18px] text-text marker:text-text-muted">
        {check.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
        <Input label="Loan-to-value">{formatPercent(inputs.ltv)}</Input>
        <Input label="Negative equity">{formatMoney(inputs.negative_equity)}</Input>
        <Input label="Warranty overlap">{inputs.warranty_overlap_months} months</Input>
        <Input label="Existing coverage">{inputs.existing_coverage}</Input>
      </dl>

      <Collapsible.Root className="mt-3 border-t pt-2">
        <Collapsible.Trigger className="group/why flex w-full items-center justify-between rounded-md py-1 text-[13px] leading-[18px] font-medium text-brand outline-none focus-visible:ring-2 focus-visible:ring-brand">
          Why this verdict
          <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]/why:rotate-180" aria-hidden="true" />
        </Collapsible.Trigger>
        <Collapsible.Content>
          <ul className="mt-2 space-y-2 text-[13px] leading-5 text-text">
            {why.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Collapsible.Content>
      </Collapsible.Root>
    </article>
  )
}

/** One card per add-on product on the signed contract. */
export function BenefitTab({ deal }: { deal: Deal }) {
  const checks = useBenefitChecks(deal.id)
  const providers = useProviders()
  const products = deal.versions[deal.versions.length - 1]?.products ?? []

  if (checks.isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Loading benefit checks">
        {[0, 1].map((i) => (
          <SkeletonCard key={i}>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="mt-5 h-2 w-full" />
            <div className="mt-5 space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-3">
              {[0, 1, 2, 3].map((k) => (
                <Skeleton key={k} className="h-8" />
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    )
  }
  if (checks.isError) {
    return (
      <div className="rounded-lg border bg-card">
        <ErrorState error={checks.error} onRetry={() => checks.refetch()} />
      </div>
    )
  }
  if (checks.data.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <EmptyState icon={ShieldQuestion} title="This deal has no add-on products to check." />
      </div>
    )
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {checks.data.map((c) => {
        const product = products.find((p) => p.code === c.product_code)
        const provider = providers.data?.find((p) => p.id === product?.provider_id)?.name ?? ''
        return <BenefitCard key={c.product_code} check={c} product={product} deal={deal} provider={provider} />
      })}
    </div>
  )
}
