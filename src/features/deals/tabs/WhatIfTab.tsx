import { ArrowDownRight, ArrowUpRight, Info, Minus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Bar, BarChart, LabelList, XAxis, YAxis } from 'recharts'

import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Money } from '@/components/common/Money'
import { SectionCard } from '@/components/common/SectionCard'
import { SkeletonCard } from '@/components/common/skeletons'
import { StatCardSkeleton } from '@/components/common/StatCard'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useBranches, useCreateBranch, useDebouncedValue, useDeleteBranch, useWhatIf } from '@/features/deals/hooks'
import {
  APR_MAX,
  APR_MIN,
  TERM_OPTIONS,
  baseScenario,
  describeScenario,
  differenceTone,
  isUnchanged,
  nextBranchName,
  parseApr,
  scenarioParams,
  stateFromParams,
  type DifferenceTone,
  type ScenarioState,
} from '@/features/deals/whatIfState'
import { whatIf as computeWhatIf } from '@/lib/finance'
import { formatMoney, formatSignedMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Deal, DealVersion, ProductCode, WhatIfParams } from '@/types'

const TONE_STYLES: Record<DifferenceTone, string> = {
  cheaper: 'bg-success/10 text-success',
  costlier: 'bg-sev-high/10 text-sev-high',
  same: 'bg-app text-text-muted',
}

/** Green when the scenario is cheaper for the buyer, red-orange when it costs more. */
function DifferenceChip({ diff }: { diff: number }) {
  const tone = differenceTone(diff)
  const Icon = tone === 'cheaper' ? ArrowDownRight : tone === 'costlier' ? ArrowUpRight : Minus
  const words = tone === 'cheaper' ? 'cheaper for the buyer' : tone === 'costlier' ? 'more for the buyer' : 'no change'
  return (
    <span className={cn('inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-xs leading-4 font-medium tabular-nums', TONE_STYLES[tone])} data-tone={tone}>
      <Icon className="size-3.5" aria-hidden="true" />
      {tone === 'same' ? 'No change' : `${formatSignedMoney(diff)} ${words}`}
    </span>
  )
}

function CompareCard({ label, current, scenario, diff }: { label: string; current: number; scenario: number; diff: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs leading-4 text-text-muted">{label}</p>
      <p className="mt-1 text-2xl leading-8 font-semibold tracking-tight text-text tabular-nums" aria-label={`${label} in the scenario`}>
        <AnimatedNumber value={scenario} format={formatMoney} />
      </p>
      <p className="mt-0.5 text-xs leading-4 text-text-muted">
        Current <Money value={current} />
      </p>
      <div className="mt-2">
        <DifferenceChip diff={diff} />
      </div>
    </div>
  )
}

const CHART_CONFIG = {
  principal: { label: 'Amount financed', color: 'var(--chart-2)' },
  interest: { label: 'Interest', color: 'var(--dt-brand)' },
} satisfies ChartConfig

/** Total of payments as amount financed plus interest, current against scenario. Values on the bars, no value axis. */
function ComparisonChart({ base, scenario }: { base: { amount_financed: number; total_interest: number }; scenario: { amount_financed: number; total_interest: number } }) {
  const rows = [
    { name: 'Current', principal: base.amount_financed, interest: base.total_interest },
    { name: 'Scenario', principal: scenario.amount_financed, interest: scenario.total_interest },
  ]
  return (
    <SectionCard title="Where the money goes" description="Total of payments, split into the amount financed and interest">
      <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[170px] w-full" role="img" aria-label="Total of payments for the current deal and the scenario, split into amount financed and interest">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={64} tickLine={false} axisLine={false} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="principal" stackId="total" fill="var(--color-principal)" fillOpacity={0.4} isAnimationActive={false}>
            <LabelList dataKey="principal" position="insideLeft" formatter={(v: unknown) => formatMoney(Number(v))} className="fill-foreground text-xs tabular-nums" />
          </Bar>
          <Bar dataKey="interest" stackId="total" fill="var(--color-interest)" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="interest" position="insideLeft" formatter={(v: unknown) => (Number(v) > 0 ? formatMoney(Number(v)) : '')} className="fill-white text-xs tabular-nums" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </SectionCard>
  )
}

