import { describe, expect, it } from 'vitest'

import { formatAge, formatDateTime, formatDuration, formatMoney, formatShortDate, pacificDate } from '@/lib/format'

describe('format helpers', () => {
  it('formats money, dates and durations as in docs/DESIGN.md', () => {
    expect(formatMoney(48920.4)).toBe('$48,920.40')
    expect(formatDateTime('2026-10-20T17:40:00.000Z')).toBe('Oct 20, 2026, 10:40 AM')
    expect(formatDuration(192)).toBe('3h 12m')
  })

  it('returns the Pacific calendar day, not the UTC day', () => {
    expect(pacificDate('2026-10-21T02:30:00.000Z')).toBe('2026-10-20')
    expect(pacificDate('2026-11-13T07:59:00.000Z')).toBe('2026-11-12')
    expect(formatShortDate('2026-10-14')).toBe('Oct 14')
  })

  it('formats age in minutes, hours and days, never negative', () => {
    const now = new Date('2026-11-16T20:00:00.000Z').getTime()
    expect(formatAge('2026-11-16T19:15:00.000Z', now)).toBe('45m')
    expect(formatAge('2026-11-16T13:00:00.000Z', now)).toBe('7h')
    expect(formatAge('2026-10-20T17:42:00.000Z', now)).toBe('27d')
    expect(formatAge('2026-12-01T00:00:00.000Z', now)).toBe('0m')
  })
})
