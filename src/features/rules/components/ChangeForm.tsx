import { LoaderCircle, Play } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { SectionCard } from '@/components/common/SectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import type { ImpactChange, ImpactChangeType, Rule } from '@/types'

const TYPES: { value: ImpactChangeType; label: string }[] = [
  { value: 'effective_date', label: 'Effective date' },
  { value: 'threshold', label: 'Threshold' },
  { value: 'disable', label: 'Disable rule' },
]

interface ChangeFormProps {
  rule: Rule
  running: boolean
  onRun: (change: ImpactChange) => void
}

/** Describe a change to the rule, then run the impact check. Nothing here changes the rule itself. */
export function ChangeForm({ rule, running, onRun }: ChangeFormProps) {
  const [type, setType] = useState<ImpactChangeType>('effective_date')
  const [date, setDate] = useState(rule.effective_from)
  const [pct, setPct] = useState('10')

  const pctNumber = Number(pct)
  const valid = type === 'effective_date' ? /^\d{4}-\d{2}-\d{2}$/.test(date) : type === 'threshold' ? pct.trim() !== '' && Number.isFinite(pctNumber) && Math.abs(pctNumber) <= 50 : true

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid || running) return
    if (type === 'effective_date') onRun({ type, effective_date: date })
    else if (type === 'threshold') onRun({ type, threshold_pct: pctNumber })
    else onRun({ type })
  }

  return (
    <SectionCard title="Change to test" description="The rule itself is not changed. This only estimates the impact.">
      <form onSubmit={submit} className="flex flex-wrap items-start gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="change-type">Change type</Label>
          <Select value={type} onValueChange={(v) => setType(v as ImpactChangeType)}>
            <SelectTrigger id="change-type" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === 'effective_date' && (
          <div className="space-y-1.5">
            <Label htmlFor="change-date">New effective date</Label>
            <Input id="change-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[180px] tabular-nums" />
            <p className="text-xs leading-4 text-text-muted">Now in force from {formatDate(rule.effective_from)}</p>
          </div>
        )}
        {type === 'threshold' && (
          <div className="space-y-1.5">
            <Label htmlFor="change-pct">Change the threshold by (%)</Label>
            <Input
              id="change-pct"
              type="number"
              inputMode="decimal"
              step="1"
              min={-50}
              max={50}
              value={pct}
              aria-invalid={!valid}
              onChange={(e) => setPct(e.target.value)}
              className="w-[180px] tabular-nums"
            />
            <p className="text-xs leading-4 text-text-muted">{valid ? 'Positive is stricter, negative is looser. Illustrative estimate.' : 'Enter a number from −50 to 50.'}</p>
          </div>
        )}
        {type === 'disable' && <p className="max-w-[320px] pt-[30px] text-[13px] leading-5 text-text-muted">The rule stops flagging deals until it is enabled again.</p>}

        <Button type="submit" disabled={!valid || running} className="mt-[26px]">
          {running ? <LoaderCircle className="animate-spin" /> : <Play />}
          {running ? 'Running impact check' : 'Run impact check'}
        </Button>
      </form>
    </SectionCard>
  )
}
