/**
 * A small markdown reader for assistant answers: headings in bold, paragraphs, bullet lists,
 * **bold** text and citations. It tolerates half-finished text, because answers stream in.
 */

export type Citation =
  | { kind: 'finding'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'rule'; id: string }
  | { kind: 'version'; version: number }

export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'cite'; cite: Citation; raw: string }

export type Block = { kind: 'heading'; text: string } | { kind: 'paragraph'; inline: Inline[] } | { kind: 'list'; items: Inline[][] }

const INLINE = /\*\*(.+?)\*\*|\[(F-\d+)\]|\[event (E-\d+)\]|\[rule ([A-Z0-9][A-Z0-9-]*)\]|\[v(\d+)\]/g

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of text.matchAll(INLINE)) {
    const index = m.index ?? 0
    if (index > last) out.push({ kind: 'text', text: text.slice(last, index) })
    if (m[1] !== undefined) out.push({ kind: 'bold', text: m[1] })
    else if (m[2]) out.push({ kind: 'cite', cite: { kind: 'finding', id: m[2] }, raw: m[0] })
    else if (m[3]) out.push({ kind: 'cite', cite: { kind: 'event', id: m[3] }, raw: m[0] })
    else if (m[4]) out.push({ kind: 'cite', cite: { kind: 'rule', id: m[4] }, raw: m[0] })
    else if (m[5]) out.push({ kind: 'cite', cite: { kind: 'version', version: Number(m[5]) }, raw: m[0] })
    last = index + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let list: Inline[][] | null = null
  for (const line of text.split('\n')) {
    const bullet = /^- (.*)$/.exec(line)
    if (bullet) {
      list ??= []
      list.push(parseInline(bullet[1] ?? ''))
      if (blocks[blocks.length - 1]?.kind !== 'list') blocks.push({ kind: 'list', items: list })
      continue
    }
    list = null
    if (line.trim() === '') continue
    const heading = /^\*\*([^*]+)\*\*$/.exec(line.trim())
    blocks.push(heading ? { kind: 'heading', text: heading[1] ?? '' } : { kind: 'paragraph', inline: parseInline(line) })
  }
  return blocks
}

/** Where a citation points. */
export function citationHref(cite: Citation, dealId: string): string {
  switch (cite.kind) {
    case 'finding':
      return `/findings/${cite.id}`
    case 'event':
      return `/deals/${dealId}?tab=timeline#event-${cite.id}`
    case 'rule':
      return `/rules/${cite.id}/blast-radius`
    case 'version':
      return `/deals/${dealId}?tab=timeline&v=${cite.version}`
  }
}
