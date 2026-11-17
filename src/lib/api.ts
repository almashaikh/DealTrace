/**
 * Mock API. The only way screens read or change data.
 * Every call resolves after 150 to 400 ms (VITE_MOCK_LATENCY_MS overrides; "0" disables).
 * Add ?simulateError=1 to the URL and the next request rejects with an ApiError, so error states can be tested.
 */
import { FINDING_TYPE_LABELS, SEVERITY_RANK, SYSTEM_ACTOR_ID } from '@/lib/catalog'
import { diffVersions } from '@/lib/diff'
import { runDetectors } from '@/lib/detectors'
import { dealRefundExposure } from '@/lib/exposure'
import { roundCents, versionFigures, whatIf as computeWhatIf } from '@/lib/finance'
import { pacificDate } from '@/lib/format'
import { describeChange, estimateImpact, impactShare, type RooftopSignal } from '@/lib/impact'
import { SYNTHETIC_STEPS, runSynthetic, stepIndexAt } from '@/lib/synthetic'
import { GRAPH_EDGES, GRAPH_NODES, explainChange, topologicalOrder } from '@/lib/graph'
import { appendRecord, verifyChain } from '@/lib/hashchain'
import { idleRiskScore, riskScore } from '@/lib/risk'
import { db } from '@/mocks/db'
import type {
  ActivityItem,
  AgentSummary,
  AppNotification,
  AssignFindingsResult,
  AuditEvent,
  AuditFacets,
  AuditFilters,
  AuditItem,
  BenefitCheck,
  BlastRadius,
  Branch,
  ChainVerification,
  DashboardKpis,
  DashboardRange,
  DashboardSummary,
  Deal,
  DealDetail,
  DealEvent,
  DealFilters,
  DealList,
  DealSortField,
  Dealer,
  Decision,
  DecisionAction,
  DependencyGraph,
  DetectorType,
  Finding,
  FindingCounts,
  FindingDetail,
  FindingFilters,
  FindingList,
  FindingListItem,
  FindingSortField,
  FindingStatus,
  Metrics,
  Paginated,
  PriceStats,
  PricingDispersion,
  ImpactChange,
  ImpactResult,
  ImpactSampleDeal,
  PricingFilters,
  Provider,
  Rule,
  RuleFilters,
  RuleVersion,
  SandboxInput,
  SandboxResult,
  SaveDecisionInput,
  SaveDecisionResult,
  SearchResult,
  Severity,
  Sort,
  SyntheticJob,
  SyntheticJobParams,
  SyntheticJobResult,
  User,
  VersionDiff,
  WhatIfParams,
  WhatIfResult,
} from '@/types'

/* ------------------------------------------------------------------ */
/* Transport: latency, simulated errors, errors                        */
/* ------------------------------------------------------------------ */

export type ApiErrorCode = 'SIMULATED_ERROR' | 'NOT_FOUND' | 'VALIDATION' | 'CONFLICT'

export class ApiError extends Error {
  readonly code: ApiErrorCode

  constructor({ code, message }: { code: ApiErrorCode; message: string }) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export const DEFAULT_PAGE_SIZE = 25
const CURRENT_USER_ID = 'U-01'
const OPEN_STATUSES: readonly FindingStatus[] = ['Open', 'In review']

function latencyMs(): number {
  const raw = import.meta.env.VITE_MOCK_LATENCY_MS
  if (raw !== undefined && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return 150 + Math.random() * 250
}

let armed = false
let consumedHref: string | null = null

/** Makes the next request reject (used by tests and the ?simulateError=1 URL flag). */
export function armSimulatedError(): void {
  armed = true
}

function shouldFail(): boolean {
  if (armed) {
    armed = false
    return true
  }
  if (typeof window === 'undefined') return false
  const href = window.location.href
  if (new URLSearchParams(window.location.search).get('simulateError') === '1' && consumedHref !== href) {
    consumedHref = href
    return true
  }
  return false
}

async function request<T>(handler: () => T | Promise<T>): Promise<T> {
  const ms = latencyMs()
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms))
  if (shouldFail()) {
    throw new ApiError({ code: 'SIMULATED_ERROR', message: 'The request failed (simulated). Try again.' })
  }
  // Callers get copies, so nothing outside the store can change seed data by accident.
  return structuredClone(await handler())
}

function notFound(what: string, id: string): never {
  throw new ApiError({ code: 'NOT_FOUND', message: `${what} ${id} was not found.` })
}

function paginate<T>(items: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  const size = Math.max(1, pageSize)
  const p = Math.max(1, page)
  return { items: items.slice((p - 1) * size, p * size), total: items.length, page: p, page_size: size }
}

function nowIso(): string {
  return new Date().toISOString()
}

/* ------------------------------------------------------------------ */
/* Live views over the store                                           */
/* ------------------------------------------------------------------ */

function isOpen(f: Pick<Finding, 'status'>): boolean {
  return OPEN_STATUSES.includes(f.status)
}

function dealerById(id: string): Dealer {
  return db.seed.dealers.find((d) => d.id === id) ?? notFound('Dealer', id)
}

function userById(id: string): User {
  return db.seed.users.find((u) => u.id === id) ?? notFound('User', id)
}

/** A deal with open findings, exposures, risk and status reflecting decisions made in this browser. */
/** Ids of the findings that are open in the seed, per deal. A deal is recalculated only when this set changes. */
const SEED_OPEN_IDS = new Map<string, string>()
for (const f of db.seed.findings) {
  if (isOpen(f)) SEED_OPEN_IDS.set(f.deal_id, [SEED_OPEN_IDS.get(f.deal_id), f.id].filter(Boolean).join(','))
}

