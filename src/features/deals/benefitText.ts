import { formatMoney, formatPercent } from '@/lib/format'
import type { BenefitCheck, BenefitVerdict, Product, Vehicle } from '@/types'

export const VERDICT_STYLES: Record<BenefitVerdict, string> = {
  'Likely benefit': 'bg-success/10 text-success',
  'Partial benefit': 'bg-sev-medium/10 text-sev-medium',
  'Little or no benefit': 'bg-sev-high/10 text-sev-high',
}

/**
 * The reasoning behind a verdict, in plain sentences, from the inputs the check used.
 * These describe how DealTrace weighs the inputs; they are not legal thresholds.
 */
export function explainVerdict(check: BenefitCheck, product: Product | undefined, vehicle: Vehicle): string[] {
  const { ltv, negative_equity, warranty_overlap_months, existing_coverage } = check.inputs
  const lines: string[] = []
  switch (check.product_code) {
    case 'GAP':
      lines.push(`Loan-to-value at signing is ${formatPercent(ltv)}. GAP pays the gap between what is owed and what the vehicle is worth, so a higher loan-to-value gives it a better chance of paying out.`)
      lines.push(negative_equity > 0 ? `The loan also carries ${formatMoney(negative_equity)} of negative equity from the trade-in, which widens the possible gap.` : 'No negative equity from a trade-in is rolled into the loan.')
      lines.push(existing_coverage === 'None on file' ? 'No other loan payoff coverage is on file, so this would be the only protection.' : `Existing coverage on file: ${existing_coverage}. A second policy for the same loss adds little.`)
      break
    case 'VSC': {
      const term = product?.term_months
      lines.push(
        warranty_overlap_months > 0
          ? `The ${vehicle.factory_warranty_months}-month factory warranty already covers ${warranty_overlap_months} of the ${term ?? 'contract'} contract months, so the contract only adds protection after it ends.`
          : 'The factory warranty has expired, so the contract covers repairs from the first day.',
      )
      if (product?.max_miles) lines.push(`Coverage runs to ${product.max_miles.toLocaleString('en-US')} miles; the factory warranty covers ${vehicle.factory_warranty_miles.toLocaleString('en-US')}.`)
      lines.push(existing_coverage === 'None on file' ? 'No other service coverage is on file.' : `Existing coverage on file: ${existing_coverage}.`)
      break
    }
    default:
      lines.push(...check.reasons)
  }
  lines.push(`DealTrace scores this ${check.score} out of 100, from 0 (no benefit to this buyer) to 100 (likely to pay off). The verdict is ${check.verdict.toLowerCase()}.`)
  return lines
}
