import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { queryClient } from '@/app/queryClient'
import { signOut } from '@/app/session'

/** Ends the fake session, clears cached data and returns to /login. */
export function useSignOut(): () => void {
  const navigate = useNavigate()
  return useCallback(() => {
    navigate('/login', { replace: true })
    signOut()
    queryClient.clear()
    toast.success('Signed out')
  }, [navigate])
}
