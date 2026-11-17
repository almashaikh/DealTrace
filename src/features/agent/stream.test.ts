import { describe, expect, it } from 'vitest'

import { answerFromSummary, chunkText, streamAnswer, streamSummary, summaryMarkdown, type StreamEvent } from '@/features/agent/stream'
import { seed } from '@/mocks/db'

const hero = seed.agent_summaries.find((s) => s.deal_id === 'DT-10482')!
const FAST = { toolDelayMs: 0, tokenDelayMs: 0 }

async function collect(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = []
  for await (const e of gen) out.push(e)
  return out
}

describe('the hero answer in agent_summaries.json', () => {
  it('is the answer from the Phase 5 brief, with figures from the data', () => {
    expect(hero.summary).toBe(
      "Between v1 and v3 of DT-10482, two add-ons ($3,300.00 in total) were added after the price was agreed, and the term was then stretched from 60 to 72 months. The monthly payment fell from $633.15 to $547.26, but the buyer's total of payments is $5,418.96 higher than in the original quote. [F-2291] [F-2292]",
    )
    expect(hero.key_points).toEqual([
      'GAP ($900.00) and the service contract ($2,400.00) first appear in v2 at Oct 20, 2026, 10:40 AM PT, 35 minutes after the price was agreed. [F-2291] [event E-1041] [event E-1043] [event E-1044]',
      'The term moved from 60 to 72 months in v3 while the payment dropped 13.6% from v2, which can hide the added products. [F-2292] [v3]',
      'The service contract (72 months / 75,000 miles) overlaps the 36-month factory warranty for its first 36 months. [F-2293] [rule CA-CARS-ADDON-01]',
      'GAP shows a likely benefit at 92% loan-to-value, but no reason is recorded for the product or term changes. [F-2294]',
    ])
    expect(hero.suggested_actions).toEqual([
      'Confirm with Jordan Lee why both products were added after price agreement, and document the reason.',
      'Request a customer-benefit statement for the service contract before funding.',
      'Fix the deal record so each change carries a reason, then re-run the check.',
    ])
  })

  it('never names a model or calls itself live', () => {
    const all = JSON.stringify(seed.agent_summaries).toLowerCase()
    expect(all).not.toMatch(/gpt|claude|llm|language model|fraud/)
  })

  it('cites only records that exist', () => {
    const cited = [...new Set(seed.agent_summaries.flatMap((s) => [s.summary, ...s.key_points]).join(' ').match(/\[(F-\d+)\]/g) ?? [])]
    const ids = new Set(seed.findings.map((f) => f.id))
    expect(cited.length).toBeGreaterThan(20)
    for (const c of cited) expect(ids.has(c.slice(1, -1)), c).toBe(true)
    const events = new Set(seed.events.map((e) => e.id))
    for (const m of hero.key_points.join(' ').matchAll(/\[event (E-\d+)\]/g)) expect(events.has(m[1]!)).toBe(true)
  })
})

describe('summaryMarkdown and answerFromSummary', () => {
  it('lays the summary out with a summary line, key points and next steps', () => {
    const md = summaryMarkdown(hero)
    expect(md.startsWith('**Summary** – Between v1 and v3 of DT-10482')).toBe(true)
    expect(md).toContain('\n\n**Key points**\n- GAP ($900.00)')
    expect(md).toContain('\n\n**Suggested next steps**\n- Confirm with Jordan Lee')
  })

  it('opens with three tool steps for the hero deal, naming the rule it looks up', () => {
    const a = answerFromSummary(hero)
    expect(a.tools.map((t) => t.label)).toEqual(['Reading timeline', 'Checking findings', 'Looking up CA-CARS-ADDON-01'])
    expect(a.tools_used).toEqual(['get_deal_versions', 'diff_versions', 'run_detectors', 'check_benefit', 'lookup_rule'])
  })

  it('uses two tool steps when no rule is cited', () => {
    const plain = seed.agent_summaries.find((s) => !s.key_points.join(' ').includes('[rule '))!
    expect(answerFromSummary(plain).tools).toHaveLength(2)
  })
})

describe('chunkText', () => {
  it('splits into word-aligned chunks that join back to the text', () => {
    const text = '**Summary** – Between v1 and v3 of DT-10482,\n\n- two add-ons ($3,300.00 in total) were added.'
    const chunks = chunkText(text, 8)
    expect(chunks.join('')).toBe(text)
    expect(chunks.length).toBeGreaterThan(5)
    expect(chunkText('', 8)).toEqual([])
  })
})

describe('streamAnswer', () => {
  it('yields the tool events, then the tokens, then done', async () => {
    const events = await collect(streamSummary(hero, { timings: FAST }))
    const kinds = events.map((e) => e.type)
    expect(kinds.slice(0, 3)).toEqual(['tool', 'tool', 'tool'])
    expect(kinds[kinds.length - 1]).toBe('done')
    expect(kinds.slice(3, -1).every((k) => k === 'token')).toBe(true)
    const text = events.flatMap((e) => (e.type === 'token' ? [e.text] : [])).join('')
    expect(text).toBe(summaryMarkdown(hero))
    const done = events[events.length - 1]!
    expect(done).toMatchObject({ type: 'done', tools_used: hero.tools_used })
  })

  it('keeps the timing of the brief: tool steps 400 ms apart, text about every 30 ms', async () => {
    const stamps: { type: string; at: number }[] = []
    const t0 = performance.now()
    const answer = { text: 'one two three four five six seven eight', tools: [{ name: 'a', label: 'A' }, { name: 'b', label: 'B' }], tools_used: ['a'] }
    for await (const e of streamAnswer(answer, { timings: { toolDelayMs: 40, tokenDelayMs: 3, chunkSize: 8 } })) stamps.push({ type: e.type, at: performance.now() - t0 })
    const tools = stamps.filter((s) => s.type === 'tool')
    expect(tools).toHaveLength(2)
    expect(tools[0]!.at).toBeGreaterThanOrEqual(35)
    expect(tools[1]!.at - tools[0]!.at).toBeGreaterThanOrEqual(35)
    const first = stamps.find((s) => s.type === 'token')!
    expect(first.at - tools[1]!.at).toBeGreaterThanOrEqual(35) // the last tool finishes before the text starts
  })

  it('uses 400 ms and 30 ms by default', async () => {
    const { DEFAULT_TIMINGS } = await import('@/features/agent/stream')
    expect(DEFAULT_TIMINGS.toolDelayMs).toBe(400)
    expect(DEFAULT_TIMINGS.tokenDelayMs).toBe(30)
  })

  it('reports a real response time', async () => {
    const answer = { text: 'a b c d e f g h i j', tools: [], tools_used: [] }
    const events = await collect(streamAnswer(answer, { timings: { tokenDelayMs: 5, chunkSize: 2 } }))
    const done = events[events.length - 1]
    expect(done?.type === 'done' && done.latency_ms).toBeGreaterThanOrEqual(20)
  })

  it('stops without a done event when aborted', async () => {
    const ctrl = new AbortController()
    const seen: string[] = []
    const answer = { text: 'one two three four five six seven eight nine ten', tools: [{ name: 'a', label: 'A' }], tools_used: [] }
    for await (const e of streamAnswer(answer, { signal: ctrl.signal, timings: { toolDelayMs: 0, tokenDelayMs: 2, chunkSize: 4 } })) {
      seen.push(e.type)
      if (seen.length === 3) ctrl.abort()
    }
    expect(seen).not.toContain('done')
    expect(seen.length).toBeLessThan(8)
  })
})
