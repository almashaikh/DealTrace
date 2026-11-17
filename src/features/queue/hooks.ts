import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { FINDING_DEPENDENT_KEYS } from '@/app/queries'
import { api } from '@/lib/api'
import { toApiQuery, type QueueState } from '@/features/queue/queueParams'
import type { SaveDecisionInput } from '@/types'

/** The review queue list. Keeps the previous rows on screen while a new tab, filter or page loads. */
export function useFindings(state: QueueState, dealerId: string | null) {
  const { filters, sort } = toApiQuery(state, dealerId)
  return useQuery({
    queryKey: ['findings', 'list', filters, sort, state.page],
    queryFn: () => api.listFindings(filters, sort, state.page),
    placeholderData: keepPreviousData,
  })
}

/** Refreshes every query that can show a finding. */
export function useRefreshFindings() {
  const queryClient = useQueryClient()
  return useCallback(
    () => Promise.all(FINDING_DEPENDENT_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: key }))),
    [queryClient],
  )
}

/** Saves a reviewer decision, then refreshes the queue, the finding, the dashboard, deals, activity and audit queries. */
export function useSaveDecision() {
  const refresh = useRefreshFindings()
  return useMutation({
    mutationFn: (input: SaveDecisionInput) => api.saveDecision(input),
    onSuccess: () => refresh(),
  })
}

export function useAssignFindings() {
  const refresh = useRefreshFindings()
  return useMutation({
    mutationFn: ({ ids, assigneeId }: { ids: string[]; assigneeId: string }) => api.assignFindings(ids, assigneeId),
    onSuccess: () => refresh(),
  })
}

/** One finding with its deal, rooftop, assignee, rule and decisions. */
export function useFinding(id: string) {
  return useQuery({ queryKey: ['findings', 'detail', id], queryFn: () => api.getFinding(id) })
}

/** Other findings on the same deal. */
export function useRelatedFindings(dealId: string | undefined) {
  return useQuery({
    queryKey: ['findings', 'related', dealId],
    queryFn: () => api.listFindings({ deal_id: dealId }, { field: 'severity', direction: 'desc' }, 1, 50),
    enabled: Boolean(dealId),
  })
}
