/** Initials avatar: tint from hash(name) over the chart palette, optional role ring and availability dot. */
import type { Availability, Role } from '@/domain/types'
import { initials } from '@/lib/format'
import { availabilityTone, avatarTint, roleTone } from '@/lib/tones'
import { cn } from '@/lib/utils'

const SIZES = { xs: 'size-6 text-micro', sm: 'size-8 text-caption', md: 'size-9 text-meta', lg: 'size-11 text-sm' } as const

export function UserAvatar({ name, size = 'md', role, availability, className }: {
  name: string
  size?: keyof typeof SIZES
  role?: Role
  availability?: Availability
  className?: string
}) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-full font-semibold text-foreground select-none',
          SIZES[size],
          avatarTint(name),
          role && cn('ring-2 ring-offset-2 ring-offset-background', roleTone[role].ring),
        )}
      >
        {initials(name)}
      </span>
      {availability && (
        <span
          aria-hidden="true"
          className={cn('absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background', availabilityTone[availability].solid)}
        />
      )}
    </span>
  )
}