function liveDeal(deal: Deal, findings: Finding[] = db.findings()): Deal {
  const open = findings.filter((f) => f.deal_id === deal.id && isOpen(f))
  const openKey = open
    .map((f) => f.id)
    .sort()
    .join(',')
  const seedKey = (SEED_OPEN_IDS.get(deal.id) ?? '').split(',').filter(Boolean).sort().join(',')
  if (openKey === seedKey) return deal

  const finalProducts = deal.versions[deal.versions.length - 1]?.products ?? []
  const customer = open.reduce((m, f) => Math.max(m, f.customer_exposure), 0)
  let status = deal.status
  if (open.length === 0 && (status === 'In review' || status === 'On hold')) status = 'Ready to fund'
  if (open.length > 0 && status === 'Ready to fund') status = 'In review'
  return {
    ...deal,
    open_findings: open.length,
    refund_exposure: dealRefundExposure(open, finalProducts),
    customer_exposure: roundCents(customer),
    risk_score: open.length === 0 ? idleRiskScore(deal.id) : riskScore(open, customer),
    status,
  }
}

function liveDeals(): Deal[] {
  const findings = db.findings()
  return db.seed.deals.map((d) => liveDeal(d, findings))
}

function dealById(id: string): Deal {
  const deal = db.seed.deals.find((d) => d.id === id) ?? notFound('Deal', id)
  return liveDeal(deal)
}

function vehicleLabel(d: Deal): string {
  return `${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model} ${d.vehicle.trim}`
}

function nextAuditId(chain: AuditEvent[]): string {
  const last = chain[chain.length - 1]
  const n = last ? Number(last.id.replace('AU-', '')) + 1 : 30001
  return `AU-${n}`
}

async function appendAudit(action: string, entity: string, entityId: string): Promise<AuditEvent> {
  const chain = db.audit()
  const record = await appendRecord<AuditEvent>(chain, {
    id: nextAuditId(chain),
    timestamp: nowIso(),
    actor_id: CURRENT_USER_ID,
    action,
    entity,
    entity_id: entityId,
  })
  db.update((s) => {
    s.audit_appended.push(record)
  })
  return record
}

/* ------------------------------------------------------------------ */
/* Session and reference data                                          */
/* ------------------------------------------------------------------ */

export function me(): Promise<User> {
  return request(() => userById(CURRENT_USER_ID))
}

export function users(): Promise<User[]> {
  return request(() => db.seed.users)
}

export function providers(): Promise<Provider[]> {
  return request(() => db.seed.providers)
}

export function dealers(): Promise<Dealer[]> {
  return request(() => db.seed.dealers)
}

export function notifications(): Promise<AppNotification[]> {
  return request(() => [...db.notifications()].sort((a, b) => b.created_at.localeCompare(a.created_at)))
}

