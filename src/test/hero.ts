import { seed } from '@/mocks/db'
import type { Deal, DealEvent } from '@/types'

/** The hero deal DT-10482 and its events, straight from the seed. */
export function heroDeal(): { deal: Deal; events: DealEvent[] } {
  const deal = seed.deals.find((d) => d.id === 'DT-10482')
  if (!deal) throw new Error('Hero deal DT-10482 is missing from the seed')
  const events = seed.events.filter((e) => e.deal_id === deal.id)
  return { deal, events }
}

export function version(deal: Deal, n: number) {
  const v = deal.versions.find((x) => x.version === n)
  if (!v) throw new Error(`${deal.id} has no v${n}`)
  return v
}
