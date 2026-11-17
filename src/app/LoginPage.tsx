import { KeyRound, LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { DEMO_EMAIL, DEMO_PASSWORD, signIn, useSession } from '@/app/session'
import { APP_VERSION } from '@/app/version'
import { Wordmark } from '@/components/common/Wordmark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Method = 'password' | 'sso'

export function LoginPage() {
  const session = useSession()
  const navigate = useNavigate()
  const [pending, setPending] = useState<Method | null>(null)

  if (session && pending === null) return <Navigate to="/" replace />

  function start(method: Method) {
    if (pending) return
    setPending(method)
    // A short pause so the button state is visible; any sign-in works.
    window.setTimeout(() => {
      signIn()
      toast.success('Signed in')
      navigate('/', { replace: true })
    }, 450)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    start('password')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-app px-4 py-10">
      <div className="w-full max-w-[380px] rounded-lg border bg-card p-6">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <div className="mt-5 text-center">
          <h1 className="text-xl leading-7 font-semibold tracking-tight text-text">Sign in</h1>
          <p className="mt-0.5 text-sm leading-5 text-text-muted">Harborline Auto Group compliance workspace</p>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" name="email" autoComplete="username" defaultValue={DEMO_EMAIL} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" name="password" autoComplete="current-password" defaultValue={DEMO_PASSWORD} />
          </div>
          <Button type="submit" className="w-full" disabled={pending !== null}>
            {pending === 'password' && <LoaderCircle className="animate-spin" />}
            {pending === 'password' ? 'Signing in' : 'Sign in'}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs leading-4 text-text-muted" role="presentation">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button type="button" variant="secondary" className="w-full" disabled={pending !== null} onClick={() => start('sso')}>
          {pending === 'sso' ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
          {pending === 'sso' ? 'Signing in' : 'Sign in with SSO'}
        </Button>
      </div>

      <p className="flex items-center gap-2 text-xs leading-4 text-text-muted">
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        DealTrace {APP_VERSION} · Demo data. Any sign-in opens the workspace.
      </p>
    </div>
  )
}
