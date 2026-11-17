/**
 * Generates every seed file in src/mocks/data from a seeded PRNG (mulberry32, seed 42).
 * Run: npx tsx scripts/generate-seed.ts
 * The output is identical on every run. All payments and totals come from src/lib/finance.ts,
 * findings for the four process detectors come from src/lib/detectors.ts.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { FINDING_TYPE_LABELS, FINDING_TYPE_ORDER, PRODUCT_NAMES, PRODUCT_PRICE_RANGES, PRODUCT_PROVIDER, SEVERITY_RANK, SYSTEM_ACTOR_ID, lowerFirst, productNameInSentence } from '@/lib/catalog'
import { ADD_ON_RULE_ID, RECORD_RULE_ID, runDetectors } from '@/lib/detectors'
import { dealRefundExposure, findingProductCodes } from '@/lib/exposure'
import { amountFinanced, monthlyPayment, roundCents, totalOfPayments } from '@/lib/finance'
import { formatApr, formatDateTime, formatMoney, formatPercent, formatTime, minutesBetween, pacificToIso } from '@/lib/format'
import { GENESIS_HASH, hashInput } from '@/lib/hashchain'
import { createRng, type Rng } from '@/lib/prng'
import { idleRiskScore, riskScore } from '@/lib/risk'
import {
  FINDING_LABEL,
  type Accuracy,
  type AgentSummary,
  type AppNotification,
  type AuditEvent,
  type BenefitCheck,
  type BlastRadius,
  type Deal,
  type DealEvent,
  type DealStatus,
  type DealVersion,
  type Dealer,
  type DetectedFinding,
  type EventType,
  type Finding,
  type FindingStatus,
  type Lender,
  type Metrics,
  type PricingPoint,
  type Product,
  type ProductCode,
  type Provider,
  type Rule,
  type RuleVersion,
  type ScanStats,
  type Severity,
  type User,
  type Vehicle,
} from '@/types'

const SEED = 42
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'mocks', 'data')

/* Numbers that must agree everywhere (docs/DATA.md) */
const TARGET = {
  deals: 28,
  findings: 74,
  open: 61,
  highOpen: 9,
  refundExposure: 48920.4,
  dealsScanned30d: 1284,
  medianDecisionMinutes: 192,
} as const

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

const USERS: User[] = [
  { id: 'U-01', name: 'Priya Shah', role: 'Compliance Officer', email: 'priya.shah@harborline.example', initials: 'PS' },
  { id: 'U-02', name: 'Marcus Reed', role: 'Internal Auditor', email: 'marcus.reed@harborline.example', initials: 'MR' },
  { id: 'U-03', name: 'Jordan Lee', role: 'F&I Manager', email: 'jordan.lee@harborline.example', initials: 'JL' },
  { id: 'U-04', name: 'Chris Patel', role: 'Sales Consultant', email: 'chris.patel@harborline.example', initials: 'CP' },
  { id: 'U-05', name: 'Elena Torres', role: 'Lender Funding Analyst', email: 'elena.torres@harborline.example', initials: 'ET' },
]
const PRIYA = 'U-01'
const MARCUS = 'U-02'
const JORDAN = 'U-03'
const CHRIS = 'U-04'
const ELENA = 'U-05'

const DEALERS: Dealer[] = [
  { id: 'DLR-01', name: 'Harborline Motors San Jose', city: 'San Jose', state: 'CA', group: 'Harborline Auto Group' },
  { id: 'DLR-02', name: 'Harborline Motors Fresno', city: 'Fresno', state: 'CA', group: 'Harborline Auto Group' },
  { id: 'DLR-03', name: 'Bayview Auto Oakland', city: 'Oakland', state: 'CA', group: 'Harborline Auto Group' },
  { id: 'DLR-04', name: 'Sierra Vista Auto Sacramento', city: 'Sacramento', state: 'CA', group: 'Harborline Auto Group' },
  { id: 'DLR-05', name: 'Coastline Motors San Diego', city: 'San Diego', state: 'CA', group: 'Harborline Auto Group' },
]

const LENDERS: Lender[] = [
  { id: 'LND-01', name: 'Pacific Crest Credit Union' },
  { id: 'LND-02', name: 'Summit Auto Finance' },
  { id: 'LND-03', name: 'Golden Bay Bank' },
]

const PROVIDERS: Provider[] = [
  { id: 'PRV-01', name: 'ShieldPoint', product_codes: ['GAP', 'THEFT_ETCH'] },
  { id: 'PRV-02', name: 'DriveCare', product_codes: ['VSC', 'PREPAID_MAINT'] },
  { id: 'PRV-03', name: 'TreadSafe', product_codes: ['TIRE_WHEEL', 'PAINT_FABRIC'] },
]

type ModelKey = 'RAV4' | 'CRV' | 'F150' | 'MODELY' | 'TUCSON' | 'CAMRY' | 'ACCORD' | 'SILVERADO' | 'SPORTAGE'

interface ModelSpec {
  make: string
  model: string
  trims: string[]
  msrp: [number, number]
  segment: string
  warrantyMonths: number
  warrantyMiles: number
  wmi: string
}

const MODELS: Record<ModelKey, ModelSpec> = {
  RAV4: { make: 'Toyota', model: 'RAV4', trims: ['LE', 'XLE', 'XLE Premium'], msrp: [30215, 37480], segment: 'compact SUV', warrantyMonths: 36, warrantyMiles: 36000, wmi: '2T3' },
  CRV: { make: 'Honda', model: 'CR-V', trims: ['LX', 'EX', 'EX-L'], msrp: [31450, 39120], segment: 'compact SUV', warrantyMonths: 36, warrantyMiles: 36000, wmi: '7FA' },
  F150: { make: 'Ford', model: 'F-150', trims: ['XL', 'XLT', 'Lariat'], msrp: [38810, 61745], segment: 'full-size truck', warrantyMonths: 36, warrantyMiles: 36000, wmi: '1FT' },
  MODELY: { make: 'Tesla', model: 'Model Y', trims: ['Long Range AWD', 'Performance AWD'], msrp: [46630, 53630], segment: 'electric SUV', warrantyMonths: 48, warrantyMiles: 50000, wmi: '7SA' },
  TUCSON: { make: 'Hyundai', model: 'Tucson', trims: ['SE', 'SEL', 'Limited'], msrp: [29245, 38715], segment: 'compact SUV', warrantyMonths: 60, warrantyMiles: 60000, wmi: 'KM8' },
  CAMRY: { make: 'Toyota', model: 'Camry', trims: ['LE', 'SE', 'XSE'], msrp: [28795, 35915], segment: 'midsize sedan', warrantyMonths: 36, warrantyMiles: 36000, wmi: '4T1' },
  ACCORD: { make: 'Honda', model: 'Accord', trims: ['LX', 'EX', 'Sport-L'], msrp: [28395, 36840], segment: 'midsize sedan', warrantyMonths: 36, warrantyMiles: 36000, wmi: '1HG' },
  SILVERADO: { make: 'Chevrolet', model: 'Silverado 1500', trims: ['WT', 'LT', 'RST'], msrp: [37645, 58290], segment: 'full-size truck', warrantyMonths: 36, warrantyMiles: 36000, wmi: '1GC' },
  SPORTAGE: { make: 'Kia', model: 'Sportage', trims: ['LX', 'EX', 'SX-Prestige'], msrp: [28415, 37190], segment: 'compact SUV', warrantyMonths: 60, warrantyMiles: 60000, wmi: 'KND' },
}

const PRICE_RANGES = PRODUCT_PRICE_RANGES

const CUSTOMERS = [
  'R. Nguyen', 'D. Okafor', 'S. Kowalski', 'T. Haddad', 'L. Brennan', 'K. Yamamoto', 'A. Delgado', 'J. Whitfield',
  'P. Castillo', 'N. Abernathy', 'E. Lindqvist', 'G. Moreau', 'H. Sandoval', 'V. Petrov', 'C. Mendoza', 'B. Ashworth',
  'F. Rahimi', 'W. Calloway', 'Y. Tanaka', 'O. Adeyemi', 'M. Fitzgerald', 'Z. Kaur', 'L. Romero', 'S. Achebe',
  'D. Varga', 'R. Holloway', 'J. Esposito', 'T. Quintero',
]

const RECORD_GAPS: { text: string; requires?: 'GAP' | 'VSC' | 'used'; rule: string }[] = [
  { text: 'Signed GAP disclosure not in deal jacket', requires: 'GAP', rule: 'CA-GAP-DISCLOSURE-01' },
  { text: 'Add-on price acknowledgment not retained', rule: RECORD_RULE_ID },
  { text: 'Credit application copy missing from deal jacket', rule: RECORD_RULE_ID },
  { text: "Buyer's Guide copy not retained", requires: 'used', rule: RECORD_RULE_ID },
  { text: 'Menu presentation printout not retained', rule: RECORD_RULE_ID },
  { text: 'Service contract cancellation notice not retained', requires: 'VSC', rule: RECORD_RULE_ID },
  { text: 'Odometer disclosure statement not scanned', rule: RECORD_RULE_ID },
  { text: 'F&I session notes incomplete', rule: RECORD_RULE_ID },
]

/* ------------------------------------------------------------------ */
/* Scenarios for the 27 non-hero deals                                 */
/* ------------------------------------------------------------------ */

type Group = 'high' | 'medium' | 'clean'

interface Scenario {
  key: string
  group: Group
  model: ModelKey
  condition: 'new' | 'used'
  year?: number
  term: number
  upfront: ProductCode[]
  /** VSC term for this deal (months). */
  vscTerm?: number
  /** Number of price changes before agreement; the last one has no reason if preMissing. */
  preChanges?: number
  preMissing?: boolean
  late?: { codes: ProductCode[]; reason: string | null }
  termExtend?: { to: number; reason: string | null }
  rateBump?: { by: number; reason: string | null }
  overpriced?: ProductCode
  mildOverpriced?: ProductCode
  existingCoverage?: string
  lowLtv?: boolean
  recordGaps?: number
  /** All findings resolved; the deal funded. */
  closeAll?: boolean
  /** Its high-severity findings were resolved before funding. */
  closeHighs?: boolean
}

/**
 * The overpriced products absorb a small price adjustment so the group refund exposure lands exactly
 * on the dashboard figure. They are outliers already, so the change moves only their excess, linearly.
 */
const TUNE_SHARES: { key: string; code: ProductCode; share: number }[] = [
  { key: 'M2', code: 'VSC', share: 0.25 },
  { key: 'M7', code: 'VSC', share: 0.25 },
  { key: 'M8', code: 'VSC', share: 0.25 },
  { key: 'M4', code: 'TIRE_WHEEL', share: 0.075 },
  { key: 'M5', code: 'GAP', share: 0.0875 },
  { key: 'M6', code: 'GAP', share: 0.0875 },
]

function tuneParts(delta: number): Map<string, number> {
  const out = new Map<string, number>()
  let assigned = 0
  TUNE_SHARES.forEach((t, i) => {
    const part = i === TUNE_SHARES.length - 1 ? roundCents(delta - assigned) : roundCents(delta * t.share)
    assigned = roundCents(assigned + part)
    out.set(`${t.key}:${t.code}`, part)
  })
  return out
}

const DUP_GAP_COVERAGE = 'Loan/lease payoff coverage on current auto policy'