function Controls({
  version,
  state,
  onChange,
  aprError,
  unchanged,
  saving,
  onReset,
  onSave,
}: {
  version: DealVersion
  state: ScenarioState
  onChange: (next: ScenarioState) => void
  aprError: boolean
  unchanged: boolean
  saving: boolean
  onReset: () => void
  onSave: () => void
}) {
  function toggle(code: ProductCode, keep: boolean) {
    onChange({ ...state, removed: keep ? state.removed.filter((c) => c !== code) : [...state.removed, code] })
  }
  return (
    <SectionCard title="Scenario" description={`Starts from v${version.version}, as signed`}>
      <fieldset className="space-y-1">
        <legend className="text-xs leading-4 font-medium text-text-muted">Add-on products</legend>
        {version.products.length === 0 && <p className="text-[13px] leading-[18px] text-text-muted">No add-on products on this contract.</p>}
        {version.products.map((p) => (
          <label key={p.code} className="flex items-center justify-between gap-3 rounded-md py-1.5 text-[13px] leading-[18px] text-text">
            <span>
              {p.name} <span className="font-mono text-xs text-text-muted">{formatMoney(p.price)}</span>
            </span>
            <Switch checked={!state.removed.includes(p.code)} onCheckedChange={(keep) => toggle(p.code, keep)} aria-label={`Keep ${p.name}`} />
          </label>
        ))}
      </fieldset>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="whatif-term">Term</Label>
        <Select value={String(state.term)} onValueChange={(v) => onChange({ ...state, term: Number(v) })}>
          <SelectTrigger id="whatif-term" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TERM_OPTIONS.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t} months
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="whatif-apr">APR</Label>
        <div className="relative">
          <Input
            id="whatif-apr"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={APR_MIN}
            max={APR_MAX}
            value={state.apr}
            aria-invalid={aprError}
            aria-describedby={aprError ? 'whatif-apr-error' : undefined}
            onChange={(e) => onChange({ ...state, apr: e.target.value })}
            className={cn('pr-8 tabular-nums', aprError && 'border-sev-critical')}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-text-muted">%</span>
        </div>
        {aprError && (
          <p id="whatif-apr-error" role="alert" className="text-xs leading-4 text-sev-critical">
            Enter an APR between {APR_MIN}% and {APR_MAX}%.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" onClick={onSave} disabled={unchanged || aprError || saving} title={unchanged ? 'Change the scenario to save it as a branch' : undefined}>
          <Save />
          Save as branch
        </Button>
        <Button variant="secondary" size="sm" onClick={onReset} disabled={unchanged && !aprError}>
          <RotateCcw />
          Reset
        </Button>
      </div>
    </SectionCard>
  )
}

function Branches({ deal, version, onLoad }: { deal: Deal; version: DealVersion; onLoad: (params: WhatIfParams) => void }) {
  const { data, isPending, isError, error, refetch } = useBranches(deal.id)
  const remove = useDeleteBranch(deal.id)
  return (
    <SectionCard title="Branches" description="Saved scenarios for this deal" flush={Boolean(data?.length)}>
      {isPending && (
        <div className="space-y-3" role="status" aria-label="Loading branches">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      )}
      {isError && <ErrorState compact error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState compact icon={Save} title="No branches yet. Change the scenario and save it to compare later." />}
      {data && data.length > 0 && (
        <ul className="divide-y">
          {data.map((b) => {
            const base = deal.versions.find((v) => v.version === b.base_version) ?? version
            const r = computeWhatIf(base, b.params)
            return (
              <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-[18px] font-medium text-text">{b.name}</p>
                  <p className="truncate text-xs leading-4 text-text-muted" title={describeScenario(b.params, base)}>
                    {describeScenario(b.params, base)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs leading-4 text-text-muted">
                    <Money mono value={r.scenario.monthly_payment} /> a month
                    <DifferenceChip diff={r.difference.total_of_payments} />
                  </p>
                </div>
                <Button variant="secondary" size="xs" onClick={() => onLoad(b.params)}>
                  Load
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete ${b.name}`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(b.id, { onSuccess: () => toast.success(`Deleted ${b.name}`), onError: () => toast.error('Could not delete the branch. Try again.') })}
                >
                  <Trash2 />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

/** Try a different term, APR or set of add-ons and compare the result with the deal as signed. */
export function WhatIfTab({ deal }: { deal: Deal }) {
  const version = deal.versions.find((v) => v.version === deal.current_version) ?? (deal.versions[deal.versions.length - 1] as DealVersion)
  const base = useMemo(() => baseScenario(version), [version])
  const [state, setState] = useState<ScenarioState>(base)
  const create = useCreateBranch(deal.id)
  const branches = useBranches(deal.id)

  // While the APR is not a valid rate, keep calculating with the last valid scenario.
  const [lastValid, setLastValid] = useState<WhatIfParams>(() => scenarioParams(base) ?? {})
  const params = scenarioParams(state)
  const paramsKey = JSON.stringify(params ?? lastValid)
  if (params && JSON.stringify(params) !== JSON.stringify(lastValid)) setLastValid(params)
  const debouncedKey = useDebouncedValue(paramsKey, 300)
  const { data, isPending, isError, error, refetch, isFetching } = useWhatIf(deal.id, version.version, debouncedKey)

  const aprError = parseApr(state.apr) === null
  const unchanged = isUnchanged(state, version)
  const recalculating = paramsKey !== debouncedKey || isFetching

  function save() {
    if (!params) return
    const name = nextBranchName(branches.data ?? [])
    create.mutate(
      { name, base_version: version.version, params },
      { onSuccess: () => toast.success(`Saved ${name}`), onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save the branch. Try again.') },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-[13px] leading-[18px] text-text-muted">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        Branches never change the real deal history.
      </p>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Controls
            version={version}
            state={state}
            onChange={setState}
            aprError={aprError}
            unchanged={unchanged}
            saving={create.isPending}
            onReset={() => setState(base)}
            onSave={save}
          />
          <Branches deal={deal} version={version} onLoad={(p) => setState(stateFromParams(p, version))} />
        </div>

        <div className="flex min-w-0 flex-col gap-4" aria-live="polite" aria-busy={recalculating}>
          {isPending && (
            <>
              <div className="grid gap-4 md:grid-cols-3" role="status" aria-label="Calculating the scenario">
                {[0, 1, 2].map((i) => (
                  <StatCardSkeleton key={i} />
                ))}
              </div>
              <SkeletonCard>
                <Skeleton className="h-4 w-44" />
                <Skeleton className="mt-4 h-[120px] w-full" />
              </SkeletonCard>
            </>
          )}
          {isError && (
            <div className="rounded-lg border bg-card">
              <ErrorState error={error} onRetry={() => refetch()} />
            </div>
          )}
          {data && (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs leading-4 text-text-muted">{recalculating ? 'Recalculating…' : `Current is v${version.version} as signed. Scenario: ${describeScenario(JSON.parse(debouncedKey) as WhatIfParams, version)}.`}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <CompareCard label="Monthly payment" current={data.base.monthly_payment} scenario={data.scenario.monthly_payment} diff={data.difference.monthly_payment} />
                <CompareCard label="Total of payments" current={data.base.total_of_payments} scenario={data.scenario.total_of_payments} diff={data.difference.total_of_payments} />
                <CompareCard label="Total interest" current={data.base.total_interest} scenario={data.scenario.total_interest} diff={data.difference.total_interest} />
              </div>
              <ComparisonChart base={data.base} scenario={data.scenario} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
