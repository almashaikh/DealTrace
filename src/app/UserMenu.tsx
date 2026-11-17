import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useMe } from '@/app/queries'
import { useDealerParam } from '@/app/useDealerParam'
import { useSignOut } from '@/app/useSignOut'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'

export function UserMenu() {
  const { data: me, isPending } = useMe()
  const [profileOpen, setProfileOpen] = useState(false)
  const navigate = useNavigate()
  const { search } = useDealerParam()
  const signOut = useSignOut()

  if (isPending) return <Skeleton className="size-8" aria-label="Loading account" />

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={me ? `Account menu for ${me.name}` : 'Account menu'}
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand-subtle text-xs font-medium text-brand">{me ? me.initials : <UserIcon className="size-4" />}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {me && (
            <DropdownMenuLabel className="font-normal">
              <p className="text-[13px] leading-[18px] font-medium text-text">{me.name}</p>
              <p className="text-xs leading-4 text-text-muted">{me.role}</p>
            </DropdownMenuLabel>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!me} onSelect={() => setProfileOpen(true)}>
            <UserIcon /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate({ pathname: '/settings', search })}>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {me && (
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Profile</DialogTitle>
              <DialogDescription>Your account in this workspace.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="bg-brand-subtle text-sm font-medium text-brand">{me.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm leading-5 font-medium text-text">{me.name}</p>
                <p className="text-xs leading-4 text-text-muted">{me.role}</p>
              </div>
            </div>
            <dl className="divide-y rounded-lg border text-[13px] leading-[18px]">
              <div className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-text-muted">Email</dt>
                <dd className="truncate text-text">{me.email}</dd>
              </div>
              <div className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-text-muted">Organization</dt>
                <dd className="text-text">Harborline Auto Group</dd>
              </div>
              <div className="flex justify-between gap-4 px-3 py-2">
                <dt className="text-text-muted">Access</dt>
                <dd className="text-text">All rooftops</dd>
              </div>
            </dl>
            <DialogFooter>
              <Button variant="secondary" size="sm" onClick={() => setProfileOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setProfileOpen(false)
                  navigate({ pathname: '/settings', search })
                }}
              >
                Open settings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
