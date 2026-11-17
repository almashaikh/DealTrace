/** Preferences saved on this device (prototype: no server). */
const KEY = 'dealtrace.settings.v1'

export interface NotificationPrefs {
  newHighFinding: boolean
  decisionRecorded: boolean
  ruleChange: boolean
  weeklyReport: boolean
  channelEmail: boolean
}

export interface AppSettings {
  displayName: string
  timeZone: string
  rooftopsInScope: Record<string, boolean>
  rulePacks: Record<string, boolean>
  notifications: NotificationPrefs
}

export const TIME_ZONES = ['America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York'] as const

export const RULE_PACKS: { id: string; name: string; detail: string; comingSoon: boolean }[] = [
  { id: 'ca-cars', name: 'California CARS Act', detail: 'Add-on and pricing rules for California dealers', comingSoon: false },
  { id: 'ca-gap', name: 'California GAP rules (Civil Code 2982.12)', detail: 'GAP waiver disclosure and cancellation rules', comingSoon: false },
  { id: 'tx', name: 'Texas', detail: 'State rule pack', comingSoon: true },
  { id: 'ny', name: 'New York', detail: 'State rule pack', comingSoon: true },
]

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newHighFinding: true,
  decisionRecorded: true,
  ruleChange: true,
  weeklyReport: false,
  channelEmail: false,
}

export function defaultSettings(userName: string): AppSettings {
  return {
    displayName: userName,
    timeZone: 'America/Los_Angeles',
    rooftopsInScope: {},
    rulePacks: { 'ca-cars': true, 'ca-gap': true, tx: false, ny: false },
    notifications: DEFAULT_NOTIFICATION_PREFS,
  }
}

export function loadSettings(userName: string): AppSettings {
  const base = defaultSettings(userName)
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      ...base,
      ...parsed,
      rulePacks: { ...base.rulePacks, ...parsed.rulePacks },
      notifications: { ...base.notifications, ...parsed.notifications },
    }
  } catch {
    return base
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Storage can be blocked; the page keeps working for this session.
  }
}

export function clearSettings(): void {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
