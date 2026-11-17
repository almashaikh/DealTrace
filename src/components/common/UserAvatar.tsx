import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  initials: string
  className?: string
}

/** Initials in a 24px square. The name is the accessible label and the hover title. */
export function UserAvatar({ name, initials, className }: UserAvatarProps) {
  return (
    <Avatar className={cn('size-6', className)} title={name} aria-label={name}>
      <AvatarFallback className="bg-brand-subtle text-[11px] font-medium text-brand">{initials}</AvatarFallback>
    </Avatar>
  )
}
