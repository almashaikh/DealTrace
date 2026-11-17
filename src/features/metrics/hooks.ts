import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

/** The detector accuracy report: overall scores, per detector, confusion matrix and the F1 history. */
export function useAccuracy() {
  return useQuery({ queryKey: ['accuracy'], queryFn: () => api.getAccuracy() })
}
