import { toast } from 'sonner'
import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { Button } from '@/components/ui/button'
import { DealForm } from '@/features/sandbox/components/DealForm'
import { FindingsPanel } from '@/features/sandbox/components/FindingsPanel'
import { LiveFiguresCard } from '@/features/sandbox/components/LiveFigures'
import { useSandboxEvaluate } from '@/features/sandbox/hooks'
import { PRESETS, START_FORM, buildHistory, liveFigures, parseForm, sameTerms, type Preset, type SandboxForm, type SavedEdit } from '@/features/sandbox/model'
import type { DealTerms } from '@/lib/history'
import { formatApr, formatMoney, formatTime } from '@/lib/format'
import type { DealVersion, DetectedFinding, DetectorType, SandboxInput } from '@/types'

function startTerms(): DealTerms {
  const { terms } = parseForm(START_FORM)
  if (!terms) throw new Error('The starting deal is not valid')
  return terms
}
const START: DealTerms = startTerms()

export function SandboxPage() {
  const [form, setForm] = useState<SandboxForm>(START_FORM)
  const [edits, setEdits] = useState<SavedEdit[]>([])
  const [flags, setFlags] = useState({ priceAgreed: START_FORM.priceAgreed, creditApproved: START_FORM.creditApproved })
  const [versions, setVersions] = useState<DealVersion[]>(() => buildHistory(START, [], flags).versions)
  const [findings, setFindings] = useState<DetectedFinding[] | null>(null)
  const [expected, setExpected] = useState<DetectorType | null>(null)
  const [lastInput, setLastInput] = useState<{ input: SandboxInput; edits: SavedEdit[] } | null>(null)
  const evaluate = useSandboxEvaluate()

  const parsed = useMemo(() => parseForm(form), [form])
  const figures = parsed.terms ? liveFigures(parsed.terms) : null
  const latest = edits.length > 0 ? (edits[edits.length - 1] as SavedEdit).terms : START
  const savedFigures = liveFigures(latest)

  const flagsChanged = form.priceAgreed !== flags.priceAgreed || form.creditApproved !== flags.creditApproved
  const unchanged = parsed.terms ? sameTerms(parsed.terms, latest) && !flagsChanged : false
  const blockedReason = parsed.errors ? 'Fix the highlighted fields first.' : unchanged ? 'Change the deal first. There is nothing new to save.' : null

  function run(newEdits: SavedEdit[], newFlags: typeof flags) {
    const history = buildHistory(START, newEdits, newFlags)
    const input: SandboxInput = { versions: history.versions, events: history.events }
    setLastInput({ input, edits: newEdits })
    evaluate.mutate(input, {
      onSuccess: (result) => {
        setEdits(newEdits)
        setFlags(newFlags)
        setVersions(history.versions)
        setFindings(result.findings)
        toast.success(`Saved v${history.versions.length} · ${result.findings.length} ${result.findings.length === 1 ? 'finding' : 'findings'}`)
      },
      onError: () => toast.error('The detectors could not run. Try again.'),
    })
  }

  function save() {
    if (!parsed.terms || blockedReason) return
    const edit: SavedEdit = { terms: parsed.terms, reason: form.reason.trim() || null }
    // A change to the log toggles alone saves a new evaluation with the same terms.
    run(sameTerms(parsed.terms, latest) ? edits : [...edits, edit], { priceAgreed: form.priceAgreed, creditApproved: form.creditApproved })
  }

  function reset() {
    evaluate.reset()
    setForm(START_FORM)
    setEdits([])
    setFlags({ priceAgreed: START_FORM.priceAgreed, creditApproved: START_FORM.creditApproved })
    setVersions(buildHistory(START, [], { priceAgreed: START_FORM.priceAgreed, creditApproved: START_FORM.creditApproved }).versions)
    setFindings(null)
    setExpected(null)
    setLastInput(null)
    toast.success('Sandbox reset to the starting deal')
  }

  function applyPreset(p: Preset) {
    setForm(p.form)
    setExpected(p.expects)
    toast.success(`Preset loaded: ${p.label}`)
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Tools' }, { label: 'Live sandbox' }]}
        title="Live sandbox"
        subtitle="Edit a deal and watch the payment figures and detectors update."
      />
      <div className="flex flex-col gap-4">
        <SectionCard title="Presets" description="Each one fills the form. Save it as a new version to run the detectors.">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="secondary" size="sm" onClick={() => applyPreset(p)} title={p.description} aria-label={`${p.label}. ${p.description}`}>
                {p.label}
              </Button>
            ))}
          </div>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
          <DealForm
            form={form}
            errors={parsed.errors ?? {}}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            onSave={save}
            onReset={reset}
            saving={evaluate.isPending}
            blockedReason={blockedReason}
          />

          <div className="flex min-w-0 flex-col gap-4">
            <LiveFiguresCard figures={figures} saved={savedFigures} savedLabel={`v${versions.length}, as saved`} />
            <FindingsPanel
              findings={findings}
              loading={evaluate.isPending}
              error={evaluate.isError ? evaluate.error : null}
              onRetry={() => lastInput && evaluate.mutate(lastInput.input)}
              expected={expected}
            />
            <SectionCard title="Saved versions" description="The history the detectors read" flush>
              <ol className="divide-y">
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] leading-[18px]">
                    <span className="min-w-0">
                      <span className="font-mono text-xs text-text">v{v.version}</span> <span className="text-text">{v.label}</span>{' '}
                      <span className="text-text-muted">· {formatTime(v.created_at)} · {formatApr(v.apr)} · {v.term_months} months{v.products.length > 0 ? ` · ${v.products.map((p) => p.code).join(', ')}` : ''}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">{formatMoney(v.monthly_payment)}</span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </div>
        </div>
      </div>
    </>
  )
}
