import { Scale } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { PageHeader } from '@/components/common/PageHeader'
import { FilterBarSkeleton } from '@/components/common/skeletons'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RuleSheet } from '@/features/rules/components/RuleSheet'
import { RulesTable } from '@/features/rules/components/RulesTable'
import { useRules, useToggleRule } from '@/features/rules/hooks'

const ANY = '__any__'

export function RulesPage() {
  const [params, setParams] = useSearchParams()
  const jurisdiction = params.get('jurisdiction')
  const openRule = params.get('rule')
  const all = useRules(null)
  const filtered = useRules(jurisdiction)
  const toggle = useToggleRule()
  const query = jurisdiction ? filtered : all

  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })

  const jurisdictions = [...new Set(all.data?.items.map((r) => r.jurisdiction) ?? [])]
  const rules = query.data?.items ?? []
  const active = rules.filter((r) => r.status === 'Active').length
  const drafts = rules.length - active

  const header = (
    <PageHeader
      breadcrumbs={[{ label: 'Compliance' }, { label: 'Rules' }]}
      title="Rules"
      subtitle="Rules in force on each deal date, plus drafts for other states."
    />
  )

  if (!query.data) {
    return (
      <>
        {header}
        {query.isError ? (
          <div className="rounded-lg border bg-card">
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          </div>
        ) : (
          <div className="flex flex-col gap-4" aria-busy="true">
            <FilterBarSkeleton tabs={0} filters={1} className="justify-start" />
            <LoadingTable rows={9} columns={[{ width: 'w-28' }, { width: 'w-52' }, { width: 'w-20' }, { width: 'w-44' }, { width: 'w-24' }, { width: 'w-10' }, { width: 'w-24' }, { width: 'w-9', align: 'right' }]} />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={jurisdiction ?? ANY} onValueChange={(v) => setParam('jurisdiction', v === ANY ? null : v)}>
            <SelectTrigger size="sm" aria-label="Jurisdiction" className="w-[200px] bg-surface text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All jurisdictions</SelectItem>
              {jurisdictions.map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {jurisdiction && (
            <Button variant="ghost" size="sm" onClick={() => setParam('jurisdiction', null)}>
              Clear filter
            </Button>
          )}
          <p className="ml-auto text-[13px] leading-[18px] text-text-muted tabular-nums" aria-live="polite">
            {active} active · {drafts} {drafts === 1 ? 'draft' : 'drafts'}
          </p>
        </div>

        {query.isError && (
          <div className="rounded-lg border bg-card">
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          </div>
        )}
        {!query.isError && rules.length === 0 && (
          <div className="rounded-lg border bg-card">
            <EmptyState icon={Scale} title="No rules match this jurisdiction." action={{ label: 'Show all rules', onClick: () => setParam('jurisdiction', null) }} />
          </div>
        )}
        {!query.isError && rules.length > 0 && (
          <RulesTable
            rules={rules}
            stale={query.isPlaceholderData}
            onOpen={(id) => setParam('rule', id)}
            onToggle={(id, enabled) => toggle.mutate({ id, enabled })}
          />
        )}
      </div>

      <RuleSheet ruleId={openRule} onClose={() => setParam('rule', null)} />
    </>
  )
}
