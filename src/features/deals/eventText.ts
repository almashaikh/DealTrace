import {
  BadgeCheck,
  CalendarClock,
  FilePlus2,
  FileSignature,
  Gavel,
  Handshake,
  PackageMinus,
  PackagePlus,
  Percent,
  Tag,
  type LucideIcon,
} from 'lucide-react'

import { CHANGE_EVENT_TYPES, PRODUCT_SHORT_NAMES } from '@/lib/catalog'
import { formatApr, formatMoney } from '@/lib/format'
import type { Deal, DealEvent, EventType, ProductCode } from '@/types'

export const EVENT_ICONS: Record<EventType, LucideIcon> = {
  QUOTE_CREATED: FilePlus2,
  PRICE_AGREED: Handshake,
  CREDIT_APPROVED: BadgeCheck,
  PRODUCT_ADDED: PackagePlus,
  PRODUCT_REMOVED: PackageMinus,
  RATE_CHANGED: Percent,
  TERM_CHANGED: CalendarClock,
  PRICE_CHANGED: Tag,
  CONTRACT_SIGNED: FileSignature,
  DECISION_RECORDED: Gavel,
}

function money(raw: string | null): string {
  const n = Number(raw)
  return raw !== null && Number.isFinite(n) ? formatMoney(n) : (raw ?? '')
}

/** Price of a product as it stands in the version an event produced (or the one before, for a removal). */
function productPrice(deal: Deal, code: ProductCode, event: DealEvent): number | undefined {
  const v = deal.versions.find((x) => x.version === event.version_after)
  const before = deal.versions.find((x) => x.version === event.version_after - 1)
  return (v?.products.find((p) => p.code === code) ?? before?.products.find((p) => p.code === code))?.price
}

/** A one-line title such as "GAP added — $900.00" or "Term changed — 60 → 72 months". */
export function eventTitle(event: DealEvent, deal: Deal): string {
  switch (event.type) {
    case 'QUOTE_CREATED':
      return `Quote created — ${money(event.new_value)}`
    case 'PRICE_AGREED':
      return `Price agreed — ${money(event.new_value)}`
    case 'CREDIT_APPROVED':
      return `Credit approved — ${formatApr(Number(event.new_value))} APR`
    case 'PRODUCT_ADDED':
    case 'PRODUCT_REMOVED': {
      const code = event.new_value as ProductCode
      const name = PRODUCT_SHORT_NAMES[code] ?? event.new_value ?? 'Product'
      const price = productPrice(deal, code, event)
      return `${name} ${event.type === 'PRODUCT_ADDED' ? 'added' : 'removed'}${price === undefined ? '' : ` — ${formatMoney(price)}`}`
    }
    case 'RATE_CHANGED':
      return `APR changed — ${formatApr(Number(event.old_value))} → ${formatApr(Number(event.new_value))}`
    case 'TERM_CHANGED':
      return `Term changed — ${event.old_value} → ${event.new_value} months`
    case 'PRICE_CHANGED':
      return `Price changed — ${money(event.old_value)} → ${money(event.new_value)}`
    case 'CONTRACT_SIGNED': {
      const v = deal.versions.find((x) => x.version === event.version_after)
      return v ? `Contract signed — ${formatMoney(v.monthly_payment)} a month for ${v.term_months} months` : 'Contract signed'
    }
    case 'DECISION_RECORDED':
      return `Decision recorded${event.new_value ? ` — ${event.new_value}` : ''}`
  }
}

/** Changes to deal terms need a reason. Quotes, approvals and signatures do not. */
export function needsReason(type: EventType): boolean {
  return CHANGE_EVENT_TYPES.includes(type)
}