const SCENARIOS: Scenario[] = [
  // High: late add-ons, payment masking, rate changes after approval
  { key: 'H1', group: 'high', model: 'CRV', condition: 'new', term: 60, upfront: [], vscTerm: 72, preChanges: 1, late: { codes: ['GAP', 'VSC'], reason: null }, termExtend: { to: 72, reason: null } },
  { key: 'H2', group: 'high', model: 'F150', condition: 'used', year: 2023, term: 72, upfront: [], vscTerm: 60, preChanges: 1, late: { codes: ['VSC'], reason: 'Customer asked for extended coverage' }, termExtend: { to: 84, reason: null }, rateBump: { by: 1.25, reason: null } },
  { key: 'H3', group: 'high', model: 'CAMRY', condition: 'used', year: 2022, term: 60, upfront: [], vscTerm: 48, preChanges: 2, late: { codes: ['GAP', 'VSC'], reason: null }, rateBump: { by: 0.75, reason: 'Lender re-tiered after income verification' } },
  { key: 'H4', group: 'high', model: 'TUCSON', condition: 'new', term: 60, upfront: [], preChanges: 1, late: { codes: ['TIRE_WHEEL', 'THEFT_ETCH'], reason: 'Customer requested after test drive' }, termExtend: { to: 72, reason: 'Customer asked for a lower payment' }, closeHighs: true },
  // Medium: warranty overlap, low-benefit GAP, duplicate coverage, price outliers
  { key: 'M1', group: 'medium', model: 'TUCSON', condition: 'new', term: 72, upfront: ['VSC', 'GAP'], vscTerm: 60, lowLtv: true, preChanges: 1, preMissing: true },
  { key: 'M2', group: 'medium', model: 'CRV', condition: 'new', term: 60, upfront: ['VSC'], vscTerm: 60, overpriced: 'VSC', preChanges: 1, preMissing: true },
  { key: 'M3', group: 'medium', model: 'F150', condition: 'used', year: 2022, term: 72, upfront: ['GAP'], existingCoverage: DUP_GAP_COVERAGE, preChanges: 1, preMissing: true },
  { key: 'M4', group: 'medium', model: 'MODELY', condition: 'new', term: 72, upfront: ['VSC', 'TIRE_WHEEL'], vscTerm: 60, overpriced: 'TIRE_WHEEL', preChanges: 2 },
  { key: 'M5', group: 'medium', model: 'SPORTAGE', condition: 'new', term: 60, upfront: ['GAP'], lowLtv: true, overpriced: 'GAP', recordGaps: 1, preChanges: 1, preMissing: true },
  { key: 'M6', group: 'medium', model: 'CAMRY', condition: 'used', year: 2021, term: 60, upfront: ['GAP', 'VSC'], vscTerm: 48, existingCoverage: DUP_GAP_COVERAGE, overpriced: 'GAP', preChanges: 1 },
  { key: 'M7', group: 'medium', model: 'CAMRY', condition: 'new', term: 60, upfront: ['VSC'], vscTerm: 60, overpriced: 'VSC', preChanges: 1, preMissing: true },
  { key: 'M8', group: 'medium', model: 'ACCORD', condition: 'new', term: 72, upfront: ['VSC', 'GAP'], vscTerm: 72, lowLtv: true, overpriced: 'VSC', preChanges: 2 },
  // Clean or low-only (some funded after review)
  { key: 'C1', group: 'clean', model: 'RAV4', condition: 'new', term: 60, upfront: ['VSC'], vscTerm: 72, closeAll: true, preChanges: 1 },
  { key: 'C2', group: 'clean', model: 'TUCSON', condition: 'new', term: 72, upfront: ['VSC', 'PREPAID_MAINT'], vscTerm: 72, closeAll: true },
  { key: 'C3', group: 'clean', model: 'SPORTAGE', condition: 'new', term: 60, upfront: ['VSC'], vscTerm: 60, closeAll: true, preChanges: 1 },
  { key: 'C4', group: 'clean', model: 'F150', condition: 'used', year: 2022, term: 72, upfront: ['VSC'], vscTerm: 60, mildOverpriced: 'VSC', preChanges: 1 },
  { key: 'C5', group: 'clean', model: 'SILVERADO', condition: 'used', year: 2023, term: 72, upfront: ['GAP', 'TIRE_WHEEL'], preChanges: 1, preMissing: true },
  { key: 'C6', group: 'clean', model: 'CRV', condition: 'used', year: 2025, term: 60, upfront: ['VSC'], vscTerm: 60, preChanges: 1 },
  { key: 'C7', group: 'clean', model: 'MODELY', condition: 'used', year: 2024, term: 60, upfront: ['TIRE_WHEEL'], preChanges: 1, preMissing: true },
  { key: 'C8', group: 'clean', model: 'RAV4', condition: 'new', term: 72, upfront: ['GAP', 'PAINT_FABRIC'], mildOverpriced: 'GAP', preChanges: 2, preMissing: true },
  { key: 'C9', group: 'clean', model: 'ACCORD', condition: 'used', year: 2023, term: 60, upfront: ['GAP', 'PREPAID_MAINT'], preChanges: 1, preMissing: true },
  { key: 'C10', group: 'clean', model: 'CAMRY', condition: 'new', term: 60, upfront: ['GAP', 'THEFT_ETCH'], mildOverpriced: 'GAP', preChanges: 1 },
  { key: 'C11', group: 'clean', model: 'SPORTAGE', condition: 'used', year: 2023, term: 72, upfront: ['GAP'], preChanges: 1, preMissing: true },
  { key: 'C12', group: 'clean', model: 'F150', condition: 'new', term: 84, upfront: ['TIRE_WHEEL', 'GAP'], preChanges: 2, preMissing: true },
  { key: 'C13', group: 'clean', model: 'SILVERADO', condition: 'new', term: 72, upfront: ['GAP', 'THEFT_ETCH'], mildOverpriced: 'GAP', preChanges: 1, preMissing: true },
  { key: 'C14', group: 'clean', model: 'CRV', condition: 'used', year: 2025, term: 48, upfront: ['VSC'], vscTerm: 72, preChanges: 1 },
  { key: 'C15', group: 'clean', model: 'MODELY', condition: 'new', term: 60, upfront: ['TIRE_WHEEL', 'PAINT_FABRIC'], preChanges: 1, preMissing: true },
]

const PRE_CHANGE_REASONS = [
  'Matched competing dealer offer',
  'Applied manufacturer incentive',
  'Customer countered on price',
  'Removed dealer-installed accessories',
  'Corrected doc fee entry',
]

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'.split('')
const VIN_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'.split('')
const TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
}
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
const YEAR_CODES: Record<number, string> = { 2021: 'M', 2022: 'N', 2023: 'P', 2024: 'R', 2025: 'S', 2026: 'T' }

/** 17-character VIN with no I, O or Q and a valid North American check digit. */
function makeVin(rng: Rng, wmi: string, year: number): string {
  let vds = ''
  for (let i = 0; i < 5; i++) vds += rng.pick(VIN_CHARS)
  const draft = `${wmi}${vds}0${YEAR_CODES[year] ?? 'T'}${rng.pick(VIN_LETTERS)}${rng.int(100000, 999999)}`
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const c = draft[i] as string
    const v = /\d/.test(c) ? Number(c) : (TRANSLIT[c] ?? 0)
    sum += v * (VIN_WEIGHTS[i] as number)
  }
  const rem = sum % 11
  return `${draft.slice(0, 8)}${rem === 10 ? 'X' : String(rem)}${draft.slice(9)}`
}

