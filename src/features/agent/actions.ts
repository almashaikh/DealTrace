import { SEVERITY_RANK } from '@/lib/catalog'
import type { DecisionAction, Finding, FindingType } from '@/types'

export interface SuggestedActionTarget {
  /** The sentence the assistant suggested. */
  text: string
  action: DecisionAction
  finding: Finding
}

/** Which finding type a suggested step is about, by what it says. The first rule that matches wins. */
const TOPIC_RULES: { pattern: RegExp; type: FindingType }[] = [
  { pattern: /customer-benefit|service contract|warranty/i, type: 'WARRANTY_OVERLAP' },
  { pattern: /added after|price agreement|add-on products? (was|were)/i, type: 'LATE_ADD_ON' },
  { pattern: /carries a reason|each change|deal record|re-run|records why/i, type: 'MISSING_REASON' },
  { pattern: /total of payments|payment|term/i, type: 'PAYMENT_MASKING' },
  { pattern: /APR|rate|lender|approval terms/i, type: 'RATE_AFTER_APPROVAL' },
  { pattern: /existing coverage|duplicate/i, type: 'DUPLICATE_COVERAGE' },
  { pattern: /loan-to-value|GAP/i, type: 'LOW_BENEFIT_GAP' },
  { pattern: /rate card|priced/i, type: 'PRICE_OUTLIER' },
  { pattern: /upload|deal jacket|document/i, type: 'RECORDKEEPING_GAP' },
]

/** The decision a suggested step implies. "Keep" and "approve" mean approve; most steps mean fix before funding. */
export function actionFor(text: string): DecisionAction {
  if (/^(keep|approve)\b/i.test(text)) return 'approve'
  if (/\bescalate\b/i.test(text)) return 'escalate'
  if (/\bdismiss\b/i.test(text)) return 'dismiss'
  return 'fix_before_funding'
}

const isOpen = (f: Finding) => f.status === 'Open' || f.status === 'In review'

/**
 * Turns the assistant's suggested steps into buttons that open the decision dialog.
 * Each step is matched to the open finding it is about, or to the most severe open finding.
 * Two steps that land on the same decision on the same finding give one button.
 */
export function suggestedActionTargets(actions: readonly string[], findings: readonly Finding[]): SuggestedActionTarget[] {
  const open = findings.filter(isOpen)
  if (open.length === 0) return []
  const mostSevere = [...open].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.refund_exposure - a.refund_exposure)[0] as Finding
  const out: SuggestedActionTarget[] = []
  for (const text of actions) {
    const rule = TOPIC_RULES.find((r) => r.pattern.test(text) && open.some((f) => f.type === r.type))
    const finding = (rule ? open.find((f) => f.type === rule.type) : undefined) ?? mostSevere
    const action = actionFor(text)
    if (!out.some((t) => t.finding.id === finding.id && t.action === action)) out.push({ text, action, finding })
  }
  return out
}
