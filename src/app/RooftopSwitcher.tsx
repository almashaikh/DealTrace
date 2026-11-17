import { RotateCw, Store } from 'lucide-react'

import { useDealers } from '@/app/queries'
import { useDealerParam } from '@/app/useDealerParam'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

/** "All rooftops" plus the five rooftops. The selection lives in the URL as ?dealer=. */
export function RooftopSwitcher() {
  const { data, isPending, isError, refetch } = useDealers()
  const { dealerId, setDealer } = useDealerParam()

  if (isPending) return <Skeleton className="h-8 w-[232px]" aria-label="Loading rooftops" />
  if (isError) {
    return (
      <Button variant="secondary" size="sm" onClick={() => refetch()} className="w-[232px] justify-start">
        <RotateCw />
        Rooftops unavailable. Retry
      </Button>
    )
  }

  return (
    <Select value={dealerId ?? 'all'} onValueChange={(v) => setDealer(v === 'all' ? null : v)}>
      <SelectTrigger size="sm" aria-label="Rooftop" className="w-[232px] bg-surface text-[13px]">
        <span className="flex min-w-0 items-center gap-2">
          <Store aria-hidden="true" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="all">All rooftops</SelectItem>
        {data.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
