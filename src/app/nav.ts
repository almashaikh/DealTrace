import {
  Car,
  ChartScatter,
  DatabaseZap,
  FlaskConical,
  LayoutDashboard,
  ListChecks,
  Scale,
  ScrollText,
  Settings,
  Target,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Path prefixes that keep this item highlighted (a finding belongs to the review queue). */
  match: string[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard, match: ['/'] }] },
  {
    label: 'Review',
    items: [
      { label: 'Review queue', to: '/queue', icon: ListChecks, match: ['/queue', '/findings'] },
      { label: 'Deals', to: '/deals', icon: Car, match: ['/deals'] },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { label: 'Rules', to: '/rules', icon: Scale, match: ['/rules'] },
      { label: 'Audit log', to: '/audit', icon: ScrollText, match: ['/audit'] },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Pricing dispersion', to: '/insights/pricing', icon: ChartScatter, match: ['/insights/pricing'] },
      { label: 'Accuracy', to: '/insights/accuracy', icon: Target, match: ['/insights/accuracy'] },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Live sandbox', to: '/tools/sandbox', icon: FlaskConical, match: ['/tools/sandbox'] },
      { label: 'Synthetic data', to: '/tools/synthetic', icon: DatabaseZap, match: ['/tools/synthetic'] },
    ],
  },
]

export const SETTINGS_ITEM: NavItem = { label: 'Settings', to: '/settings', icon: Settings, match: ['/settings'] }

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/'
  return item.match.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
