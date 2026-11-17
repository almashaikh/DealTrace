import { QueryClient } from '@tanstack/react-query'

/**
 * No automatic retries: the mock API only fails on purpose (?simulateError=1),
 * and the error state with its Retry button should be what people see.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})
