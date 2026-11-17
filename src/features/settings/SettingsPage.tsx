import { Copy, KeyRound, Plug, RotateCcw, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

import { useDealers, useMe, useUsers } from '@/app/queries'
import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { FieldsSkeleton, SkeletonCard } from '@/components/common/skeletons'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  RULE_PACKS,
  TIME_ZONES,
  clearSettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  type AppSettings,
  type NotificationPrefs,
} from '@/features/settings/settings'
import { api } from '@/lib/api'
import type { Dealer, User } from '@/types'

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'rooftops', label: 'Rooftops' },
  { id: 'rule-packs', label: 'Rule packs' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'team', label: 'Team members' },
  { id: 'api-keys', label: 'API keys' },
  { id: 'integrations', label: 'Integrations' },
] as const

const NOTIFICATION_ROWS: { key: keyof NotificationPrefs; label: string; detail: string }[] = [
  { key: 'newHighFinding', label: 'New high-severity finding', detail: 'When a finding of high or critical severity is detected' },
  { key: 'decisionRecorded', label: 'Decision recorded', detail: 'When a reviewer records a decision on a finding' },
  { key: 'ruleChange', label: 'Rule changes', detail: 'When a rule is switched on or off or a new version takes effect' },
  { key: 'weeklyReport', label: 'Weekly summary', detail: 'A Monday summary of open findings and refund exposure' },
  { key: 'channelEmail', label: 'Also send by email', detail: 'Email copies of the notifications above' },
]

const MASKED_KEYS = [
  { id: 'prod', label: 'Production', value: 'dt_live_••••••••••••3f9a' },
  { id: 'sandbox', label: 'Sandbox', value: 'dt_test_••••••••••••c21e' },
]

function SwitchRow({ label, detail, checked, onChange, disabled, badge }: { label: string; detail: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; badge?: string }) {
  return (
    <label className="flex items-center justify-between gap-6 py-3 text-[13px] leading-[18px] text-text">
      <span className="min-w-0">
        <span className="flex items-center gap-2 font-medium">
          {label}
          {badge && <span className="rounded-md border bg-app px-1.5 text-xs leading-5 font-normal text-text-muted">{badge}</span>}
        </span>
        <span className="block text-xs leading-4 text-text-muted">{detail}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={label} />
    </label>
  )
}

function SaveBar({ dirty, onSave, onDiscard }: { dirty: boolean; onSave: () => void; onDiscard: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2 border-t pt-4">
      <Button onClick={onSave} disabled={!dirty}>
        Save changes
      </Button>
      <Button variant="ghost" onClick={onDiscard} disabled={!dirty}>
        Discard
      </Button>
    </div>
  )
}

function SettingsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" role="status" aria-label="Loading settings">
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i}>
          <Skeleton className="h-4 w-28" />
          <FieldsSkeleton fields={2} className="mt-4" />
        </SkeletonCard>
      ))}
    </div>
  )
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [email, setEmail] = useState('')
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setEmail('')
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>They get an invitation by email. Prototype: nothing is sent.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Work email</Label>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@harborline.example" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              toast.success(`Invitation sent to ${email}`)
              setEmail('')
              onOpenChange(false)
            }}
          >
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SettingsForms({ me, dealers, users }: { me: User; dealers: Dealer[]; users: User[] }) {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState<AppSettings>(() => loadSettings(me.name))
  const [draft, setDraft] = useState<AppSettings>(saved)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  const nameError = draft.displayName.trim().length === 0 ? 'Enter a display name.' : null

  function commit(label: string, next: AppSettings) {
    saveSettings(next)
    setSaved(next)
    setDraft(next)
    toast.success(`${label} saved`)
  }

  const scoped = (id: string) => draft.rooftopsInScope[id] ?? true

  async function reset() {
    setResetting(true)
    try {
      await api.resetDemoData()
      clearSettings()
      const fresh = defaultSettings(me.name)
      setSaved(fresh)
      setDraft(fresh)
      await queryClient.invalidateQueries()
      toast.success('Demo data reset')
      setResetOpen(false)
    } catch {
      toast.error('Could not reset the demo data. Try again.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[168px_minmax(0,720px)]">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-4 space-y-0.5">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} className="block rounded-md px-2.5 py-1.5 text-[13px] leading-[18px] text-text-muted transition-colors outline-none hover:bg-app hover:text-text focus-visible:ring-2 focus-visible:ring-ring">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-col gap-4">
        <div id="profile" className="scroll-mt-4">
          <SectionCard title="Profile" description="How you appear to your team">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="st-name">Display name</Label>
                <Input id="st-name" value={draft.displayName} aria-invalid={nameError !== null} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
                {nameError && <p role="alert" className="text-xs leading-4 text-sev-critical">{nameError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-email">Email</Label>
                <Input id="st-email" value={me.email} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-role">Role</Label>
                <Input id="st-role" value={`${me.role}, Harborline Auto Group`} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-tz">Time zone</Label>
                <Select value={draft.timeZone} onValueChange={(v) => setDraft({ ...draft, timeZone: v })}>
                  <SelectTrigger id="st-tz" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_ZONES.map((z) => (
                      <SelectItem key={z} value={z}>{z.replace('America/', '').replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SaveBar dirty={dirty} onSave={() => (nameError ? toast.error(nameError) : commit('Settings', draft))} onDiscard={() => setDraft(saved)} />
          </SectionCard>
        </div>

        <div id="rooftops" className="scroll-mt-4">
          <SectionCard title="Rooftops" description="Which rooftops are scanned and shown">
            <div className="divide-y">
              {dealers.map((d) => (
                <SwitchRow key={d.id} label={d.name} detail={`${d.city}, ${d.state}`} checked={scoped(d.id)} onChange={(v) => setDraft({ ...draft, rooftopsInScope: { ...draft.rooftopsInScope, [d.id]: v } })} />
              ))}
            </div>
            <SaveBar dirty={dirty} onSave={() => commit('Settings', draft)} onDiscard={() => setDraft(saved)} />
          </SectionCard>
        </div>

        <div id="rule-packs" className="scroll-mt-4">
          <SectionCard title="Rule packs" description="Rules in force by jurisdiction. Individual rules are managed in the Rules engine.">
            <div className="divide-y">
              {RULE_PACKS.map((p) => (
                <SwitchRow key={p.id} label={p.name} detail={p.detail} badge={p.comingSoon ? 'Coming soon' : undefined} disabled={p.comingSoon} checked={draft.rulePacks[p.id] ?? false} onChange={(v) => setDraft({ ...draft, rulePacks: { ...draft.rulePacks, [p.id]: v } })} />
              ))}
            </div>
            <SaveBar dirty={dirty} onSave={() => commit('Settings', draft)} onDiscard={() => setDraft(saved)} />
          </SectionCard>
        </div>

        <div id="notifications" className="scroll-mt-4">
          <SectionCard title="Notifications" description="What you hear about">
            <div className="divide-y">
              {NOTIFICATION_ROWS.map((r) => (
                <SwitchRow key={r.key} label={r.label} detail={r.detail} checked={draft.notifications[r.key]} onChange={(v) => setDraft({ ...draft, notifications: { ...draft.notifications, [r.key]: v } })} />
              ))}
            </div>
            <SaveBar dirty={dirty} onSave={() => commit('Notification preferences', draft)} onDiscard={() => setDraft(saved)} />
          </SectionCard>
        </div>

        <div id="team" className="scroll-mt-4">
          <SectionCard title="Team members" description={`${users.length} people in Harborline Auto Group`} action={<Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}><UserPlus />Invite member</Button>} flush>
            <ul className="divide-y">
              {users.map((u) => (
                <li key={u.id} className="flex h-12 items-center gap-3 px-4 text-[13px] leading-[18px]">
                  <UserAvatar name={u.name} initials={u.initials} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-text">{u.name}</span>
                    <span className="ml-2 text-text-muted">{u.email}</span>
                  </span>
                  <span className="text-text-muted">{u.role}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div id="api-keys" className="scroll-mt-4">
          <SectionCard title="API keys" description="Placeholder values. This prototype has no API.">
            <ul className="divide-y">
              {MASKED_KEYS.map((k) => (
                <li key={k.id} className="flex items-center gap-3 py-3">
                  <KeyRound className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-[18px] font-medium text-text">{k.label}</span>
                    <span className="block truncate font-mono text-xs leading-4 text-text-muted">{k.value}</span>
                  </span>
                  <Button variant="ghost" size="icon-sm" aria-label={`Copy ${k.label} key`} onClick={() => { void navigator.clipboard?.writeText(k.value).catch(() => undefined); toast.success(`${k.label} key copied (masked placeholder)`) }}>
                    <Copy />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => toast.success(`${k.label} key regenerated (placeholder)`)}>Regenerate</Button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div id="integrations" className="scroll-mt-4">
          <SectionCard title="Integrations" description="Connections to other systems">
            <ul className="divide-y">
              <li className="flex items-center gap-3 py-3">
                <Plug className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-[18px] font-medium text-text">Tekion ARC <span className="font-normal text-text-muted">— Not connected</span></span>
                  <span className="block text-xs leading-4 text-text-muted">Pulls deal events from the dealer management system</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => toast.success('Integration request sent')}>Connect</Button>
              </li>
              <li className="flex items-center gap-3 py-3">
                <Plug className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-[18px] font-medium text-text">Review assistant <span className="font-normal text-text-muted">— Prototype mode</span></span>
                  <span className="block text-xs leading-4 text-text-muted">Responses are scripted in this prototype. No live model is connected.</span>
                </span>
                <span className="rounded-md border bg-app px-1.5 text-xs leading-5 text-text-muted">Scripted</span>
              </li>
            </ul>
          </SectionCard>
        </div>

        <SectionCard title="Demo data" description="Clears decisions, rule toggles, read notifications, branches, synthetic jobs and saved preferences">
          <div className="flex items-center justify-between gap-6">
            <p className="text-[13px] leading-[18px] text-text-muted">Use this to start a demo from the original data.</p>
            <Button variant="secondary" onClick={() => setResetOpen(true)}>
              <RotateCcw />
              Reset demo data
            </Button>
          </div>
        </SectionCard>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset demo data?</DialogTitle>
            <DialogDescription>Decisions, rule toggles, read notifications, branches and saved preferences return to their starting values.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={() => void reset()} disabled={resetting}>Reset demo data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function SettingsPage() {
  const me = useMe()
  const dealers = useDealers()
  const users = useUsers()
  const failed = me.isError || dealers.isError || users.isError
  const ready = me.data && dealers.data && users.data
  return (
    <>
      <PageHeader breadcrumbs={[{ label: 'Account' }, { label: 'Settings' }]} title="Settings" subtitle="Profile, rooftops, rules, notifications and demo data." />
      {failed && <ErrorState error={me.error ?? dealers.error ?? users.error} onRetry={() => { void me.refetch(); void dealers.refetch(); void users.refetch() }} />}
      {!failed && !ready && <SettingsLoading />}
      {!failed && ready && <SettingsForms me={me.data} dealers={dealers.data} users={users.data} />}
    </>
  )
}
