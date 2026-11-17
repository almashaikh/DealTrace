import { Download, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { hasAuditFilters, type AuditState } from '@/features/audit/auditParams'
import type { AuditFacets } from '@/types'

interface AuditToolbarProps {
  state: AuditState
  update: (patch: Partial<AuditState>) => void
  clearFilters: () => void
  facets: AuditFacets | undefined
  exporting: boolean
  onExport: () => void
}

const ANY = '__any__'

export function AuditToolbar({ state, update, clearFilters, facets, exporting, onExport }: AuditToolbarProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="audit-actor" className="text-xs leading-4 text-text-muted">
          Actor
        </Label>
        <Select value={state.actor ?? ANY} onValueChange={(v) => update({ actor: v === ANY ? null : v })}>
          <SelectTrigger id="audit-actor" size="sm" className="w-[170px] bg-surface text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any actor</SelectItem>
            {facets?.actors.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-action" className="text-xs leading-4 text-text-muted">
          Action
        </Label>
        <Select value={state.action ?? ANY} onValueChange={(v) => update({ action: v === ANY ? null : v })}>
          <SelectTrigger id="audit-action" size="sm" className="w-[200px] bg-surface text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any action</SelectItem>
            {facets?.actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-from" className="text-xs leading-4 text-text-muted">
          From
        </Label>
        <Input id="audit-from" type="date" value={state.from ?? ''} max={state.to ?? undefined} onChange={(e) => update({ from: e.target.value || null })} className="h-8 w-[150px] bg-surface text-[13px] tabular-nums" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-to" className="text-xs leading-4 text-text-muted">
          To
        </Label>
        <Input id="audit-to" type="date" value={state.to ?? ''} min={state.from ?? undefined} onChange={(e) => update({ to: e.target.value || null })} className="h-8 w-[150px] bg-surface text-[13px] tabular-nums" />
      </div>
      {hasAuditFilters(state) && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
      <Button variant="secondary" size="sm" className="ml-auto" onClick={onExport} disabled={exporting}>
        {exporting ? <LoaderCircle className="animate-spin" /> : <Download />}
        Export CSV
      </Button>
    </div>
  )
}
