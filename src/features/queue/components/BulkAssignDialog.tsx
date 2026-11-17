import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAssignFindings } from '@/features/queue/hooks'
import { ASSIGNABLE_ROLES } from '@/features/queue/queueParams'
import type { User } from '@/types'

interface BulkAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ids: string[]
  users: readonly User[]
  onAssigned: () => void
}

export function BulkAssignDialog({ open, onOpenChange, ids, users, onAssigned }: BulkAssignDialogProps) {
  const [assigneeId, setAssigneeId] = useState<string>('')
  const assign = useAssignFindings()
  const reviewers = users.filter((u) => ASSIGNABLE_ROLES.includes(u.role))
  const noun = ids.length === 1 ? 'finding' : 'findings'

  function submit() {
    const person = reviewers.find((u) => u.id === assigneeId)
    if (!person) return
    assign.mutate(
      { ids, assigneeId },
      {
        onSuccess: () => {
          toast.success(`Assigned ${ids.length} ${noun} to ${person.name}`)
          onOpenChange(false)
          setAssigneeId('')
          onAssigned()
        },
        onError: () => toast.error('Could not assign the findings. Try again.'),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!assign.isPending) onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Assign {ids.length} {noun}
          </DialogTitle>
          <DialogDescription>Each change is recorded as its own event in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="bulk-assignee">Assign to</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger id="bulk-assignee" className="w-full">
              <SelectValue placeholder="Choose a reviewer" />
            </SelectTrigger>
            <SelectContent>
              {reviewers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="secondary" size="sm" disabled={assign.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!assigneeId || assign.isPending} onClick={submit}>
            {assign.isPending && <LoaderCircle className="animate-spin" />}
            Assign {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
