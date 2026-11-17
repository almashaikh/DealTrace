import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'

import { SectionCard } from '@/components/common/SectionCard'
import type { EvidenceItem } from '@/types'

/** Each item that came from an event links to that event on the deal timeline. */
export function EvidenceList({ dealId, items }: { dealId: string; items: EvidenceItem[] }) {
  return (
    <SectionCard title="Evidence" description={`${items.length} ${items.length === 1 ? 'item' : 'items'} from the deal record`} flush>
      <ul className="divide-y">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs leading-4 text-text-muted">{item.label}</p>
              <p className="mt-0.5 text-[13px] leading-[18px] text-text">{item.value}</p>
            </div>
            {item.event_id && (
              <Link
                to={{ pathname: `/deals/${dealId}`, search: '?tab=timeline', hash: `#event-${item.event_id}` }}
                aria-label={`View ${item.event_id} on the deal timeline`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs leading-4 text-brand outline-none hover:bg-brand-subtle focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="font-mono">{item.event_id}</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
