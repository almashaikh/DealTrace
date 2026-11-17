import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'

import { useUsers } from '@/app/queries'
import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { MonoId } from '@/components/common/MonoId'
import { SectionCard } from '@/components/common/SectionCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EVENT_ICONS, eventTitle, needsReason } from '@/features/deals/eventText'
import { parseVersion } from '@/features/deals/dealsParams'
import { useDealEvents } from '@/features/deals/hooks'
import { roundCents } from '@/lib/finance'
import { formatDateTime, formatMoney, formatSignedMoney, formatTime, shortHash } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Deal, DealEvent, DealVersion, User } from '@/types'

const STEP_MS = 1400

function Figure({ label, children, delta, emphasis }: { label: string; children: React.ReactNode; delta?: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs leading-4 text-text-muted">{label}</p>
      <p className={cn('mt-1 leading-8 font-semibold tracking-tight text-text tabular-nums', emphasis ? 'text-2xl' : 'text-xl')}>{children}</p>
      <p className="h-4 text-xs leading-4 text-text-muted tabular-nums">{delta ?? ''}</p>
    </div>
  )
}

function delta(cur: number, prev: number | undefined, unit: 'money' | 'months'): string | undefined {
  if (prev === undefined || cur === prev) return undefined
  return unit === 'money' ? `${formatSignedMoney(roundCents(cur - prev))} from previous` : `${cur - prev > 0 ? '+' : '−'}${Math.abs(cur - prev)} months from previous`
}

function SummaryCard({ version, previous }: { version: DealVersion; previous: DealVersion | undefined }) {
  return (
    <SectionCard title={`Version ${version.version}`} description={`${version.label} · ${formatDateTime(version.created_at)}`}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-5" aria-live="polite">
        <Figure label="Vehicle price" delta={delta(version.vehicle_price, previous?.vehicle_price, 'money')}>
          <AnimatedNumber value={version.vehicle_price} format={formatMoney} />
        </Figure>
        <Figure label="Amount financed" delta={delta(version.amount_financed, previous?.amount_financed, 'money')}>
          <AnimatedNumber value={version.amount_financed} format={formatMoney} />
        </Figure>
        <Figure label="Term" delta={delta(version.term_months, previous?.term_months, 'months')}>
          <AnimatedNumber value={version.term_months} format={(n) => `${Math.round(n)} months`} />
        </Figure>
        <Figure label="Monthly payment" emphasis delta={delta(version.monthly_payment, previous?.monthly_payment, 'money')}>
          <AnimatedNumber value={version.monthly_payment} format={formatMoney} />
        </Figure>
        <Figure label="Total of payments" emphasis delta={delta(version.total_of_payments, previous?.total_of_payments, 'money')}>
          <AnimatedNumber value={version.total_of_payments} format={formatMoney} />
        </Figure>
      </div>
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2 border-t pt-3 text-xs leading-4 text-text-muted">
        <span>Add-ons</span>
        {version.products.length === 0 ? (
          <span>none</span>
        ) : (
          version.products.map((p) => (
            <span key={p.code} className="rounded-md border bg-card px-1.5 py-0.5 text-text">
              {p.name} <span className="font-mono">{formatMoney(p.price)}</span>
            </span>
          ))
        )}
      </div>
    </SectionCard>
  )
}

function EventRow({ event, deal, users, dimmed, highlighted, last }: { event: DealEvent; deal: Deal; users: readonly User[]; dimmed: boolean; highlighted: boolean; last: boolean }) {
  const Icon = EVENT_ICONS[event.type]
  const actor = users.find((u) => u.id === event.actor_id)?.name ?? event.actor_id
  const missing = needsReason(event.type) && !event.reason?.trim()
  return (
    <li
      id={`event-${event.id}`}
      aria-current={highlighted ? 'true' : undefined}
      className={cn(
        'relative scroll-mt-24 rounded-lg py-2 pr-3 pl-12 transition-[opacity,background-color,box-shadow] duration-200 ease-out',
        dimmed && 'opacity-45',
        highlighted && 'bg-brand-subtle ring-2 ring-brand',
      )}
    >
      {!last && <span className="absolute top-9 bottom-[-8px] left-[27px] w-px bg-border" aria-hidden="true" />}
      <span className="absolute top-2 left-3 grid size-8 place-items-center rounded-md border bg-card text-text-muted">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-[13px] leading-[18px] font-medium text-text">{eventTitle(event, deal)}</p>
        <span className="flex items-center gap-2 text-xs leading-4 text-text-muted">
          <span className="rounded-md bg-app px-1.5 font-mono">v{event.version_after}</span>
          <MonoId value={event.hash} display={shortHash(event.hash)} />
        </span>
      </div>
      <p className="text-xs leading-4 text-text-muted">
        {actor} · {formatDateTime(event.timestamp)} · <span className="font-mono">{event.id}</span>
      </p>
      {event.reason?.trim() ? (
        <p className="mt-0.5 text-xs leading-4 text-text">Reason: {event.reason}</p>
      ) : missing ? (
        <p className="mt-0.5 text-xs leading-4 font-medium text-sev-medium">No reason recorded</p>
      ) : null}
    </li>
  )
}

