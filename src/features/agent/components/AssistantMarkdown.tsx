import { Link } from 'react-router'

import { citationHref, parseBlocks, type Inline } from '@/features/agent/markdown'

function Inlines({ nodes, dealId, onNavigate }: { nodes: Inline[]; dealId: string; onNavigate: () => void }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.kind === 'bold') return <strong key={i} className="font-semibold">{n.text}</strong>
        if (n.kind === 'cite') {
          return (
            <Link
              key={i}
              to={citationHref(n.cite, dealId)}
              onClick={onNavigate}
              className="rounded-sm font-mono text-xs text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand"
            >
              {n.raw}
            </Link>
          )
        }
        return <span key={i}>{n.text}</span>
      })}
    </>
  )
}

/** Renders an answer: bold headings, paragraphs, bullet lists and citations that link to the record they name. */
export function AssistantMarkdown({ text, dealId, onNavigate }: { text: string; dealId: string; onNavigate: () => void }) {
  const blocks = parseBlocks(text)
  return (
    <div className="space-y-2 text-[13px] leading-5 text-text">
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          return (
            <h3 key={i} className="pt-1 text-[13px] leading-5 font-semibold text-text">
              {b.text}
            </h3>
          )
        }
        if (b.kind === 'list') {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-4 marker:text-text-muted">
              {b.items.map((item, k) => (
                <li key={k}>
                  <Inlines nodes={item} dealId={dealId} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            <Inlines nodes={b.inline} dealId={dealId} onNavigate={onNavigate} />
          </p>
        )
      })}
    </div>
  )
}
