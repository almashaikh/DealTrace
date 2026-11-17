import { PRODUCT_NAMES } from '@/lib/catalog'
import { roundCents } from '@/lib/finance'
import type { Finding, Product, ProductCode } from '@/types'

/**
 * Refund exposure of a deal, from its open findings.
 * Each product is counted once (a service contract flagged twice is one refund, not two),
 * and findings that are not about a product (rate refunds) add up on top.
 */

type ExposureFinding = Pick<Finding, 'type' | 'title' | 'evidence' | 'refund_exposure'>

const CODES = Object.keys(PRODUCT_NAMES) as ProductCode[]

function codeFromName(name: string): ProductCode | undefined {
  return CODES.find((c) => PRODUCT_NAMES[c] === name)
}

/** Products a finding is about, read from its type, title and evidence. */
export function findingProductCodes(f: Pick<Finding, 'type' | 'title' | 'evidence'>): ProductCode[] {
  switch (f.type) {
    case 'LATE_ADD_ON': {
      const codes: ProductCode[] = []
      for (const e of f.evidence) {
        if (!e.label.endsWith(' added')) continue
        const code = codeFromName(e.label.slice(0, -' added'.length))
        if (code && !codes.includes(code)) codes.push(code)
      }
      return codes
    }
    case 'WARRANTY_OVERLAP':
      return ['VSC']
    case 'LOW_BENEFIT_GAP':
    case 'DUPLICATE_COVERAGE':
      return ['GAP']
    case 'PRICE_OUTLIER': {
      const code = CODES.find((c) => f.title.startsWith(`${PRODUCT_NAMES[c]} priced`))
      return code ? [code] : []
    }
    default:
      return []
  }
}

/** Refund exposure of one deal from its open findings and the products on its signed contract. */
export function dealRefundExposure(open: readonly ExposureFinding[], finalProducts: readonly Pick<Product, 'code' | 'price'>[]): number {
  const byProduct = new Map<ProductCode, number>()
  let other = 0
  for (const f of open) {
    const codes = findingProductCodes(f)
    if (codes.length === 0) {
      other += f.refund_exposure
      continue
    }
    for (const code of codes) {
      // A price outlier refunds only the excess; any other finding refunds the whole product.
      const claim = f.type === 'PRICE_OUTLIER' ? f.refund_exposure : (finalProducts.find((p) => p.code === code)?.price ?? 0)
      byProduct.set(code, Math.max(byProduct.get(code) ?? 0, claim))
    }
  }
  return roundCents([...byProduct.values()].reduce((s, x) => s + x, 0) + other)
}