/** Avoid amounts that look typed by hand (multiples of 50). */
function unround(n: number, bump = 13): number {
  return n % 50 === 0 ? n + bump : n
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function vehicleAgeMonths(vehicle: Vehicle, dealDate: string): number {
  if (vehicle.condition === 'new') return 0
  // Assume the vehicle went into service on Oct 1 of the year before its model year.
  const [y, m] = dealDate.split('-').map(Number) as [number, number]
  return (y - (vehicle.year - 1)) * 12 + (m - 10)
}

function warrantyOverlapMonths(vehicle: Vehicle, dealDate: string, productTerm: number): number {
  const remaining = Math.max(0, vehicle.factory_warranty_months - vehicleAgeMonths(vehicle, dealDate))
  return Math.min(productTerm, remaining)
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  const a = sorted[lo] as number
  const b = sorted[hi] as number
  return a + (b - a) * (pos - lo)
}

function makeProduct(code: ProductCode, price: number, loanTerm: number, vscTerm?: number): Product {
  const base = { code, name: PRODUCT_NAMES[code], provider_id: PRODUCT_PROVIDER[code], price }
  switch (code) {
    case 'GAP':
      return { ...base, term_months: loanTerm }
    case 'VSC': {
      const term = vscTerm ?? 60
      return { ...base, term_months: term, max_miles: term >= 72 ? 75000 : 60000 }
    }
    case 'PREPAID_MAINT':
      return { ...base, term_months: 36, max_miles: 36000 }
    default:
      return { ...base, term_months: 60 }
  }
}

function productPrice(rng: Rng, code: ProductCode, kind: 'normal' | 'over' | 'mild'): number {
  const [lo, hi] = PRICE_RANGES[code]
  const w = hi - lo
  if (kind === 'over') return unround(Math.round(hi + 1.1 * w) + rng.int(3, 41))
  if (kind === 'mild') return unround(Math.round(hi + 0.75 * w) + rng.int(2, 27))
  return unround(rng.int(lo, hi))
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/** Hash-chains records in order with node:crypto, using the same canonicalisation as the browser verifier. */
function chain<T extends { prev_hash: string; hash: string }>(records: Omit<T, 'hash' | 'prev_hash'>[]): T[] {
  const out: T[] = []
  let prev = GENESIS_HASH
  for (const r of records) {
    const withPrev = { ...r, prev_hash: prev }
    const hash = sha256(hashInput(withPrev))
    out.push({ ...withPrev, hash } as unknown as T)
    prev = hash
  }
  return out
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString()
}

/* ------------------------------------------------------------------ */
/* Deal builder                                                        */
/* ------------------------------------------------------------------ */

interface Draft {
  vehicle_price: number
  down_payment: number
  trade_in_value: number
  trade_in_payoff: number
  apr: number
  term_months: number
  products: Product[]
}

type RawEvent = Omit<DealEvent, 'id' | 'seq' | 'hash' | 'prev_hash'>

class DealBuilder {
  readonly versions: DealVersion[] = []
  readonly events: RawEvent[] = []

  constructor(
    readonly dealId: string,
    readonly date: string,
    public draft: Draft,
  ) {}

  iso(minute: number): string {
    return pacificToIso(this.date, minute)
  }

  snapshot(minute: number, actor: string, label: string, reason: string | null): number {
    const d = this.draft
    const af = amountFinanced(d)
    this.versions.push({
      version: this.versions.length + 1,
      created_at: this.iso(minute),
      actor_id: actor,
      reason,
      vehicle_price: d.vehicle_price,
      down_payment: d.down_payment,
      trade_in_value: d.trade_in_value,
      trade_in_payoff: d.trade_in_payoff,
      amount_financed: af,
      apr: d.apr,
      term_months: d.term_months,
      monthly_payment: monthlyPayment(af, d.apr, d.term_months),
      total_of_payments: totalOfPayments(af, d.apr, d.term_months),
      products: d.products.map((p) => ({ ...p })),
      label,
    })
    return this.versions.length
  }

  event(
    minute: number,
    type: EventType,
    actor: string,
    opts: { field?: string | null; old?: string | null; next?: string | null; reason?: string | null } = {},
  ): void {
    this.events.push({
      deal_id: this.dealId,
      type,
      field: opts.field ?? null,
      old_value: opts.old ?? null,
      new_value: opts.next ?? null,
      actor_id: actor,
      reason: opts.reason ?? null,
      timestamp: this.iso(minute),
      version_after: this.versions.length,
    })
  }
}

interface DealCore {
  scenario: Scenario | null // null for the hero
  id: string
  dealer_id: string
  customer_display: string
  vehicle: Vehicle
  lender_id: string
  deal_date: string
  builder: DealBuilder
  existingCoverage: string
}

/* ------------------------------------------------------------------ */
/* Hero deal DT-10482 (docs/DATA.md, exact numbers)                    */
/* ------------------------------------------------------------------ */

function buildHero(rng: Rng): DealCore {
  const date = '2026-10-20'
  const vehicle: Vehicle = {
    year: 2026,
    make: 'Toyota',
    model: 'RAV4',
    trim: 'XLE',
    vin: makeVin(rng, MODELS.RAV4.wmi, 2026),
    condition: 'new',
    msrp: 34615,
    factory_warranty_months: 36,
    factory_warranty_miles: 36000,
  }
  const b = new DealBuilder('DT-10482', date, {
    vehicle_price: 34000,
    down_payment: 6000,
    trade_in_value: 0,
    trade_in_payoff: 0,
    apr: 7.9,
    term_months: 60,
    products: [],
  })
  const t = (h: number, m: number) => h * 60 + m

  b.snapshot(t(10, 5), CHRIS, 'Quote, price agreed', 'Customer accepted price')
  b.event(t(10, 5), 'QUOTE_CREATED', CHRIS, { field: 'vehicle_price', next: '34000.00', reason: 'Initial quote' })
  b.event(t(10, 5), 'PRICE_AGREED', CHRIS, { field: 'vehicle_price', next: '34000.00', reason: 'Customer accepted price' })
  b.event(t(10, 20), 'CREDIT_APPROVED', JORDAN, { field: 'apr', next: '7.9', reason: 'Approved by Pacific Crest Credit Union' })

  b.draft.products = [makeProduct('GAP', 900, 60), { ...makeProduct('VSC', 2400, 60, 72), max_miles: 75000 }]
  b.snapshot(t(10, 40), JORDAN, 'Add-ons added', null)
  b.event(t(10, 40), 'PRODUCT_ADDED', JORDAN, { field: 'products', next: 'GAP', reason: null })
  b.event(t(10, 40), 'PRODUCT_ADDED', JORDAN, { field: 'products', next: 'VSC', reason: null })

  b.draft.term_months = 72
  b.snapshot(t(10, 55), JORDAN, 'Term extended', null)
  b.event(t(10, 55), 'TERM_CHANGED', JORDAN, { field: 'term_months', old: '60', next: '72', reason: null })

  b.snapshot(t(11, 10), JORDAN, 'Contract signed', null)
  b.event(t(11, 10), 'CONTRACT_SIGNED', JORDAN)

  return {
    scenario: null,
    id: 'DT-10482',
    dealer_id: 'DLR-01',
    customer_display: 'M. Alvarez',
    vehicle,
    lender_id: 'LND-01',
    deal_date: date,
    builder: b,
    existingCoverage: 'None on file',
  }
}

/** Asserts the hero deal matches docs/DATA.md to the cent. */
function assertHero(hero: DealCore): void {
  const expected = [
    { af: 28000, term: 60, pay: 566.4, top: 33984.0, time: '10:05 AM' },
    { af: 31300, term: 60, pay: 633.15, top: 37989.25, time: '10:40 AM' },
    { af: 31300, term: 72, pay: 547.26, top: 39402.96, time: '10:55 AM' },
    { af: 31300, term: 72, pay: 547.26, top: 39402.96, time: '11:10 AM' },
  ]
  const vs = hero.builder.versions
  if (vs.length !== 4) throw new Error(`Hero must have 4 versions, got ${vs.length}`)
  expected.forEach((e, i) => {
    const v = vs[i] as DealVersion
    const ok =
      v.amount_financed === e.af && v.term_months === e.term && v.monthly_payment === e.pay && v.total_of_payments === e.top && formatTime(v.created_at) === e.time
    if (!ok) throw new Error(`Hero v${i + 1} does not match docs/DATA.md: ${JSON.stringify(v)}`)
  })
}

/* ------------------------------------------------------------------ */
/* Generic deals                                                       */
/* ------------------------------------------------------------------ */

function buildScenarioDeal(rng: Rng, s: Scenario, id: string, date: string, dealerId: string, customer: string, tune: Map<string, number>): DealCore {
  const spec = MODELS[s.model]
  const year = s.condition === 'new' ? 2026 : (s.year ?? 2023)
  const msrp = unround(rng.int(spec.msrp[0], spec.msrp[1]), 7)
  const vehicle: Vehicle = {
    year,
    make: spec.make,
    model: spec.model,
    trim: rng.pick(spec.trims),
    vin: makeVin(rng, spec.wmi, year),
    condition: s.condition,
    msrp,
    factory_warranty_months: spec.warrantyMonths,
    factory_warranty_miles: spec.warrantyMiles,
  }
  const ageYears = 2026 - year + 1
  const listPrice =
    s.condition === 'new'
      ? Math.round(msrp * (1 - rng.float(0.005, 0.045, 4)))
      : Math.round(msrp * (1 - 0.11 * ageYears - rng.float(0, 0.05, 4)))
  const preChanges = s.preChanges ?? 0
  const reductions: number[] = []
  for (let i = 0; i < preChanges; i++) reductions.push(unround(rng.int(240, 1180), 17))
  const startPrice = unround(listPrice + reductions.reduce((a, b) => a + b, 0), 9)

  const hasGap = s.upfront.includes('GAP') || (s.late?.codes.includes('GAP') ?? false)
  const downShare = s.lowLtv ? rng.float(0.3, 0.34, 4) : hasGap ? rng.float(0.035, 0.08, 4) : rng.float(0.08, 0.2, 4)
  const down = unround(Math.round(listPrice * downShare), 37)
  let tradeValue = 0
  let tradePayoff = 0
  const tradeRoll = rng.next()
  if (!hasGap && !s.lowLtv && tradeRoll < 0.4) {
    tradeValue = unround(rng.int(5800, 16400), 21)
    tradePayoff = unround(Math.round(tradeValue * rng.float(0.25, 1.15, 3)), 11)
  }
  const apr = s.condition === 'new' ? rng.float(4.9, 8.9, 1) : rng.float(6.9, 13.9, 1)
  const lenderId = rng.pick(LENDERS).id

  const priceFor = (code: ProductCode) => {
    const kind = s.overpriced === code ? 'over' : s.mildOverpriced === code ? 'mild' : 'normal'
    const p = productPrice(rng, code, kind)
    return roundCents(p + (tune.get(`${s.key}:${code}`) ?? 0))
  }
  const upfront = s.upfront.map((c) => makeProduct(c, priceFor(c), s.term, s.vscTerm))
  const lateProducts = (s.late?.codes ?? []).map((c) => makeProduct(c, priceFor(c), s.term, s.vscTerm))

  const b = new DealBuilder(id, date, {
    vehicle_price: startPrice,
    down_payment: down,
    trade_in_value: tradeValue,
    trade_in_payoff: tradePayoff,
    apr,
    term_months: s.term,
    products: upfront,
  })

  let t = rng.int(9 * 60 + 12, 15 * 60 + 25)
  const lender = LENDERS.find((l) => l.id === lenderId)?.name ?? ''

  b.snapshot(t, CHRIS, preChanges > 0 ? 'Quote' : 'Quote, price agreed', preChanges > 0 ? null : 'Customer accepted price')
  b.event(t, 'QUOTE_CREATED', CHRIS, { field: 'vehicle_price', next: startPrice.toFixed(2), reason: 'Initial quote' })

  let price = startPrice
  for (let i = 0; i < preChanges; i++) {
    t += rng.int(6, 19)
    const old = price
    price = old - (reductions[i] as number)
    const missing = s.preMissing === true && i === preChanges - 1
    const reason = missing ? null : rng.pick(PRE_CHANGE_REASONS)
    b.draft.vehicle_price = price
    const last = i === preChanges - 1
    b.snapshot(t, CHRIS, last ? 'Price revised, price agreed' : 'Price revised', reason)
    b.event(t, 'PRICE_CHANGED', CHRIS, { field: 'vehicle_price', old: old.toFixed(2), next: price.toFixed(2), reason })
  }
  b.event(t, 'PRICE_AGREED', CHRIS, { field: 'vehicle_price', next: price.toFixed(2), reason: 'Customer accepted price' })

  t += rng.int(9, 26)
  b.event(t, 'CREDIT_APPROVED', JORDAN, { field: 'apr', next: String(apr), reason: `Approved by ${lender}` })

  if (s.late) {
    t += rng.int(11, 27)
    b.draft.products = [...b.draft.products, ...lateProducts]
    b.snapshot(t, JORDAN, 'Add-ons added', s.late.reason)
    for (const p of lateProducts) b.event(t, 'PRODUCT_ADDED', JORDAN, { field: 'products', next: p.code, reason: s.late.reason })
  }
  if (s.termExtend) {
    t += rng.int(8, 18)
    const old = b.draft.term_months
    b.draft.term_months = s.termExtend.to
    b.draft.products = b.draft.products.map((p) => (p.code === 'GAP' ? { ...p, term_months: s.termExtend?.to ?? p.term_months } : p))
    b.snapshot(t, JORDAN, 'Term extended', s.termExtend.reason)
    b.event(t, 'TERM_CHANGED', JORDAN, { field: 'term_months', old: String(old), next: String(s.termExtend.to), reason: s.termExtend.reason })
  }
  if (s.rateBump) {
    t += rng.int(7, 16)
    const old = b.draft.apr
    b.draft.apr = Math.round((old + s.rateBump.by) * 100) / 100
    b.snapshot(t, JORDAN, 'Rate changed', s.rateBump.reason)
    b.event(t, 'RATE_CHANGED', JORDAN, { field: 'apr', old: String(old), next: String(b.draft.apr), reason: s.rateBump.reason })
  }
  t += rng.int(12, 24)
  b.snapshot(t, JORDAN, 'Contract signed', null)
  b.event(t, 'CONTRACT_SIGNED', JORDAN)

  return {
    scenario: s,
    id,
    dealer_id: dealerId,
    customer_display: customer,
    vehicle,
    lender_id: lenderId,
    deal_date: date,
    builder: b,
    existingCoverage: s.existingCoverage ?? 'None on file',
  }
}

/* ------------------------------------------------------------------ */
/* Benefit checks and non-detector findings                            */
/* ------------------------------------------------------------------ */

function finalVersion(core: DealCore): DealVersion {
  return core.builder.versions[core.builder.versions.length - 1] as DealVersion
}

function benefitFor(core: DealCore, product: Product): BenefitCheck {
  const v = finalVersion(core)
  const ltvExact = v.amount_financed / v.vehicle_price
  const ltv = round3(ltvExact)
  const negativeEquity = roundCents(Math.max(0, v.trade_in_payoff - v.trade_in_value))
  const overlap = product.code === 'VSC' ? warrantyOverlapMonths(core.vehicle, core.deal_date, product.term_months) : 0
  const dupGap = product.code === 'GAP' && core.existingCoverage === DUP_GAP_COVERAGE
  const inputs = { ltv, negative_equity: negativeEquity, warranty_overlap_months: overlap, existing_coverage: product.code === 'GAP' || product.code === 'VSC' ? core.existingCoverage : 'None on file' }
  const pct = formatPercent(ltvExact)

  switch (product.code) {
    case 'GAP': {
      if (dupGap) {
        return {
          deal_id: core.id,
          product_code: 'GAP',
          verdict: 'Little or no benefit',
          score: 17,
          reasons: [`Buyer already has ${DUP_GAP_COVERAGE.toLowerCase()}`, `Loan-to-value ${pct} at signing`],
          inputs,
        }
      }
      const score = Math.max(6, Math.min(96, Math.round(40 + (ltvExact - 0.7) * 200 + (negativeEquity > 0 ? 6 : 0))))
      const verdict = ltvExact >= 0.9 ? 'Likely benefit' : ltvExact >= 0.8 ? 'Partial benefit' : 'Little or no benefit'
      const reasons =
        verdict === 'Likely benefit'
          ? [`Loan-to-value ${pct} at signing; a total loss in the first years would likely leave a balance above the insurance payout`, 'No existing loan payoff coverage on file']
          : verdict === 'Partial benefit'
            ? [`Loan-to-value ${pct}; a gap is possible only in the first part of the loan`, 'No existing loan payoff coverage on file']
            : [`Loan-to-value ${pct}; the insurance payout would likely cover the balance`, `Down payment ${formatMoney(v.down_payment)} reduces the shortfall a GAP waiver protects against`]
      return { deal_id: core.id, product_code: 'GAP', verdict, score, reasons, inputs }
    }
    case 'VSC': {
      const ratio = overlap / product.term_months
      const score = Math.round(87 - ratio * 76)
      const verdict = ratio === 0 ? 'Likely benefit' : ratio < 0.6 ? 'Partial benefit' : 'Little or no benefit'
      const reasons =
        overlap === 0
          ? ['Factory warranty has expired; the contract covers repairs from day one', `Coverage runs ${product.term_months} months / ${(product.max_miles ?? 0).toLocaleString('en-US')} miles`]
          : [
              `Factory warranty covers the first ${overlap} of ${product.term_months} contract months`,
              ratio < 0.6
                ? `Coverage after month ${overlap} adds protection through ${(product.max_miles ?? 0).toLocaleString('en-US')} miles`
                : `Only ${product.term_months - overlap} months of coverage fall outside the factory warranty`,
            ]
      return { deal_id: core.id, product_code: 'VSC', verdict, score, reasons, inputs }
    }
    case 'TIRE_WHEEL':
      return { deal_id: core.id, product_code: 'TIRE_WHEEL', verdict: 'Likely benefit', score: segmentOf(core.vehicle).includes('truck') ? 77 : 71, reasons: ['Not covered by the factory warranty', 'Road hazard claims are common in the first three years'], inputs }
    case 'PAINT_FABRIC':
      return { deal_id: core.id, product_code: 'PAINT_FABRIC', verdict: 'Partial benefit', score: 52, reasons: ['Cosmetic coverage only', 'Claims require documented incidents'], inputs }
    case 'PREPAID_MAINT':
      return { deal_id: core.id, product_code: 'PREPAID_MAINT', verdict: core.vehicle.condition === 'new' ? 'Likely benefit' : 'Partial benefit', score: core.vehicle.condition === 'new' ? 68 : 57, reasons: ['Covers scheduled maintenance for 36 months / 36,000 miles', 'Value depends on servicing at a Harborline rooftop'], inputs }
    case 'THEFT_ETCH':
      return { deal_id: core.id, product_code: 'THEFT_ETCH', verdict: 'Partial benefit', score: 38, reasons: ['Vehicle already has a factory immobilizer', 'Benefit limited to the theft deductible credit'], inputs }
  }
}

function firstVersionWith(core: DealCore, code: ProductCode): DealVersion {
  return core.builder.versions.find((v) => v.products.some((p) => p.code === code)) as DealVersion
}

function addedEventId(events: DealEvent[], code: ProductCode, version: number): string | undefined {
  return events.find((e) => e.type === 'PRODUCT_ADDED' && e.new_value === code && e.version_after === version)?.id
}

function costWithFinance(price: number, v: DealVersion): number {
  return roundCents((price * v.total_of_payments) / v.amount_financed)
}

interface OutlierInfo {
  code: ProductCode
  price: number
  median: number
  upperFence: number
}

function benefitFindings(core: DealCore, events: DealEvent[], outliers: OutlierInfo[]): DetectedFinding[] {
  const out: DetectedFinding[] = []
  const v = finalVersion(core)
  const quoteEvent = events.find((e) => e.type === 'QUOTE_CREATED')

  const vsc = v.products.find((p) => p.code === 'VSC')
  if (vsc) {
    const overlap = warrantyOverlapMonths(core.vehicle, core.deal_date, vsc.term_months)
    if (overlap > 0) {
      const ratio = overlap / vsc.term_months
      const first = firstVersionWith(core, 'VSC')
      const evId = addedEventId(events, 'VSC', first.version) ?? quoteEvent?.id
      out.push({
        type: 'WARRANTY_OVERLAP',
        title: `Service contract overlaps factory warranty for ${overlap} months`,
        severity: ratio >= 0.5 ? 'medium' : 'low',
        version_from: Math.max(1, first.version - 1),
        version_to: first.version,
        rule_id: ADD_ON_RULE_ID,
        evidence: [
          { label: 'Factory warranty', value: `${core.vehicle.factory_warranty_months} months / ${core.vehicle.factory_warranty_miles.toLocaleString('en-US')} miles${core.vehicle.condition === 'used' ? `, ${core.vehicle.factory_warranty_months - vehicleAgeMonths(core.vehicle, core.deal_date)} months left` : ''}` },
          { label: 'Service contract', value: `${vsc.term_months} months / ${(vsc.max_miles ?? 0).toLocaleString('en-US')} miles · DriveCare · ${formatMoney(vsc.price)}`, ...(evId ? { event_id: evId } : {}) },
          { label: 'Overlap', value: `${overlap} months (${formatPercent(ratio)} of the contract term)` },
        ],
        uncertainty: round3(0.214 + (overlap % 7) / 1000),
        refund_exposure: vsc.price,
        customer_exposure: costWithFinance(vsc.price, v),
        product_codes: ['VSC'],
      })
    }
  }

  const gap = v.products.find((p) => p.code === 'GAP')
  if (gap) {
    const ltvExact = v.amount_financed / v.vehicle_price
    const first = firstVersionWith(core, 'GAP')
    if (core.existingCoverage === DUP_GAP_COVERAGE) {
      out.push({
        type: 'DUPLICATE_COVERAGE',
        title: 'GAP waiver duplicates loan payoff coverage on the buyer’s auto policy',
        severity: 'medium',
        version_from: Math.max(1, first.version - 1),
        version_to: first.version,
        rule_id: ADD_ON_RULE_ID,
        evidence: [
          { label: 'Existing coverage', value: DUP_GAP_COVERAGE },
          { label: 'GAP waiver', value: `${formatMoney(gap.price)} · ShieldPoint · ${gap.term_months} months`, ...(quoteEvent ? { event_id: quoteEvent.id } : {}) },
          { label: 'Loan-to-value', value: formatPercent(ltvExact) },
        ],
        uncertainty: 0.317,
        refund_exposure: gap.price,
        customer_exposure: costWithFinance(gap.price, v),
        product_codes: ['GAP'],
      })
    } else if (ltvExact < 0.8) {
      out.push({
        type: 'LOW_BENEFIT_GAP',
        title: `GAP waiver sold at ${formatPercent(ltvExact)} loan-to-value`,
        severity: 'medium',
        version_from: Math.max(1, first.version - 1),
        version_to: first.version,
        rule_id: 'CA-GAP-LTV-01',
        evidence: [
          { label: 'Loan-to-value', value: `${formatPercent(ltvExact)} (${formatMoney(v.amount_financed)} financed on a ${formatMoney(v.vehicle_price)} vehicle)` },
          { label: 'Down payment', value: formatMoney(v.down_payment) },
          { label: 'GAP waiver', value: `${formatMoney(gap.price)} · ShieldPoint`, ...(quoteEvent ? { event_id: quoteEvent.id } : {}) },
          { label: 'Benefit check', value: 'Little or no benefit' },
        ],
        uncertainty: round3(0.268 + (Math.round(ltvExact * 100) % 9) / 1000),
        refund_exposure: gap.price,
        customer_exposure: costWithFinance(gap.price, v),
        product_codes: ['GAP'],
      })
    }
  }

  for (const o of outliers) {
    const p = v.products.find((x) => x.code === o.code)
    if (!p) continue
    const excess = roundCents(p.price - o.median)
    out.push({
      type: 'PRICE_OUTLIER',
      title: `${PRODUCT_NAMES[o.code]} priced ${formatPercent(excess / o.median)} above the group median`,
      severity: excess >= 1.1 * o.median ? 'medium' : 'low',
      version_from: firstVersionWith(core, o.code).version,
      version_to: v.version,
      ...(o.code === 'GAP' ? { rule_id: 'CA-GAP-PRICE-01' } : {}),
      evidence: [
        { label: 'Price charged', value: formatMoney(p.price) },
        { label: 'Group median', value: `${formatMoney(o.median)} (${productNameInSentence(o.code)}, last 30 days)` },
        { label: 'Outlier threshold', value: `${formatMoney(roundCents(o.upperFence))} (upper quartile + 1.5 × interquartile range)` },
      ],
      uncertainty: round3(0.183 + (Math.round(excess) % 11) / 1000),
      refund_exposure: excess,
      customer_exposure: costWithFinance(excess, v),
      product_codes: [o.code],
    })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */

interface StoredFinding extends Finding {
  product_codes: ProductCode[]
}

interface World {
  deals: Deal[]
  cores: DealCore[]
  events: DealEvent[]
  findings: StoredFinding[]
  benefit: BenefitCheck[]
  pricing: PricingPoint[]
  refundTotal: number
}

function buildWorld(tuneDelta: number): World {
  const rng = createRng(SEED)

  /* Dates: 6 deals before Oct 20 and 21 after, one deal per day. */
  const dayList = (from: number, to: number, month: number) => {
    const out: string[] = []
    for (let d = from; d <= to; d++) out.push(`2026-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    return out
  }
  const before = rng.shuffle(dayList(1, 19, 10)).slice(0, 6)
  const after = rng.shuffle([...dayList(21, 31, 10), ...dayList(1, 12, 11)]).slice(0, 21)
  const dates = [...before, ...after].sort()
  const scenarios = rng.shuffle(SCENARIOS)
  const customers = rng.shuffle(CUSTOMERS.filter((c) => c !== 'M. Alvarez'))
  const dealerCycle = rng.shuffle(['DLR-01', 'DLR-02', 'DLR-03', 'DLR-04', 'DLR-05', 'DLR-02', 'DLR-03', 'DLR-04', 'DLR-05', 'DLR-01', 'DLR-03', 'DLR-05', 'DLR-02', 'DLR-04', 'DLR-01', 'DLR-03', 'DLR-02', 'DLR-05', 'DLR-04', 'DLR-01', 'DLR-03', 'DLR-02', 'DLR-04', 'DLR-05', 'DLR-01', 'DLR-03', 'DLR-02'])

  const hero = buildHero(rng)
  assertHero(hero)

  /* Deal numbers rise with the date (~30 deals a day across the group). */
  const heroDay = new Date('2026-10-20T12:00:00Z').getTime() / 86400000
  const usedIds = new Set<string>(['DT-10482'])
  const cores: DealCore[] = [hero]
  dates.forEach((date, i) => {
    const day = new Date(`${date}T12:00:00Z`).getTime() / 86400000
    let n = 10482 + Math.round((day - heroDay) * 29.7) + rng.int(-9, 9)
    while (usedIds.has(`DT-${n}`)) n += 1
    usedIds.add(`DT-${n}`)
    cores.push(buildScenarioDeal(rng, scenarios[i] as Scenario, `DT-${n}`, date, dealerCycle[i] as string, customers[i] as string, tuneParts(tuneDelta)))
  })
  cores.sort((a, b) => a.deal_date.localeCompare(b.deal_date))

  /* Events: one global chain in time order. Ids are sequential so the hero's events are E-1040 to E-1046. */
  const raw = cores.flatMap((c, ci) => c.builder.events.map((e, ei) => ({ e, ci, ei })))
  raw.sort((a, b) => a.e.timestamp.localeCompare(b.e.timestamp) || a.ci - b.ci || a.ei - b.ei)
  const heroFirst = raw.findIndex((r) => r.e.deal_id === 'DT-10482')
  const startId = 1040 - heroFirst
  const seqByDeal = new Map<string, number>()
  const unchained = raw.map((r, i) => {
    const seq = (seqByDeal.get(r.e.deal_id) ?? 0) + 1
    seqByDeal.set(r.e.deal_id, seq)
    return { id: `E-${startId + i}`, seq, ...r.e }
  })
  const events = chain<DealEvent>(unchained)
  const heroIds = events.filter((e) => e.deal_id === 'DT-10482').map((e) => e.id)
  if (heroIds.join(',') !== 'E-1040,E-1041,E-1042,E-1043,E-1044,E-1045,E-1046') throw new Error(`Hero event ids are ${heroIds.join(',')}`)
  const eventsByDeal = new Map<string, DealEvent[]>()
  for (const e of events) eventsByDeal.set(e.deal_id, [...(eventsByDeal.get(e.deal_id) ?? []), e])

  /* Pricing: stored deals plus a sample of deals cleared automatically. */
  const pricing: PricingPoint[] = []
  for (const c of cores) {
    for (const p of finalVersion(c).products) {
      pricing.push({ deal_id: c.id, dealer_id: c.dealer_id, product_code: p.code, price: p.price, segment: segmentOf(c.vehicle), is_outlier: false })
    }
  }
  const sampleWeights: [ProductCode, number][] = [['GAP', 40], ['VSC', 45], ['TIRE_WHEEL', 27], ['PAINT_FABRIC', 19], ['PREPAID_MAINT', 19], ['THEFT_ETCH', 21]]
  const totalWeight = sampleWeights.reduce((s, [, w]) => s + w, 0)
  const modelKeys = Object.keys(MODELS) as ModelKey[]
  // Sampled deals cleared automatically: choose products first, then spread each product's prices
  // evenly across its normal range (with jitter) so the quartiles are stable.
  let sampleN = 10100
  const samples: { dealId: string; code: ProductCode; dealer: string; segment: string }[] = []
  while (pricing.length + samples.length < 219) {
    let roll = rng.int(1, totalWeight)
    let code: ProductCode = 'GAP'
    for (const [c, w] of sampleWeights) {
      if (roll <= w) {
        code = c
        break
      }
      roll -= w
    }
    sampleN += rng.int(3, 11)
    const dealId = `DT-${sampleN}`
    if (usedIds.has(dealId)) continue
    const spec = MODELS[rng.pick(modelKeys)]
    samples.push({ dealId, code, dealer: rng.pick(DEALERS).id, segment: `${rng.chance(0.62) ? 'New' : 'Used'} ${spec.segment}` })
  }
  for (const code of Object.keys(PRICE_RANGES) as ProductCode[]) {
    const mine = samples.filter((x) => x.code === code)
    const [lo, hi] = PRICE_RANGES[code]
    const order = rng.shuffle(mine.map((_, i) => i))
    mine.forEach((x, i) => {
      const k = order[i] as number
      const price = unround(Math.round(lo + ((hi - lo) * (k + rng.next())) / mine.length))
      pricing.push({ deal_id: x.dealId, dealer_id: x.dealer, product_code: code, price, segment: x.segment, is_outlier: false })
    })
  }
  pricing.sort((a, b) => a.deal_id.localeCompare(b.deal_id) || a.product_code.localeCompare(b.product_code))
  const outlierByDeal = new Map<string, OutlierInfo[]>()
  const fences = new Map<ProductCode, { median: number; upper: number; lower: number }>()
  for (const code of Object.keys(PRICE_RANGES) as ProductCode[]) {
    const prices = pricing.filter((p) => p.product_code === code).map((p) => p.price).sort((a, b) => a - b)
    const q1 = quantile(prices, 0.25)
    const q3 = quantile(prices, 0.75)
    const iqr = q3 - q1
    fences.set(code, { median: roundCents(quantile(prices, 0.5)), upper: q3 + 1.5 * iqr, lower: q1 - 1.5 * iqr })
  }
  for (const p of pricing) {
    const f = fences.get(p.product_code)
    if (!f) continue
    // Only overpricing matters for refunds, so only the upper fence marks an outlier.
    p.is_outlier = p.price > f.upper
    if (p.is_outlier && usedIds.has(p.deal_id)) {
      outlierByDeal.set(p.deal_id, [...(outlierByDeal.get(p.deal_id) ?? []), { code: p.product_code, price: p.price, median: f.median, upperFence: f.upper }])
    }
  }
  // Only the deliberately overpriced products may be outliers.
  for (const c of cores) {
    const expected = [c.scenario?.overpriced, c.scenario?.mildOverpriced].filter((x): x is ProductCode => x !== undefined).sort()
    const actual = (outlierByDeal.get(c.id) ?? []).map((o) => o.code).sort()
    if (expected.join() !== actual.join()) throw new Error(`Pricing outliers for ${c.id} (${c.scenario?.key ?? 'hero'}) are [${actual}], expected [${expected}]`)
  }

  /* Findings: four detectors + benefit/pricing checks + recordkeeping gaps. */
  const perDeal = new Map<string, DetectedFinding[]>()
  const benefit: BenefitCheck[] = []
  for (const c of cores) {
    const evs = eventsByDeal.get(c.id) ?? []
    const detected = [...runDetectors({ versions: c.builder.versions, events: evs }), ...benefitFindings(c, evs, outlierByDeal.get(c.id) ?? [])]
    perDeal.set(c.id, detected)
    for (const p of finalVersion(c).products) benefit.push(benefitFor(c, p))
  }

  // Expected detector results for the scenario scripts (guards against silent drift).
  for (const c of cores) {
    const s = c.scenario
    const types = new Set((perDeal.get(c.id) ?? []).map((f) => f.type))
    const expect = (type: DetectedFinding['type'], want: boolean) => {
      if (types.has(type) !== want) throw new Error(`${c.id} (${s?.key ?? 'hero'}) ${want ? 'is missing' : 'unexpectedly has'} ${type}`)
    }
    expect('LATE_ADD_ON', s ? Boolean(s.late) : true)
    expect('PAYMENT_MASKING', s ? Boolean(s.late || s.termExtend) && s.key !== 'H3' : true)
    expect('RATE_AFTER_APPROVAL', s ? Boolean(s.rateBump) : false)
  }

  // Scenario recordkeeping gaps, then padding up to 74 findings in total.
  const recordPlan = new Map<string, number>()
  for (const c of cores) if (c.scenario?.recordGaps) recordPlan.set(c.id, c.scenario.recordGaps)
  const intrinsic = [...perDeal.values()].reduce((s, f) => s + f.length, 0) + [...recordPlan.values()].reduce((s, n) => s + n, 0)
  let padding = TARGET.findings - intrinsic
  if (padding < 0) throw new Error(`Detectors produced ${intrinsic} findings, more than ${TARGET.findings}`)
  const padOrder = [
    ...cores.filter((c) => c.scenario?.group === 'clean'),
    ...cores.filter((c) => c.scenario?.group === 'medium'),
    ...cores.filter((c) => c.scenario?.group === 'high'),
  ]
  // First make sure every stored deal has at least one finding.
  for (const c of padOrder) {
    if (padding > 0 && (perDeal.get(c.id)?.length ?? 0) + (recordPlan.get(c.id) ?? 0) === 0) {
      recordPlan.set(c.id, 1)
      padding -= 1
    }
  }
  let rr = 0
  while (padding > 0) {
    const c = padOrder[rr % padOrder.length] as DealCore
    if ((recordPlan.get(c.id) ?? 0) < 2 && c.scenario?.group !== 'high') {
      recordPlan.set(c.id, (recordPlan.get(c.id) ?? 0) + 1)
      padding -= 1
    } else if (rr > padOrder.length * 3) {
      recordPlan.set(c.id, (recordPlan.get(c.id) ?? 0) + 1)
      padding -= 1
    }
    rr += 1
  }
  let gapCursor = 0
  for (const c of cores) {
    const n = recordPlan.get(c.id) ?? 0
    const v = finalVersion(c)
    const signed = (eventsByDeal.get(c.id) ?? []).find((e) => e.type === 'CONTRACT_SIGNED')
    const used = new Set<string>()
    for (let k = 0; k < n; k++) {
      let gap = RECORD_GAPS[gapCursor % RECORD_GAPS.length] as (typeof RECORD_GAPS)[number]
      let guard = 0
      while (
        guard < RECORD_GAPS.length &&
        (used.has(gap.text) ||
          (gap.requires === 'GAP' && !v.products.some((p) => p.code === 'GAP')) ||
          (gap.requires === 'VSC' && !v.products.some((p) => p.code === 'VSC')) ||
          (gap.requires === 'used' && c.vehicle.condition !== 'used'))
      ) {
        gapCursor += 1
        gap = RECORD_GAPS[gapCursor % RECORD_GAPS.length] as (typeof RECORD_GAPS)[number]
        guard += 1
      }
      gapCursor += 1
      used.add(gap.text)
      perDeal.get(c.id)?.push({
        type: 'RECORDKEEPING_GAP',
        title: `Recordkeeping gap: ${lowerFirst(gap.text)}`,
        severity: 'low',
        version_from: v.version,
        version_to: v.version,
        rule_id: gap.rule,
        evidence: [
          { label: 'Missing document', value: gap.text },
          { label: 'Retention', value: 'Deal records must be kept for two years (CA-CARS-RECORD-01)' },
          ...(signed ? [{ label: 'Contract signed', value: formatDateTime(signed.timestamp), event_id: signed.id }] : []),
        ],
        uncertainty: round3(0.072 + (gapCursor % 5) / 1000),
        refund_exposure: 0,
        customer_exposure: 0,
        product_codes: [],
      })
    }
  }

  /* Ids, statuses and assignees. */
  const ordered: { c: DealCore; f: DetectedFinding; detected_at: string }[] = []
  for (const c of cores) {
    const evs = eventsByDeal.get(c.id) ?? []
    const last = evs[evs.length - 1] as DealEvent
    const detected_at = addMinutes(last.timestamp, 2)
    const list = [...(perDeal.get(c.id) ?? [])].sort((a, b) => FINDING_TYPE_ORDER.indexOf(a.type) - FINDING_TYPE_ORDER.indexOf(b.type))
    for (const f of list) ordered.push({ c, f, detected_at })
  }
  const heroFindingIdx = ordered.findIndex((o) => o.c.id === 'DT-10482')
  const firstFindingNo = 2291 - heroFindingIdx

  // Closed: the high findings fixed on H4, every finding on deals funded after review, then single low findings.
  const closed = new Set<number>()
  ordered.forEach((o, i) => {
    if (o.c.scenario?.closeHighs && o.f.severity === 'high') closed.add(i)
  })
  let budget = TARGET.findings - TARGET.open - closed.size
  for (const c of cores.filter((x) => x.scenario?.closeAll)) {
    const idx = ordered.map((o, i) => (o.c.id === c.id ? i : -1)).filter((i) => i >= 0)
    if (idx.length <= budget) {
      idx.forEach((i) => closed.add(i))
      budget -= idx.length
    }
  }
  const lowCandidates = cores.filter((c) => c.scenario?.group === 'clean' && !c.scenario.closeAll)
  let lc = 0
  while (budget > 0 && lc < lowCandidates.length * 3) {
    const c = lowCandidates[lc % lowCandidates.length] as DealCore
    const i = ordered.findIndex((o, k) => o.c.id === c.id && o.f.severity === 'low' && !closed.has(k))
    const openLeft = ordered.filter((o, k) => o.c.id === c.id && !closed.has(k)).length
    if (i >= 0 && openLeft > 1) {
      closed.add(i)
      budget -= 1
    }
    lc += 1
  }
  if (budget !== 0) throw new Error(`Could not close enough findings; ${budget} left`)

  let closedCount = 0
  let lowRotation = 0
  const findings: StoredFinding[] = ordered.map((o, i) => {
    const isHero = o.c.id === 'DT-10482'
    const isClosed = closed.has(i)
    let status: FindingStatus
    if (isClosed) {
      closedCount += 1
      status = o.f.severity === 'high' || closedCount % 3 !== 0 ? 'Resolved' : 'Dismissed'
    } else if (!isHero && (o.c.scenario?.key === 'H2' || o.c.scenario?.key === 'H3' || (o.f.severity === 'medium' && i % 4 === 1))) {
      status = 'In review'
    } else {
      status = 'Open'
    }
    let assignee = PRIYA
    if (isHero) assignee = o.f.type === 'MISSING_REASON' ? MARCUS : PRIYA
    else if (status === 'In review') assignee = MARCUS
    else if (o.f.severity === 'low') assignee = lowRotation++ % 2 === 0 ? MARCUS : PRIYA
    return {
      id: `F-${firstFindingNo + i}`,
      deal_id: o.c.id,
      type: o.f.type,
      title: o.f.title,
      severity: o.f.severity,
      status,
      detected_at: o.detected_at,
      version_from: o.f.version_from,
      version_to: o.f.version_to,
      ...(o.f.rule_id ? { rule_id: o.f.rule_id } : {}),
      evidence: o.f.evidence,
      uncertainty: o.f.uncertainty,
      refund_exposure: o.f.refund_exposure,
      customer_exposure: o.f.customer_exposure,
      assignee_id: assignee,
      label: FINDING_LABEL,
      product_codes: o.f.product_codes,
    }
  })

  // The app recalculates exposure from the finding text (src/lib/exposure.ts); it must agree with what the detectors knew.
  for (const f of findings) {
    const derived = [...findingProductCodes(f)].sort().join()
    const known = [...f.product_codes].sort().join()
    if (derived !== known) throw new Error(`${f.id} (${f.type}): products derived from its text [${derived}] differ from the detector's [${known}]`)
  }

  /* Deals: exposures, risk and status from open findings. */
  const deals: Deal[] = cores.map((c) => {
    const mine = findings.filter((f) => f.deal_id === c.id)
    const open = mine.filter((f) => f.status === 'Open' || f.status === 'In review')
    const refund = dealRefundExposure(open, finalVersion(c).products)
    const customer = open.reduce((m, f) => Math.max(m, f.customer_exposure), 0)
    const h = open.filter((f) => f.severity === 'high').length
    const m = open.filter((f) => f.severity === 'medium').length
    const risk = open.length === 0 ? idleRiskScore(c.id) : riskScore(open, customer)
    let status: DealStatus
    if (c.id === 'DT-10482') status = 'In review'
    else if (c.scenario?.key === 'H2') status = 'On hold'
    else if (h > 0 || m > 0) status = 'In review'
    else if (open.length > 0) status = Number(c.id.slice(-1)) % 2 === 0 ? 'In review' : 'Ready to fund'
    else status = c.scenario?.closeAll ? 'Funded' : 'Ready to fund'
    const versions = c.builder.versions
    return {
      id: c.id,
      dealer_id: c.dealer_id,
      customer_display: c.customer_display,
      vehicle: c.vehicle,
      lender_id: c.lender_id,
      deal_date: c.deal_date,
      status,
      fi_manager_id: JORDAN,
      salesperson_id: CHRIS,
      versions,
      current_version: versions.length,
      risk_score: risk,
      refund_exposure: refund,
      customer_exposure: roundCents(customer),
      open_findings: open.length,
    }
  })

  const refundTotal = roundCents(deals.reduce((s, d) => s + d.refund_exposure, 0))
  return { deals, cores, events, findings, benefit, pricing, refundTotal }
}

function segmentOf(v: Vehicle): string {
  const spec = Object.values(MODELS).find((m) => m.make === v.make && m.model === v.model)
  return `${v.condition === 'new' ? 'New' : 'Used'} ${spec?.segment ?? 'vehicle'}`
}

/* ------------------------------------------------------------------ */
/* Rules, blast radius, summaries, audit, notifications, stats         */
/* ------------------------------------------------------------------ */

const RULES: Rule[] = [
  {
    id: 'CA-CARS-ADDON-01',
    name: 'Add-on products must benefit the buyer',
    description:
      'A dealer may not sell an add-on product that gives the buyer no benefit, such as coverage that duplicates what the buyer already has or a product the buyer cannot use. Add-ons must be offered with their price stated separately, and changes made after the price is agreed need a clear record.',
    jurisdiction: 'California',
    source: 'California CARS Act (SB 766)',
    category: 'Add-on products',
    effective_from: '2026-10-01',
    recorded_at: '2026-09-15T16:42:00.000Z',
    version: '1.0.3',
    severity: 'high',
    status: 'Active',
    enabled: true,
  },
  {
    id: 'CA-CARS-RECORD-01',
    name: 'Keep deal records for two years',
    description:
      'Dealers must keep the records of each vehicle sale and financing transaction, including add-on offers, disclosures and signed documents, for two years and produce them on request.',
    jurisdiction: 'California',
    source: 'California CARS Act (SB 766)',
    category: 'Recordkeeping',
    effective_from: '2026-10-01',
    recorded_at: '2026-09-15T16:47:00.000Z',
    version: '1.0.1',
    severity: 'low',
    status: 'Active',
    enabled: true,
  },
  {
    id: 'CA-GAP-PRICE-01',
    name: 'GAP price within the permitted limit',
    description:
      'The price charged for a GAP waiver must stay within the limit set in Civil Code 2982.12. DealTrace compares each GAP price with the limit configured for the group and with the group median.',
    jurisdiction: 'California',
    source: 'Cal. Civil Code § 2982.12',
    category: 'GAP',
    effective_from: '2026-10-01',
    recorded_at: '2026-09-16T17:05:00.000Z',
    version: '1.1.0',
    severity: 'medium',
    status: 'Active',
    enabled: true,
  },
  {
    id: 'CA-GAP-COVERAGE-01',
    name: 'GAP coverage matches the amount financed',
    description:
      'A GAP waiver must cover the shortfall on the financed amount it is sold with. Coverage limits that leave part of the loan uncovered, or that do not match the contract term, need review.',
    jurisdiction: 'California',
    source: 'Cal. Civil Code § 2982.12',
    category: 'GAP',
    effective_from: '2026-10-01',
    recorded_at: '2026-09-16T17:11:00.000Z',
    version: '1.0.2',
    severity: 'medium',
    status: 'Active',
    enabled: true,
  },
  {
    id: 'CA-GAP-LTV-01',
    name: 'GAP must be able to benefit the buyer (loan-to-value)',
    description:
      'A GAP waiver should only be sold when the buyer could owe more than the vehicle is worth. When the loan-to-value is low, DealTrace flags the sale for review; the floor used is a group setting, not a statutory figure.',
    jurisdiction: 'California',
    source: 'Cal. Civil Code § 2982.12',
    category: 'GAP',
    effective_from: '2026-10-01',
    recorded_at: '2026-09-16T17:18:00.000Z',
    version: '1.2.0',
    severity: 'medium',
    status: 'Active',
    enabled: true,
  },
  {
    id: 'CA-GAP-DISCLOSURE-01',
    name: 'GAP disclosures and cancellation rights',
    description:
      'The buyer must receive the GAP waiver terms in writing, including that the waiver is optional and how to cancel it for a refund. A signed copy must stay in the deal jacket.',
    jurisdiction: 'California',
    source: 'Cal. Civil Code § 2982.12',
    category: 'GAP',
    effective_from: '2026-10-01',
    recorded_at: '2026-09-16T17:26:00.000Z',
    version: '1.0.4',
    severity: 'low',
    status: 'Active',
    enabled: true,
  },
  {
    id: 'TX-GAP-01',
    name: 'Texas GAP waiver terms',
    description:
      'Draft rule for Texas GAP waivers: written terms, optional purchase and refund on early payoff. Not active; Harborline has no Texas rooftops yet.',
    jurisdiction: 'Texas',
    source: 'Texas Finance Code, Chapter 354 (draft mapping)',
    category: 'GAP',
    effective_from: '2027-01-01',
    recorded_at: '2026-11-04T18:02:00.000Z',
    version: '0.3.0',
    severity: 'medium',
    status: 'Draft',
    enabled: false,
  },
  {
    id: 'TX-ADDON-01',
    name: 'Texas add-on product disclosures',
    description:
      'Draft rule for Texas add-on disclosures: each optional product priced separately and acknowledged by the buyer before signing.',
    jurisdiction: 'Texas',
    source: 'Texas Finance Code (draft mapping)',
    category: 'Add-on products',
    effective_from: '2027-01-01',
    recorded_at: '2026-11-04T18:09:00.000Z',
    version: '0.2.1',
    severity: 'medium',
    status: 'Draft',
    enabled: false,
  },
  {
    id: 'NY-ADDON-01',
    name: 'New York optional product consent',
    description:
      'Draft rule for New York: optional products need the buyer’s express consent, recorded separately from the retail installment contract.',
    jurisdiction: 'New York',
    source: 'New York Personal Property Law, Article 9 (draft mapping)',
    category: 'Add-on products',
    effective_from: '2027-03-01',
    recorded_at: '2026-11-06T17:31:00.000Z',
    version: '0.1.4',
    severity: 'medium',
    status: 'Draft',
    enabled: false,
  },
]

/** Impact of each rule's latest change on the group (an estimate), and the sentence describing that change. */
const BLAST_PLAN: Record<string, { desc: string; deals: number; dealers: number; exposure: number }> = {
  'CA-CARS-ADDON-01': { desc: 'v1.0.3 also checks add-ons added after the price is agreed, not only at signing.', deals: 37, dealers: 4, exposure: 21486.1 },
  'CA-CARS-RECORD-01': { desc: 'v1.0.1 adds the F&I menu printout and session notes to the required documents.', deals: 52, dealers: 5, exposure: 0 },
  'CA-GAP-PRICE-01': { desc: 'v1.1.0 compares GAP prices with the group median as well as the configured limit.', deals: 18, dealers: 3, exposure: 7412.66 },
  'CA-GAP-COVERAGE-01': { desc: 'v1.0.2 checks the GAP term against the final contract term after term changes.', deals: 11, dealers: 3, exposure: 4871.29 },
  'CA-GAP-LTV-01': { desc: 'v1.2.0 uses loan-to-value at signing instead of at quote.', deals: 24, dealers: 4, exposure: 9943.18 },
  'CA-GAP-DISCLOSURE-01': { desc: 'v1.0.4 requires the signed cancellation notice to be attached before funding.', deals: 14, dealers: 3, exposure: 0 },
}

function buildBlastRadius(world: World): BlastRadius[] {
  return RULES.map((r) => {
    const p = BLAST_PLAN[r.id]
    if (!p) {
      return {
        rule_id: r.id,
        change_description: `Harborline has no ${r.jurisdiction} rooftops, so enabling this draft changes no current deals.`,
        affected_deals: 0,
        affected_dealers: 0,
        estimated_refund_exposure: 0,
        sample_deal_ids: [],
      }
    }
    const sample = world.deals
      .filter((d) => world.findings.some((f) => f.deal_id === d.id && f.rule_id === r.id))
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 4)
      .map((d) => d.id)
    return { rule_id: r.id, change_description: p.desc, affected_deals: p.deals, affected_dealers: p.dealers, estimated_refund_exposure: p.exposure, sample_deal_ids: sample }
  })
}

const ACTION_BY_TYPE: Record<Finding['type'], string> = {
  LATE_ADD_ON: 'Record why each product was added after the price was agreed before funding.',
  PAYMENT_MASKING: 'Show the buyer the total of payments at both terms and get a signed acknowledgment.',
  RATE_AFTER_APPROVAL: 'Ask the lender for the approval terms and refund the rate difference if the increase is not supported.',
  WARRANTY_OVERLAP: 'Check whether the service contract can start when the factory warranty ends, or reprice it.',
  LOW_BENEFIT_GAP: 'Confirm with the buyer that GAP is still wanted at this loan-to-value; cancel and refund if not.',
  DUPLICATE_COVERAGE: 'Ask the buyer for the existing payoff coverage declaration; cancel the duplicate GAP if confirmed.',
  PRICE_OUTLIER: 'Compare the product price with the rooftop rate card and document any exception.',
  MISSING_REASON: 'Ask the F&I manager to add reasons to the unexplained changes.',
  RECORDKEEPING_GAP: 'Upload the missing document to the deal jacket.',
}

function buildSummaries(world: World): AgentSummary[] {
  const out: AgentSummary[] = []
  for (const d of world.deals) {
    const open = world.findings.filter((f) => f.deal_id === d.id && (f.status === 'Open' || f.status === 'In review'))
    if (open.length === 0) continue
    const core = world.cores.find((c) => c.id === d.id) as DealCore
    const evs = world.events.filter((e) => e.deal_id === d.id)
    const generated_at = addMinutes(open[0]?.detected_at ?? d.deal_date, 4)
    const vs = d.versions
    const first = vs[0] as DealVersion
    const last = vs[vs.length - 1] as DealVersion
    const agreed = evs.find((e) => e.type === 'PRICE_AGREED') as DealEvent
    const base = vs.filter((v) => v.created_at <= agreed.timestamp).pop() as DealVersion
    const byId = (t: Finding['type']) => open.find((f) => f.type === t)

    if (d.id === 'DT-10482') {
      // The hero answer. Every figure and id comes from the data; citations like [F-2291] link to records in the app.
      const v2 = vs[1] as DealVersion
      const v3 = vs[2] as DealVersion
      const addOns = roundCents(v2.products.reduce((sum, p) => sum + p.price, 0))
      const gap = v2.products.find((p) => p.code === 'GAP') as Product
      const vsc = v2.products.find((p) => p.code === 'VSC') as Product
      const gapCheck = world.benefit.find((b) => b.deal_id === d.id && b.product_code === 'GAP') as BenefitCheck
      const vscCheck = world.benefit.find((b) => b.deal_id === d.id && b.product_code === 'VSC') as BenefitCheck
      const late = byId('LATE_ADD_ON') as Finding
      const mask = byId('PAYMENT_MASKING') as Finding
      const overlap = byId('WARRANTY_OVERLAP') as Finding
      const missing = byId('MISSING_REASON') as Finding
      const gapEvent = evs.find((e) => e.type === 'PRODUCT_ADDED' && e.new_value === 'GAP') as DealEvent
      const vscEvent = evs.find((e) => e.type === 'PRODUCT_ADDED' && e.new_value === 'VSC') as DealEvent
      const jordan = USERS.find((u) => u.id === JORDAN) as User
      out.push({
        deal_id: d.id,
        summary: `Between v1 and v3 of ${d.id}, two add-ons (${formatMoney(addOns)} in total) were added after the price was agreed, and the term was then stretched from ${first.term_months} to ${v3.term_months} months. The monthly payment fell from ${formatMoney(v2.monthly_payment)} to ${formatMoney(v3.monthly_payment)}, but the buyer's total of payments is ${formatMoney(roundCents(v3.total_of_payments - first.total_of_payments))} higher than in the original quote. [${late.id}] [${mask.id}]`,
        key_points: [
          `GAP (${formatMoney(gap.price)}) and the service contract (${formatMoney(vsc.price)}) first appear in v2 at ${formatDateTime(v2.created_at)} PT, ${minutesBetween(agreed.timestamp, v2.created_at)} minutes after the price was agreed. [${late.id}] [event ${agreed.id}] [event ${gapEvent.id}] [event ${vscEvent.id}]`,
          `The term moved from ${v2.term_months} to ${v3.term_months} months in v3 while the payment dropped ${formatPercent((v2.monthly_payment - v3.monthly_payment) / v2.monthly_payment, 1)} from v2, which can hide the added products. [${mask.id}] [v3]`,
          `The service contract (${vsc.term_months} months / ${(vsc.max_miles ?? 0).toLocaleString('en-US')} miles) overlaps the ${core.vehicle.factory_warranty_months}-month factory warranty for its first ${vscCheck.inputs.warranty_overlap_months} months. [${overlap.id}] [rule ${overlap.rule_id}]`,
          `GAP shows a ${gapCheck.verdict.toLowerCase()} at ${formatPercent(gapCheck.inputs.ltv)} loan-to-value, but no reason is recorded for the product or term changes. [${missing.id}]`,
        ],
        suggested_actions: [
          `Confirm with ${jordan.name} why both products were added after price agreement, and document the reason.`,
          'Request a customer-benefit statement for the service contract before funding.',
          'Fix the deal record so each change carries a reason, then re-run the check.',
        ],
        tools_used: ['get_deal_versions', 'diff_versions', 'run_detectors', 'check_benefit', 'lookup_rule'],
        generated_at,
      })
      continue
    }

    const s = core.scenario as Scenario
    const sev = (['high', 'medium', 'low'] as Severity[])
      .map((x) => ({ x, n: open.filter((f) => f.severity === x).length }))
      .filter((o) => o.n > 0)
      .map((o) => `${o.n} ${o.x}`)
      .join(', ')
    const top = [...open].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.customer_exposure - a.customer_exposure)[0] as Finding
    const late = byId('LATE_ADD_ON')
    const rate = byId('RATE_AFTER_APPROVAL')
    const mask = byId('PAYMENT_MASKING')

    let summary: string
    let keyPoints: string[]
    if (s.key === 'H1' || s.key === 'H2' || s.key === 'H3') {
      const lateVersion = vs.find((v) => v.label === 'Add-ons added') as DealVersion
      const added = lateVersion.products.filter((p) => !base.products.some((b) => b.code === p.code))
      const addedText = added.map((p) => `${productNameInSentence(p.code)} (${formatMoney(p.price)})`).join(' and ')
      const parts = [`The ${addedText} ${added.length > 1 ? 'were' : 'was'} added ${minutesBetween(agreed.timestamp, lateVersion.created_at)} minutes after the price was agreed.`]
      if (mask) parts.push(`The term then went from ${base.term_months} to ${last.term_months} months, so the payment moved only from ${formatMoney(base.monthly_payment)} to ${formatMoney(last.monthly_payment)}.`)
      if (rate) parts.push(`After approval at ${formatApr(base.apr)}, the APR was raised to ${formatApr(last.apr)}, adding ${formatMoney(rate.refund_exposure)} in finance charges.`)
      parts.push(`Total of payments rose from ${formatMoney(base.total_of_payments)} to ${formatMoney(last.total_of_payments)}.`)
      summary = `${parts.join(' ')} ${[late, mask, rate].filter((f): f is StoredFinding => Boolean(f)).map((f) => `[${f.id}]`).join(' ')}`
      keyPoints = [
        `Price agreed at ${formatTime(agreed.timestamp)}: ${formatMoney(base.amount_financed)} over ${base.term_months} months at ${formatApr(base.apr)}.`,
        ...(late ? [`${late.title}. [${late.id}]`] : []),
        ...(mask ? [`${mask.title}. [${mask.id}]`] : []),
        ...(rate ? [`${rate.title}. [${rate.id}]`] : []),
        `Signed at ${formatTime(last.created_at)}: ${formatMoney(last.monthly_payment)} a month for ${last.term_months} months.`,
      ]
    } else {
      summary = `${d.id} has ${open.length} open ${open.length === 1 ? 'finding' : 'findings'} (${sev}). The most significant: ${lowerFirst(top.title)}.${d.refund_exposure > 0 ? ` Potential refund exposure is ${formatMoney(d.refund_exposure)}.` : ''} [${top.id}]`
      keyPoints = open.map((f) => `${f.title}. [${f.id}]`)
    }
    const actions = [...new Set(open.map((f) => ACTION_BY_TYPE[f.type]))]
    const tools = ['get_deal_versions', 'run_detectors']
    if (open.some((f) => ['WARRANTY_OVERLAP', 'LOW_BENEFIT_GAP', 'DUPLICATE_COVERAGE'].includes(f.type))) tools.push('check_benefit')
    if (open.some((f) => f.type === 'PRICE_OUTLIER')) tools.push('pricing_dispersion')
    if (open.some((f) => f.type === 'LATE_ADD_ON' || f.type === 'PAYMENT_MASKING')) tools.splice(1, 0, 'diff_versions')
    tools.push('lookup_rule')
    out.push({ deal_id: d.id, summary, key_points: keyPoints, suggested_actions: actions, tools_used: tools, generated_at })
  }
  return out
}

function buildAudit(rng: Rng, world: World): AuditEvent[] {
  type Raw = Omit<AuditEvent, 'id' | 'hash' | 'prev_hash'>
  const raw: Raw[] = []
  const push = (timestamp: string, actor_id: string, action: string, entity: string, entity_id: string) => raw.push({ timestamp, actor_id, action, entity, entity_id })

  for (const r of RULES) push(r.recorded_at, PRIYA, r.status === 'Active' ? 'Rule published' : 'Rule drafted', 'rule', r.id)
  // Sign-ins on weekdays, Oct 1 to Nov 12.
  for (let day = new Date('2026-10-01T12:00:00Z'); day <= new Date('2026-11-12T12:00:00Z'); day = new Date(day.getTime() + 86400000)) {
    const date = day.toISOString().slice(0, 10)
    const dow = day.getUTCDay()
    if (dow === 0 || dow === 6) continue
    push(pacificToIso(date, 8 * 60 + rng.int(14, 52)), PRIYA, 'Signed in', 'user', PRIYA)
    push(pacificToIso(date, 8 * 60 + rng.int(20, 58)), MARCUS, 'Signed in', 'user', MARCUS)
    if (rng.chance(0.55)) push(pacificToIso(date, 9 * 60 + rng.int(0, 40)), ELENA, 'Signed in', 'user', ELENA)
  }
  for (const d of world.deals) {
    const last = d.versions[d.versions.length - 1] as DealVersion
    push(addMinutes(last.created_at, 1), SYSTEM_ACTOR_ID, 'Deal scanned', 'deal', d.id)
  }
  for (const f of world.findings) {
    push(f.detected_at, SYSTEM_ACTOR_ID, 'Finding created', 'finding', f.id)
    if (f.status === 'In review') push(addMinutes(f.detected_at, rng.int(18, 95)), PRIYA, 'Finding assigned', 'finding', f.id)
    if (f.status === 'Resolved' || f.status === 'Dismissed') {
      push(addMinutes(f.detected_at, rng.int(131, 263)), f.severity === 'high' ? PRIYA : MARCUS, f.status === 'Resolved' ? 'Decision recorded: approve' : 'Decision recorded: dismiss', 'finding', f.id)
    }
  }
  for (const d of world.deals.filter((x) => x.status === 'Funded')) {
    push(addMinutes(d.versions[d.versions.length - 1]?.created_at ?? '', rng.int(1440, 2880)), ELENA, 'Deal funded', 'deal', d.id)
  }
  const reports = ['RPT-1107', 'RPT-1114', 'RPT-1121', 'RPT-1128', 'RPT-1104']
  reports.forEach((id, i) => push(pacificToIso(`2026-${i === 4 ? '11' : '10'}-${['09', '16', '23', '30', '06'][i]}`, 16 * 60 + rng.int(5, 50)), PRIYA, 'Report exported', 'report', id))
  // Reviewers opening deals, until the log has 297 entries.
  const dealIds = world.deals.map((d) => d.id)
  while (raw.length < 297) {
    const pickedId = rng.pick(dealIds)
    const d = world.deals.find((x) => x.id === pickedId) as Deal
    const last = d.versions[d.versions.length - 1] as DealVersion
    push(addMinutes(last.created_at, rng.int(30, 4000)), rng.chance(0.6) ? PRIYA : MARCUS, 'Deal viewed', 'deal', d.id)
  }
  raw.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.entity_id.localeCompare(b.entity_id))
  return chain<AuditEvent>(raw.map((r, i) => ({ id: `AU-${30417 + i}`, ...r })))
}

const CHANGE_NOTES = {
  first: 'Initial version drafted from the published text',
  patch: [
    'Clarified the wording of the clause summary',
    'Corrected the source reference',
    'Added examples to the clause summary',
    'Aligned terms with the group glossary',
    'Reworded the scope note',
  ],
  minor: [
    'Added a check for changes made after the price is agreed',
    'Added a group-level threshold setting',
    'Extended the check to used vehicles',
    'Split the rule from a combined GAP rule',
  ],
}

/** Versions before the current one: step back one patch at a time, then one minor version, down to x.0.0. */
function earlierVersions(current: string): string[] {
  const [a = 0, b = 0, c = 0] = current.split('.').map(Number)
  const out: string[] = []
  const maj = a
  let min = b
  let pat = c
  while (out.length < 4 && !(min === 0 && pat === 0)) {
    if (pat > 0) pat -= 1
    else {
      min -= 1
      pat = 0
    }
    out.push(`${maj}.${min}.${pat}`)
  }
  // A 0.x rule starts at 0.1.0; there is no 0.0.0.
  return out.filter((v) => v !== '0.0.0').reverse()
}

/** Version history per rule: the current version is recorded when the rule was, earlier ones a few days apart before it. */
function buildRuleVersions(rng: Rng): RuleVersion[] {
  const out: RuleVersion[] = []
  for (const rule of RULES) {
    const past = earlierVersions(rule.version)
    const recordedDate = pacificDateOf(rule.recorded_at)
    let day = recordedDate
    const entries: { version: string; recorded_at: string; change: string; actor_id: string }[] = [
      { version: rule.version, recorded_at: rule.recorded_at, change: '', actor_id: PRIYA },
    ]
    for (let i = past.length - 1; i >= 0; i--) {
      day = shiftDate(day, -rng.int(3, 9))
      entries.unshift({ version: past[i] as string, recorded_at: pacificToIso(day, rng.int(9 * 60 + 5, 16 * 60 + 40)), change: '', actor_id: rng.chance(0.7) ? PRIYA : MARCUS })
    }
    const used = new Set<string>()
    // The current version's note is what the blast radius data says that version changed.
    const latest = BLAST_PLAN[rule.id]?.desc.replace(/^v\d+\.\d+\.\d+ /, '')
    entries.forEach((e, i) => {
      const [, min = 0, pat = 0] = e.version.split('.').map(Number)
      const pool = i === 0 ? [CHANGE_NOTES.first] : pat === 0 && min > 0 ? CHANGE_NOTES.minor : CHANGE_NOTES.patch
      const fresh = pool.filter((n) => !used.has(n))
      const note = (fresh.length > 0 ? rng.pick(fresh) : rng.pick(pool)) as string
      e.change = i === entries.length - 1 && latest ? latest.charAt(0).toUpperCase() + latest.slice(1) : note
      used.add(e.change)
      out.push({ rule_id: rule.id, version: e.version, recorded_at: e.recorded_at, change: e.change, actor_id: e.actor_id })
    })
  }
  return out
}

function pacificDateOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

function shiftDate(date: string, days: number): string {
  return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10)
}

function buildNotifications(world: World): AppNotification[] {
  const hero = world.findings.filter((f) => f.deal_id === 'DT-10482')
  const heroLate = hero.find((f) => f.type === 'LATE_ADD_ON') as Finding
  const rate = world.findings.find((f) => f.type === 'RATE_AFTER_APPROVAL' && f.status !== 'Resolved') as Finding
  const lowGap = world.findings.find((f) => f.type === 'LOW_BENEFIT_GAP') as Finding
  const resolvedHigh = world.findings.find((f) => f.severity === 'high' && f.status === 'Resolved') as Finding
  const dup = world.findings.find((f) => f.type === 'DUPLICATE_COVERAGE') as Finding
  return [
    { id: 'N-0815', kind: 'finding', title: `${heroLate.id} needs review on DT-10482`, body: `Late add-on: GAP waiver and service contract added after price agreed. Refund exposure ${formatMoney(heroLate.refund_exposure)}.`, created_at: '2026-11-12T19:14:00.000Z', read: false, href: `/findings/${heroLate.id}` },
    { id: 'N-0814', kind: 'finding', title: `APR raised after approval on ${rate.deal_id}`, body: `${rate.title}. Marcus Reed is reviewing.`, created_at: '2026-11-12T17:02:00.000Z', read: false, href: `/findings/${rate.id}` },
    { id: 'N-0813', kind: 'decision', title: `Elena Torres is waiting on ${heroLate.deal_id}`, body: 'Pacific Crest Credit Union funding is on hold until the open findings have a decision.', created_at: '2026-11-11T22:37:00.000Z', read: false, href: '/deals/DT-10482' },
    { id: 'N-0812', kind: 'finding', title: `Low-benefit GAP on ${lowGap.deal_id}`, body: `${lowGap.title}. Benefit check: little or no benefit.`, created_at: '2026-11-11T18:20:00.000Z', read: false, href: `/findings/${lowGap.id}` },
    { id: 'N-0811', kind: 'rule', title: 'Draft rule NY-ADDON-01 recorded', body: 'New York optional product consent, v0.1.4. Not active.', created_at: '2026-11-06T17:31:00.000Z', read: true, href: '/rules/NY-ADDON-01/blast-radius' },
    { id: 'N-0810', kind: 'report', title: 'Accuracy report for synthetic test set v3', body: 'F1 0.893 on 480 deals, up from 0.862 on test set v2.', created_at: '2026-11-09T21:05:00.000Z', read: false, href: '/insights/accuracy' },
    { id: 'N-0809', kind: 'decision', title: `${resolvedHigh.id} resolved before funding`, body: `${resolvedHigh.title}. Decision recorded by Priya Shah.`, created_at: '2026-11-05T20:48:00.000Z', read: true, href: `/findings/${resolvedHigh.id}` },
    { id: 'N-0808', kind: 'finding', title: `Duplicate GAP coverage on ${dup.deal_id}`, body: `${dup.title}.`, created_at: '2026-11-03T23:12:00.000Z', read: true, href: `/findings/${dup.id}` },
  ]
}

function buildScanStats(rng: Rng, world: World): ScanStats {
  const weights: [string, number][] = [['DLR-01', 0.27], ['DLR-02', 0.16], ['DLR-03', 0.21], ['DLR-04', 0.17], ['DLR-05', 0.19]]
  const daily: ScanStats['daily'] = []
  const end = new Date('2026-11-12T12:00:00Z').getTime()
  for (let i = 59; i >= 0; i--) {
    const date = new Date(end - i * 86400000).toISOString().slice(0, 10)
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay()
    const dayFactor = dow === 6 ? 1.31 : dow === 0 ? 0.74 : 1
    const base = (i >= 30 ? 38.2 : 42.8) * dayFactor
    const by_dealer: Record<string, number> = {}
    for (const [id, w] of weights) by_dealer[id] = Math.max(1, Math.round(base * w * rng.float(0.78, 1.22, 3)))
    daily.push({ date, by_dealer })
  }
  // Make the last 30 days add up to exactly 1,284 and the 30 before to 1,147.
  const fix = (from: number, to: number, target: number) => {
    let sum = 0
    for (let i = from; i < to; i++) sum += Object.values(daily[i]?.by_dealer ?? {}).reduce((a, b) => a + b, 0)
    let diff = target - sum
    let k = from
    while (diff !== 0) {
      const day = daily[k] as ScanStats['daily'][number]
      const id = (weights[k % weights.length] as [string, number])[0]
      const step = diff > 0 ? 1 : -1
      if ((day.by_dealer[id] ?? 0) + step >= 1) {
        day.by_dealer[id] = (day.by_dealer[id] ?? 0) + step
        diff -= step
      }
      k = k + 1 >= to ? from : k + 1
    }
  }
  fix(0, 30, 1147)
  fix(30, 60, TARGET.dealsScanned30d)

  const open = world.findings.filter((f) => f.status === 'Open' || f.status === 'In review')
  const current = (dealerId: string) => {
    const deals = world.deals.filter((d) => dealerId === 'all' || d.dealer_id === dealerId)
    const ids = new Set(deals.map((d) => d.id))
    const o = open.filter((f) => ids.has(f.deal_id))
    return {
      open_findings: o.length,
      high_severity_open: o.filter((f) => f.severity === 'high').length,
      refund_exposure: roundCents(deals.reduce((s, d) => s + d.refund_exposure, 0)),
    }
  }
  const median30: Record<string, number> = { all: TARGET.medianDecisionMinutes, 'DLR-01': 178, 'DLR-02': 214, 'DLR-03': 187, 'DLR-04': 203, 'DLR-05': 196 }
  const median7: Record<string, number> = { all: 171, 'DLR-01': 163, 'DLR-02': 197, 'DLR-03': 158, 'DLR-04': 184, 'DLR-05': 176 }
  const prior30: Record<string, ScanStats['prior']['30d'][string]> = {
    all: { open_findings: 54, high_severity_open: 11, refund_exposure: 43617.85, median_decision_minutes: 241 },
  }
  const prior7: Record<string, ScanStats['prior']['7d'][string]> = {
    all: { open_findings: 58, high_severity_open: 10, refund_exposure: 46233.17, median_decision_minutes: 188 },
  }
  for (const [id] of weights) {
    const c = current(id)
    const f30 = rng.float(0.78, 1.21, 3)
    const f7 = rng.float(0.86, 1.12, 3)
    prior30[id] = {
      open_findings: Math.max(0, Math.round(c.open_findings * f30)),
      high_severity_open: Math.max(0, Math.round(c.high_severity_open * rng.float(0.7, 1.5, 3))),
      refund_exposure: roundCents(c.refund_exposure * f30),
      median_decision_minutes: Math.round((median30[id] ?? 192) * rng.float(1.08, 1.32, 3)),
    }
    prior7[id] = {
      open_findings: Math.max(0, Math.round(c.open_findings * f7)),
      high_severity_open: c.high_severity_open,
      refund_exposure: roundCents(c.refund_exposure * f7),
      median_decision_minutes: Math.round((median7[id] ?? 171) * rng.float(1.02, 1.16, 3)),
    }
  }
  return { as_of: '2026-11-12', daily, median_decision_minutes: { '7d': median7, '30d': median30 }, prior: { '7d': prior7, '30d': prior30 } }
}

const METRICS: Metrics = {
  dataset: 'Synthetic test set v3 (480 deals)',
  overall: { precision: 0.912, recall: 0.874, f1: 0.893 },
  per_detector: [
    { detector: 'Late add-on', precision: 0.951, recall: 0.913, f1: 0.932, support: 58 },
    { detector: 'Payment masking', precision: 0.907, recall: 0.869, f1: 0.888, support: 41 },
    { detector: 'Rate after approval', precision: 0.889, recall: 0.851, f1: 0.87, support: 29 },
    { detector: 'Missing reason', precision: 0.901, recall: 0.863, f1: 0.882, support: 39 },
  ],
  confusion_matrix: { tp: 146, fp: 14, fn: 21, tn: 299 },
  history: [
    { dataset: 'Synthetic test set v1 (240 deals)', f1: 0.811, evaluated_at: '2026-09-08T18:20:00.000Z' },
    { dataset: 'Synthetic test set v2 (360 deals)', f1: 0.862, evaluated_at: '2026-10-02T17:45:00.000Z' },
    { dataset: 'Synthetic test set v3 (480 deals)', f1: 0.893, evaluated_at: '2026-11-09T21:05:00.000Z' },
  ],
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function assertMetrics(m: Accuracy): void {
  const { tp, fp, fn, tn } = m.confusion_matrix
  const close = (a: number, b: number) => Math.abs(a - b) < 0.0006
  const avg = (k: 'precision' | 'recall' | 'f1') => m.per_detector.reduce((s, r) => s + r[k], 0) / m.per_detector.length
  if (tp + fp + fn + tn !== 480) throw new Error('Confusion matrix must cover 480 deals')
  if (!close(tp / (tp + fp), m.overall.precision) || !close(tp / (tp + fn), m.overall.recall)) throw new Error('Confusion matrix does not match precision/recall')
  if (!close((2 * tp) / (2 * tp + fp + fn), m.overall.f1)) throw new Error('Confusion matrix does not match F1')
  if (!close(avg('precision'), m.overall.precision) || !close(avg('recall'), m.overall.recall) || !close(avg('f1'), m.overall.f1)) throw new Error('Per-detector rows do not average to the overall values')
  if (m.per_detector.reduce((s, r) => s + r.support, 0) !== tp + fn) throw new Error('Per-detector support must add up to tp + fn')
}

function main(): void {
  assertMetrics(METRICS)

  let delta = 0
  let world = buildWorld(delta)
  for (let i = 0; i < 6 && world.refundTotal !== TARGET.refundExposure; i++) {
    delta = roundCents(delta + (TARGET.refundExposure - world.refundTotal))
    if (process.env.SEED_DEBUG) console.error(`refund ${world.refundTotal} -> delta ${delta}`)
    world = buildWorld(delta)
  }

  const open = world.findings.filter((f) => f.status === 'Open' || f.status === 'In review')
  const checks: [string, number, number][] = [
    ['deals', world.deals.length, TARGET.deals],
    ['findings', world.findings.length, TARGET.findings],
    ['open findings', open.length, TARGET.open],
    ['open high severity', open.filter((f) => f.severity === 'high').length, TARGET.highOpen],
    ['refund exposure', world.refundTotal, TARGET.refundExposure],
  ]
  for (const [name, got, want] of checks) if (got !== want) throw new Error(`${name}: got ${got}, expected ${want}`)

  const hero = world.deals.find((d) => d.id === 'DT-10482') as Deal
  const heroFindings = world.findings.filter((f) => f.deal_id === hero.id)
  const heroExpect = [
    ['F-2291', 'LATE_ADD_ON', 'high'],
    ['F-2292', 'PAYMENT_MASKING', 'high'],
    ['F-2293', 'WARRANTY_OVERLAP', 'medium'],
    ['F-2294', 'MISSING_REASON', 'low'],
  ]
  if (heroFindings.map((f) => `${f.id}:${f.type}:${f.severity}`).join() !== heroExpect.map((e) => e.join(':')).join()) {
    throw new Error(`Hero findings are ${heroFindings.map((f) => `${f.id}:${f.type}:${f.severity}`).join()}`)
  }
  if (hero.refund_exposure !== 3300 || hero.customer_exposure !== 5418.96 || hero.risk_score !== 87 || hero.status !== 'In review') {
    throw new Error(`Hero totals are refund ${hero.refund_exposure}, customer ${hero.customer_exposure}, risk ${hero.risk_score}, status ${hero.status}`)
  }
  const heroBenefit = world.benefit.filter((b) => b.deal_id === hero.id)
  const gapB = heroBenefit.find((b) => b.product_code === 'GAP')
  const vscB = heroBenefit.find((b) => b.product_code === 'VSC')
  if (gapB?.verdict !== 'Likely benefit' || formatPercent(gapB.inputs.ltv) !== '92%' || vscB?.verdict !== 'Partial benefit') {
    throw new Error('Hero benefit checks do not match docs/DATA.md')
  }

  const rng = createRng(SEED + 1)
  const blast = buildBlastRadius(world)
  const summaries = buildSummaries(world)
  const audit = buildAudit(rng, world)
  const notifications = buildNotifications(world)
  const scanStats = buildScanStats(rng, world)
  const ruleVersions = buildRuleVersions(createRng(SEED + 2))

  const findingsOut: Finding[] = world.findings.map(({ product_codes: _codes, ...f }) => f)

  const files: Record<string, unknown> = {
    'users.json': USERS,
    'dealers.json': DEALERS,
    'lenders.json': LENDERS,
    'providers.json': PROVIDERS,
    'deals.json': world.deals,
    'events.json': world.events,
    'findings.json': findingsOut,
    'benefit_checks.json': world.benefit,
    'rules.json': RULES,
    'rule_versions.json': ruleVersions,
    'blast_radius.json': blast,
    'agent_summaries.json': summaries,
    'pricing.json': world.pricing,
    'metrics.json': METRICS,
    'audit.json': audit,
    'notifications.json': notifications,
    'scan_stats.json': scanStats,
  }
  mkdirSync(OUT_DIR, { recursive: true })
  for (const [name, data] of Object.entries(files)) writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`)

  const sev = (s: Severity) => world.findings.filter((f) => f.severity === s).length
  const lines = [
    `deals ${world.deals.length} · events ${world.events.length} · findings ${world.findings.length} (open ${open.length}; high ${sev('high')}, medium ${sev('medium')}, low ${sev('low')})`,
    `open high ${open.filter((f) => f.severity === 'high').length} · refund exposure ${formatMoney(world.refundTotal)} (tuning ${formatMoney(delta)})`,
    `benefit checks ${world.benefit.length} · pricing ${world.pricing.length} · summaries ${summaries.length} · audit ${audit.length} · notifications ${notifications.length}`,
    `add-ons per deal ${(world.deals.reduce((s, d) => s + (d.versions[d.versions.length - 1]?.products.length ?? 0), 0) / world.deals.length).toFixed(2)} · GAP ${world.deals.filter((d) => d.versions[d.versions.length - 1]?.products.some((p) => p.code === 'GAP')).length} · VSC ${world.deals.filter((d) => d.versions[d.versions.length - 1]?.products.some((p) => p.code === 'VSC')).length}`,
    `finding types: ${Object.entries(FINDING_TYPE_LABELS).map(([t, l]) => `${l} ${world.findings.filter((f) => f.type === t).length}`).join(', ')}`,
  ]
  console.log(`Wrote ${Object.keys(files).length} files to src/mocks/data\n${lines.join('\n')}`)
}

main()
