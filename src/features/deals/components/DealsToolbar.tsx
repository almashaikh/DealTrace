import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MultiSelectFilter } from '@/components/common/MultiSelectFilter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DEAL_STATUSES, hasActiveDealFilters, type DealsState, type DealsTab } from '@/features/deals/dealsParams'
import { formatCount } from '@/lib/format'
import type { Dealer } from '@/types'

interface DealsToolbarProps {
  state: DealsState
  update: (patch: Partial<DealsState>, options?: { replace?: boolean }) => void
  dealers: readonly Dealer[]
  dealerId: string | null
  setDealer: (id: string | null) => void
  clearFilters: () => void
  /** Count on the Flagged deals tab. */
  flaggedCount: number
  /** Count on the All deals tab. */
  scannedCount: number
}

const ANY = '__any__'

export function DealsToolbar({ state, update, dealers, dealerId, setDealer, clearFilters, flaggedCount, scannedCount }: DealsToolbarProps) {
  // The search box types freely and writes to the URL 300 ms after the last keystroke.
  const [text, setText] = useState(state.q)
  const [syncedQ, setSyncedQ] = useState(state.q)
  if (state.q !== syncedQ) {
    setSyncedQ(state.q)
    setText(state.q)
  }
  useEffect(() => {
    if (text.trim() === state.q.trim()) return
    const timer = window.setTimeout(() => update({ q: text }, { replace: true }), 300)
    return () => window.clearTimeout(timer)
  }, [text, state.q, update])

  const tabs: { key: DealsTab; label: string; count: number }[] = [
    { key: 'flagged', label: 'Flagged deals', count: flaggedCount },
    { key: 'all', label: 'All deals', count: scannedCount },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="border-b">
        <Tabs value={state.tab} onValueChange={(v) => update({ tab: v as DealsTab })}>
          <TabsList variant="line" className="h-10 p-0 group-data-[orientation=horizontal]/tabs:h-10">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="h-10 flex-none rounded-none px-3 after:bottom-0 after:bg-brand data-[state=active]:text-text">
                {t.label}{' '}
                <span className="rounded-md bg-app px-1.5 text-xs leading-4 font-medium text-text-muted tabular-nums">{formatCount(t.count)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search deal, customer, vehicle, VIN"
            aria-label="Search deals"
            className="h-8 w-[300px] bg-surface pl-8 text-[13px]"
          />
        </div>
        <MultiSelectFilter label="Status" options={DEAL_STATUSES.map((s) => ({ value: s, label: s }))} selected={state.status} onChange={(status) => update({ status })} />
        <Select value={dealerId ?? ANY} onValueChange={(v) => setDealer(v === ANY ? null : v)}>
          <SelectTrigger size="sm" aria-label="Rooftop" className="w-[210px] bg-surface text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All rooftops</SelectItem>
            {dealers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveDealFilters(state, dealerId) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
