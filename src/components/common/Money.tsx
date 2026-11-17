import { formatMoney, formatSignedMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

interface MoneyProps {
  value: number
  /** Always show + or − (for differences). */
  signed?: boolean
  /** IBM Plex Mono, used for money in tables. */
  mono?: boolean
  className?: string
}

/** US dollars from the data layer. Tabular figures so columns line up. */
export function Money({ value, signed = false, mono = false, className }: MoneyProps) {
  return <span className={cn('tabular-nums', mono && 'font-mono', className)}>{signed ? formatSignedMoney(value) : formatMoney(value)}</span>
}
