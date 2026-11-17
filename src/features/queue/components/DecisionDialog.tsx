import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { decisionConfig } from '@/features/queue/decisions'
import { useSaveDecision } from '@/features/queue/hooks'
import { cn } from '@/lib/utils'
import type { DecisionAction } from '@/types'

interface DecisionDialogProps {
  findingId: string
  /** The decision being made; null keeps the dialog closed. */
  action: DecisionAction | null
  onClose: () => void
}

/** Every decision needs a note. Saving writes the decision and an audit event, then refreshes the pages that show the finding. */
export function DecisionDialog({ findingId, action, onClose }: DecisionDialogProps) {
  const [note, setNote] = useState('')
  const [showError, setShowError] = useState(false)
  const save = useSaveDecision()
  const config = action ? decisionConfig(action) : null
  const noteId = `decision-note-${findingId}`
  const invalid = showError && note.trim().length === 0

  function close() {
    if (save.isPending) return
    setNote('')
    setShowError(false)
    onClose()
  }

  function submit() {
    if (!action || !config) return
    if (note.trim().length === 0) {
      setShowError(true)
      return
    }
    save.mutate(
      { finding_id: findingId, action, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(`Decision saved · ${findingId} marked ${config.marked}`)
          setNote('')
          setShowError(false)
          onClose()
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save the decision. Try again.'),
      },
    )
  }

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {config?.label} · {findingId}
          </DialogTitle>
          <DialogDescription>{config?.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={noteId}>Note</Label>
          <Textarea
            id={noteId}
            value={note}
            rows={4}
            maxLength={600}
            placeholder="What did you check, and why this decision?"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${noteId}-error` : undefined}
            onChange={(e) => setNote(e.target.value)}
            className={cn('resize-none text-[13px]', invalid && 'border-sev-critical')}
            autoFocus
          />
          {invalid ? (
            <p id={`${noteId}-error`} role="alert" className="text-xs leading-4 text-sev-critical">
              Add a note to record this decision.
            </p>
          ) : (
            <p className="text-xs leading-4 text-text-muted">The note is saved in the audit log with your name and the time.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" size="sm" disabled={save.isPending} onClick={close}>
            Cancel
          </Button>
          <Button size="sm" disabled={save.isPending} onClick={submit}>
            {save.isPending && <LoaderCircle className="animate-spin" />}
            Save decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
