import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { SyntheticJob, SyntheticJobParams } from '@/types'

/** How often a running job is checked. */
export const POLL_MS = 500

/** A synthetic data job. While it runs, it is polled every 500 ms; once it completes the polling stops. */
export function useSyntheticJob(id: string | null) {
  return useQuery({
    queryKey: ['synthetic', 'job', id],
    queryFn: () => api.getSyntheticJob(id as string),
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data?.status === 'completed' ? false : POLL_MS),
    refetchIntervalInBackground: true,
  })
}

export function useStartSyntheticJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: SyntheticJobParams) => api.startSyntheticJob(params),
    onSuccess: (job: SyntheticJob) => queryClient.setQueryData(['synthetic', 'job', job.id], job),
  })
}
