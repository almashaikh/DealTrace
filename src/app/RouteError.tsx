import { useRouteError } from 'react-router'

import { ErrorState } from '@/components/common/ErrorState'
import { PageHeader } from '@/components/common/PageHeader'

/** Shown inside the shell when a page throws while rendering. */
export function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)
  return (
    <>
      <PageHeader title="Something went wrong" subtitle="This page could not be shown." />
      <div className="rounded-lg border bg-card">
        <ErrorState message="This page hit an unexpected problem. Reload to try again." onRetry={() => window.location.reload()} />
      </div>
    </>
  )
}
