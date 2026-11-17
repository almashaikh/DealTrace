import { afterEach, describe, expect, it } from 'vitest'

import { ApiError, api, armSimulatedError } from '@/lib/api'
import { db } from '@/mocks/db'

const seedDealDate = (id: string) => db.seed.deals.find((d) => d.id === id)!.deal_date

afterEach(() => {
  db.reset()
})

describe('dashboard', () => {
  it('shows the agreed numbers for the whole group over 30 days', async () => {
    const s = await api.dashboardSummary('all', '30d')
    expect(s.kpis).toEqual({
      deals_scanned: 1284,
      open_findings: 61,
      high_severity_open: 9,
      refund_exposure: 48920.4,
      median_decision_minutes: 192,
    })
    expect(s.scanned_series).toHaveLength(30)
    expect(s.findings_by_severity.reduce((n, x) => n + x.count, 0)).toBe(61)
    expect(s.top_deals.map((d) => d.id)).toContain('DT-10482')
    expect(s.top_deals).toHaveLength(5)
  })

  it('filters by dealer', async () => {
    const s = await api.dashboardSummary('DLR-01', '7d')
    const all = await api.dashboardSummary('all', '7d')
    expect(s.kpis.deals_scanned).toBeLessThan(all.kpis.deals_scanned)
    expect(s.exposure_by_dealer.map((d) => d.dealer_id)).toEqual(['DLR-01'])
  })
})

