import { CircleCheck, CircleX, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

import { MonoId } from '@/components/common/MonoId'
import { Button } from '@/components/ui/button'
import { headLabel } from '@/features/audit/auditParams'
import { api } from '@/lib/api'
import { formatCount, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ChainVerification } from '@/types'

/** The check shows its progress for at least this long, so a fast verification is still visible. */
const MIN_PROGRESS_MS = 1100

type Phase = { name: 'idle' } | { name: 'running' } | { name: 'done'; result: ChainVerification; at: string } | { name: 'failed' }

/**
 * Verify hash chain. Runs the real api.verifyAuditChain, which recomputes every SHA-256 hash in this browser,
 * and shows a green result or a red one that names the first record that does not match.
 */
export function VerifyPanel({ tamper }: { tamper: boolean }) {
  const [phase, setPhase] = useState<Phase>({ name: 'idle' })
  const [width, setWidth] = useState(0)
  const running = phase.name === 'running'

  // The bar fills towards 92% while the check runs, then jumps to 100% when the result arrives.
  useEffect(() => {
    if (!running) return
    const frame = requestAnimationFrame(() => setWidth(92))
    return () => cancelAnimationFrame(frame)
  }, [running])

  async function verify() {
    setWidth(0)
    setPhase({ name: 'running' })
    try {
      const [result] = await Promise.all([api.verifyAuditChain({ tamper }), new Promise((r) => setTimeout(r, MIN_PROGRESS_MS))])
      setWidth(100)
      setPhase({ name: 'done', result, at: new Date().toISOString() })
    } catch {
      setPhase({ name: 'failed' })
    }
  }

  return (
    <section aria-label="Hash chain" className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base leading-6 font-semibold text-text">Hash chain</h2>
          <p className="max-w-[640px] text-xs leading-4 text-text-muted">
            Each record&rsquo;s SHA-256 hash covers the record and the hash before it, so changing any record breaks every link after it. Verifying recomputes all of them in this browser.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tamper && <span className="rounded-md bg-sev-medium/10 px-2 py-0.5 text-xs leading-4 font-medium text-sev-medium">Tamper test on</span>}
          <Button onClick={verify} disabled={running}>
            {running ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            {running ? 'Verifying' : 'Verify hash chain'}
          </Button>
        </div>
      </div>

      {running && (
        <div className="mt-4" role="status" aria-label="Verifying hash chain">
          <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} className="h-1.5 overflow-hidden rounded-md bg-border">
            <div className={cn('h-full rounded-md bg-brand ease-out', width === 92 ? 'transition-[width] duration-[1100ms]' : '')} style={{ width: `${width}%` }} />
          </div>
          <p className="mt-2 text-xs leading-4 text-text-muted">Recomputing SHA-256 hashes</p>
        </div>
      )}

      {phase.name === 'done' && phase.result.valid && (
        <div role="status" className="mt-4 flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-3 text-success">
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm leading-5 font-semibold">
              Chain valid · {formatCount(phase.result.checked)} events checked · head{' '}
              {phase.result.head_hash ? <MonoId value={phase.result.head_hash} display={headLabel(phase.result.head_hash)} className="text-sm font-semibold text-success [&_button]:text-success" /> : 'none'}
            </p>
            <p className="text-xs leading-4 text-success/90">Every hash was recomputed and matches the one stored. Checked at {formatTime(phase.at)}.</p>
          </div>
        </div>
      )}

      {phase.name === 'done' && !phase.result.valid && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-sev-critical/30 bg-sev-critical/10 p-3 text-sev-critical">
          <CircleX className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm leading-5 font-semibold">Chain broken at event {phase.result.first_invalid_id}</p>
            <p className="text-xs leading-4">
              {phase.result.reason}. {formatCount(phase.result.checked)} of {formatCount(phase.result.total)} records were checked before it stopped, and the records after it cannot be trusted until it is reviewed.
            </p>
          </div>
        </div>
      )}

      {phase.name === 'failed' && (
        <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <p className="text-sm leading-5 text-text">The check could not run. Try again.</p>
          <Button variant="secondary" size="sm" onClick={verify}>
            Retry
          </Button>
        </div>
      )}
    </section>
  )
}
