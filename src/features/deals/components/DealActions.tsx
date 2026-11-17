import { EllipsisVertical, FileDown, History, Link2, ListChecks, MessageSquareText, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface DealActionsProps {
  dealId: string
  onAskAssistant: () => void
  onOpenActivity: () => void
}

async function copy(text: string, message: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(message)
  } catch {
    toast.error('Could not copy to the clipboard')
  }
}

/** Ask assistant, Export report and the more-actions menu. */
export function DealActions({ dealId, onAskAssistant, onOpenActivity }: DealActionsProps) {
  const navigate = useNavigate()
  return (
    <>
      <Button variant="secondary" size="sm" onClick={onAskAssistant}>
        <MessageSquareText />
        Ask assistant
      </Button>
      <Button variant="secondary" size="sm" onClick={() => toast.success('Report exported')}>
        <FileDown />
        Export report
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon-sm" aria-label="More actions">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => copy(dealId, `Copied ${dealId}`)}>
            <Copy /> Copy deal ID
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(window.location.href, 'Link copied')}>
            <Link2 /> Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate({ pathname: '/queue', search: `?tab=all&q=${encodeURIComponent(dealId)}` })}>
            <ListChecks /> Findings in review queue
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenActivity}>
            <History /> Audit activity
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