export function TimelineTab({ deal }: { deal: Deal }) {
  const events = useDealEvents(deal.id)
  const { data: users } = useUsers()
  const { hash } = useLocation()
  const [params] = useSearchParams()
  const max = deal.versions.length
  const vParam = params.get('v')
  const [version, setVersion] = useState(() => parseVersion(vParam, max, deal.current_version))
  const [playing, setPlaying] = useState(false)

  // A link with ?v=3 (a [v3] citation) opens the replay at that version, even if the tab is already open.
  const [appliedV, setAppliedV] = useState(vParam)
  if (vParam !== appliedV) {
    setAppliedV(vParam)
    setVersion(parseVersion(vParam, max, deal.current_version))
    setPlaying(false)
  }

  // A link to #event-<id> opens the replay at that event's version, then scrolls to it.
  const hashEventId = hash.startsWith('#event-') ? hash.slice('#event-'.length) : null
  const [appliedHash, setAppliedHash] = useState<string | null>(null)
  if (events.data && hashEventId !== appliedHash) {
    setAppliedHash(hashEventId)
    const target = events.data.find((e) => e.id === hashEventId)
    if (target) {
      setVersion(target.version_after)
      setPlaying(false)
    }
  }
  useEffect(() => {
    if (!hashEventId || !events.data) return
    document.getElementById(`event-${hashEventId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [hashEventId, events.data])

  // While playing, move to the next version every 1.4 seconds and stop on the last one.
  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => (version >= max ? setPlaying(false) : setVersion(version + 1)), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [playing, version, max])

  const current = deal.versions.find((v) => v.version === version) ?? deal.versions[0]
  const previous = deal.versions.find((v) => v.version === version - 1)

  function togglePlay() {
    if (playing) return setPlaying(false)
    if (version >= max) setVersion(1)
    setPlaying(true)
  }
  const step = (to: number) => {
    setPlaying(false)
    setVersion(Math.max(1, Math.min(max, to)))
  }

  if (!current) return null

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Replay" className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon-sm" aria-label="Previous version" disabled={version <= 1} onClick={() => step(version - 1)}>
              <SkipBack />
            </Button>
            <Button variant="default" size="sm" aria-label={playing ? 'Pause replay' : 'Play replay'} onClick={togglePlay} className="w-[84px]">
              {playing ? <Pause /> : <Play />}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button variant="secondary" size="icon-sm" aria-label="Next version" disabled={version >= max} onClick={() => step(version + 1)}>
              <SkipForward />
            </Button>
          </div>
          <ol className="flex flex-1 items-center gap-1" aria-label="Versions">
            {deal.versions.map((v) => (
              <li key={v.version} className="flex-1">
                <button
                  type="button"
                  aria-pressed={v.version === version}
                  aria-label={`Show version ${v.version}`}
                  onClick={() => step(v.version)}
                  className={cn(
                    'flex w-full flex-col rounded-md border px-2.5 py-1.5 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand',
                    v.version === version ? 'border-brand bg-brand-subtle' : v.version < version ? 'bg-app hover:bg-brand-subtle/60' : 'bg-card hover:bg-app',
                  )}
                >
                  <span className={cn('text-[13px] leading-[18px] font-medium', v.version === version ? 'text-brand' : 'text-text')}>v{v.version}</span>
                  <span className="text-xs leading-4 text-text-muted">{formatTime(v.created_at)}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <SummaryCard version={current} previous={previous} />

      <SectionCard title="Events" description="Every change to this deal, in order. Events after the version shown are dimmed." flush>
        {events.isPending && (
          <div className="space-y-5 p-4" role="status" aria-label="Loading events">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-56" />
                  <Skeleton className="h-3 w-80 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {events.isError && <ErrorState compact error={events.error} onRetry={() => events.refetch()} />}
        {events.data && events.data.length === 0 && <EmptyState compact icon={Pause} title="No events are recorded for this deal." />}
        {events.data && events.data.length > 0 && (
          <ol className="space-y-2 p-3">
            {events.data.map((e, i) => (
              <EventRow
                key={e.id}
                event={e}
                deal={deal}
                users={users ?? []}
                dimmed={e.version_after > version}
                highlighted={e.id === hashEventId}
                last={i === events.data.length - 1}
              />
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  )
}
