import { Compass } from 'lucide-react'

import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { useDealerParam } from '@/app/useDealerParam'

export function NotFoundPage() {
  const { search } = useDealerParam()
  return (
    <>
      <PageHeader title="Page not found" subtitle="The address does not match a DealTrace page." />
      <div className="rounded-lg border bg-card">
        <EmptyState icon={Compass} title="This page does not exist or has moved." action={{ label: 'Go to dashboard', to: `/${search}` }} />
      </div>
    </>
  )
}
