import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

/** The signed-in user. */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.me() })
}

/** The five rooftops. */
export function useDealers() {
  return useQuery({ queryKey: ['dealers'], queryFn: () => api.dealers() })
}

export const NOTIFICATIONS_KEY = ['notifications'] as const

export function useNotifications() {
  return useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: () => api.notifications() })
}

/** The three product providers (ShieldPoint, DriveCare, TreadSafe). */
export function useProviders() {
  return useQuery({ queryKey: ['providers'], queryFn: () => api.providers(), staleTime: Infinity })
}

/** All five people. Used for assignee names and avatars. */
export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: () => api.users(), staleTime: Infinity })
}

/**
 * Query key prefixes. A decision or an assignment refreshes everything that can show a finding:
 * the queue and detail pages, the dashboard, deals, the activity feed and the audit log.
 */
export const FINDING_DEPENDENT_KEYS = [['findings'], ['dashboard'], ['deals'], ['activity'], ['audit']] as const
