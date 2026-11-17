import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import type { ImpactChange, Paginated, Rule } from '@/types'

/** Rules, optionally for one jurisdiction. The unfiltered list also supplies the jurisdiction options. */
export function useRules(jurisdiction: string | null) {
  return useQuery({
    queryKey: ['rules', 'list', jurisdiction ?? 'all'],
    queryFn: () => api.listRules(jurisdiction ? { jurisdiction } : {}, 1, 50),
    placeholderData: keepPreviousData,
  })
}

export function useRule(id: string | null) {
  return useQuery({ queryKey: ['rules', 'detail', id], queryFn: () => api.getRule(id as string), enabled: id !== null })
}

export function useRuleVersions(id: string | null) {
  return useQuery({ queryKey: ['rules', 'versions', id], queryFn: () => api.getRuleVersions(id as string), enabled: id !== null })
}

/**
 * The enabled switch. It flips at once, then api.toggleRule confirms it and records an audit event.
 * If the call fails the switch goes back and a toast says so.
 */
export function useToggleRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.toggleRule(id, enabled),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['rules'] })
      const previous = queryClient.getQueriesData<Paginated<Rule>>({ queryKey: ['rules', 'list'] })
      queryClient.setQueriesData<Paginated<Rule>>({ queryKey: ['rules', 'list'] }, (old) =>
        old ? { ...old, items: old.items.map((r) => (r.id === id ? { ...r, enabled } : r)) } : old,
      )
      return { previous }
    },
    onSuccess: (_rule, { id, enabled }) => {
      toast.success(`${id} ${enabled ? 'enabled' : 'disabled'} · Audit event recorded`)
    },
    onError: (error, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error(error instanceof Error ? error.message : 'Could not change the rule. Try again.')
    },
    onSettled: () => {
      for (const key of [['rules'], ['audit'], ['activity']]) void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

/** Runs the impact check for a change to a rule. */
export function useImpactCheck(ruleId: string) {
  return useMutation({ mutationFn: (change: ImpactChange) => api.runImpactCheck(ruleId, change) })
}
