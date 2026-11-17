import type { ScriptedAnswer } from '@/features/agent/stream'
import { formatMoney } from '@/lib/format'
import type { AgentSummary, BenefitCheck, Deal, Finding } from '@/types'

/** Context the follow-up answers are written from. Every figure comes from these records. */
export interface AnswerContext {
  deal: Deal
  findings: Finding[]
  benefit: BenefitCheck[]
  summary: AgentSummary | null
}

export type FollowUpTopic = 'service_contract' | 'exposure' | 'next_steps' | 'other'

/** Matches a question to a topic by keywords. Order matters: the first topic that matches wins. */
export function matchTopic(question: string): FollowUpTopic {
  const q = question.toLowerCase()
  if (/service contract|warranty|vsc|coverage/.test(q)) return 'service_contract'
  if (/refund|exposure|owe|how much/.test(q)) return 'exposure'
  if (/what should i do|next step|recommend|what now|what do i do|suggest/.test(q)) return 'next_steps'
  return 'other'
}

export const SUGGESTED_QUESTIONS: readonly string[] = ['Why is the service contract flagged?', 'What is the refund exposure?', 'What should I do?']

const isOpen = (f: Finding) => f.status === 'Open' || f.status === 'In review'

function serviceContract({ deal, findings, benefit }: AnswerContext): ScriptedAnswer {
  const final = deal.versions[deal.versions.length - 1]
  const vsc = final?.products.find((p) => p.code === 'VSC')
  const tools = [{ name: 'check_benefit', label: 'Reading benefit checks' }]
  if (!vsc || !final) {
    return {
      text: `This deal has no service contract on the signed version, so there is nothing to compare with the factory warranty. [v${final?.version ?? 1}]`,
      tools,
      tools_used: ['check_benefit'],
    }
  }
  const check = benefit.find((b) => b.product_code === 'VSC')
  const overlap = findings.find((f) => f.type === 'WARRANTY_OVERLAP')
  const months = check?.inputs.warranty_overlap_months ?? 0
  const terms = `${vsc.term_months} months${vsc.max_miles ? ` / ${vsc.max_miles.toLocaleString('en-US')} miles` : ''}`
  const first =
    months > 0
      ? `The service contract (${terms}, ${formatMoney(vsc.price)}) overlaps the ${deal.vehicle.factory_warranty_months}-month factory warranty for its first ${months} months, so the buyer pays for coverage the manufacturer already provides during that time.${overlap ? ` [${overlap.id}]` : ''} ${overlap?.rule_id ? `[rule ${overlap.rule_id}]` : ''}`.trim()
      : `The service contract (${terms}, ${formatMoney(vsc.price)}) starts after the factory warranty ends, so no overlap is flagged.`
  const second = check
    ? `The benefit check rates it ${check.verdict}, with a score of ${check.score} out of 100. [v${final.version}]`
    : `No benefit check is stored for it. [v${final.version}]`
  return { text: `${first}\n\n${second}`, tools, tools_used: ['check_benefit', 'lookup_rule'] }
}

function exposure({ deal, findings }: AnswerContext): ScriptedAnswer {
  const open = findings.filter(isOpen)
  const top = [...open].filter((f) => f.refund_exposure > 0).sort((a, b) => b.refund_exposure - a.refund_exposure).slice(0, 2)
  const cites = top.map((f) => `[${f.id}]`).join(' ')
  const text =
    open.length === 0
      ? `${deal.id} has no open findings, so nothing is counted as refund or customer exposure right now.`
      : `Refund exposure on ${deal.id} is ${formatMoney(deal.refund_exposure)} and customer exposure is ${formatMoney(deal.customer_exposure)}, across ${open.length} open ${open.length === 1 ? 'finding' : 'findings'}. Each product is counted once, even when two findings point at it. ${cites}`.trim()
  return { text, tools: [{ name: 'list_findings', label: 'Checking findings' }], tools_used: ['run_detectors'] }
}

function nextSteps({ deal, summary }: AnswerContext): ScriptedAnswer {
  const steps = summary?.suggested_actions ?? []
  const text =
    steps.length === 0
      ? `${deal.id} has no open findings that need a decision. Nothing needs to be done before funding.`
      : `A reasonable order for ${deal.id}:\n\n${steps.map((s) => `- ${s}`).join('\n')}\n\nEach step is a suggestion. Record the decision yourself once you have checked the record.`
  return { text, tools: [{ name: 'list_findings', label: 'Checking findings' }], tools_used: ['run_detectors'] }
}

function other({ deal }: AnswerContext): ScriptedAnswer {
  return {
    text: `I can only answer from the versions, events and findings recorded for ${deal.id}, and none of them speak to that. The Timeline tab lists each change with its reason and who made it, and the Activity tab lists audit events and decisions. You can also ask about the service contract, the refund exposure or what to do next. [v1]`,
    tools: [{ name: 'get_timeline', label: 'Searching the deal record' }],
    tools_used: ['get_deal_versions'],
  }
}

/** A canned, calm answer matched by keywords, in the same shape the stream plays. */
export function followUpAnswer(question: string, ctx: AnswerContext): ScriptedAnswer {
  switch (matchTopic(question)) {
    case 'service_contract':
      return serviceContract(ctx)
    case 'exposure':
      return exposure(ctx)
    case 'next_steps':
      return nextSteps(ctx)
    default:
      return other(ctx)
  }
}
