import { CheckCheck, ShieldQuestion, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { SectionCard } from '@/components/common/SectionCard'
import { SeverityBadge } from '@/components/common/SeverityBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { FINDING_TYPE_LABELS } from '@/lib/catalog'
import { formatMoney } from '@/lib/format'
import { FINDING_LABEL, type DetectedFinding, type DetectorType } from '@/types'

interface FindingsPanelProps {
  /** null until a version has been saved. */
  findings: DetectedFinding[] | null
  loading: boolean
  error: unknown
  onRetry: () => void
  /** The finding the last preset should produce. */
  expected: DetectorType | null
}

function FindingCard({ f, expected }: { f: DetectedFinding; expected: boolean }) {
  return (
    // Each new finding slides in from the right and fades in over 150 ms.
    <li data-finding={f.type} className="animate-in rounded-lg border bg-card p-3 duration-150 fade-in-0 slide-in-from-right-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={f.severity} />
        <span className="text-xs leading-4 font-medium text-text">{FINDING_TYPE_LABELS[f.type]}</span>
        {expected && <span className="rounded-md border bg-brand-subtle px-1.5 text-xs leading-5 font-medium text-brand">Expected from the preset</span>}
        {f.rule_id && (
          <Link to={`/rules?rule=${f.rule_id}`} className="ml-auto font-mono text-xs text-brand hover:underline">
            {f.rule_id}
          </Link>
        )}
      </div>
      <p className="mt-2 text-[13px] leading-5 font-medium text-text">{f.title}</p>
      <dl className="mt-2 divide-y rounded-md border">
        {f.evidence.map((e, i) => (
          <div key={`${e.label}-${i}`} className="flex items-start justify-between gap-3 px-2.5 py-1.5">
            <dt className="text-xs leading-4 text-text-muted">{e.label}</dt>
            <dd className="text-right text-xs leading-4 text-text">{e.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 flex items-center gap-1.5 text-xs leading-4 text-text-muted">
        <TriangleAlert className="size-3.5 shrink-0 text-sev-medium" aria-hidden="true" />
        {FINDING_LABEL}
        {f.customer_exposure > 0 && <span className="ml-auto tabular-nums">Customer exposure {formatMoney(f.customer_exposure)}</span>}
      </p>
    </li>
  )
}

/** What the real detectors found in the deal history. */
export function FindingsPanel({ findings, loading, error, onRetry, expected }: FindingsPanelProps) {
  const found = findings?.some((f) => f.type === expected)
  return (
    <SectionCard title="Findings" description={findings ? `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'} from the four detectors` : 'From the four detectors'} flush={false}>
      {loading && (
        <div className="space-y-3" role="status" aria-label="Running the detectors">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg border p-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-3 h-3.5 w-3/4" />
              <Skeleton className="mt-2 h-12 w-full" />
            </div>
          ))}
        </div>
      )}
      {!loading && error !== null && error !== undefined && <ErrorState compact error={error} onRetry={onRetry} />}
      {!loading && !error && findings === null && <EmptyState compact icon={ShieldQuestion} title="Change the deal and save it as a new version to run the detectors." />}
      {!loading && !error && findings && findings.length === 0 && <EmptyState compact icon={CheckCheck} title="No findings. The detectors found nothing in this history." />}
      {!loading && !error && findings && findings.length > 0 && (
        <>
          {expected && (
            <p role="status" className={found ? 'mb-3 text-xs leading-4 font-medium text-success' : 'mb-3 text-xs leading-4 font-medium text-sev-medium'}>
              {found ? `The preset expected ${FINDING_TYPE_LABELS[expected]}: found.` : `The preset expected ${FINDING_TYPE_LABELS[expected]}: not found.`}
            </p>
          )}
          <ul className="space-y-3" aria-label="Findings">
            {findings.map((f) => (
              <FindingCard key={`${f.type}-${f.version_to}`} f={f} expected={f.type === expected} />
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  )
}
