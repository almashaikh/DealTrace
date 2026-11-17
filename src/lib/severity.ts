import type { Severity } from '@/types'

/** Text colour plus a 10% tint per severity, never a solid fill. Class names are written out so Tailwind can see them. */
export const SEVERITY_TINT: Record<Severity, string> = {
  critical: 'bg-sev-critical/10 text-sev-critical',
  high: 'bg-sev-high/10 text-sev-high',
  medium: 'bg-sev-medium/10 text-sev-medium',
  low: 'bg-sev-low/10 text-sev-low',
}
