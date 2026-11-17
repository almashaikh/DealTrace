import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

/** The pre-written case summary for a deal. Null when the deal has no findings. */
export function useAgentSummary(dealId: string) {
  return useQuery({ queryKey: ['deals', 'agent', dealId], queryFn: () => api.getAgentSummary(dealId) })
}
