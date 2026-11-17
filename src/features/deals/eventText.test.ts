import { describe, expect, it } from 'vitest'

import { eventTitle, needsReason } from '@/features/deals/eventText'
import { seed } from '@/mocks/db'
import { heroDeal } from '@/test/hero'

const { deal, events } = heroDeal()
const title = (id: string) => eventTitle(events.find((e) => e.id === id)!, deal)

describe('eventTitle on the hero deal', () => {
  it('writes a title for each event E-1040 to E-1046', () => {
    expect(events.map((e) => eventTitle(e, deal))).toEqual([
      'Quote created — $34,000.00',
      'Price agreed — $34,000.00',
      'Credit approved — 7.9% APR',
      'GAP added — $900.00',
      'Service contract added — $2,400.00',
      'Term changed — 60 → 72 months',
      'Contract signed — $547.26 a month for 72 months',
    ])
  })

  it('knows which events need a reason', () => {
    expect(title('E-1045')).toContain('Term changed')
    expect(events.filter((e) => needsReason(e.type) && !e.reason).map((e) => e.id)).toEqual(['E-1043', 'E-1044', 'E-1045'])
    expect(needsReason('CONTRACT_SIGNED')).toBe(false)
  })
})

describe('eventTitle for every seeded event', () => {
  it('never prints undefined or NaN', () => {
    for (const e of seed.events) {
      const d = seed.deals.find((x) => x.id === e.deal_id)!
      expect(eventTitle(e, d), e.id).not.toMatch(/undefined|NaN|null/)
    }
  })
})
