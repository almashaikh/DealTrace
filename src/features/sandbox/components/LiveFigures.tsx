import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { SectionCard } from '@/components/common/SectionCard'
import type { LiveFigures as Figures } from '@/features/sandbox/model'
import { formatMoney } from '@/lib/format'

function Figure({ label, value, saved }: { label: string; value: number; saved?: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs leading-4 text-text-muted">{label}</p>
      <p className="mt-1 text-2xl leading-8 font-semibold tracking-tight text-text tabular-nums" aria-label={label}>
        <AnimatedNumber value={value} format={formatMoney} />
      </p>
      <p className="h-4 text-xs leading-4 text-text-muted tabular-nums">{saved === undefined ? '' : `Saved ${formatMoney(saved)}`}</p>
    </div>
  )
}

/** Payment, total of payments and total interest for what is typed, from finance.ts. They follow every keystroke. */
export function LiveFiguresCard({ figures, saved, savedLabel }: { figures: Figures | null; saved: Figures; savedLabel: string }) {
  return (
    <SectionCard title="Live figures" description={`Recalculated as you type. Compared with ${savedLabel}`}>
      {figures ? (
        <div className="grid grid-cols-3 gap-4" aria-live="polite">
          <Figure label="Monthly payment" value={figures.monthly_payment} saved={saved.monthly_payment} />
          <Figure label="Total of payments" value={figures.total_of_payments} saved={saved.total_of_payments} />
          <Figure label="Total interest" value={figures.total_interest} saved={saved.total_interest} />
        </div>
      ) : (
        <p className="text-[13px] leading-[18px] text-text-muted">Fix the highlighted fields to see the figures.</p>
      )}
    </SectionCard>
  )
}
