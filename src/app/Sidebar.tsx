import { CircleHelp, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { NAV_GROUPS, SETTINGS_ITEM, isActive, type NavItem } from '@/app/nav'
import { useDealerParam } from '@/app/useDealerParam'
import { Wordmark } from '@/components/common/Wordmark'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenHelp: () => void
}

const ITEM_BASE =
  'flex h-8 w-full items-center gap-2.5 rounded-md px-3 text-[13px] leading-[18px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-brand'

function WithTooltip({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  if (!show) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function SidebarLink({ item, active, collapsed, search }: { item: NavItem; active: boolean; collapsed: boolean; search: string }) {
  const Icon = item.icon
  return (
    <WithTooltip label={item.label} show={collapsed}>
      <Link
        to={{ pathname: item.to, search }}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cn(ITEM_BASE, collapsed && 'justify-center px-0', active ? 'bg-brand-subtle font-medium text-brand' : 'text-text hover:bg-app')}
      >
        <Icon className={cn('size-4 shrink-0', !active && 'text-text-muted')} aria-hidden="true" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </WithTooltip>
  )
}

function SidebarButton({
  label,
  icon: Icon,
  collapsed,
  onClick,
}: {
  label: string
  icon: NavItem['icon']
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <WithTooltip label={label} show={collapsed}>
      <button
        type="button"
        onClick={onClick}
        aria-label={collapsed ? label : undefined}
        className={cn(ITEM_BASE, collapsed && 'justify-center px-0', 'text-text hover:bg-app')}
      >
        <Icon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    </WithTooltip>
  )
}

export function Sidebar({ collapsed, onToggle, onOpenHelp }: SidebarProps) {
  const { pathname } = useLocation()
  const { search } = useDealerParam()

  return (
    <aside
      aria-label="Primary"
      className={cn('flex h-full shrink-0 flex-col border-r bg-surface transition-[width] duration-200 ease-out', collapsed ? 'w-14' : 'w-60')}
    >
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <Link to={{ pathname: '/', search }} className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label="DealTrace dashboard">
          <Wordmark markOnly={collapsed} />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn(gi === 0 ? 'pt-3' : collapsed ? 'pt-2' : 'pt-4')}>
            {collapsed ? (
              gi > 0 && <div className="mx-3 mb-2 border-t" role="presentation" />
            ) : (
              <p className="px-3 pb-1 text-xs leading-4 font-medium text-text-muted">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <SidebarLink item={item} active={isActive(item, pathname)} collapsed={collapsed} search={search} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t p-2">
        <SidebarLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM, pathname)} collapsed={collapsed} search={search} />
        <SidebarButton label="Help" icon={CircleHelp} collapsed={collapsed} onClick={onOpenHelp} />
        <SidebarButton
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          collapsed={collapsed}
          onClick={onToggle}
        />
      </div>
    </aside>
  )
}
