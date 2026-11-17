import { ArrowLeftRight, GitCompareArrows, PackageMinus, PackagePlus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

import { useProviders } from '@/app/queries'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingTable } from '@/components/common/LoadingTable'
import { Money } from '@/components/common/Money'
import { SectionCard } from '@/components/common/SectionCard'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DetectorBadge } from '@/features/deals/components/DetectorBadge'
import { parseVersion } from '@/features/deals/dealsParams'
import { detectorBadges, fieldRows, type FieldRow, type RowKey } from '@/features/deals/diffRows'
import { useDealDiff, useDealFindings } from '@/features/deals/hooks'
import { formatApr, formatDateTime, formatMoney, formatSignedMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Deal, Finding } from '@/types'

const MINUS = '−'

function formatValue(kind: FieldRow['kind'], n: number): string {
  return kind === 'money' ? formatMoney(n) : kind === 'percent' ? formatApr(n) : `${n} months`
}

function formatChange(row: FieldRow): string {
  if (!row.changed) return ''
  if (row.kind === 'money') return formatSignedMoney(row.delta)
  const sign = row.delta > 0 ? '+' : MINUS
  const size = Math.abs(row.delta)
  return row.kind === 'months' ? `${sign}${size} months` : `${sign}${String(Number(size.toFixed(2)))} pts`
}

function Badges({ findings }: { findings: Finding[] | undefined }) {
  if (!findings?.length) return null
  return (
    <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
      {findings.map((f) => (
        <DetectorBadge key={f.id} finding={f} />
      ))}
    </span>
  )
}

function ReasonText({ reason }: { reason: string | null }) {
  return reason?.trim() ? <span className="text-text">{reason}</span> : <span className="font-medium text-sev-medium">No reason recorded</span>
}

