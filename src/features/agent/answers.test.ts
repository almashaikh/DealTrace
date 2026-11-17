import { describe, expect, it } from 'vitest'

import { followUpAnswer, matchTopic, type AnswerContext } from '@/features/agent/answers'
import { seed } from '@/mocks/db'

function ctxFor(dealId: string): AnswerContext {
  const deal = seed.deals.find((d) => d.id === dealId)!
  return {
    deal,
    findings: seed.findings.filter((f) => f.deal_id === dealId),
    benefit: seed.benefit_checks.filter((b) => b.deal_id === dealId),
    summary: seed.agent_summaries.find((s) => s.deal_id === dealId) ?? null,
  }
}
const hero = ctxFor('DT-10482')

describe('matchTopic', () => {
  it('matches by keyword', () => {
    expect(matchTopic('Why is the service contract flagged?')).toBe('service_contract')
    expect(matchTopic('does the warranty overlap')).toBe('service_contract')
    expect(matchTopic('What is the refund exposure?')).toBe('exposure')
    expect(matchTopic('how much does the buyer owe')).toBe('exposure')
    expect(matchTopic('What should I do?')).toBe('next_steps')
    expect(matchTopic('any next steps')).toBe('next_steps')
    expect(matchTopic('Who is the salesperson’s manager?')).toBe('other')
  })
})

describe('followUpAnswer on the hero deal', () => {
  it('answers the service contract question from the data', () => {
    const a = followUpAnswer('why is the service contract flagged', hero)
    expect(a.text).toContain('(72 months / 75,000 miles, $2,400.00) overlaps the 36-month factory warranty for its first 36 months')
    expect(a.text).toContain('[F-2293] [rule CA-CARS-ADDON-01]')
    expect(a.text).toContain('Partial benefit, with a score of 49 out of 100. [v4]')
  })

  it('answers the exposure question with both figures and the findings behind them', () => {
    const a = followUpAnswer('what is the refund exposure', hero)
    expect(a.text).toBe(
      'Refund exposure on DT-10482 is $3,300.00 and customer exposure is $5,418.96, across 4 open findings. Each product is counted once, even when two findings point at it. [F-2291] [F-2293]',
    )
  })

  it('lists the suggested steps for "what should I do"', () => {
    const a = followUpAnswer('what should I do?', hero)
    expect(a.text).toContain('- Confirm with Jordan Lee why both products were added')
    expect(a.text).toContain('Record the decision yourself')
  })

  it('gives a calm answer that says where the record would show it', () => {
    const a = followUpAnswer('what colour is the car', hero)
    expect(a.text).toContain('none of them speak to that')
    expect(a.text).toContain('Timeline tab')
    expect(a.text).toContain('Activity tab')
    expect(a.text).not.toContain('!')
  })

  it('handles a deal without a service contract', () => {
    const noVsc = seed.deals.find((d) => !d.versions[d.versions.length - 1]!.products.some((p) => p.code === 'VSC'))!
    expect(followUpAnswer('service contract', ctxFor(noVsc.id)).text).toContain('no service contract on the signed version')
  })

  it('every answer has tool steps and never mentions a model', () => {
    for (const q of ['service contract', 'refund', 'what should I do', 'anything']) {
      const a = followUpAnswer(q, hero)
      expect(a.tools.length).toBeGreaterThanOrEqual(1)
      expect(a.text.toLowerCase()).not.toMatch(/\bgpt|claude|language model|\bllm\b/)
    }
  })
})
