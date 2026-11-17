import { Link } from 'react-router'

import { MonoId } from '@/components/common/MonoId'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { entityHref } from '@/features/audit/auditParams'
import { formatDateTime, shortHash } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AuditEvent, User } from '@/types'

interface AuditTableProps {
  rows: AuditEvent[]
  users: readonly User[]
  /** Dim the rows while a new filter or page loads. */
  stale: boolean
}

const ENTITY_LABELS: Record<string, string> = { deal: 'Deal', finding: 'Finding', rule: 'Rule', user: 'User', report: 'Report' }

export function AuditTable({ rows, users, stale }: AuditTableProps) {
  const actorName = (id: string) => (id === 'system' ? 'DealTrace' : (users.find((u) => u.id === id)?.name ?? id))
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table containerClassName="max-h-[calc(100vh-420px)] min-h-[280px] overflow-auto" aria-label="Audit log" className={cn(stale && 'opacity-60 transition-opacity')}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">Time</TableHead>
            <TableHead className="px-2">Actor</TableHead>
            <TableHead className="px-2">Action</TableHead>
            <TableHead className="px-2">Entity</TableHead>
            <TableHead className="px-4">Hash</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => {
            const href = entityHref(a.entity, a.entity_id)
            return (
              <TableRow key={a.id}>
                <TableCell className="px-4 whitespace-nowrap text-text-muted">{formatDateTime(a.timestamp)}</TableCell>
                <TableCell className="px-2">{actorName(a.actor_id)}</TableCell>
                <TableCell className="px-2">{a.action}</TableCell>
                <TableCell className="px-2">
                  <span className="text-text-muted">{ENTITY_LABELS[a.entity] ?? a.entity} </span>
                  {href ? (
                    <Link to={href} className="font-mono text-xs text-brand hover:underline">
                      {a.entity_id}
                    </Link>
                  ) : (
                    <span className="font-mono text-xs">{a.entity_id}</span>
                  )}
                </TableCell>
                <TableCell className="px-4">
                  <MonoId value={a.hash} display={shortHash(a.hash)} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