export function VersionsTab({ deal }: { deal: Deal }) {
  const [params, setParams] = useSearchParams()
  const max = deal.versions.length
  const from = parseVersion(params.get('from'), max, 1)
  const to = parseVersion(params.get('to'), max, deal.current_version)
  const [showUnchanged, setShowUnchanged] = useState(false)
  const diff = useDealDiff(deal.id, from, to)
  const findings = useDealFindings(deal.id)
  const providers = useProviders()

  const setVersions = (next: { from?: number; to?: number }) =>
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('from', String(next.from ?? from))
        n.set('to', String(next.to ?? to))
        return n
      },
      { replace: true },
    )

  const fromV = deal.versions.find((v) => v.version === from)
  const toV = deal.versions.find((v) => v.version === to)
  const badges = diff.data && findings.data ? detectorBadges(diff.data, findings.data.items) : new Map<RowKey, Finding[]>()
  const providerName = (code: string) => providers.data?.find((p) => p.id === code)?.name ?? code
  const options = deal.versions.map((v) => (
    <SelectItem key={v.version} value={String(v.version)}>
      v{v.version} · {formatDateTime(v.created_at)}
    </SelectItem>
  ))

  const rows = diff.data && fromV && toV ? fieldRows(diff.data, fromV, toV).filter((r) => r.changed || showUnchanged) : []
  const changedCount = diff.data?.changes.length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1.5">
          <Label htmlFor="diff-from">From version</Label>
          <Select value={String(from)} onValueChange={(v) => setVersions({ from: Number(v) })}>
            <SelectTrigger id="diff-from" size="sm" className="w-[250px] bg-surface text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{options}</SelectContent>
          </Select>
        </div>
        <Button variant="secondary" size="icon-sm" aria-label="Swap versions" onClick={() => setVersions({ from: to, to: from })}>
          <ArrowLeftRight />
        </Button>
        <div className="space-y-1.5">
          <Label htmlFor="diff-to">To version</Label>
          <Select value={String(to)} onValueChange={(v) => setVersions({ to: Number(v) })}>
            <SelectTrigger id="diff-to" size="sm" className="w-[250px] bg-surface text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{options}</SelectContent>
          </Select>
        </div>
        <label className="ml-auto flex items-center gap-2 pb-1.5 text-[13px] leading-[18px] text-text">
          <Switch checked={showUnchanged} onCheckedChange={setShowUnchanged} aria-label="Show unchanged fields" />
          Show unchanged fields
        </label>
      </div>

      {diff.isPending && <LoadingTable rows={6} columns={[{ width: 'w-36' }, { width: 'w-24', align: 'right' }, { width: 'w-24', align: 'right' }, { width: 'w-20', align: 'right' }]} />}
      {diff.isError && (
        <div className="rounded-lg border bg-card">
          <ErrorState error={diff.error} onRetry={() => diff.refetch()} />
        </div>
      )}

      {diff.data && fromV && toV && (
        <>
          <SectionCard
            title={`v${from} to v${to}`}
            description={
              diff.data.has_changes
                ? `${changedCount} ${changedCount === 1 ? 'field' : 'fields'} changed, ${diff.data.products_added.length} ${diff.data.products_added.length === 1 ? 'product' : 'products'} added, ${diff.data.products_removed.length} removed`
                : 'These versions are identical'
            }
            flush
          >
            <Table aria-label={`Changes from version ${from} to version ${to}`}>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[34%] px-4">Field</TableHead>
                  <TableHead className="px-4 text-right">v{from} (before)</TableHead>
                  <TableHead className="px-4 text-right">v{to} (after)</TableHead>
                  <TableHead className="px-4 text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key} className={cn(!r.changed && 'text-text-muted')}>
                    <TableCell className="px-4">
                      {r.label}
                      <Badges findings={badges.get(r.key)} />
                    </TableCell>
                    <TableCell className={cn('px-4 text-right font-mono text-xs', r.changed && 'bg-sev-critical/10 text-sev-critical')}>{formatValue(r.kind, r.before)}</TableCell>
                    <TableCell className={cn('px-4 text-right font-mono text-xs', r.changed && 'bg-success/10 text-success')}>{formatValue(r.kind, r.after)}</TableCell>
                    <TableCell className="px-4 text-right font-mono text-xs tabular-nums">{formatChange(r)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="px-4">
                    Change reason
                    <Badges findings={badges.get('reason')} />
                  </TableCell>
                  <TableCell className="px-4 text-right text-xs">
                    <ReasonText reason={fromV.reason} />
                  </TableCell>
                  <TableCell className="px-4 text-right text-xs">
                    <ReasonText reason={toV.reason} />
                  </TableCell>
                  <TableCell className="px-4" />
                </TableRow>
                {rows.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="px-4 py-3 text-center text-text-muted">
                      No fields differ between these versions.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Products" description="Add-on products that appear, disappear or change price between the two versions">
            {!diff.data.products_added.length && !diff.data.products_removed.length && !diff.data.products_changed.length ? (
              <EmptyState compact icon={GitCompareArrows} title="No add-on products were added, removed or repriced." />
            ) : (
              <div className="space-y-4">
                {diff.data.products_added.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1.5 text-[13px] leading-[18px] font-medium text-success">
                      <PackagePlus className="size-4" aria-hidden="true" /> Added
                    </h3>
                    <ul className="mt-1 divide-y rounded-lg border">
                      {diff.data.products_added.map((p) => (
                        <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 bg-success/10 px-3 py-2 first:rounded-t-lg last:rounded-b-lg">
                          <span className="text-[13px] leading-[18px] text-text">
                            {p.name}
                            <span className="text-text-muted">
                              {' '}
                              · {providerName(deal.versions.flatMap((v) => v.products).find((x) => x.code === p.code)?.provider_id ?? '')} · {p.term_months} months
                              {p.max_miles ? ` / ${p.max_miles.toLocaleString('en-US')} miles` : ''}
                            </span>
                            <Badges findings={badges.get(`product:${p.code}`)} />
                          </span>
                          <Money mono signed value={p.price} className="text-xs text-success" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {diff.data.products_removed.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-1.5 text-[13px] leading-[18px] font-medium text-sev-critical">
                      <PackageMinus className="size-4" aria-hidden="true" /> Removed
                    </h3>
                    <ul className="mt-1 divide-y rounded-lg border">
                      {diff.data.products_removed.map((p) => (
                        <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 bg-sev-critical/10 px-3 py-2 first:rounded-t-lg last:rounded-b-lg">
                          <span className="text-[13px] leading-[18px] text-text">{p.name}</span>
                          <Money mono signed value={-p.price} className="text-xs text-sev-critical" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {diff.data.products_changed.length > 0 && (
                  <div>
                    <h3 className="text-[13px] leading-[18px] font-medium text-text">Repriced</h3>
                    <ul className="mt-1 divide-y rounded-lg border">
                      {diff.data.products_changed.map((p) => (
                        <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span className="text-[13px] leading-[18px] text-text">{p.name}</span>
                          <span className="font-mono text-xs">
                            {formatMoney(p.before.price)} → {formatMoney(p.after.price)} ({formatSignedMoney(p.price_delta)})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
