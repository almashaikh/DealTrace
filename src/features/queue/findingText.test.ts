import { describe, expect, it } from 'vitest'

import { describeFinding, uncertaintyLabel, uncertaintyLevel } from '@/features/queue/findingText'
import { seed } from '@/mocks/db'
import { heroDeal } from '@/test/hero'

const { deal } = heroDeal()
const finding = (id: string) => seed.findings.find((f) => f.id === id)!

describe('describeFinding on the hero deal', () => {
  it('F-2291 late add-on', () => {
    expect(describeFinding(finding('F-2291'), deal)).toEqual([
      'In version 1 (Oct 20, 2026, 10:05 AM) the price was agreed at $34,000.00 with no add-on products.',
      'In version 2, 35 minutes later, a GAP waiver ($900.00) and a service contract ($2,400.00) were added. The total of payments rose from $33,984.00 to $37,989.25.',
      'No reason was recorded for the change.',
    ])
  })

  it('F-2292 payment masking', () => {
    expect(describeFinding(finding('F-2292'), deal)).toEqual([
      'Between version 1 and version 3, a GAP waiver ($900.00) and a service contract ($2,400.00) were added and the term went from 60 to 72 months.',
      'The monthly payment moved from $566.40 to $547.26 (−3.4%), so the customer saw a lower payment.',
      'The total of payments rose by $5,418.96.',
    ])
  })

  it('F-2293 warranty overlap', () => {
    expect(describeFinding(finding('F-2293'), deal)).toEqual([
      "The vehicle's factory warranty covers 36 months / 36,000 miles.",
      'The service contract runs 72 months / 75,000 miles.',
      'For the first 36 months the buyer is paying for coverage the factory warranty already provides.',
    ])
  })

  it('F-2294 missing reason', () => {
    const [first, second] = describeFinding(finding('F-2294'), deal)
    expect(first).toBe('3 changes on this deal have no recorded reason.')
    expect(second).toBe('Product added: GAP waiver; Product added: Service contract; Term changed: 60 → 72.')
  })
})

describe('describeFinding for every seeded finding', () => {
  it('gives two or three sentences and never the word fraud', () => {
    for (const f of seed.findings) {
      const d = seed.deals.find((x) => x.id === f.deal_id)!
      const text = describeFinding(f, d)
      expect(text.length, f.id).toBeGreaterThanOrEqual(2)
      expect(text.length, f.id).toBeLessThanOrEqual(3)
      expect(text.join(' ').toLowerCase()).not.toContain('fraud')
      expect(text.join(' '), f.id).not.toMatch(/undefined|NaN/)
    }
  })

  it('never falls back to the generic text for a finding the detectors produced', () => {
    for (const f of seed.findings) {
      const d = seed.deals.find((x) => x.id === f.deal_id)!
      expect(describeFinding(f, d)[0], f.id).not.toBe(`${f.title}.`)
    }
  })
})

describe('uncertainty', () => {
  it('maps the value to words', () => {
    expect(uncertaintyLevel(0.063)).toBe('Low')
    expect(uncertaintyLevel(0.187)).toBe('Medium')
    expect(uncertaintyLevel(0.317)).toBe('High')
    expect(uncertaintyLabel(0.187)).toBe('Medium uncertainty')
  })
})
