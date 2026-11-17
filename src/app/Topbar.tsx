import { Search } from 'lucide-react'

import { NotificationsMenu } from '@/app/NotificationsMenu'
import { RooftopSwitcher } from '@/app/RooftopSwitcher'
import { UserMenu } from '@/app/UserMenu'
import { PALETTE_KEY_LABEL } from '@/app/platform'

export function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-surface px-4">
      <RooftopSwitcher />
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Search deals, findings and rules"
        aria-keyshortcuts="Control+K Meta+K"
        className="flex h-8 w-full max-w-[420px] items-center gap-2 rounded-md border bg-surface px-3 text-[13px] leading-[18px] text-text-muted transition-colors outline-none hover:bg-app focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-left">Search deals, findings, rules</span>
        <kbd className="rounded-md border bg-app px-1.5 py-0.5 font-mono text-[11px] leading-none">{PALETTE_KEY_LABEL}</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2">
        <NotificationsMenu />
        <UserMenu />
      </div>
    </div>
  )
}
