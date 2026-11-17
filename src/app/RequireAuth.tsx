import { Navigate } from 'react-router'

import { AppShell } from '@/app/AppShell'
import { useSession } from '@/app/session'

/** Signed-out visitors go to /login. Signed-in users get the shell with the page inside it. */
export function RequireAuth() {
  const session = useSession()
  if (!session) return <Navigate to="/login" replace />
  return <AppShell />
}
