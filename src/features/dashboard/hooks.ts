import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

/** All dashboard queries take the rooftop (null means all rooftops) and refetch when it changes. */

export function useDashboard(dealerId: string | null) {
  return useQuery({
    queryKey: ['dashboard', dealerId ?? 'all'],
    queryFn: () => api.dashboardSummary(dealerId ?? 'all', '30d'),
    placeholderData: keepPreviousData,
  })
}

/** Top five open findings by refund exposure. */
export function useNeedsAttention(dealerId: string | null) {
  return useQuery({
    queryKey: ['findings', 'needs-attention', dealerId ?? 'all'],
    queryFn: () => api.listFindings({ status: 'open', dealer_id: dealerId ?? undefined }, { field: 'refund_exposure', direction: 'desc' }, 1, 5),
    placeholderData: keepPreviousData,
  })
}

export function useRecentActivity(dealerId: string | null) {
  return useQuery({
    queryKey: ['activity', dealerId ?? 'all'],
    queryFn: () => api.recentActivity(dealerId ?? 'all', 8),
    placeholderData: keepPreviousData,
  })
}
