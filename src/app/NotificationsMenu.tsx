import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CircleCheck, FileText, Info, Scale, ShieldAlert, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { NOTIFICATIONS_KEY, useNotifications } from '@/app/queries'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AppNotification, NotificationKind } from '@/types'

const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  finding: ShieldAlert,
  decision: CircleCheck,
  rule: Scale,
  report: FileText,
  system: Info,
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isPending, isError, error, refetch } = useNotifications()

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => api.markRead(ids),
    onSuccess: (next) => queryClient.setQueryData<AppNotification[]>(NOTIFICATIONS_KEY, next),
    onError: () => toast.error('Could not update notifications. Try again.'),
  })

  const unread = data?.filter((n) => !n.read).length ?? 0

  function openItem(n: AppNotification) {
    if (!n.read) markRead.mutate([n.id])
    setOpen(false)
    navigate(n.href)
  }

  function markAll() {
    const count = unread
    markRead.mutate(undefined, { onSuccess: () => toast.success(`Marked ${count} ${count === 1 ? 'notification' : 'notifications'} as read`) })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} className="relative">
          <Bell />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-md border border-brand/20 bg-brand-subtle px-1 text-[11px] leading-none font-medium text-brand tabular-nums">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex h-11 items-center justify-between border-b px-4">
          <h2 className="text-sm font-semibold text-text">Notifications</h2>
          <Button variant="ghost" size="xs" disabled={unread === 0 || markRead.isPending} onClick={markAll}>
            Mark all as read
          </Button>
        </div>

        {isPending && (
          <div className="space-y-4 p-4" role="status" aria-label="Loading notifications">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-7 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
        {isError && <ErrorState compact error={error} onRetry={() => refetch()} />}
        {data && data.length === 0 && <EmptyState compact icon={Bell} title="No notifications yet." />}
        {data && data.length > 0 && (
          <ul className="max-h-[420px] divide-y overflow-y-auto">
            {data.map((n) => {
              const Icon = KIND_ICON[n.kind]
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className="flex w-full gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-app focus-visible:bg-app">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md border bg-card text-text-muted">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={cn('text-[13px] leading-[18px] text-text', !n.read && 'font-medium')}>{n.title}</span>
                        {!n.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" role="img" aria-label="Unread" />}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-4 text-text-muted">{n.body}</span>
                      <span className="mt-1 block text-xs leading-4 text-text-muted">{formatDateTime(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
