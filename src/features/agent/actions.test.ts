import { describe, expect, it } from 'vitest'

import { actionFor, suggestedActionTargets } from '@/features/agent/actions'
import { seed } from '@/mocks/db'

const heroFindings = seed.findings.filter((f) => f.deal_id === 'DT-10482')
const hero = seed.agent_summaries.find((s) => s.deal_id === 'DT-10482')!

describe('suggestedActionTargets for the hero deal', () => {
  it('matches each suggested step to the finding it is about', () => {
    const targets = suggestedActionTargets(hero.suggested_actions, heroFindings)
    expect(targets.map((t) => [t.finding.id, t.action])).toEqual([
      ['F-2291', 'fix_before_funding'],
      ['F-2293', 'fix_before_funding'],
      ['F-2294', 'fix_before_funding'],
    ])
  })

  it('returns nothing when no finding is open', () => {
    expect(suggestedActionTargets(hero.suggested_actions, heroFindings.map((f) => ({ ...f, status: 'Resolved' as const })))).toEqual([])
  })

  it('falls back to the most severe open finding', () => {
    const [t] = suggestedActionTargets(['Do something unrelated.'], heroFindings)
    expect(t?.finding.severity).toBe('high')
  })

  it('merges steps that land on the same decision on the same finding', () => {
    const targets = suggestedActionTargets(['Do something unrelated.', 'Do another unrelated thing.'], heroFindings)
    expect(targets).toHaveLength(1)
  })

  it('every seeded summary maps its steps to an open finding of the same deal', () => {
    for (const s of seed.agent_summaries) {
      const findings = seed.findings.filter((f) => f.deal_id === s.deal_id)
      for (const t of suggestedActionTargets(s.suggested_actions, findings)) {
        expect(t.finding.deal_id).toBe(s.deal_id)
        expect(['Open', 'In review']).toContain(t.finding.status)
      }
    }
  })
})

describe('actionFor', () => {
  it('reads the decision from the step', () => {
    expect(actionFor('Keep GAP; the benefit check supports it.')).toBe('approve')
    expect(actionFor('Escalate to the compliance lead.')).toBe('escalate')
    expect(actionFor('Confirm with Jordan Lee why both products were added.')).toBe('fix_before_funding')
  })
})
