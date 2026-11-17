import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

/** The benchmark the generator's default mix is taken from. */
export const BENCHMARK_NOTE = 'Benchmark: StoneEagle Q1 2026'

interface ParamSliderProps {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  /** How the value is shown next to the label. */
  format: (n: number) => string
  onChange: (n: number) => void
  disabled?: boolean
}

/** A labelled slider with its value and the benchmark note. */
export function ParamSlider({ id, label, value, min, max, step, format, onChange, disabled }: ParamSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <output htmlFor={id} className="text-[13px] leading-[18px] font-medium text-text tabular-nums">
          {format(value)}
        </output>
      </div>
      <Slider id={id} aria-label={label} value={[value]} min={min} max={max} step={step} disabled={disabled} onValueChange={([v]) => onChange(v ?? value)} />
      <p className="text-xs leading-4 text-text-muted">{BENCHMARK_NOTE}</p>
    </div>
  )
}
