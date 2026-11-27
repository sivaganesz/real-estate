/** Overlapping avatars with a "+N" bubble (team on a deal, attendees of a visit). */
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { UserAvatar } from './user-avatar'

export function AvatarStack({ names, max = 4, size = 'sm', className }: { names: string[]; max?: number; size?: 'xs' | 'sm' | 'md'; className?: string }) {
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {shown.map((n) => (
        <Tooltip key={n}>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="rounded-full ring-2 ring-card focus-visible:outline-none focus-visible:ring-ring">
              <UserAvatar name={n} size={size} />
              <span className="sr-only">{n}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{n}</TooltipContent>
        </Tooltip>
      ))}
      {rest > 0 && (
        <span className={cn('relative inline-flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-card tabular-nums', size === 'xs' ? 'size-6 text-micro' : size === 'sm' ? 'size-8 text-caption' : 'size-9 text-meta')}>
          +{rest}
        </span>
      )}
    </div>
  )
}
