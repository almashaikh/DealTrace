import { describe, expect, it } from 'vitest'

import { baseScenario, describeScenario, differenceTone, isUnchanged, nextBranchName, parseApr, scenarioParams, stateFromParams } from '@/features/deals/whatIfState'
import { whatIf } from '@/lib/finance'
import { heroDeal, version } from '@/test/hero'

const { deal } = heroDeal()
const signed = version(deal, 4)

describe('scenario state', () => {
  it('starts as the deal as signed', () => {
    const base = baseScenario(signed)
    expect(base).toEqual({ removed: [], term: 72, apr: '7.9' })
    expect(isUnchanged(base, signed)).toBe(true)
    expect(isUnchanged({ ...base, term: 60 }, signed)).toBe(false)
    expect(isUnchanged({ ...base, removed: ['GAP'] }, signed)).toBe(false)
  })

  it('removing both products and going to 60 months gives the original quote of $566.40', () => {
    const params = scenarioParams({ removed: ['VSC', 'GAP'], term: 60, apr: '7.9' })!
    expect(params).toEqual({ removeProducts: ['GAP', 'VSC'], termMonths: 60, apr: 7.9 })
    const r = whatIf(signed, params)
    expect(r.scenario.monthly_payment).toBe(566.4)
    expect(r.scenario.total_of_payments).toBe(33984)
  })

  it('validates the APR', () => {
    expect(parseApr('7.9')).toBe(7.9)
    expect(parseApr('0')).toBe(0)
    expect(parseApr('36')).toBe(36)
    expect(parseApr('36.1')).toBeNull()
    expect(parseApr('-1')).toBeNull()
    expect(parseApr('')).toBeNull()
    expect(parseApr('abc')).toBeNull()
    expect(scenarioParams({ removed: [], term: 72, apr: '' })).toBeNull()
  })

  it('round-trips saved params back into the controls', () => {
    const state = stateFromParams({ removeProducts: ['GAP'], termMonths: 84, apr: 6.9 }, signed)
    expect(state).toEqual({ removed: ['GAP'], term: 84, apr: '6.9' })
    expect(stateFromParams({}, signed)).toEqual(baseScenario(signed))
  })
})

describe('branches', () => {
  it('names them Branch A, Branch B and so on, reusing a letter after a delete', () => {
    expect(nextBranchName([])).toBe('Branch A')
    expect(nextBranchName([{ name: 'Branch A' }])).toBe('Branch B')
    expect(nextBranchName([{ name: 'Branch A' }, { name: 'Branch B' }])).toBe('Branch C')
    expect(nextBranchName([{ name: 'Branch B' }])).toBe('Branch A')
  })

  it('describes only what changed', () => {
    expect(describeScenario({ removeProducts: ['GAP', 'VSC'], termMonths: 60, apr: 7.9 }, signed)).toBe('Remove GAP waiver and Service contract · 60 months')
    expect(describeScenario({ apr: 6.9 }, signed)).toBe('6.9% APR')
    expect(describeScenario({ removeProducts: [], termMonths: 72, apr: 7.9 }, signed)).toBe('Same as signed')
  })
})

describe('differenceTone', () => {
  it('is cheaper below zero, costlier above, same at zero', () => {
    expect(differenceTone(-0.01)).toBe('cheaper')
    expect(differenceTone(19.14)).toBe('costlier')
    expect(differenceTone(0)).toBe('same')
  })
})