/** Marks the given notifications as read, or all of them when no ids are passed. */
export function markRead(ids?: string[]): Promise<AppNotification[]> {
  return request(() => {
    const target = ids ?? db.seed.notifications.map((n) => n.id)
    db.update((s) => {
      s.read_notifications = [...new Set([...s.read_notifications, ...target])]
    })
    return [...db.notifications()].sort((a, b) => b.created_at.localeCompare(a.created_at))
  })
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

const RANGE_DAYS: Record<DashboardRange, number> = { '7d': 7, '30d': 30 }

export function dashboardSummary(dealerId = 'all', range: DashboardRange = '30d'): Promise<DashboardSummary> {
  return request(() => {
    if (dealerId !== 'all') dealerById(dealerId)
    const stats = db.seed.scan_stats
    const days = RANGE_DAYS[range]
    const scannedOn = (day: (typeof stats.daily)[number]) =>
      dealerId === 'all' ? Object.values(day.by_dealer).reduce((a, b) => a + b, 0) : (day.by_dealer[dealerId] ?? 0)
    const current = stats.daily.slice(-days)
    const previousDays = stats.daily.slice(-2 * days, -days)

    const deals = liveDeals().filter((d) => dealerId === 'all' || d.dealer_id === dealerId)
    const dealIds = new Set(deals.map((d) => d.id))
    const open = db.findings().filter((f) => dealIds.has(f.deal_id) && isOpen(f))

    const kpis: DashboardKpis = {
      deals_scanned: current.reduce((s, d) => s + scannedOn(d), 0),
      open_findings: open.length,
      high_severity_open: open.filter((f) => f.severity === 'high' || f.severity === 'critical').length,
      refund_exposure: roundCents(deals.reduce((s, d) => s + d.refund_exposure, 0)),
      median_decision_minutes: stats.median_decision_minutes[range][dealerId] ?? stats.median_decision_minutes[range].all ?? 0,
    }
    const prior = stats.prior[range][dealerId] ?? stats.prior[range].all
    const previous: DashboardKpis = {
      deals_scanned: previousDays.reduce((s, d) => s + scannedOn(d), 0),
      open_findings: prior?.open_findings ?? 0,
      high_severity_open: prior?.high_severity_open ?? 0,
      refund_exposure: prior?.refund_exposure ?? 0,
      median_decision_minutes: prior?.median_decision_minutes ?? 0,
    }

    const byDay = new Map(current.map((d) => [d.date, { date: d.date, critical: 0, high: 0, medium: 0, low: 0 }]))
    for (const f of db.findings()) {
      if (!dealIds.has(f.deal_id)) continue
      const row = byDay.get(pacificDate(f.detected_at))
      if (row) row[f.severity] += 1
    }

    const severities: Severity[] = ['critical', 'high', 'medium', 'low']
    const typeCounts = new Map<Finding['type'], number>()
    for (const f of open) typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1)

    const exposureDealers = dealerId === 'all' ? db.seed.dealers : [dealerById(dealerId)]
    return {
      range,
      dealer_id: dealerId,
      kpis,
      previous,
      scanned_series: current.map((d) => ({ date: d.date, scanned: scannedOn(d) })),
      findings_by_day: [...byDay.values()],
      findings_by_severity: severities.map((s) => ({ severity: s, count: open.filter((f) => f.severity === s).length })),
      findings_by_type: [...typeCounts.entries()]
        .map(([type, count]) => ({ type, label: FINDING_TYPE_LABELS[type], count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
      exposure_by_dealer: exposureDealers
        .map((dl) => {
          const mine = deals.filter((d) => d.dealer_id === dl.id)
          return {
            dealer_id: dl.id,
            dealer_name: dl.name,
            refund_exposure: roundCents(mine.reduce((s, d) => s + d.refund_exposure, 0)),
            open_findings: mine.reduce((s, d) => s + d.open_findings, 0),
          }
        })
        .sort((a, b) => b.refund_exposure - a.refund_exposure),
      top_deals: deals
        .filter((d) => d.open_findings > 0)
        .sort((a, b) => b.risk_score - a.risk_score || b.refund_exposure - a.refund_exposure)
        .slice(0, 5),
    }
  })
}

/* ------------------------------------------------------------------ */
/* Findings and decisions                                              */
/* ------------------------------------------------------------------ */

function matchesStatus(f: Finding, status: FindingFilters['status']): boolean {
  if (!status) return true
  if (status === 'open') return isOpen(f)
  if (status === 'closed') return !isOpen(f)
  return status.length === 0 || status.includes(f.status)
}

function compareFindings(sort: Sort<FindingSortField>) {
  const dir = sort.direction === 'asc' ? 1 : -1
  return (a: FindingListItem, b: FindingListItem): number => {
    let primary: number
    switch (sort.field) {
      case 'severity':
        primary = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
        break
      case 'detected_at':
        primary = a.detected_at.localeCompare(b.detected_at)
        break
      default:
        primary = a[sort.field] - b[sort.field]
    }
    if (primary !== 0) return primary * dir
    // Stable tie-breakers: larger refund, then newest, then id.
    return b.refund_exposure - a.refund_exposure || b.detected_at.localeCompare(a.detected_at) || a.id.localeCompare(b.id)
  }
}

export function listFindings(
  filters: FindingFilters = {},
  sort: Sort<FindingSortField> = { field: 'severity', direction: 'desc' },
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<FindingList> {
  return request(() => {
    const deals = new Map(liveDeals().map((d) => [d.id, d]))
    const q = filters.q?.trim().toLowerCase()
    const base: FindingListItem[] = db
      .findings()
      .map((f) => {
        const deal = deals.get(f.deal_id) as Deal
        return {
          ...f,
          dealer_id: deal.dealer_id,
          dealer_name: dealerById(deal.dealer_id).name,
          customer_display: deal.customer_display,
          vehicle_label: vehicleLabel(deal),
          deal_status: deal.status,
        }
      })
      .filter(
        (f) =>
          (!filters.severity?.length || filters.severity.includes(f.severity)) &&
          (!filters.type?.length || filters.type.includes(f.type)) &&
          (!filters.dealer_id || f.dealer_id === filters.dealer_id) &&
          (!filters.deal_id || f.deal_id === filters.deal_id) &&
          (!filters.assignee_id || f.assignee_id === filters.assignee_id) &&
          (filters.min_refund === undefined || f.refund_exposure >= filters.min_refund) &&
          (!q ||
            [f.id, f.deal_id, f.title, f.customer_display, f.dealer_name, f.vehicle_label, FINDING_TYPE_LABELS[f.type]]
              .join(' ')
              .toLowerCase()
              .includes(q)),
      )
    // Tab counts ignore the status filter so every tab shows its own total.
    const counts: FindingCounts = {
      all: base.length,
      open: base.filter((f) => isOpen(f)).length,
      in_review: base.filter((f) => f.status === 'In review').length,
      resolved: base.filter((f) => f.status === 'Resolved').length,
      dismissed: base.filter((f) => f.status === 'Dismissed').length,
    }
    const items = base.filter((f) => matchesStatus(f, filters.status)).sort(compareFindings(sort))
    return { ...paginate(items, page, pageSize), counts }
  })
}

export function getFinding(id: string): Promise<FindingDetail> {
  return request(() => {
    const finding = db.findings().find((f) => f.id === id) ?? notFound('Finding', id)
    const deal = dealById(finding.deal_id)
    return {
      finding,
      deal,
      dealer: dealerById(deal.dealer_id),
      assignee: userById(finding.assignee_id),
      rule: finding.rule_id ? (db.rules().find((r) => r.id === finding.rule_id) ?? null) : null,
      decisions: db.state.decisions.filter((d) => d.finding_id === id).sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      agent_summary: db.seed.agent_summaries.find((s) => s.deal_id === deal.id) ?? null,
    }
  })
}

const STATUS_AFTER: Record<DecisionAction, FindingStatus> = {
  approve: 'Resolved',
  fix_before_funding: 'In review',
  escalate: 'In review',
  dismiss: 'Dismissed',
}

export const DECISION_LABELS: Record<DecisionAction, string> = {
  approve: 'Approve',
  fix_before_funding: 'Fix before funding',
  escalate: 'Escalate',
  dismiss: 'Dismiss',
}

/** Records a reviewer decision, updates the finding status and appends a hash-chained audit event. */
export function saveDecision(input: SaveDecisionInput): Promise<SaveDecisionResult> {
  return request(async () => {
    const current = db.findings().find((f) => f.id === input.finding_id) ?? notFound('Finding', input.finding_id)
    const note = input.note.trim()
    if ((input.action === 'dismiss' || input.action === 'escalate') && note.length === 0) {
      throw new ApiError({ code: 'VALIDATION', message: `Add a note to ${DECISION_LABELS[input.action].toLowerCase()} ${current.id}.` })
    }
    const decision: Decision = { finding_id: current.id, action: input.action, note, actor_id: CURRENT_USER_ID, timestamp: nowIso() }
    const status = STATUS_AFTER[input.action]
    db.update((s) => {
      s.decisions.push(decision)
      s.finding_status[current.id] = status
    })
    const audit_event = await appendAudit(`Decision recorded: ${input.action}`, 'finding', current.id)
    return { finding: { ...current, status }, decision, audit_event }
  })
}

/** Reassigns findings (bulk assign) and records one hash-chained audit event per finding that changed hands. */
export function assignFindings(ids: string[], assigneeId: string): Promise<AssignFindingsResult> {
  return request(async () => {
    if (ids.length === 0) throw new ApiError({ code: 'VALIDATION', message: 'Select at least one finding.' })
    userById(assigneeId)
    const all = db.findings()
    const targets = ids.map((id) => all.find((f) => f.id === id) ?? notFound('Finding', id))
    const changed = targets.filter((f) => f.assignee_id !== assigneeId)
    db.update((s) => {
      for (const f of changed) s.finding_assignee[f.id] = assigneeId
    })
    const audit_events: AuditEvent[] = []
    for (const f of changed) audit_events.push(await appendAudit('Finding assigned', 'finding', f.id))
    return { updated: targets.map((f) => ({ ...f, assignee_id: assigneeId })), audit_events }
  })
}

/* ------------------------------------------------------------------ */
/* Activity feed                                                       */
/* ------------------------------------------------------------------ */

const DECISION_PHRASES: Record<DecisionAction, (id: string) => string> = {
  approve: (id) => `approved ${id}`,
  fix_before_funding: (id) => `marked ${id} Fix before funding`,
  escalate: (id) => `escalated ${id}`,
  dismiss: (id) => `dismissed ${id}`,
}

/** Latest meaningful audit events (decisions, new findings, assignments, funding, rule changes), newest first. */
export function recentActivity(dealerId = 'all', limit = 8): Promise<ActivityItem[]> {
  return request(() => {
    if (dealerId !== 'all') dealerById(dealerId)
    const findings = new Map(db.findings().map((f) => [f.id, f]))
    const dealerOfDeal = new Map(db.seed.deals.map((d) => [d.id, d.dealer_id]))
    const audit = db.audit()
    const out: ActivityItem[] = []

    // The audit log is append-only, so its order is the order things happened (browser decisions come last).
    for (let i = audit.length - 1; i >= 0 && out.length < limit; i--) {
      const a = audit[i] as AuditEvent
      const finding = a.entity === 'finding' ? findings.get(a.entity_id) : undefined
      const dealId = a.entity === 'finding' ? (finding?.deal_id ?? null) : a.entity === 'deal' ? a.entity_id : null
      if (dealerId !== 'all' && (!dealId || dealerOfDeal.get(dealId) !== dealerId)) continue

      let kind: ActivityItem['kind']
      let text: string
      let href: string | null
      if (a.action === 'Finding created' && finding) {
        kind = 'finding'
        text = `opened ${a.entity_id} (${FINDING_TYPE_LABELS[finding.type]}) on ${finding.deal_id}`
        href = `/findings/${a.entity_id}`
      } else if (a.action.startsWith('Decision recorded: ')) {
        kind = 'decision'
        const action = a.action.slice('Decision recorded: '.length) as DecisionAction
        text = (DECISION_PHRASES[action] ?? ((id: string) => `recorded a decision on ${id}`))(a.entity_id)
        href = `/findings/${a.entity_id}`
      } else if (a.action === 'Finding assigned' && finding) {
        kind = 'finding'
        text = `assigned ${a.entity_id} to ${userById(finding.assignee_id).name}`
        href = `/findings/${a.entity_id}`
      } else if (a.action === 'Deal funded') {
        kind = 'deal'
        text = `funded ${a.entity_id}`
        href = `/deals/${a.entity_id}`
      } else if (a.entity === 'rule' && /^Rule (published|enabled|disabled)$/.test(a.action)) {
        kind = 'rule'
        text = `${a.action.slice('Rule '.length)} ${a.entity_id}`
        href = `/rules/${a.entity_id}/blast-radius`
      } else if (a.action === 'Report exported') {
        kind = 'report'
        text = `exported ${a.entity_id}`
        href = null
      } else {
        continue
      }
      out.push({
        id: a.id,
        timestamp: a.timestamp,
        actor_id: a.actor_id,
        actor_name: a.actor_id === SYSTEM_ACTOR_ID ? 'DealTrace' : userById(a.actor_id).name,
        kind,
        text,
        href,
      })
    }
    return out
  })
}

/* ------------------------------------------------------------------ */
/* Deals                                                               */
/* ------------------------------------------------------------------ */

export function listDeals(
  filters: DealFilters = {},
  sort: Sort<DealSortField> = { field: 'risk_score', direction: 'desc' },
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<DealList> {
  return request(() => {
    const q = filters.q?.trim().toLowerCase()
    const dir = sort.direction === 'asc' ? 1 : -1
    const items = liveDeals()
      .filter(
        (d) =>
          (!filters.dealer_id || d.dealer_id === filters.dealer_id) &&
          (!filters.status?.length || filters.status.includes(d.status)) &&
          (!q || [d.id, d.customer_display, vehicleLabel(d), d.vehicle.vin, dealerById(d.dealer_id).name].join(' ').toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const primary = sort.field === 'deal_date' ? a.deal_date.localeCompare(b.deal_date) : a[sort.field] - b[sort.field]
        return primary * dir || a.id.localeCompare(b.id)
      })
    const stats = db.seed.scan_stats.daily.slice(-30)
    const total_scanned = stats.reduce(
      (s, day) => s + (filters.dealer_id ? (day.by_dealer[filters.dealer_id] ?? 0) : Object.values(day.by_dealer).reduce((a, b) => a + b, 0)),
      0,
    )
    const flagged_total = db.seed.deals.filter((d) => !filters.dealer_id || d.dealer_id === filters.dealer_id).length
    return { ...paginate(items, page, pageSize), total_scanned, flagged_total }
  })
}

/** Audit events about a deal and about its findings, newest first. */
export function getDealActivity(dealId: string): Promise<AuditItem[]> {
  return request(() => {
    dealById(dealId)
    const findingDeal = new Map(db.seed.findings.map((f) => [f.id, f.deal_id]))
    return db
      .audit()
      .filter((a) => (a.entity === 'deal' && a.entity_id === dealId) || (a.entity === 'finding' && findingDeal.get(a.entity_id) === dealId))
      .reverse()
      .map((a) => ({ ...a, actor_name: a.actor_id === SYSTEM_ACTOR_ID ? 'DealTrace' : userById(a.actor_id).name }))
  })
}

export function getDeal(id: string): Promise<DealDetail> {
  return request(() => {
    const deal = dealById(id)
    return {
      deal,
      dealer: dealerById(deal.dealer_id),
      lender: db.seed.lenders.find((l) => l.id === deal.lender_id) ?? notFound('Lender', deal.lender_id),
      fi_manager: userById(deal.fi_manager_id),
      salesperson: userById(deal.salesperson_id),
    }
  })
}

export function getEvents(dealId: string): Promise<DealEvent[]> {
  return request(() => {
    dealById(dealId)
    return db.seed.events.filter((e) => e.deal_id === dealId).sort((a, b) => a.seq - b.seq)
  })
}

function versionOf(deal: Deal, version: number) {
  return deal.versions.find((v) => v.version === version) ?? notFound('Version', `v${version} of ${deal.id}`)
}

export function getDiff(dealId: string, fromVersion: number, toVersion: number): Promise<VersionDiff> {
  return request(() => {
    const deal = dealById(dealId)
    return { ...diffVersions(versionOf(deal, fromVersion), versionOf(deal, toVersion)), deal_id: dealId }
  })
}

/** The pre-written case summary for a deal, if it has findings. */
export function getAgentSummary(dealId: string): Promise<AgentSummary | null> {
  return request(() => {
    dealById(dealId)
    return db.seed.agent_summaries.find((s) => s.deal_id === dealId) ?? null
  })
}

export function getBenefitChecks(dealId: string): Promise<BenefitCheck[]> {
  return request(() => {
    dealById(dealId)
    return db.seed.benefit_checks.filter((b) => b.deal_id === dealId)
  })
}

/** What-if on a version of a deal (the signed version when `version` is omitted). */
export function whatIf(dealId: string, params: WhatIfParams, version?: number): Promise<WhatIfResult> {
  return request(() => {
    const deal = dealById(dealId)
    if (params.termMonths !== undefined && (!Number.isInteger(params.termMonths) || params.termMonths <= 0)) {
      throw new ApiError({ code: 'VALIDATION', message: 'Term must be a whole number of months.' })
    }
    if (params.apr !== undefined && (params.apr < 0 || params.apr > 36)) {
      throw new ApiError({ code: 'VALIDATION', message: 'APR must be between 0% and 36%.' })
    }
    return computeWhatIf(versionOf(deal, version ?? deal.current_version), params)
  })
}

export function getDependencyGraph(dealId: string, fromVersion = 1, toVersion?: number): Promise<DependencyGraph> {
  return request(() => {
    const deal = dealById(dealId)
    const to = toVersion ?? deal.current_version
    return {
      deal_id: dealId,
      from_version: fromVersion,
      to_version: to,
      nodes: [...GRAPH_NODES],
      edges: [...GRAPH_EDGES],
      order: topologicalOrder(),
      explanation: explainChange(versionOf(deal, fromVersion), versionOf(deal, to), deal.versions[0]),
    }
  })
}

/* What-if branches (saved scenarios) */

export function listBranches(dealId: string): Promise<Branch[]> {
  return request(() => db.state.branches.filter((b) => b.deal_id === dealId).sort((a, b) => b.created_at.localeCompare(a.created_at)))
}

export function createBranch(input: Pick<Branch, 'deal_id' | 'name' | 'base_version' | 'params'>): Promise<Branch> {
  return request(() => {
    const deal = dealById(input.deal_id)
    versionOf(deal, input.base_version)
    const name = input.name.trim()
    if (!name) throw new ApiError({ code: 'VALIDATION', message: 'Give the branch a name.' })
    const n = db.state.branches.reduce((m, b) => Math.max(m, Number(b.id.replace('BR-', ''))), 100) + 1
    const branch: Branch = { ...input, name, id: `BR-${n}`, created_at: nowIso(), created_by: CURRENT_USER_ID }
    db.update((s) => {
      s.branches.push(branch)
    })
    return branch
  })
}

export function deleteBranch(id: string): Promise<void> {
  return request(() => {
    if (!db.state.branches.some((b) => b.id === id)) notFound('Branch', id)
    db.update((s) => {
      s.branches = s.branches.filter((b) => b.id !== id)
    })
  })
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export function listRules(filters: RuleFilters = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Paginated<Rule>> {
  return request(() => {
    const q = filters.q?.trim().toLowerCase()
    const items = db
      .rules()
      .filter(
        (r) =>
          (!filters.status || r.status === filters.status) &&
          (!filters.jurisdiction || r.jurisdiction === filters.jurisdiction) &&
          (!q || [r.id, r.name, r.description, r.category, r.source].join(' ').toLowerCase().includes(q)),
      )
    return paginate(items, page, pageSize)
  })
}

export function toggleRule(ruleId: string, enabled: boolean): Promise<Rule> {
  return request(async () => {
    const rule = db.rules().find((r) => r.id === ruleId) ?? notFound('Rule', ruleId)
    if (rule.status === 'Draft') {
      throw new ApiError({ code: 'CONFLICT', message: `${rule.id} is a draft. Publish it before enabling it.` })
    }
    db.update((s) => {
      s.rule_enabled[ruleId] = enabled
    })
    await appendAudit(enabled ? 'Rule enabled' : 'Rule disabled', 'rule', ruleId)
    return { ...rule, enabled }
  })
}

/** One rule with its current enabled state. */
export function getRule(ruleId: string): Promise<Rule> {
  return request(() => db.rules().find((r) => r.id === ruleId) ?? notFound('Rule', ruleId))
}

/** A rule's version history, newest first. */
export function getRuleVersions(ruleId: string): Promise<RuleVersion[]> {
  return request(() => {
    if (!db.rules().some((r) => r.id === ruleId)) notFound('Rule', ruleId)
    return db.seed.rule_versions.filter((v) => v.rule_id === ruleId).sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
  })
}

/** Time the impact check "computes", so its loading state is visible. Skipped when mock latency is switched off. */
const IMPACT_COMPUTE_MS = 700

/**
 * Estimates what a change to a rule would touch: affected deals, rooftops and refund exposure,
 * the rooftop breakdown (which adds up to the headline) and the stored deals it would affect most.
 */
export function runImpactCheck(ruleId: string, change: ImpactChange): Promise<ImpactResult> {
  return request(async () => {
    const rule = db.rules().find((r) => r.id === ruleId) ?? notFound('Rule', ruleId)
    const base = db.seed.blast_radius.find((b) => b.rule_id === ruleId) ?? notFound('Blast radius for rule', ruleId)
    if (change.type === 'effective_date' && !/^\d{4}-\d{2}-\d{2}$/.test(change.effective_date ?? '')) {
      throw new ApiError({ code: 'VALIDATION', message: 'Choose a valid effective date.' })
    }
    if (change.type === 'threshold' && !Number.isFinite(change.threshold_pct ?? Number.NaN)) {
      throw new ApiError({ code: 'VALIDATION', message: 'Enter how much the threshold changes, in percent.' })
    }
    if (import.meta.env.VITE_MOCK_LATENCY_MS !== '0') await new Promise((resolve) => setTimeout(resolve, IMPACT_COMPUTE_MS))

    const stats = db.seed.scan_stats
    const last30 = stats.daily.slice(-30)
    const dealOf = new Map(db.seed.deals.map((d) => [d.id, d]))
    const citing = db.seed.findings.filter((f) => f.rule_id === ruleId)
    const signals: RooftopSignal[] = db.seed.dealers.map((dealer) => ({
      dealer,
      findings: citing.filter((f) => dealOf.get(f.deal_id)?.dealer_id === dealer.id).length,
      scanned: last30.reduce((s, day) => s + (day.by_dealer[dealer.id] ?? 0), 0),
    }))
    const estimate = estimateImpact(base, impactShare(change, rule, stats), signals)

    const dealIds = new Set(citing.map((f) => f.deal_id))
    const sample_deals: ImpactSampleDeal[] =
      estimate.affected_deals === 0
        ? []
        : liveDeals()
            .filter((d) => dealIds.has(d.id) && (change.type !== 'effective_date' || d.deal_date >= (change.effective_date ?? rule.effective_from)))
            .sort((a, b) => b.refund_exposure - a.refund_exposure || b.risk_score - a.risk_score || a.id.localeCompare(b.id))
            .slice(0, 6)
            .map((d) => ({
              deal_id: d.id,
              customer_display: d.customer_display,
              dealer_id: d.dealer_id,
              dealer_name: dealerById(d.dealer_id).name,
              vehicle_label: vehicleLabel(d),
              status: d.status,
              risk_score: d.risk_score,
              refund_exposure: d.refund_exposure,
              findings_citing_rule: citing.filter((f) => f.deal_id === d.id).length,
            }))

    return {
      rule_id: ruleId,
      change,
      change_summary: describeChange(change, rule),
      latest_change: base.change_description,
      ...estimate,
      sample_deals,
      scanned_deals: last30.reduce((s, day) => s + Object.values(day.by_dealer).reduce((a, b) => a + b, 0), 0),
    }
  })
}

export function getBlastRadius(ruleId: string): Promise<BlastRadius> {
  return request(() => db.seed.blast_radius.find((b) => b.rule_id === ruleId) ?? notFound('Blast radius for rule', ruleId))
}

/* ------------------------------------------------------------------ */
/* Pricing dispersion                                                  */
/* ------------------------------------------------------------------ */

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const a = sorted[lo] as number
  const b = sorted[hi] as number
  return roundCents(a + (b - a) * (pos - lo))
}

function priceStats(points: { price: number; is_outlier: boolean }[]): PriceStats {
  const prices = points.map((p) => p.price).sort((a, b) => a - b)
  return {
    count: prices.length,
    min: prices[0] ?? 0,
    p25: quantile(prices, 0.25),
    median: quantile(prices, 0.5),
    p75: quantile(prices, 0.75),
    max: prices[prices.length - 1] ?? 0,
    outliers: points.filter((p) => p.is_outlier).length,
  }
}

export function pricingDispersion(filters: PricingFilters): Promise<PricingDispersion> {
  return request(() => {
    const forProduct = db.seed.pricing.filter((p) => p.product_code === filters.product_code)
    const points = forProduct.filter(
      (p) => (!filters.dealer_id || p.dealer_id === filters.dealer_id) && (!filters.segment || p.segment === filters.segment),
    )
    return {
      product_code: filters.product_code,
      points,
      overall: priceStats(points),
      by_dealer: db.seed.dealers
        .map((d) => ({ dealer_id: d.id, dealer_name: d.name, ...priceStats(points.filter((p) => p.dealer_id === d.id)) }))
        .filter((s) => s.count > 0),
      segments: [...new Set(forProduct.map((p) => p.segment))].sort(),
      stored_deal_ids: points.filter((p) => db.seed.deals.some((d) => d.id === p.deal_id)).map((p) => p.deal_id),
    }
  })
}

/* ------------------------------------------------------------------ */
/* Accuracy and synthetic data                                         */
/* ------------------------------------------------------------------ */

export function getAccuracy(): Promise<Metrics> {
  return request(() => db.seed.metrics)
}

const JOB_DURATION_MS = 6000

/** Results are computed once per job, when the progress reaches 100%. Generating and scoring is deterministic. */
const jobResults = new Map<string, SyntheticJobResult>()

function jobView(job: { id: string; created_at: string; params: SyntheticJobParams }, now = Date.now()): SyntheticJob {
  const elapsed = Math.max(0, now - new Date(job.created_at).getTime())
  const progress = Math.min(100, Math.round((elapsed / JOB_DURATION_MS) * 100))
  const done = progress >= 100
  let result: SyntheticJobResult | null = null
  if (done) {
    result = jobResults.get(job.id) ?? runSynthetic(job.params)
    jobResults.set(job.id, result)
  }
  return {
    id: job.id,
    created_at: job.created_at,
    params: job.params,
    status: done ? 'completed' : 'running',
    progress,
    stage: done ? 'Completed' : (SYNTHETIC_STEPS[stepIndexAt(progress)]?.label ?? 'Writing events'),
    result,
  }
}

const ALL_DETECTORS: DetectorType[] = ['LATE_ADD_ON', 'PAYMENT_MASKING', 'RATE_AFTER_APPROVAL', 'MISSING_REASON']

export function startSyntheticJob(params: SyntheticJobParams): Promise<SyntheticJob> {
  return request(() => {
    if (!Number.isInteger(params.deal_count) || params.deal_count < 10 || params.deal_count > 10000) {
      throw new ApiError({ code: 'VALIDATION', message: 'Deal count must be between 10 and 10,000.' })
    }
    if (params.issue_rate < 0 || params.issue_rate > 1) {
      throw new ApiError({ code: 'VALIDATION', message: 'Issue rate must be between 0% and 100%.' })
    }
    if (!Number.isFinite(params.products_per_deal) || params.products_per_deal < 0 || params.products_per_deal > 6) {
      throw new ApiError({ code: 'VALIDATION', message: 'Products per deal must be between 0 and 6.' })
    }
    for (const [label, rate] of [['Service-contract rate', params.vsc_rate], ['GAP rate', params.gap_rate]] as const) {
      if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new ApiError({ code: 'VALIDATION', message: `${label} must be between 0% and 100%.` })
    }
    const detectors = params.detectors.filter((d) => ALL_DETECTORS.includes(d))
    if (detectors.length === 0) throw new ApiError({ code: 'VALIDATION', message: 'Choose at least one detector.' })
    const n = db.state.synthetic_jobs.length + 1
    const job = { id: `SJ-${String(1040 + n)}`, created_at: nowIso(), params: { ...params, detectors } }
    db.update((s) => {
      s.synthetic_jobs.push(job)
    })
    return jobView(job)
  })
}

/** Progress runs from 0 to 100 over about 6 seconds after the job was created. */
export function getSyntheticJob(id: string): Promise<SyntheticJob> {
  return request(() => {
    const job = db.state.synthetic_jobs.find((j) => j.id === id) ?? notFound('Synthetic job', id)
    return jobView(job)
  })
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

export function listAudit(filters: AuditFilters = {}, page = 1, pageSize = DEFAULT_PAGE_SIZE): Promise<Paginated<AuditEvent>> {
  return request(() => {
    const q = filters.q?.trim().toLowerCase()
    const items = db
      .audit()
      .filter(
        (a) =>
          (!filters.actor_id || a.actor_id === filters.actor_id) &&
          (!filters.entity || a.entity === filters.entity) &&
          (!filters.action || a.action.startsWith(filters.action)) &&
          (!filters.from || pacificDate(a.timestamp) >= filters.from) &&
          (!filters.to || pacificDate(a.timestamp) <= filters.to) &&
          (!q || [a.id, a.action, a.entity, a.entity_id].join(' ').toLowerCase().includes(q)),
      )
      .reverse()
    return paginate(items, page, pageSize)
  })
}

/** The actors and actions that appear in the audit log, for its filters. */
export function getAuditFacets(): Promise<AuditFacets> {
  return request(() => {
    const log = db.audit()
    const actorIds = [...new Set(log.map((a) => a.actor_id))]
    const actors = actorIds
      .map((id) => ({ id, name: id === SYSTEM_ACTOR_ID ? 'DealTrace' : (db.seed.users.find((u) => u.id === id)?.name ?? id) }))
      .sort((a, b) => a.name.localeCompare(b.name))
    const actions = [...new Set(log.map((a) => a.action.replace(/: .*/, '')))].sort()
    return { actors, actions }
  })
}

/** Recomputes every SHA-256 hash in the audit chain (seed records plus events added in this browser). */
export function verifyAuditChain(options: { tamper?: boolean } = {}): Promise<ChainVerification> {
  return request(() => {
    let chain = db.audit()
    if (options.tamper && chain.length > 0) {
      // Dev-only test: alter one record in a copy so the verifier has something to catch. The stored log is untouched.
      const at = Math.floor(chain.length * 0.4)
      chain = chain.map((r, i) => (i === at ? { ...r, action: `${r.action} (edited)` } : r))
    }
    return verifyChain(chain)
  })
}

/* ------------------------------------------------------------------ */
/* Sandbox                                                             */
/* ------------------------------------------------------------------ */

/** Runs the four detectors on a deal built in the sandbox. */
export function sandboxEvaluate(input: SandboxInput): Promise<SandboxResult> {
  return request(() => {
    if (input.versions.length === 0) throw new ApiError({ code: 'VALIDATION', message: 'Add at least one deal version.' })
    const versions = [...input.versions].sort((a, b) => a.version - b.version)
    const first = versions[0]
    const last = versions[versions.length - 1]
    if (!first || !last) throw new ApiError({ code: 'VALIDATION', message: 'Add at least one deal version.' })
    return {
      findings: runDetectors({ versions, events: input.events }),
      current: versionFigures(last),
      diff: versions.length > 1 ? diffVersions(first, last) : null,
    }
  })
}

/* ------------------------------------------------------------------ */
/* Search (command palette)                                            */
/* ------------------------------------------------------------------ */

export function searchAll(query: string): Promise<SearchResult[]> {
  return request(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return []
    const has = (...parts: string[]) => parts.join(' ').toLowerCase().includes(q)
    const deals = liveDeals()
      .filter((d) => has(d.id, d.customer_display, vehicleLabel(d), d.vehicle.vin))
      .slice(0, 6)
      .map<SearchResult>((d) => ({
        kind: 'deal',
        id: d.id,
        title: `${d.id} · ${d.customer_display}`,
        subtitle: `${vehicleLabel(d)} · ${dealerById(d.dealer_id).name}`,
        href: `/deals/${d.id}`,
      }))
    const findings = db
      .findings()
      .filter((f) => has(f.id, f.title, f.deal_id, FINDING_TYPE_LABELS[f.type]))
      .slice(0, 6)
      .map<SearchResult>((f) => ({
        kind: 'finding',
        id: f.id,
        title: `${f.id} · ${FINDING_TYPE_LABELS[f.type]}`,
        subtitle: `${f.deal_id} · ${f.status}`,
        href: `/findings/${f.id}`,
      }))
    const rules = db
      .rules()
      .filter((r) => has(r.id, r.name, r.category))
      .slice(0, 4)
      .map<SearchResult>((r) => ({ kind: 'rule', id: r.id, title: r.id, subtitle: r.name, href: `/rules/${r.id}/blast-radius` }))
    const dealerHits = db.seed.dealers
      .filter((d) => has(d.name, d.city))
      .slice(0, 3)
      .map<SearchResult>((d) => ({ kind: 'dealer', id: d.id, title: d.name, subtitle: `${d.city}, CA`, href: `/deals?dealer=${d.id}` }))
    return [...deals, ...findings, ...rules, ...dealerHits]
  })
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** Clears decisions, rule toggles, read notifications, branches, jobs and appended audit events. */
export function resetDemoData(): Promise<void> {
  return request(() => {
    db.reset()
  })
}

export const api = {
  me,
  users,
  providers,
  dealers,
  notifications,
  markRead,
  dashboardSummary,
  listFindings,
  getFinding,
  saveDecision,
  assignFindings,
  recentActivity,
  listDeals,
  getDealActivity,
  getDeal,
  getEvents,
  getDiff,
  getBenefitChecks,
  getAgentSummary,
  whatIf,
  getDependencyGraph,
  listBranches,
  createBranch,
  deleteBranch,
  listRules,
  toggleRule,
  getRule,
  getRuleVersions,
  runImpactCheck,
  getBlastRadius,
  pricingDispersion,
  getAccuracy,
  startSyntheticJob,
  getSyntheticJob,
  listAudit,
  getAuditFacets,
  verifyAuditChain,
  sandboxEvaluate,
  searchAll,
  resetDemoData,
}
