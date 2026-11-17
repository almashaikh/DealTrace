import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { ProductCode } from '@/types'

/** Prices for one product, optionally for one rooftop. Keeps the previous chart on screen while a new one loads. */
export function usePricing(product: ProductCode, dealerId: string | null) {
  return useQuery({
    queryKey: ['pricing', product, dealerId ?? 'all'],
    queryFn: () => api.pricingDispersion({ product_code: product, dealer_id: dealerId ?? undefined }),
    placeholderData: keepPreviousData,
  })
}
