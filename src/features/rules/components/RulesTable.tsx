import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { StatusBadge } from '@/components/common/StatusBadge'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Rule } from '@/types'

interface RulesTableProps {
  rules: Rule[]
  onOpen: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
  /** Dim the rows while a new filter loads. */
  stale: boolean
}

/** California rules are Active. Rules for other states are drafts: greyed out, "Coming soon", switch disabled. */
export function RulesTable({ rules, onOpen, onToggle, stale }: RulesTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table aria-label="Rules" className={cn(stale && 'opacity-60 transition-opacity')}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">Rule ID</TableHead>
            <TableHead className="px-2">Name</TableHead>
            <TableHead className="px-2">Jurisdiction</TableHead>
            <TableHead className="px-2">Source</TableHead>
            <TableHead className="px-2">Effective from</TableHead>
            <TableHead className="px-2">Version</TableHead>
            <TableHead className="px-2">Status</TableHead>
            <TableHead className="px-4 text-right">Enabled</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((r) => {
            const draft = r.status === 'Draft'
            return (
              <TableRow key={r.id} className={cn('cursor-pointer', draft && 'bg-app/60 text-text-muted')} onClick={() => onOpen(r.id)}>
                <TableCell className="px-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(r.id)
                    }}
                    className={cn('rounded-sm font-mono text-xs outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand', draft ? 'text-text-muted' : 'text-brand')}
                  >
                    {r.id}
                  </button>
                </TableCell>
                <TableCell className="px-2">
                  <span className="block max-w-[260px] truncate" title={r.name}>
                    {r.name}
                  </span>
                </TableCell>
                <TableCell className="px-2">{r.jurisdiction}</TableCell>
                <TableCell className="px-2">
                  <span className="block max-w-[210px] truncate" title={r.source}>
                    {r.source}
                  </span>
                </TableCell>
                <TableCell className="px-2 tabular-nums">{formatDate(r.effective_from)}</TableCell>
                <TableCell className="px-2 font-mono text-xs">v{r.version}</TableCell>
                <TableCell className="px-2">
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={r.status} className={cn(draft && 'text-text-muted')} />
                    {draft && <Badge variant="outline" className="h-5 border-dashed bg-card font-medium text-text-muted">Coming soon</Badge>}
                  </span>
                </TableCell>
                <TableCell className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={r.enabled}
                    disabled={draft}
                    onCheckedChange={(on) => onToggle(r.id, on)}
                    aria-label={draft ? `${r.id} is a draft and cannot be enabled` : `${r.enabled ? 'Disable' : 'Enable'} ${r.id}`}
                  />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
