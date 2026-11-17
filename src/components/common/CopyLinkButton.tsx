import { Link2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/** Copies the current page address. */
export function CopyLinkButton() {
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      <Link2 />
      Copy link
    </Button>
  )
}
