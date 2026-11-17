import type {
  AgentSummary,
  AuditEvent,
  Deal,
  DealEvent,
  DealStatus,
  DealVersion,
  DashboardRange,
  DashboardSnapshot,
  Dealer,
  Decision,
  DecisionAction,
  EvidenceItem,
  Finding,
  FindingStatus,
  FindingType,
  Lender,
  PricingPoint,
  ProductCode,
  Rule,
  Severity,
  User,
} from './domain'

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type SortDirection = 'asc' | 'desc'

export interface Sort<F extends string> {
  field: F
  direction: SortDirection
}

/* ---------------- Finance and what-if ---------------- */

export interface LoanFigures {
  amount_financed: number
  apr: number
  term_months: number
  monthly_payment: number
  total_of_payments: number
  total_interest: number
}

export interface WhatIfParams {
  removeProducts?: ProductCode[]
  termMonths?: number
  apr?: number
}

export interface WhatIfResult {
  base: LoanFigures
  scenario: LoanFigures
  removed_products: { code: ProductCode; name: string; price: number }[]
  difference: {
    amount_financed: number
    monthly_payment: number
    total_of_payments: number
    total_interest: number
  }
}

export interface Branch {
  id: string
  deal_id: string
  name: string
  base_version: number
  params: WhatIfParams
  created_at: string
  created_by: string
}

/* ---------------- Detectors ---------------- */

export type DetectorType = 'LATE_ADD_ON' | 'PAYMENT_MASKING' | 'RATE_AFTER_APPROVAL' | 'MISSING_REASON'

/** A finding produced by a detector, before it is stored with an id, status and assignee. */
export interface DetectedFinding {
  type: FindingType
  title: string
  severity: Severity
  version_from: number
  version_to: number
  rule_id?: string
  evidence: EvidenceItem[]
  uncertainty: number
  refund_exposure: number
  customer_exposure: number
  /** Products this finding is about; used to avoid counting a refund twice. */
  product_codes: ProductCode[]
}

/* ---------------- Hash chain ---------------- */

export interface ChainVerification {
  valid: boolean
  total: number
  checked: number
  first_invalid_index: number | null
  first_invalid_id: string | null
  reason: string | null
  /** Hash of the last record in the chain; null when the chain is broken or empty. */
  head_hash: string | null
}

/* ---------------- Findings and queue ---------------- */

export interface FindingFilters {
  /** 'open' means Open or In review. */
  status?: FindingStatus[] | 'open' | 'closed'
  severity?: Severity[]
  type?: FindingType[]
  dealer_id?: string
  deal_id?: string
  assignee_id?: string
  /** Only findings with at least this refund exposure. */
  min_refund?: number
  q?: string
}

export type FindingSortField = 'severity' | 'detected_at' | 'refund_exposure' | 'customer_exposure' | 'uncertainty'

export interface FindingListItem extends Finding {
  dealer_id: string
  dealer_name: string
  customer_display: string
  vehicle_label: string
  deal_status: DealStatus
}

export interface FindingCounts {
  all: number
  open: number
  in_review: number
  resolved: number
  dismissed: number
}

export interface FindingList extends Paginated<FindingListItem> {
  counts: FindingCounts
}

export interface FindingDetail {
  finding: Finding
  deal: Deal
  dealer: Dealer
  assignee: User
  rule: Rule | null
  decisions: Decision[]
  agent_summary: AgentSummary | null
}

export interface SaveDecisionInput {
  finding_id: string
  action: DecisionAction
  note: string
}

export interface SaveDecisionResult {
  finding: Finding
  decision: Decision
  audit_event: AuditEvent
}

/* ---------------- Deals ---------------- */

export interface DealFilters {
  dealer_id?: string
  status?: DealStatus[]
  q?: string
}

export type DealSortField = 'risk_score' | 'deal_date' | 'refund_exposure' | 'customer_exposure' | 'open_findings'

export interface DealList extends Paginated<Deal> {
  /** All deals scanned in the last 30 days, including the ones cleared automatically and not stored. */
  total_scanned: number
  /** Stored (flagged) deals for the same rooftop, ignoring the status and search filters. */
  flagged_total: number
}

