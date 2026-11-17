import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { CLEARED_FILTERS, applyQueuePatch, parseQueueState, type QueueState } from '@/features/queue/queueParams'

/** Queue state from the URL, and a function that changes it. */
export function useQueueParams() {
  const [params, setParams] = useSearchParams()
  const state = useMemo(() => parseQueueState(params), [params])
  const update = useCallback(
    (patch: Partial<QueueState>, options?: { replace?: boolean }) => {
      setParams((prev) => applyQueuePatch(prev, patch), { replace: options?.replace })
    },
    [setParams],
  )
  /**
   * Clears every filter and the rooftop together. This must be one URL change:
   * two setSearchParams calls in the same tick both start from the old URL, so the second would undo the first.
   */
  const clearFilters = useCallback(() => {
    setParams((prev) => {
      const next = applyQueuePatch(prev, CLEARED_FILTERS)
      next.delete('dealer')
      return next
    })
  }, [setParams])
  return { state, update, clearFilters }
}
