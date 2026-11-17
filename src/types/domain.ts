/**
 * Domain types. These match the interfaces in docs/DATA.md exactly.
 * Do not change a field here without changing docs/DATA.md and the seed script.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type FindingStatus = 'Open' | 'In review' | 'Resolved' | 'Dismissed'
export type ProductCode = 'GAP' | 'VSC' | 'TIRE_WHEEL' | 'PAINT_FABRIC' | 'PREPAID_MAINT' | 'THEFT_ETCH'

/** email: name@harborline.example */
export interface User {
  id: string
  name: string
  role: string
  email: string
  initials: string
}

export interface Dealer {
  id: string
  name: string
  city: string
  state: 'CA'
  group: 'Harborline Auto Group'
}

export interface Product {
  code: ProductCode
  name: string
  provider_id: string
  price: number
  term_months: number
  max_miles?: number
}

/** VIN 17 chars, no I/O/Q */
export interface Vehicle {
  year: number
  make: string
  model: string
  trim: string
  vin: string
  condition: 'new' | 'used'
  msrp: number
  factory_warranty_months: number
  factory_warranty_miles: number
}

export interface DealVersion {
  version: number
  created_at: string
  actor_id: string
  reason: string | null
  vehicle_price: number
  down_payment: number
  trade_in_value: number
  trade_in_payoff: number
  amount_financed: number
  /** Annual percentage rate in percent, e.g. 7.9 */
  apr: number
  term_months: number
  monthly_payment: number
  total_of_payments: number
  products: Product[]
  label: string
}

export type DealStatus = 'In review' | 'Ready to fund' | 'Funded' | 'On hold'

export interface Deal {
  id: string
  dealer_id: string
  customer_display: string
  vehicle: Vehicle
  lender_id: string
  deal_date: string
  status: DealStatus
  fi_manager_id: string
  salesperson_id: string
  versions: DealVersion[]
  current_version: number
  risk_score: number
  refund_exposure: number
  customer_exposure: number
  open_findings: number
}

export type EventType =
  | 'QUOTE_CREATED'
  | 'PRICE_AGREED'
  | 'CREDIT_APPROVED'
  | 'PRODUCT_ADDED'
  | 'PRODUCT_REMOVED'
  | 'RATE_CHANGED'
  | 'TERM_CHANGED'
  | 'PRICE_CHANGED'
  | 'CONTRACT_SIGNED'
  | 'DECISION_RECORDED'

export interface DealEvent {
  id: string
  deal_id: string
  seq: number
  type: EventType
  field: string | null
  old_value: string | null
  new_value: string | null
  actor_id: string
  reason: string | null
  timestamp: string
  version_after: number
  hash: string
  prev_hash: string
}

export type FindingType =
  | 'LATE_ADD_ON'
  | 'PAYMENT_MASKING'
  | 'RATE_AFTER_APPROVAL'
  | 'WARRANTY_OVERLAP'
  | 'LOW_BENEFIT_GAP'
  | 'DUPLICATE_COVERAGE'
  | 'MISSING_REASON'
  | 'PRICE_OUTLIER'
  | 'RECORDKEEPING_GAP'

export const FINDING_LABEL = 'Potential violation – human review required' as const
export type FindingLabel = typeof FINDING_LABEL

export interface EvidenceItem {
  label: string
  value: string
  event_id?: string
}

export interface Finding {
  id: string
  deal_id: string
  type: FindingType
  title: string
  severity: Severity
  status: FindingStatus
  detected_at: string
  version_from: number
  version_to: number
  rule_id?: string
  evidence: EvidenceItem[]
  /** 0 to 1 */
  uncertainty: number
  refund_exposure: number
  customer_exposure: number
  assignee_id: string
  label: FindingLabel
}

export type BenefitVerdict = 'Likely benefit' | 'Partial benefit' | 'Little or no benefit'

export interface BenefitCheck {
  deal_id: string
  product_code: ProductCode
  verdict: BenefitVerdict
  score: number
  reasons: string[]
  inputs: {
    ltv: number
    negative_equity: number
    warranty_overlap_months: number
    existing_coverage: string
  }
}

export interface Rule {
  id: string
  name: string
  description: string
  jurisdiction: string
  source: string
  category: string
  effective_from: string
  effective_to?: string
  recorded_at: string
  version: string
  severity: Severity
  status: 'Active' | 'Draft'
  enabled: boolean
}

/** One entry in a rule's version history (rule_versions.json). */
export interface RuleVersion {
  rule_id: string
  version: string
  recorded_at: string
  /** What changed in this version, in a sentence. */
  change: string
  actor_id: string
}

export interface BlastRadius {
  rule_id: string
  change_description: string
  affected_deals: number
  affected_dealers: number
  estimated_refund_exposure: number
  sample_deal_ids: string[]
}

export interface AgentSummary {
  deal_id: string
  summary: string
  key_points: string[]
  suggested_actions: string[]
  tools_used: string[]
  generated_at: string
}

export type DecisionAction = 'approve' | 'fix_before_funding' | 'escalate' | 'dismiss'

export interface Decision {
  finding_id: string
  action: DecisionAction
  note: string
  actor_id: string
  timestamp: string
}

export interface AuditEvent {
  id: string
  timestamp: string
  actor_id: string
  action: string
  entity: string
  entity_id: string
  hash: string
  prev_hash: string
}

export interface PricingPoint {
  deal_id: string
  dealer_id: string
  product_code: ProductCode
  price: number
  segment: string
  is_outlier: boolean
}

export interface Accuracy {
  dataset: string
  overall: { precision: number; recall: number; f1: number }
  per_detector: { detector: string; precision: number; recall: number; f1: number; support: number }[]
  confusion_matrix: { tp: number; fp: number; fn: number; tn: number }
}

/* ------------------------------------------------------------------
   Supporting entities listed in docs/DATA.md without a full interface.
   ------------------------------------------------------------------ */

export interface Lender {
  id: string
  name: string
}

export interface Provider {
  id: string
  name: string
  product_codes: ProductCode[]
}

export type NotificationKind = 'finding' | 'decision' | 'rule' | 'report' | 'system'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  created_at: string
  read: boolean
  href: string
}

/** metrics.json: the Accuracy record plus F1 for earlier test sets. */
export interface Metrics extends Accuracy {
  history: { dataset: string; f1: number; evaluated_at: string }[]
}

export type DashboardRange = '7d' | '30d'

export interface DashboardSnapshot {
  open_findings: number
  high_severity_open: number
  refund_exposure: number
  median_decision_minutes: number
}

/** scan_stats.json: deals scanned per day and dealer (most are cleared automatically and not stored). */
export interface ScanStats {
  as_of: string
  daily: { date: string; by_dealer: Record<string, number> }[]
  median_decision_minutes: Record<DashboardRange, Record<string, number>>
  prior: Record<DashboardRange, Record<string, DashboardSnapshot>>
}