/** An audit event with the actor's name, for lists. */
export type AuditItem = AuditEvent & { actor_name: string }

export interface DealDetail {
  deal: Deal
  dealer: Dealer
  lender: Lender
  fi_manager: User
  salesperson: User
}

/* ---------------- Version diff and dependency graph ---------------- */

export type DiffFieldKey =
  | 'vehicle_price'
  | 'down_payment'
  | 'trade_in_value'
  | 'trade_in_payoff'
  | 'amount_financed'
  | 'apr'
  | 'term_months'
  | 'monthly_payment'
  | 'total_of_payments'

export interface FieldChange {
  field: DiffFieldKey
  label: string
  kind: 'money' | 'percent' | 'months'
  before: number
  after: number
  delta: number
}

export interface ProductChange {
  code: ProductCode
  name: string
  before: { price: number; term_months: number; max_miles?: number }
  after: { price: number; term_months: number; max_miles?: number }
  price_delta: number
}

export interface VersionDiff {
  deal_id?: string
  from_version: number
  to_version: number
  from_created_at: string
  to_created_at: string
  changes: FieldChange[]
  products_added: { code: ProductCode; name: string; price: number; term_months: number; max_miles?: number }[]
  products_removed: { code: ProductCode; name: string; price: number; term_months: number; max_miles?: number }[]
  products_changed: ProductChange[]
  has_changes: boolean
}

export type GraphNodeId =
  | 'vehicle_price'
  | 'down_payment'
  | 'products'
  | 'amount_financed'
  | 'apr'
  | 'term_months'
  | 'monthly_payment'
  | 'total_of_payments'

export interface GraphNode {
  id: GraphNodeId
  label: string
  kind: 'input' | 'derived'
  unit: 'money' | 'percent' | 'months'
}

export interface GraphEdge {
  from: GraphNodeId
  to: GraphNodeId
}

export type GraphValues = Record<GraphNodeId, number>

export interface GraphExplanation {
  changed_inputs: GraphNodeId[]
  affected: GraphNodeId[]
  before: GraphValues
  after: GraphValues
  sentences: string[]
  summary: string
  /** One sentence on why the monthly payment moved, for example "Payment fell $85.89 because the term rose from 60 to 72 months, even though $3,300.00 of products was added." */
  headline: string
}

export interface DependencyGraph {
  deal_id: string
  from_version: number
  to_version: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  order: GraphNodeId[]
  explanation: GraphExplanation
}

/* ---------------- Dashboard ---------------- */

export interface DashboardKpis extends DashboardSnapshot {
  deals_scanned: number
}

export interface DashboardSummary {
  range: DashboardRange
  dealer_id: string
  kpis: DashboardKpis
  previous: DashboardKpis
  scanned_series: { date: string; scanned: number }[]
  /** Findings detected per Pacific calendar day (all statuses), one entry per day of the range. */
  findings_by_day: { date: string; critical: number; high: number; medium: number; low: number }[]
  findings_by_severity: { severity: Severity; count: number }[]
  findings_by_type: { type: FindingType; label: string; count: number }[]
  exposure_by_dealer: { dealer_id: string; dealer_name: string; refund_exposure: number; open_findings: number }[]
  top_deals: Deal[]
}

/* ---------------- Activity feed ---------------- */

export interface ActivityItem {
  id: string
  timestamp: string
  actor_id: string
  actor_name: string
  kind: 'finding' | 'decision' | 'deal' | 'rule' | 'report'
  /** Sentence without the actor, for example "marked F-2291 Fix before funding". */
  text: string
  /** Page the item links to, or null. */
  href: string | null
}

export interface AssignFindingsResult {
  updated: Finding[]
  audit_events: AuditEvent[]
}

/* ---------------- Impact check (blast radius) ---------------- */

export type ImpactChangeType = 'effective_date' | 'threshold' | 'disable'

