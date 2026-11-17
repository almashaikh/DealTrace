import { PRODUCT_NAMES } from '@/lib/catalog'
import { formatApr } from '@/lib/format'
import type { DealVersion, ProductCode, WhatIfParams } from '@/types'

/** Scenario controls for the what-if tab. The APR is text so a half-typed number is allowed. */
export interface ScenarioState {
  /** Products switched off. */
  removed: ProductCode[]
  term: number
  apr: string
}

export const TERM_OPTIONS = [48, 60, 72, 84] as const
export const APR_MIN = 0
export const APR_MAX = 36

/** The scenario that equals the deal as signed. */
export function baseScenario(version: DealVersion): ScenarioState {
  return { removed: [], term: version.term_months, apr: String(version.apr) }
}

/** The APR as a number, or null when the text is not a rate between 0% and 36%. */
export function parseApr(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) && n >= APR_MIN && n <= APR_MAX ? n : null
}

/** What to send to api.whatIf, or null while the APR is invalid. */
export function scenarioParams(state: ScenarioState): WhatIfParams | null {
  const apr = parseApr(state.apr)
  if (apr === null) return null
  return { removeProducts: [...state.removed].sort(), termMonths: state.term, apr }
}

export function isUnchanged(state: ScenarioState, version: DealVersion): boolean {
  const apr = parseApr(state.apr)
  return state.removed.length === 0 && state.term === version.term_months && apr === version.apr
}

/** The state that corresponds to saved params, for loading a branch back into the controls. */
export function stateFromParams(params: WhatIfParams, version: DealVersion): ScenarioState {
  return { removed: params.removeProducts ?? [], term: params.termMonths ?? version.term_months, apr: String(params.apr ?? version.apr) }
}

/** Branch A, Branch B, and so on: the first letter not used by this deal's branches. */
export function nextBranchName(existing: readonly { name: string }[]): string {
  const used = new Set(existing.map((b) => b.name))
  for (let i = 0; i < 26; i++) {
    const name = `Branch ${String.fromCharCode(65 + i)}`
    if (!used.has(name)) return name
  }
  return `Branch ${existing.length + 1}`
}

/** "Remove GAP waiver and service contract · 60 months · 7.9% APR", leaving out what did not change. */
export function describeScenario(params: WhatIfParams, version: DealVersion): string {
  const parts: string[] = []
  const removed = (params.removeProducts ?? []).map((c) => PRODUCT_NAMES[c])
  if (removed.length > 0) parts.push(`Remove ${removed.length > 1 ? `${removed.slice(0, -1).join(', ')} and ${removed[removed.length - 1]}` : removed[0]}`)
  if (params.termMonths !== undefined && params.termMonths !== version.term_months) parts.push(`${params.termMonths} months`)
  if (params.apr !== undefined && params.apr !== version.apr) parts.push(`${formatApr(params.apr)} APR`)
  return parts.length > 0 ? parts.join(' · ') : 'Same as signed'
}

export type DifferenceTone = 'cheaper' | 'costlier' | 'same'

/** Cheaper is good news for the buyer. */
export function differenceTone(diff: number): DifferenceTone {
  return diff < 0 ? 'cheaper' : diff > 0 ? 'costlier' : 'same'
}
