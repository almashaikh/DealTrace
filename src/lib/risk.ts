import type { Severity } from '@/types'

/**
 * Deal risk score (0 to 96) from its open findings and customer exposure.
 * 34 base + 18 per high + 9 per medium + 3 per low + 1 per $1,000 of customer exposure.
 * The hero deal DT-10482 (2 high, 1 medium, 1 low, $5,418.96) scores 87.
 */
export function riskScore(open: readonly { severity: Severity }[], customerExposure: number): number {
  if (open.length === 0) return 0
  const n = (s: Severity) => open.filter((f) => f.severity === s).length
  const score = 34 + 22 * n('critical') + 18 * n('high') + 9 * n('medium') + 3 * n('low') + Math.round(customerExposure / 1000)
  return Math.min(96, score)
}

export type RiskBand = 'high' | 'medium' | 'low'

/** Display band for a risk score: 70 and above is high, 45 and above is medium. Used for colour only. */
export function riskBand(score: number): RiskBand {
  if (score >= 70) return 'high'
  if (score >= 45) return 'medium'
  return 'low'
}

/** Residual score for a deal with no open findings (small, stable per deal). */
export function idleRiskScore(dealId: string): number {
  return 7 + (Number(dealId.slice(-2)) % 9)
}