describe('findings and decisions', () => {
  it('lists open findings with a queue tab count of 61 and pages of 25', async () => {
    const r = await api.listFindings({ status: 'open' })
    expect(r.counts.open).toBe(61)
    expect(r.total).toBe(61)
    expect(r.page_size).toBe(25)
    expect(r.items).toHaveLength(25)
    expect(r.items[0]?.severity).toBe('high')
  })

  it('saving a decision updates the status, the counts and the audit chain', async () => {
    const result = await api.saveDecision({ finding_id: 'F-2291', action: 'approve', note: 'Customer signed add-on acknowledgment' })
    expect(result.finding.status).toBe('Resolved')
    expect(result.audit_event.entity_id).toBe('F-2291')

    const list = await api.listFindings({ status: 'open' })
    expect(list.counts.open).toBe(60)
    const detail = await api.getFinding('F-2291')
    expect(detail.decisions).toHaveLength(1)
    const verification = await api.verifyAuditChain()
    expect(verification.valid).toBe(true)
    expect(verification.total).toBe(db.seed.audit.length + 1)
  })

  it('requires a note to dismiss', async () => {
    await expect(api.saveDecision({ finding_id: 'F-2294', action: 'dismiss', note: ' ' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('reset clears decisions', async () => {
    await api.saveDecision({ finding_id: 'F-2292', action: 'fix_before_funding', note: '' })
    await api.resetDemoData()
    expect((await api.getFinding('F-2292')).finding.status).toBe('Open')
    expect((await api.listFindings({ status: 'open' })).total).toBe(61)
  })

  it('closing every finding on a deal clears its exposure from the dashboard', async () => {
    for (const id of ['F-2291', 'F-2292', 'F-2293']) await api.saveDecision({ finding_id: id, action: 'approve', note: '' })
    await api.saveDecision({ finding_id: 'F-2294', action: 'dismiss', note: 'Reasons added to the jacket' })
    const s = await api.dashboardSummary('all', '30d')
    expect(s.kpis.open_findings).toBe(57)
    expect(s.kpis.high_severity_open).toBe(7)
    expect(s.kpis.refund_exposure).toBe(45620.4)
  })
})

describe('exposure after decisions', () => {
  it('approving F-2291 leaves the service contract exposure from F-2293 on the hero deal', async () => {
    await api.saveDecision({ finding_id: 'F-2291', action: 'approve', note: 'Add-on acknowledgment on file' })
    const s = await api.dashboardSummary('all', '30d')
    expect(s.kpis.open_findings).toBe(60)
    expect(s.kpis.high_severity_open).toBe(8)
    expect(s.kpis.refund_exposure).toBe(48020.4) // only the $900.00 GAP waiver comes off
    expect((await api.getDeal('DT-10482')).deal.refund_exposure).toBe(2400)
  })

  it('fix before funding keeps the finding open, now In review', async () => {
    await api.saveDecision({ finding_id: 'F-2291', action: 'fix_before_funding', note: 'Needs reasons from the F&I manager' })
    const open = await api.listFindings({ status: 'open' })
    expect(open.counts.open).toBe(61)
    expect(open.counts.in_review).toBe(11)
    expect((await api.dashboardSummary('all', '30d')).kpis.refund_exposure).toBe(48920.4)
  })
})

describe('dashboard extras', () => {
  it('returns findings per day for the range, stacked by severity', async () => {
    const s = await api.dashboardSummary('all', '30d')
    expect(s.findings_by_day).toHaveLength(30)
    const inRange = s.findings_by_day.reduce((n, d) => n + d.critical + d.high + d.medium + d.low, 0)
    expect(inRange).toBeGreaterThan(40)
    expect(inRange).toBeLessThanOrEqual(74)
    const oct20 = s.findings_by_day.find((d) => d.date === '2026-10-20')
    expect(oct20).toMatchObject({ high: 2, medium: 1, low: 1 })
  })

  it('filters findings per day by rooftop', async () => {
    const all = await api.dashboardSummary('all', '30d')
    const san = await api.dashboardSummary('DLR-01', '30d')
    const total = (s: typeof all) => s.findings_by_day.reduce((n, d) => n + d.critical + d.high + d.medium + d.low, 0)
    expect(total(san)).toBeLessThan(total(all))
    expect(san.findings_by_day.find((d) => d.date === '2026-10-20')).toMatchObject({ high: 2 })
  })

  it('lists recent activity newest first, with the decision on top after one is saved', async () => {
    const before = await api.recentActivity('all', 6)
    expect(before).toHaveLength(6)
    expect(before.every((a) => a.text.length > 0)).toBe(true)
    await api.saveDecision({ finding_id: 'F-2291', action: 'fix_before_funding', note: 'Hold funding' })
    const after = await api.recentActivity('all', 6)
    expect(after[0]).toMatchObject({ actor_name: 'Priya Shah', kind: 'decision', text: 'marked F-2291 Fix before funding', href: '/findings/F-2291' })
  })

  it('limits recent activity to one rooftop', async () => {
    const items = await api.recentActivity('DLR-01', 20)
    const detail = await Promise.all(items.filter((a) => a.href?.startsWith('/findings/')).map((a) => api.getFinding(a.href!.split('/')[2]!)))
    expect(detail.length).toBeGreaterThan(0)
    expect(detail.every((d) => d.dealer.id === 'DLR-01')).toBe(true)
  })
})

describe('bulk assign and min refund filter', () => {
  it('assigns findings, filters by the new assignee and writes audit events', async () => {
    const before = await api.listFindings({ status: 'open', assignee_id: 'U-02' })
    const r = await api.assignFindings(['F-2291', 'F-2292'], 'U-02')
    expect(r.updated.map((f) => f.assignee_id)).toEqual(['U-02', 'U-02'])
    expect(r.audit_events).toHaveLength(2)
    const after = await api.listFindings({ status: 'open', assignee_id: 'U-02' })
    expect(after.total).toBe(before.total + 2)
    expect((await api.getFinding('F-2291')).assignee.name).toBe('Marcus Reed')
    expect((await api.verifyAuditChain()).valid).toBe(true)
  })

  it('does not write audit events for findings that already have that assignee', async () => {
    const r = await api.assignFindings(['F-2291'], 'U-01')
    expect(r.audit_events).toHaveLength(0)
  })

  it('rejects an empty selection', async () => {
    await expect(api.assignFindings([], 'U-01')).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('filters by minimum refund exposure', async () => {
    const r = await api.listFindings({ status: 'open', min_refund: 2000 })
    expect(r.total).toBe(16)
    expect(r.items.every((f) => f.refund_exposure >= 2000)).toBe(true)
  })
})

describe('deals', () => {
  it('lists the 28 flagged deals and reports 1,284 scanned', async () => {
    const r = await api.listDeals()
    expect(r.total).toBe(28)
    expect(r.total_scanned).toBe(1284)
  })

  it('returns the hero deal diff, what-if and dependency graph', async () => {
    const diff = await api.getDiff('DT-10482', 1, 3)
    expect(diff.deal_id).toBe('DT-10482')
    expect(diff.products_added).toHaveLength(2)
    const w = await api.whatIf('DT-10482', { removeProducts: ['VSC'] })
    expect(w.scenario.amount_financed).toBe(28900)
    const g = await api.getDependencyGraph('DT-10482')
    expect(g.explanation.summary).toContain('$5,418.96')
  })

  it('reports the flagged and scanned totals for the Flagged and All deals tabs', async () => {
    const r = await api.listDeals()
    expect([r.flagged_total, r.total_scanned, r.total_scanned - r.flagged_total]).toEqual([28, 1284, 1256])
    const filtered = await api.listDeals({ status: ['Funded'] })
    expect(filtered.total).toBe(3)
    expect(filtered.flagged_total).toBe(28)
    const oneRooftop = await api.listDeals({ dealer_id: 'DLR-01' })
    expect(oneRooftop.flagged_total).toBe(oneRooftop.total)
  })

  it('lists a deal\'s audit events (deal and finding events), newest first', async () => {
    const before = await api.getDealActivity('DT-10482')
    expect(before.map((a) => a.action)).toEqual(expect.arrayContaining(['Deal scanned', 'Finding created']))
    expect(before.filter((a) => a.action === 'Finding created')).toHaveLength(4)
    await api.saveDecision({ finding_id: 'F-2293', action: 'dismiss', note: 'Contract starts after the warranty ends' })
    const after = await api.getDealActivity('DT-10482')
    expect(after[0]).toMatchObject({ action: 'Decision recorded: dismiss', entity_id: 'F-2293', actor_name: 'Priya Shah' })
    expect(after).toHaveLength(before.length + 1)
  })

  it('rejects unknown deals with NOT_FOUND', async () => {
    await expect(api.getDeal('DT-00000')).rejects.toBeInstanceOf(ApiError)
    await expect(api.getDeal('DT-00000')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('rules, versions and impact check', () => {
  it('returns a rule with its version history, newest first', async () => {
    const r = await api.getRule('CA-CARS-ADDON-01')
    expect(r).toMatchObject({ version: '1.0.3', enabled: true, effective_from: '2026-10-01' })
    const v = await api.getRuleVersions('CA-CARS-ADDON-01')
    expect(v.map((x) => x.version)).toEqual(['1.0.3', '1.0.2', '1.0.1', '1.0.0'])
    expect(v[0]?.recorded_at).toBe(r.recorded_at)
    expect(v[0]?.change).toBe('Also checks add-ons added after the price is agreed, not only at signing.')
    await expect(api.getRule('NOPE-01')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('every rule has a history ending at its current version', async () => {
    for (const rule of (await api.listRules({}, 1, 50)).items) {
      expect((await api.getRuleVersions(rule.id))[0]?.version, rule.id).toBe(rule.version)
    }
  })

  it('estimates the impact of a change to CA-CARS-ADDON-01: 37 deals, 4 rooftops, $21,486.10', async () => {
    const r = await api.runImpactCheck('CA-CARS-ADDON-01', { type: 'effective_date', effective_date: '2026-10-01' })
    expect(r).toMatchObject({ affected_deals: 37, affected_dealers: 4, estimated_refund_exposure: 21486.1, scanned_deals: 1284 })
    expect(r.by_rooftop).toHaveLength(4)
    expect(r.by_rooftop.reduce((n, x) => n + x.deals, 0)).toBe(37)
    expect(Math.round(r.by_rooftop.reduce((n, x) => n + x.refund_exposure, 0) * 100)).toBe(2148610)
    expect(r.sample_deals.length).toBeGreaterThan(0)
    expect(r.sample_deals.length).toBeLessThanOrEqual(6)
    expect(r.sample_deals.map((d) => d.refund_exposure)).toEqual([...r.sample_deals.map((d) => d.refund_exposure)].sort((a, b) => b - a))
    expect(r.change_summary).toBe('Effective date moved from Oct 1, 2026 to Oct 1, 2026.')
  })

  it('disabling the rule has the full impact; a later start has less; a draft has none', async () => {
    expect((await api.runImpactCheck('CA-CARS-ADDON-01', { type: 'disable' })).affected_deals).toBe(37)
    const later = await api.runImpactCheck('CA-CARS-ADDON-01', { type: 'effective_date', effective_date: '2026-10-25' })
    expect(later.affected_deals).toBeLessThan(37)
    expect(later.sample_deals.every((d) => seedDealDate(d.deal_id) >= '2026-10-25')).toBe(true)
    const draft = await api.runImpactCheck('TX-GAP-01', { type: 'disable' })
    expect(draft).toMatchObject({ affected_deals: 0, affected_dealers: 0, estimated_refund_exposure: 0, by_rooftop: [], sample_deals: [] })
  })

  it('validates the change', async () => {
    await expect(api.runImpactCheck('CA-CARS-ADDON-01', { type: 'effective_date', effective_date: 'soon' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.runImpactCheck('CA-CARS-ADDON-01', { type: 'threshold', threshold_pct: Number.NaN })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.runImpactCheck('NOPE-01', { type: 'disable' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('toggling a rule adds a hash-chained audit event that the log can find', async () => {
    const before = (await api.verifyAuditChain()).total
    await api.toggleRule('CA-GAP-LTV-01', false)
    const log = await api.listAudit({ entity: 'rule', action: 'Rule disabled' })
    expect(log.items[0]).toMatchObject({ action: 'Rule disabled', entity_id: 'CA-GAP-LTV-01', actor_id: 'U-01' })
    const v = await api.verifyAuditChain()
    expect(v.valid).toBe(true)
    expect(v.total).toBe(before + 1)
  })
})

describe('audit filters, facets and verification', () => {
  it('filters by actor, action prefix and Pacific date range', async () => {
    const all = await api.listAudit({}, 1, 1000)
    expect(all.total).toBe(297)
    const decisions = await api.listAudit({ action: 'Decision recorded' }, 1, 1000)
    expect(decisions.total).toBe(13)
    const day = await api.listAudit({ from: '2026-10-20', to: '2026-10-20' }, 1, 1000)
    expect(day.total).toBeGreaterThan(0)
    expect(day.total).toBeLessThan(40)
    const priya = await api.listAudit({ actor_id: 'U-01', action: 'Signed in' }, 1, 1000)
    expect(priya.items.every((a) => a.actor_id === 'U-01' && a.action === 'Signed in')).toBe(true)
    expect((await api.listAudit({ from: '2027-01-01' })).total).toBe(0)
  })

  it('lists facets: the actors and the action names without details', async () => {
    const f = await api.getAuditFacets()
    expect(f.actors.map((a) => a.name)).toEqual(['DealTrace', 'Elena Torres', 'Marcus Reed', 'Priya Shah'])
    expect(f.actions).toContain('Decision recorded')
    expect(f.actions).not.toContain('Decision recorded: approve')
    expect(f.actions).toEqual(expect.arrayContaining(['Rule published', 'Rule drafted', 'Signed in', 'Finding created']))
  })

  it('verifies the real chain and reports its head hash', async () => {
    const v = await api.verifyAuditChain()
    expect(v).toMatchObject({ valid: true, total: 297, checked: 297, first_invalid_id: null })
    expect(v.head_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(v.head_hash).toBe(db.seed.audit[296]?.hash)
  })

  it('catches a tampered record without changing the stored log', async () => {
    const v = await api.verifyAuditChain({ tamper: true })
    expect(v.valid).toBe(false)
    expect(v.first_invalid_id).toBe(db.seed.audit[Math.floor(297 * 0.4)]?.id)
    expect(v.head_hash).toBeNull()
    expect(v.reason).toContain('changed after it was written')
    expect((await api.verifyAuditChain()).valid).toBe(true)
  })
})

describe('rules, synthetic jobs, search and errors', () => {
  it('toggles an active rule and refuses a draft', async () => {
    const r = await api.toggleRule('CA-GAP-LTV-01', false)
    expect(r.enabled).toBe(false)
    expect((await api.listRules({ status: 'Active' })).items.find((x) => x.id === 'CA-GAP-LTV-01')?.enabled).toBe(false)
    await expect(api.toggleRule('TX-GAP-01', true)).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('runs a synthetic job that starts at 0% progress', async () => {
    const job = await api.startSyntheticJob({ deal_count: 480, products_per_deal: 1.57, vsc_rate: 0.45, gap_rate: 0.4, issue_rate: 0.35, detectors: ['LATE_ADD_ON', 'MISSING_REASON'], seed: 7 })
    expect(job.status).toBe('running')
    expect(job.progress).toBeLessThan(10)
    expect((await api.getSyntheticJob(job.id)).id).toBe(job.id)
  })

  it('searches deals, findings and rules', async () => {
    const results = await api.searchAll('10482')
    expect(results[0]).toMatchObject({ kind: 'deal', id: 'DT-10482' })
    expect((await api.searchAll('CA-GAP')).some((r) => r.kind === 'rule')).toBe(true)
  })

  it('rejects the next request when an error is simulated, then recovers', async () => {
    armSimulatedError()
    await expect(api.me()).rejects.toMatchObject({ code: 'SIMULATED_ERROR' })
    expect((await api.me()).name).toBe('Priya Shah')
  })

  it('evaluates a sandbox deal with the real detectors', async () => {
    const deal = db.seed.deals.find((d) => d.id === 'DT-10482')!
    const events = db.seed.events.filter((e) => e.deal_id === deal.id)
    const r = await api.sandboxEvaluate({ versions: deal.versions, events })
    expect(r.findings.map((f) => f.type)).toEqual(['LATE_ADD_ON', 'PAYMENT_MASKING', 'MISSING_REASON'])
    expect(r.current.total_of_payments).toBe(39402.96)
  })
})
