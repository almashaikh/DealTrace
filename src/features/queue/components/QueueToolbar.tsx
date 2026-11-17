import { Bookmark, Check, Download, LoaderCircle, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MultiSelectFilter } from '@/components/common/MultiSelectFilter'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FINDING_TYPES,
  QUEUE_TABS,
  SEVERITIES,
  ASSIGNABLE_ROLES,
  activeViewId,
  hasActiveFilters,
  savedViews,
  type QueueState,
  type QueueTab,
} from '@/features/queue/queueParams'
import { FINDING_TYPE_LABELS } from '@/lib/catalog'
import { formatMoney } from '@/lib/format'
import type { Dealer, FindingCounts, User } from '@/types'

interface QueueToolbarProps {
  state: QueueState
  update: (patch: Partial<QueueState>, options?: { replace?: boolean }) => void
  counts: FindingCounts
  dealers: readonly Dealer[]
  users: readonly User[]
  meId: string | null
  dealerId: string | null
  setDealer: (id: string | null) => void
  /** Clears every filter and the rooftop in one URL change. */
  clearFilters: () => void
  exporting: boolean
  onExport: () => void
}

const COUNT_KEY: Record<QueueTab, keyof FindingCounts> = {
  open: 'open',
  in_review: 'in_review',
  resolved: 'resolved',
  dismissed: 'dismissed',
  all: 'all',
}

const ANY = '__any__'

export function QueueToolbar({ state, update, counts, dealers, users, meId, dealerId, setDealer, clearFilters, exporting, onExport }: QueueToolbarProps) {
  // The search box types freely and writes to the URL 300 ms after the last keystroke.
  const [text, setText] = useState(state.q)
  const [syncedQ, setSyncedQ] = useState(state.q)
  if (state.q !== syncedQ) {
    // The URL changed from elsewhere (a saved view, Clear filters, the back button): show it in the box.
    setSyncedQ(state.q)
    setText(state.q)
  }
  useEffect(() => {
    if (text.trim() === state.q.trim()) return
    const timer = window.setTimeout(() => update({ q: text }, { replace: true }), 300)
    return () => window.clearTimeout(timer)
  }, [text, state.q, update])

  const views = savedViews(meId)
  const activeView = activeViewId(state, views)
  const reviewers = users.filter((u) => ASSIGNABLE_ROLES.includes(u.role))
  const filtered = hasActiveFilters(state, dealerId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b">
        <Tabs value={state.tab} onValueChange={(v) => update({ tab: v as QueueTab })}>
          <TabsList variant="line" className="h-10 p-0 group-data-[orientation=horizontal]/tabs:h-10">
            {QUEUE_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="h-10 flex-none rounded-none px-3 after:bottom-0 after:bg-brand data-[state=active]:text-text">
                {t.label}{' '}
                <span className="rounded-md bg-app px-1.5 text-xs leading-4 font-medium text-text-muted tabular-nums">{counts[COUNT_KEY[t.key]]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2 pb-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Bookmark />
                Saved views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-text-muted">Saved views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {views.map((v) => (
                <DropdownMenuItem key={v.id} onSelect={() => update(v.patch)}>
                  {v.label}
                  {activeView === v.id && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" onClick={onExport} disabled={exporting}>
            {exporting ? <LoaderCircle className="animate-spin" /> : <Download />}
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search findings, deals, customers"
            aria-label="Search findings"
            className="h-8 w-[280px] bg-surface pl-8 text-[13px]"
          />
        </div>
        <MultiSelectFilter
          label="Severity"
          options={SEVERITIES.map((s) => ({ value: s, label: <SeverityBadge severity={s} /> }))}
          selected={state.severity}
          onChange={(severity) => update({ severity })}
        />
        <MultiSelectFilter
          label="Type"
          options={FINDING_TYPES.map((t) => ({ value: t, label: FINDING_TYPE_LABELS[t] }))}
          selected={state.type}
          onChange={(type) => update({ type })}
        />
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
        <Select value={state.assignee ?? ANY} onValueChange={(v) => update({ assignee: v === ANY ? null : v })}>
          <SelectTrigger size="sm" aria-label="Assignee" className="w-[170px] bg-surface text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any assignee</SelectItem>
            {reviewers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.minRefund !== null && (
          <span className="inline-flex h-8 items-center gap-1 rounded-md border bg-brand-subtle pr-1 pl-2.5 text-[13px] text-brand">
            Refund exposure ≥ {formatMoney(state.minRefund)}
            <button
              type="button"
              aria-label="Remove refund exposure filter"
              onClick={() => update({ minRefund: null })}
              className="grid size-6 place-items-center rounded-md outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="size-3.5" />
            </button>
          </span>
        )}
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
