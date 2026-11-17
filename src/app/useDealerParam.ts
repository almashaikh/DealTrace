import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

import { useDealers } from '@/app/queries'

export interface DealerParam {
  /** Selected rooftop id from ?dealer=, or null for all rooftops. */
  dealerId: string | null
  /** "?dealer=DLR-01" or "" — append to links so the selection follows the user. */
  search: string
  setDealer: (id: string | null) => void
}

/** The rooftop switcher keeps its selection in the URL as ?dealer=. */
export function useDealerParam(): DealerParam {
  const [params, setParams] = useSearchParams()
  const { data: dealers } = useDealers()
  const raw = params.get('dealer')
  // Until rooftops load, trust the URL; afterwards ignore ids that do not exist.
  const dealerId = raw && (!dealers || dealers.some((d) => d.id === raw)) ? raw : null

  const setDealer = useCallback(
    (id: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        if (id) next.set('dealer', id)
        else next.delete('dealer')
        next.delete('page')
        return next
      })
    },
    [setParams],
  )

  return { dealerId, search: dealerId ? `?dealer=${encodeURIComponent(dealerId)}` : '', setDealer }
}
