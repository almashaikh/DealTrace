import { useMutation } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { SandboxInput } from '@/types'

/** Runs the deal history through the real detectors (api.sandboxEvaluate). */
export function useSandboxEvaluate() {
  return useMutation({ mutationFn: (input: SandboxInput) => api.sandboxEvaluate(input) })
}
