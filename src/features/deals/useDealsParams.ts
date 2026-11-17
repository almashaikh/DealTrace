import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { applyDealsPatch, parseDealsState, type DealsState } from '@/features/deals/dealsParams'

/** Deals list state from the URL, and a function that changes it. */
export function useDealsParams() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseDealsState(params), [params])
  const update = useCallback(
    (patch: Partial<DealsState>, options?: { replace?: boolean }) => setParams((prev) => applyDealsPatch(prev, patch), { replace: options?.replace }),
    [setParams],
  )
  /** One URL change for the filters and the rooftop together (two calls in a row would undo each other). */
  const clearFilters = useCallback(
    () =>
      setParams((prev) => {
        const next = applyDealsPatch(prev, { status: [], q: '' })
        next.delete('dealer')
        return next
      }),
    [setParams],
  )
  return { state, update, clearFilters }
}
