import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PALETTE_KEY_LABEL } from '@/app/platform'
import { APP_VERSION } from '@/app/version'

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: PALETTE_KEY_LABEL, action: 'Open the command palette' },
  { keys: '↑ ↓', action: 'Move between results' },
  { keys: 'Enter', action: 'Open the selected result' },
  { keys: 'Esc', action: 'Close a dialog or menu' },
]

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help and shortcuts</DialogTitle>
          <DialogDescription>DealTrace {APP_VERSION} runs on demo data. Nothing leaves your browser.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y rounded-lg border text-[13px] leading-[18px]">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex items-center justify-between gap-4 px-3 py-2">
              <dt className="text-text">{s.action}</dt>
              <dd>
                <kbd className="rounded-md border bg-app px-1.5 py-0.5 font-mono text-xs text-text-muted">{s.keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-[13px] leading-[18px] text-text-muted">
          Findings are potential violations. Each one needs a human reviewer&rsquo;s decision before the lender funds the deal.
        </p>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