export interface ImpactChange {
  type: ImpactChangeType
  /** New effective date, YYYY-MM-DD, for effective_date. */
  effective_date?: string
  /** How much stricter (positive) or looser (negative) the threshold becomes, in percent, for threshold. */
  threshold_pct?: number
}

export interface ImpactRooftop {
  dealer_id: string
  dealer_name: string
  deals: number
  refund_exposure: number
}

export interface ImpactSampleDeal {
  deal_id: string
  customer_display: string
  dealer_id: string
  dealer_name: string
  vehicle_label: string
  status: DealStatus
  risk_score: number
  refund_exposure: number
  /** Findings on this deal that cite the rule. */
  findings_citing_rule: number
}

export interface ImpactResult {
  rule_id: string
  change: ImpactChange
  /** The change in a sentence, for the result header. */
  change_summary: string
  /** What the latest version of the rule changed, from the blast radius data. */
  latest_change: string
  affected_deals: number
  affected_dealers: number
  estimated_refund_exposure: number
  by_rooftop: ImpactRooftop[]
  sample_deals: ImpactSampleDeal[]
  /** Deals scanned in the last 30 days that the estimate is drawn from. */
  scanned_deals: number
}

/* ---------------- Rules ---------------- */

export interface RuleFilters {
  status?: Rule['status']
  jurisdiction?: string
  q?: string
}

/* ---------------- Pricing ---------------- */

export interface PricingFilters {
  product_code: ProductCode
  dealer_id?: string
  segment?: string
}

export interface PriceStats {
  count: number
  min: number
  p25: number
  median: number
  p75: number
  max: number
  outliers: number
}

export interface PricingDispersion {
  /** Deals among the points that are stored in DealTrace, so they have a page to link to. */
  stored_deal_ids: string[]
  product_code: ProductCode
  points: PricingPoint[]
  overall: PriceStats
  by_dealer: (PriceStats & { dealer_id: string; dealer_name: string })[]
  segments: string[]
}

/* ---------------- Synthetic data ---------------- */

export interface SyntheticJobParams {
  deal_count: number
  /** Average add-on products per deal. */
  products_per_deal: number
  /** Share of deals with a service contract, 0 to 1. */
  vsc_rate: number
  /** Share of deals with GAP, 0 to 1. */
  gap_rate: number
  /** Share of deals that get an injected issue, 0 to 1. */
  issue_rate: number
  detectors: DetectorType[]
  seed: number
}

export interface SyntheticJobResult {
  deals_generated: number
  issues_injected: number
  /** Flags the detectors raised in total (true plus false). */
  issues_detected: number
  true_positives: number
  false_positives: number
  false_negatives: number
  precision: number
  recall: number
  f1: number
  per_detector: {
    detector: DetectorType
    injected: number
    detected: number
    true_positives: number
    false_positives: number
    false_negatives: number
  }[]
  /** What the generated deals actually look like, to compare with the settings. */
  actual: { products_per_deal: number; vsc_rate: number; gap_rate: number; issue_rate: number }
}

export interface SyntheticJob {
  id: string
  created_at: string
  params: SyntheticJobParams
  status: 'running' | 'completed'
  progress: number
  stage: string
  result: SyntheticJobResult | null
}

/* ---------------- Audit ---------------- */

export interface AuditFilters {
  actor_id?: string
  entity?: string
  /** Matches the start of the action, so "Decision recorded" finds every decision. */
  action?: string
  /** Pacific calendar days, YYYY-MM-DD, inclusive. */
  from?: string
  to?: string
  q?: string
}

/** The values the audit filters offer. */
export interface AuditFacets {
  actors: { id: string; name: string }[]
  /** Actions with any ": detail" removed, for example "Decision recorded". */
  actions: string[]
}

/* ---------------- Sandbox ---------------- */

export interface SandboxInput {
  versions: DealVersion[]
  events: DealEvent[]
}

export interface SandboxResult {
  findings: DetectedFinding[]
  current: LoanFigures
  diff: VersionDiff | null
}

/* ---------------- Search ---------------- */

export interface SearchResult {
  kind: 'deal' | 'finding' | 'rule' | 'dealer'
  id: string
  title: string
  subtitle: string
  href: string
}

