import { roundCents } from '@/lib/finance'
import { formatDate } from '@/lib/format'
import type { BlastRadius, Dealer, ImpactChange, ImpactRooftop, Rule, ScanStats } from '@/types'

/**
 * Impact model for "what if this rule changes". It scales the stored blast radius for a rule by how much of the
 * scanned volume the change touches, then spreads the result over the rooftops. It is an estimate, and every
 * total it returns adds up exactly: deals are whole numbers, exposure is in cents, and the rooftop rows sum to the headline.
 */

/** Largest-remainder split of a whole number in proportion to weights. The parts add up to `total`. */
export function allocateWhole(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (total <= 0 || weights.length === 0 || sum <= 0) return weights.map(() => 0)
  const exact = weights.map((w) => (total * w) / sum)
  const floors = exact.map(Math.floor)
  let left = total - floors.reduce((a, b) => a + b, 0)
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    floors[i] = (floors[i] ?? 0) + 1
    left -= 1
  }
  return floors
}

/** The same split for money, in cents, so the rooftop amounts add up to the cent. */
export function allocateCents(total: number, weights: readonly number[]): number[] {
  return allocateWhole(Math.round(total * 100), weights).map((c) => c / 100)
}

function scannedBetween(stats: ScanStats, fromDate: string): number {
  return stats.daily.filter((d) => d.date >= fromDate).reduce((sum, d) => sum + Object.values(d.by_dealer).reduce((a, b) => a + b, 0), 0)
}

/**
 * How much of the rule's current impact a change keeps.
 *  - Effective date: deals scanned from the new date on, against deals scanned from the current date on.
 *  - Threshold: a 10% stricter threshold flags about 7.5% more deals, a looser one fewer.
 *  - Disable: every deal the rule flags stops being checked, so the full impact.
 */
export function impactShare(change: ImpactChange, rule: Pick<Rule, 'effective_from'>, stats: ScanStats): number {
  switch (change.type) {
    case 'effective_date': {
      const from = change.effective_date ?? rule.effective_from
      const current = scannedBetween(stats, rule.effective_from)
      return current === 0 ? 1 : scannedBetween(stats, from) / current
    }
    case 'threshold': {
      const pct = Math.max(-50, Math.min(50, change.threshold_pct ?? 0))
      return Math.max(0, 1 + (pct / 100) * 0.75)
    }
    case 'disable':
      return 1
  }
}

export function describeChange(change: ImpactChange, rule: Pick<Rule, 'effective_from'>): string {
  switch (change.type) {
    case 'effective_date':
      return `Effective date moved from ${formatDate(rule.effective_from)} to ${formatDate(change.effective_date ?? rule.effective_from)}.`
    case 'threshold': {
      const pct = change.threshold_pct ?? 0
      return pct === 0 ? 'Threshold left as it is.' : `Threshold made ${Math.abs(pct)}% ${pct > 0 ? 'stricter' : 'looser'}.`
    }
    case 'disable':
      return 'Rule disabled: it stops flagging deals until it is enabled again.'
  }
}

export interface RooftopSignal {
  dealer: Dealer
  /** Stored findings that cite the rule at this rooftop. */
  findings: number
  /** Deals scanned at this rooftop in the last 30 days. */
  scanned: number
}

/** The headline numbers for a change, with the rooftop breakdown that adds up to them. */
export function estimateImpact(
  base: Pick<BlastRadius, 'affected_deals' | 'affected_dealers' | 'estimated_refund_exposure'>,
  share: number,
  signals: readonly RooftopSignal[],
): { affected_deals: number; affected_dealers: number; estimated_refund_exposure: number; by_rooftop: ImpactRooftop[] } {
  const deals = Math.round(base.affected_deals * Math.max(0, share))
  const empty = { affected_deals: 0, affected_dealers: 0, estimated_refund_exposure: 0, by_rooftop: [] as ImpactRooftop[] }
  if (deals === 0 || base.affected_dealers === 0) return empty

  const totalScanned = signals.reduce((s, x) => s + x.scanned, 0) || 1
  const weight = (s: RooftopSignal) => s.findings + s.scanned / totalScanned
  const rooftops = [...signals].sort((a, b) => weight(b) - weight(a) || a.dealer.id.localeCompare(b.dealer.id)).slice(0, Math.min(base.affected_dealers, deals, signals.length))

  // Every affected rooftop has at least one deal; the rest are shared by weight.
  const spread = allocateWhole(deals - rooftops.length, rooftops.map(weight))
  const perRooftop = rooftops.map((_, i) => 1 + (spread[i] ?? 0))
  const exposure = roundCents(base.affected_deals === 0 ? 0 : (base.estimated_refund_exposure * deals) / base.affected_deals)
  const cents = allocateCents(exposure, perRooftop)

  return {
    affected_deals: deals,
    affected_dealers: rooftops.length,
    estimated_refund_exposure: exposure,
    by_rooftop: rooftops
      .map((s, i) => ({ dealer_id: s.dealer.id, dealer_name: s.dealer.name, deals: perRooftop[i] ?? 0, refund_exposure: cents[i] ?? 0 }))
      .sort((a, b) => b.deals - a.deals || a.dealer_name.localeCompare(b.dealer_name)),
  }
}
