import { RiskRing } from '@/components/common/RiskScore'
import { Money } from '@/components/common/Money'
import { riskBand } from '@/lib/risk'
import type { Deal } from '@/types'

const BAND_WORDS = { high: 'High risk', medium: 'Medium risk', low: 'Low risk' } as const

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs leading-4 text-text-muted">{label}</p>
      <div className="mt-1 text-2xl leading-8 font-semibold tracking-tight text-text tabular-nums">{children}</div>
    </div>
  )
}

/** Risk score ring, the two exposures and the open finding count. */
export function DealSummaryStrip({ deal }: { deal: Deal }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-card p-4 md:grid-cols-4">
      <div className="flex items-center gap-3">
        <RiskRing score={deal.risk_score} size={56} />
        <div>
          <p className="text-xs leading-4 text-text-muted">Risk score</p>
          <p className="mt-1 text-sm leading-5 font-medium text-text">{BAND_WORDS[riskBand(deal.risk_score)]}</p>
        </div>
      </div>
      <Cell label="Refund exposure">
        <Money value={deal.refund_exposure} />
      </Cell>
      <Cell label="Customer exposure">
        <Money value={deal.customer_exposure} />
      </Cell>
      <Cell label="Open findings">{deal.open_findings}</Cell>
    </div>
  )
}
