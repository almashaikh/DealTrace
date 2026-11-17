import { PRODUCT_SHORT_NAMES } from '@/lib/catalog'
import { formatMoney } from '@/lib/format'
import type { PricingDispersion, PricingPoint, ProductCode } from '@/types'

/** Products the pricing page offers. */
export const PRICING_PRODUCTS: readonly ProductCode[] = ['GAP', 'VSC', 'TIRE_WHEEL']

/** "Above 1.5× the median" is the line the finding sentence draws. */
export const MEDIAN_MULTIPLE = 1.5

export function parsePricingProduct(raw: string | null): ProductCode {
  return PRICING_PRODUCTS.find((p) => p === raw) ?? 'GAP'
}

/** Points more than 1.5× the median price. */
export function aboveMedianMultiple(points: readonly PricingPoint[], median: number): PricingPoint[] {
  return points.filter((p) => p.price > MEDIAN_MULTIPLE * median)
}

/** One line computed from the data: the price range and how many deals sit above 1.5× the median. */
export function pricingSentence(d: Pick<PricingDispersion, 'product_code' | 'points' | 'overall'>): string {
  const name = PRODUCT_SHORT_NAMES[d.product_code]
  if (d.overall.count === 0) return `No ${name} prices are recorded for this selection.`
  const n = aboveMedianMultiple(d.points, d.overall.median).length
  const above = n === 0 ? 'No deals are' : n === 1 ? '1 deal is' : `${n} deals are`
  return `${name} prices range from ${formatMoney(d.overall.min)} to ${formatMoney(d.overall.max)}; ${above} above ${MEDIAN_MULTIPLE}× the median.`
}

/** Stable value in [-0.5, 0.5) from an id, to spread points sideways in a strip chart without hiding any. */
export function jitterFor(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5
}
