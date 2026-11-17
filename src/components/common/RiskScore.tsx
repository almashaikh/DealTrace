import { riskBand, type RiskBand } from '@/lib/risk'
import { cn } from '@/lib/utils'

/** Severity colours for the three display bands. Written out so Tailwind can see every class. */
const BAND_TEXT: Record<RiskBand, string> = { high: 'text-sev-high', medium: 'text-sev-medium', low: 'text-sev-low' }
const BAND_STROKE: Record<RiskBand, string> = { high: 'stroke-sev-high', medium: 'stroke-sev-medium', low: 'stroke-sev-low' }
const BAND_TINT: Record<RiskBand, string> = { high: 'bg-sev-high/10 text-sev-high', medium: 'bg-sev-medium/10 text-sev-medium', low: 'bg-sev-low/10 text-sev-low' }

/** A ring that fills to the score out of 100, with the number in the middle. */
export function RiskRing({ score, size = 56, className }: { score: number; size?: number; className?: string }) {
  const band = riskBand(score)
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c
  return (
    <span
      role="img"
      aria-label={`Risk score ${score} out of 100`}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          className={cn(BAND_STROKE[band], 'transition-[stroke-dasharray] duration-200 ease-out')}
        />
      </svg>
      <span className={cn('absolute text-base leading-none font-semibold tabular-nums', BAND_TEXT[band])}>{score}</span>
    </span>
  )
}

/** The score as a small tinted number for table cells. */
export function RiskScorePill({ score }: { score: number }) {
  return (
    <span
      aria-label={`Risk score ${score} out of 100`}
      className={cn('inline-flex h-5 min-w-8 items-center justify-center rounded-md px-1.5 text-xs leading-4 font-semibold tabular-nums', BAND_TINT[riskBand(score)])}
    >
      {score}
    </span>
  )
}
