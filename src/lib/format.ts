export const APP_TIME_ZONE = 'America/Los_Angeles'

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
})

/** Newer ICU versions put a narrow no-break space before AM/PM; normalise to a plain space. */
function normaliseSpaces(s: string): string {
  return s.replace(/[\u202f\u00a0]/g, ' ')
}

/** $31,300.00 */
export function formatMoney(value: number): string {
  return moneyFormatter.format(value)
}

/** +$5,418.96 or −$19.14 */
export function formatSignedMoney(value: number): string {
  if (value === 0) return formatMoney(0)
  const sign = value > 0 ? '+' : '−'
  return `${sign}${formatMoney(Math.abs(value))}`
}

/** 7.9 -> 7.9%, 7 -> 7.0%, 7.25 -> 7.25% */
export function formatApr(value: number): string {
  return `${value.toFixed(2).replace(/0$/, '')}%`
}

/** 0.921 -> 92% */
export function formatPercent(ratio: number, decimals = 0): string {
  return `${(ratio * 100).toFixed(decimals)}%`
}

/** Oct 20, 2026, 10:40 AM (Pacific time) */
export function formatDateTime(iso: string): string {
  return normaliseSpaces(dateTimeFormatter.format(new Date(iso)))
}

/** Oct 20, 2026 (Pacific time). Accepts a full ISO timestamp or a YYYY-MM-DD date. */
export function formatDate(isoOrDate: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate) ? new Date(`${isoOrDate}T12:00:00Z`) : new Date(isoOrDate)
  return normaliseSpaces(dateFormatter.format(d))
}

/** 10:40 AM (Pacific time) */
export function formatTime(iso: string): string {
  return normaliseSpaces(timeFormatter.format(new Date(iso)))
}

/** 192 -> 3h 12m */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

/** 1284 -> 1,284 */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

/**
 * Pacific wall-clock time to a UTC ISO string.
 * Covers the 2026 demo window: PDT (UTC−7) until Nov 1, 2026 02:00, PST (UTC−8) after.
 */
export function pacificToIso(date: string, minutesFromMidnight: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const offsetHours = date >= '2026-11-01' || date < '2026-03-08' ? 8 : 7
  const h = Math.floor(minutesFromMidnight / 60)
  const min = minutesFromMidnight % 60
  return new Date(Date.UTC(y, m - 1, d, h + offsetHours, min)).toISOString()
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000)
}

const pacificDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Pacific calendar day of a timestamp as YYYY-MM-DD. */
export function pacificDate(iso: string): string {
  return pacificDateFormatter.format(new Date(iso))
}

/** "Oct 14" from YYYY-MM-DD, for chart axes. */
export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`))
}

/** How long ago: 45m, 7h, 27d. Never negative. */
export function formatAge(iso: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

/** "Harborline Motors San Jose" -> "San Jose". For chart axes where the full name will not fit. */
export function rooftopShortName(name: string): string {
  return name.replace(/^.*\b(?:Motors|Auto)\s+/, '')
}

/** First characters of a SHA-256 hash, for display. The full hash is what gets copied. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…`
}
