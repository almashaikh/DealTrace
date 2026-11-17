import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { applyAuditPatch, parseAuditState, toAuditFilters, type AuditState } from '@/features/audit/auditParams'
import { api } from '@/lib/api'

/** Audit log state from the URL, and a function that changes it. */
export function useAuditParams() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseAuditState(params), [params])
  const update = useCallback((patch: Partial<AuditState>) => setParams((prev) => applyAuditPatch(prev, patch)), [setParams])
  const clearFilters = useCallback(() => update({ actor: null, action: null, from: null, to: null }), [update])
  /** Dev-only: ?tamper=1 makes the next verification alter one record in memory so it fails. */
  const tamper = params.get('tamper') === '1'
  return { state, update, clearFilters, tamper }
}

export function useAudit(state: AuditState) {
  const filters = toAuditFilters(state)
  return useQuery({
    queryKey: ['audit', 'list', filters, state.page],
    queryFn: () => api.listAudit(filters, state.page),
    placeholderData: keepPreviousData,
  })
}

export function useAuditFacets() {
  return useQuery({ queryKey: ['audit', 'facets'], queryFn: () => api.getAuditFacets() })
}
