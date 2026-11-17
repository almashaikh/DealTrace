import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, LogOut, Scale, ShieldAlert, Store, Car, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from '@/app/nav'
import { useDealers } from '@/app/queries'
import { useDealerParam } from '@/app/useDealerParam'
import { useSignOut } from '@/app/useSignOut'
import { api } from '@/lib/api'
import type { SearchResult } from '@/types'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PAGES: { item: NavItem; group: string }[] = [
  ...NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ item, group: g.label }))),
  { item: SETTINGS_ITEM, group: 'Account' },
]

const RESULT_ICON: Record<SearchResult['kind'], LucideIcon> = { deal: Car, finding: ShieldAlert, rule: Scale, dealer: Store }
const RESULT_HEADING: { kind: SearchResult['kind']; heading: string }[] = [
  { kind: 'deal', heading: 'Deals' },
  { kind: 'finding', heading: 'Findings' },
  { kind: 'rule', heading: 'Rules' },
  { kind: 'dealer', heading: 'Rooftops in deals' },
]

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded-md border bg-app px-1.5 py-0.5 font-mono text-[11px] leading-none text-text-muted">{keys}</kbd>
      {label}
    </span>
  )
}

/** Ctrl/Cmd+K. Jumps to a page, switches rooftop or signs out. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { data: dealers } = useDealers()
  const { dealerId, search, setDealer } = useDealerParam()
  const signOut = useSignOut()
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = (...parts: string[]) => q === '' || parts.join(' ').toLowerCase().includes(q)
  const found = useQuery({ queryKey: ['search', q], queryFn: () => api.searchAll(q), enabled: open && q.length > 0, placeholderData: keepPreviousData })
  // While the new query loads, the previous results stay hidden so Enter never opens a stale match.
  const results = q.length > 0 && !found.isPlaceholderData ? (found.data ?? []) : []
  const pages = PAGES.filter(({ item, group }) => matches(item.label, group))
  const rooftopRows = [{ id: null as string | null, name: 'All rooftops' }, ...(dealers ?? []).map((d) => ({ id: d.id as string | null, name: `${d.name} ${d.city}` }))].filter((r) => matches('rooftop', r.name))
  const showSignOut = matches('sign out', 'account', 'log out')
  const nothing = pages.length === 0 && rooftopRows.length === 0 && results.length === 0 && !showSignOut && !found.isFetching

  function close(next: boolean) {
    onOpenChange(next)
    if (!next) setQuery('')
  }

  function run(action: () => void) {
    close(false)
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={close} shouldFilter={false} title="Command palette" description="Search deals, findings, rules and pages">
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search deals, findings, rules and pages" />
      <CommandList className="max-h-[360px]">
        {nothing && <CommandEmpty>{`Nothing matches "${query.trim()}".`}</CommandEmpty>}
        {q.length > 0 && found.isFetching && results.length === 0 && <div role="status" className="px-3 py-2 text-xs leading-4 text-text-muted">Searching…</div>}
        {q.length > 0 && found.isError && <div role="alert" className="px-3 py-2 text-xs leading-4 text-sev-critical">Search failed. Type again to retry.</div>}
        {RESULT_HEADING.map(({ kind, heading }) => {
          const group = results.filter((r) => r.kind === kind)
          if (group.length === 0) return null
          const Icon = RESULT_ICON[kind]
          return (
            <CommandGroup key={kind} heading={heading}>
              {group.map((r) => (
                <CommandItem key={`${r.kind}-${r.id}`} value={`${r.kind}-${r.id}`} onSelect={() => run(() => navigate(r.href))}>
                  <Icon className="text-text-muted" />
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <span className="max-w-[45%] truncate text-xs text-text-muted">{r.subtitle}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        })}
        {pages.length > 0 && <CommandGroup heading="Pages">
          {pages.map(({ item, group }) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.to} value={`${item.label} ${group}`} onSelect={() => run(() => navigate({ pathname: item.to, search }))}>
                <Icon className="text-text-muted" />
                {item.label}
                <span className="ml-auto text-xs text-text-muted">{group}</span>
              </CommandItem>
            )
          })}
        </CommandGroup>}
        {rooftopRows.length > 0 && (
          <CommandGroup heading="Rooftops">
            {rooftopRows.map((r) => (
              <CommandItem key={r.id ?? 'all'} value={`rooftop-${r.id ?? 'all'}`} onSelect={() => run(() => setDealer(r.id))}>
                <Store className="text-text-muted" />
                {r.id === null ? r.name : (dealers?.find((d) => d.id === r.id)?.name ?? r.name)}
                {dealerId === r.id && <Check className="ml-auto" />}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {showSignOut && (
          <CommandGroup heading="Account">
            <CommandItem value="sign-out" onSelect={() => run(signOut)}>
              <LogOut className="text-text-muted" />
              Sign out
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center gap-4 border-t px-3 py-2 text-xs leading-4 text-text-muted">
        <Hint keys="↑ ↓" label="Move" />
        <Hint keys="Enter" label="Open" />
        <Hint keys="Esc" label="Close" />
      </div>
    </CommandDialog>
  )
}
