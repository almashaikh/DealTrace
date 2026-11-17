import { Handle, MarkerType, Position, ReactFlow, Controls, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Network } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { SectionCard } from '@/components/common/SectionCard'
import { SkeletonCard } from '@/components/common/skeletons'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { parseVersion } from '@/features/deals/dealsParams'
import { NODE_HEIGHT, NODE_POSITIONS, NODE_WIDTH, defaultGraphPair, nodeData, type DealNodeData } from '@/features/deals/graphLayout'
import { useDependencyGraph } from '@/features/deals/hooks'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Deal, DependencyGraph, GraphNodeId } from '@/types'

type DealNode = Node<DealNodeData, 'deal'>

/** A node shows its label and value, and "old → new" when it changed. Changed nodes are amber. */
function DealNodeView({ data }: NodeProps<DealNode>) {
  return (
    <div
      data-changed={data.changed}
      className={cn('rounded-lg border px-3 py-2', data.changed ? 'border-sev-medium/40 bg-sev-medium/10' : 'bg-card')}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-text-muted" isConnectable={false} />
      <p className={cn('text-xs leading-4', data.changed ? 'font-medium text-sev-medium' : 'text-text-muted')}>{data.label}</p>
      <p className="mt-1 text-[13px] leading-[18px] font-medium whitespace-nowrap text-text tabular-nums">
        {data.changed ? (
          <>
            <span className="text-text-muted">{data.before}</span> <span aria-label="to">→</span> {data.after}
          </>
        ) : (
          data.after
        )}
      </p>
      <Handle type="source" position={Position.Right} className="!size-1.5 !min-h-0 !min-w-0 !border-0 !bg-text-muted" isConnectable={false} />
    </div>
  )
}

const NODE_TYPES = { deal: DealNodeView }

function buildFlow(graph: DependencyGraph): { nodes: DealNode[]; edges: Edge[] } {
  const e = graph.explanation
  const changed = new Set<GraphNodeId>([...e.changed_inputs, ...e.affected])
  const nodes: DealNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: 'deal',
    position: NODE_POSITIONS[n.id],
    data: nodeData(n, e.before, e.after, changed),
    draggable: false,
    selectable: false,
    connectable: false,
  }))
  const edges: Edge[] = graph.edges.map((edge) => {
    const hot = changed.has(edge.from) && changed.has(edge.to)
    const color = hot ? 'var(--dt-sev-medium)' : 'var(--dt-border)'
    return {
      id: `${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      style: { stroke: color, strokeWidth: hot ? 2 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    }
  })
  return { nodes, edges }
}

function GraphSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" aria-busy="true" role="status" aria-label="Loading dependency graph">
      <SkeletonCard className="h-[480px]">
        <div className="grid h-full grid-cols-4 items-center gap-6">
          {[5, 1, 1, 1].map((n, col) => (
            <div key={col} className="flex h-full flex-col justify-around">
              {Array.from({ length: n }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ))}
        </div>
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton className="h-4 w-36" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-11/12" />
          <Skeleton className="h-3.5 w-3/4" />
        </div>
      </SkeletonCard>
    </div>
  )
}

/** How the deal's figures depend on each other, and which ones moved between two versions. */
export function GraphTab({ deal }: { deal: Deal }) {
  const [params, setParams] = useSearchParams()
  const max = deal.versions.length
  const [defaultFrom, defaultTo] = useMemo(() => defaultGraphPair(deal.versions), [deal.versions])
  const from = parseVersion(params.get('from'), max, defaultFrom)
  const to = parseVersion(params.get('to'), max, defaultTo)
  const { data, isPending, isError, error, refetch } = useDependencyGraph(deal.id, from, to)

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

  const flow = useMemo(() => (data ? buildFlow(data) : null), [data])
  const options = deal.versions.map((v) => (
    <SelectItem key={v.version} value={String(v.version)}>
      v{v.version} · {formatDateTime(v.created_at)}
    </SelectItem>
  ))

  if (isPending) return <GraphSkeleton />
  if (isError || !data || !flow) {
    return (
      <div className="rounded-lg border bg-card">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  const e = data.explanation
  const anyChange = e.changed_inputs.length > 0 || e.affected.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1.5">
          <Label htmlFor="graph-from">From version</Label>
          <Select value={String(from)} onValueChange={(v) => setVersions({ from: Number(v) })}>
            <SelectTrigger id="graph-from" size="sm" className="w-[250px] bg-surface text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{options}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="graph-to">To version</Label>
          <Select value={String(to)} onValueChange={(v) => setVersions({ to: Number(v) })}>
            <SelectTrigger id="graph-to" size="sm" className="w-[250px] bg-surface text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{options}</SelectContent>
          </Select>
        </div>
        <ul className="ml-auto flex items-center gap-4 pb-1.5 text-xs leading-4 text-text-muted" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border border-sev-medium/40 bg-sev-medium/10" aria-hidden="true" /> Changed
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm border bg-card" aria-hidden="true" /> Unchanged
          </li>
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[480px] overflow-hidden rounded-lg border bg-card" role="group" aria-label={`Dependency graph from version ${from} to version ${to}`}>
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={NODE_TYPES}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={false}
            preventScrolling={false}
            fitView
            fitViewOptions={{ padding: 0.06 }}
            minZoom={0.3}
            maxZoom={1.6}
            proOptions={{ hideAttribution: false }}
          >
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </div>

        <SectionCard title="What changed" description={`v${from} to v${to}`}>
          {from === to || !anyChange ? (
            <EmptyState compact icon={Network} title={`No deal terms changed between v${from} and v${to}.`} />
          ) : (
            <>
              <p className="text-sm leading-5 font-medium text-text">{e.headline}</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-4 text-[13px] leading-5 text-text marker:text-text-muted">
                {e.sentences.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <p className="mt-3 border-t pt-3 text-xs leading-4 text-text-muted">{e.summary}</p>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
