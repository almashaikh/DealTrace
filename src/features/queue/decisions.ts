import { CircleCheck, CircleX, Hammer, TriangleAlert, type LucideIcon } from 'lucide-react'

import type { DecisionAction } from '@/types'

export interface DecisionConfig {
  action: DecisionAction
  /** Button and dialog title. */
  label: string
  /** How the finding is marked in the toast: "F-2291 marked Fix before funding". */
  marked: string
  /** What this decision does, under the dialog title. */
  description: string
  icon: LucideIcon
}

export const DECISION_CONFIG: readonly DecisionConfig[] = [
  {
    action: 'fix_before_funding',
    label: 'Fix before funding',
    marked: 'Fix before funding',
    description: 'Funding stays on hold until the issue is fixed. The finding moves to In review.',
    icon: Hammer,
  },
  {
    action: 'approve',
    label: 'Approve',
    marked: 'Approved',
    description: 'Confirm the deal can fund as it stands. The finding is resolved.',
    icon: CircleCheck,
  },
  {
    action: 'escalate',
    label: 'Escalate',
    marked: 'Escalated',
    description: 'Send this to a senior reviewer. The finding stays In review.',
    icon: TriangleAlert,
  },
  {
    action: 'dismiss',
    label: 'Dismiss',
    marked: 'Dismissed',
    description: 'Close the finding as not a violation. Explain why for the record.',
    icon: CircleX,
  },
]

export function decisionConfig(action: DecisionAction): DecisionConfig {
  const c = DECISION_CONFIG.find((d) => d.action === action)
  if (!c) throw new Error(`Unknown decision action ${action}`)
  return c
}
