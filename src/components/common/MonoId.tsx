import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

interface MonoIdProps {
  /** The full value. This is what gets copied. */
  value: string
  /** What to show when it differs from the value, such as the first characters of a hash. */
  display?: string
  /** Show the copy button. Default true. */
  copyable?: boolean
  className?: string
}

/** IDs, VINs and hashes in IBM Plex Mono, with a copy button that appears on hover and focus. */
export function MonoId({ value, display, copyable = true, className }: MonoIdProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(event: React.MouseEvent) {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(display ? `Copied full value of ${display}` : `Copied ${value}`)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy to the clipboard')
    }
  }

  return (
    <span className={cn('group/id inline-flex items-center gap-1 font-mono text-xs leading-4 text-text', className)}>
      <span title={display ? value : undefined}>{display ?? value}</span>
      {copyable && (
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${value}`}
          className="grid size-5 place-items-center rounded-md text-text-muted opacity-0 transition-opacity duration-150 outline-none group-hover/id:opacity-100 hover:bg-app hover:text-text focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand"
        >
          {copied ? <Check className="size-3.5 text-success" strokeWidth={1.75} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
        </button>
      )}
    </span>
  )
}
