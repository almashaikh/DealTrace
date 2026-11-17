import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { toDealsQuery, type DealsState } from '@/features/deals/dealsParams'
import { api } from '@/lib/api'
import type { Branch, WhatIfParams } from '@/types'

/** The deals list. Keeps the previous rows on screen while a new tab, filter or page loads. */
export function useDeals(state: DealsState, dealerId: string | null) {
  const { filters, sort } = toDealsQuery(state, dealerId)
  return useQuery({
    queryKey: ['deals', 'list', filters, sort, state.page],
    queryFn: () => api.listDeals(filters, sort, state.page),
    placeholderData: keepPreviousData,
  })
}

/** Everything about one deal. All of these sit under ['deals', ...] so a decision on a finding refreshes them. */
export function useDealDetail(id: string) {
  return useQuery({ queryKey: ['deals', 'detail', id], queryFn: () => api.getDeal(id) })
}

export function useDealEvents(id: string) {
  return useQuery({ queryKey: ['deals', 'events', id], queryFn: () => api.getEvents(id) })
}

export function useDealDiff(id: string, from: number, to: number) {
  return useQuery({ queryKey: ['deals', 'diff', id, from, to], queryFn: () => api.getDiff(id, from, to), placeholderData: keepPreviousData })
}

export function useBenefitChecks(id: string) {
  return useQuery({ queryKey: ['deals', 'benefit', id], queryFn: () => api.getBenefitChecks(id) })
}

/** All findings on a deal, most severe first. */
export function useDealFindings(id: string) {
  return useQuery({
    queryKey: ['findings', 'deal', id],
    queryFn: () => api.listFindings({ deal_id: id }, { field: 'severity', direction: 'desc' }, 1, 50),
  })
}

export function useDealActivity(id: string) {
  return useQuery({ queryKey: ['audit', 'deal', id], queryFn: () => api.getDealActivity(id) })
}

/** A value that follows `value` after it has stopped changing for `ms`. */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return debounced
}

/** Recalculates a scenario through api.whatIf. `paramsKey` is the JSON of the params, already debounced by the caller. */
export function useWhatIf(dealId: string, version: number, paramsKey: string) {
  return useQuery({
    queryKey: ['deals', 'whatif', dealId, version, paramsKey],
    queryFn: () => api.whatIf(dealId, JSON.parse(paramsKey) as WhatIfParams, version),
    placeholderData: keepPreviousData,
  })
}

/** Saved what-if branches for a deal, newest first. */
export function useBranches(dealId: string) {
  return useQuery({ queryKey: ['deals', 'branches', dealId], queryFn: () => api.listBranches(dealId) })
}

export function useCreateBranch(dealId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Pick<Branch, 'name' | 'base_version' | 'params'>) => api.createBranch({ deal_id: dealId, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals', 'branches', dealId] }),
  })
}

export function useDeleteBranch(dealId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteBranch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals', 'branches', dealId] }),
  })
}

/** The dependency graph of a deal between two versions. */
export function useDependencyGraph(dealId: string, from: number, to: number) {
  return useQuery({
    queryKey: ['deals', 'graph', dealId, from, to],
    queryFn: () => api.getDependencyGraph(dealId, from, to),
    placeholderData: keepPreviousData,
  })
}
