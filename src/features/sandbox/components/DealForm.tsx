import { Save, RotateCcw } from 'lucide-react'

import { SectionCard } from '@/components/common/SectionCard'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { SANDBOX_PRODUCTS, SANDBOX_PRODUCT_PRICES, TERM_CHOICES, type FieldErrors, type SandboxForm } from '@/features/sandbox/model'
import { PRODUCT_NAMES } from '@/lib/catalog'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProductCode } from '@/types'

interface DealFormProps {
  form: SandboxForm
  errors: FieldErrors
  onChange: (patch: Partial<SandboxForm>) => void
  onSave: () => void
  onReset: () => void
  saving: boolean
  /** Why saving is not possible right now, shown on the button. */
  blockedReason: string | null
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs leading-4 text-sev-critical">
          {error}
        </p>
      )}
    </div>
  )
}

/** The deal as the person edits it. Nothing is saved until "Save as new version". */
export function DealForm({ form, errors, onChange, onSave, onReset, saving, blockedReason }: DealFormProps) {
  function toggleProduct(code: ProductCode, on: boolean) {
    onChange({ products: on ? [...form.products, code] : form.products.filter((c) => c !== code) })
  }
  const money = (id: string, value: string, key: 'price' | 'down', error?: string) => (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-text-muted">$</span>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange({ [key]: e.target.value })}
        className={cn('pl-6 tabular-nums', error && 'border-sev-critical')}
      />
    </div>
  )

  return (
    <SectionCard title="Deal" description="Edit the deal, then save it as a new version">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field id="sb-price" label="Vehicle price" error={errors.price}>
            {money('sb-price', form.price, 'price', errors.price)}
          </Field>
          <Field id="sb-down" label="Down payment" error={errors.down}>
            {money('sb-down', form.down, 'down', errors.down)}
          </Field>
          <Field id="sb-apr" label="APR" error={errors.apr}>
            <div className="relative">
              <Input
                id="sb-apr"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                max={36}
                value={form.apr}
                aria-invalid={Boolean(errors.apr)}
                aria-describedby={errors.apr ? 'sb-apr-error' : undefined}
                onChange={(e) => onChange({ apr: e.target.value })}
                className={cn('pr-8 tabular-nums', errors.apr && 'border-sev-critical')}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-text-muted">%</span>
            </div>
          </Field>
          <Field id="sb-term" label="Term">
            <Select value={String(form.term)} onValueChange={(v) => onChange({ term: Number(v) })}>
              <SelectTrigger id="sb-term" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERM_CHOICES.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {t} months
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <fieldset className="space-y-1">
          <legend className="text-xs leading-4 font-medium text-text-muted">Add-on products</legend>
          {SANDBOX_PRODUCTS.map((code) => (
            <label key={code} htmlFor={`sb-product-${code}`} className="flex cursor-pointer items-center gap-2 rounded-md py-1 text-[13px] leading-[18px] text-text">
              <Checkbox id={`sb-product-${code}`} aria-label={PRODUCT_NAMES[code]} checked={form.products.includes(code)} onCheckedChange={(v) => toggleProduct(code, v === true)} />
              <span className="flex-1">{PRODUCT_NAMES[code]}</span>
              <span className="font-mono text-xs text-text-muted">{formatMoney(SANDBOX_PRODUCT_PRICES[code])}</span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="sb-reason">Reason for the change</Label>
          <Textarea id="sb-reason" value={form.reason} rows={2} maxLength={300} placeholder="Why was this changed?" onChange={(e) => onChange({ reason: e.target.value })} className="resize-none text-[13px]" />
          <p className="text-xs leading-4 text-text-muted">Leave it empty on a change to see the Missing reason check.</p>
        </div>

        <div className="space-y-2 border-t pt-3">
          <label className="flex items-center justify-between gap-3 text-[13px] leading-[18px] text-text">
            <span>
              Price agreed
              <span className="block text-xs leading-4 text-text-muted">The log has a price-agreed event</span>
            </span>
            <Switch checked={form.priceAgreed} onCheckedChange={(v) => onChange({ priceAgreed: v })} aria-label="Price agreed" />
          </label>
          <label className="flex items-center justify-between gap-3 text-[13px] leading-[18px] text-text">
            <span>
              Credit approved
              <span className="block text-xs leading-4 text-text-muted">The log has a credit-approved event</span>
            </span>
            <Switch checked={form.creditApproved} onCheckedChange={(v) => onChange({ creditApproved: v })} aria-label="Credit approved" />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onSave} disabled={saving || blockedReason !== null} title={blockedReason ?? undefined}>
            <Save />
            Save as new version
          </Button>
          <Button variant="secondary" onClick={onReset}>
            <RotateCcw />
            Reset
          </Button>
        </div>
        {blockedReason && <p className="-mt-2 text-xs leading-4 text-text-muted">{blockedReason}</p>}
      </div>
    </SectionCard>
  )
}
