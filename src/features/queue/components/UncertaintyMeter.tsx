import { SectionCard } from '@/components/common/SectionCard'
import { uncertaintyLabel } from '@/features/queue/findingText'

/** A bar from 0 to 1 with the level in words. Higher uncertainty means the reviewer should look more closely. */
export function UncertaintyMeter({ value }: { value: number }) {
  const label = uncertaintyLabel(value)
  const percent = Math.max(0, Math.min(1, value)) * 100
  return (
    <SectionCard title="Uncertainty" description="How sure DealTrace is that this needs review">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm leading-5 font-medium text-text">{label}</p>
        <p className="font-mono text-xs text-text-muted tabular-nums">{value.toFixed(2)}</p>
      </div>
      <div
        role="meter"
        aria-label="Uncertainty"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(value.toFixed(3))}
        aria-valuetext={`${label}, ${value.toFixed(2)} on a scale of 0 to 1`}
        className="mt-2 h-2 overflow-hidden rounded-md bg-border"
      >
        <div className="h-full rounded-md bg-brand transition-[width] duration-200 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs leading-4 text-text-muted" aria-hidden="true">
        <span>0 · certain</span>
        <span>1 · unsure</span>
      </div>
    </SectionCard>
  )
}
