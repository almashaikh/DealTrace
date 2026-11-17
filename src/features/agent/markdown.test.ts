import { describe, expect, it } from 'vitest'

import { citationHref, parseBlocks, parseInline } from '@/features/agent/markdown'
import { summaryMarkdown } from '@/features/agent/stream'
import { seed } from '@/mocks/db'

describe('parseInline', () => {
  it('finds the four kinds of citation and bold text', () => {
    const nodes = parseInline('**Summary** – see [F-2291], [event E-1043], [rule CA-CARS-ADDON-01] and [v2].')
    expect(nodes.filter((n) => n.kind === 'cite').map((n) => (n.kind === 'cite' ? n.cite : null))).toEqual([
      { kind: 'finding', id: 'F-2291' },
      { kind: 'event', id: 'E-1043' },
      { kind: 'rule', id: 'CA-CARS-ADDON-01' },
      { kind: 'version', version: 2 },
    ])
    expect(nodes[0]).toEqual({ kind: 'bold', text: 'Summary' })
  })

  it('leaves unfinished text alone while streaming', () => {
    expect(parseInline('see [F-22')).toEqual([{ kind: 'text', text: 'see [F-22' }])
    expect(parseInline('**Summ')).toEqual([{ kind: 'text', text: '**Summ' }])
  })

  it('does not treat other brackets as citations', () => {
    expect(parseInline('[note] and [v] and [F-]')).toEqual([{ kind: 'text', text: '[note] and [v] and [F-]' }])
  })
})

describe('parseBlocks', () => {
  it('reads headings, paragraphs and bullet lists', () => {
    const blocks = parseBlocks('**Summary** – Text [F-1].\n\n**Key points**\n- one [v2]\n- two\n\n**Suggested next steps**\n- do it')
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'heading', 'list', 'heading', 'list'])
    const list = blocks[2]
    expect(list?.kind === 'list' && list.items).toHaveLength(2)
  })

  it('parses the whole hero answer into three sections with 4 and 3 bullets', () => {
    const hero = seed.agent_summaries.find((s) => s.deal_id === 'DT-10482')!
    const blocks = parseBlocks(summaryMarkdown(hero))
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'heading', 'list', 'heading', 'list'])
    expect(blocks.filter((b) => b.kind === 'list').map((b) => (b.kind === 'list' ? b.items.length : 0))).toEqual([4, 3])
  })
})

describe('citationHref', () => {
  it('points each citation at its record', () => {
    expect(citationHref({ kind: 'finding', id: 'F-2291' }, 'DT-10482')).toBe('/findings/F-2291')
    expect(citationHref({ kind: 'event', id: 'E-1043' }, 'DT-10482')).toBe('/deals/DT-10482?tab=timeline#event-E-1043')
    expect(citationHref({ kind: 'rule', id: 'CA-CARS-ADDON-01' }, 'DT-10482')).toBe('/rules/CA-CARS-ADDON-01/blast-radius')
    expect(citationHref({ kind: 'version', version: 2 }, 'DT-10482')).toBe('/deals/DT-10482?tab=timeline&v=2')
  })
})
