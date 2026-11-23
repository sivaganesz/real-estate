import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type Tone, toneSoft } from './tone'

const TONES: Tone[] = ['primary', 'success', 'violet', 'warning', 'info']

/** Initials avatar for a person (lead, executive). The colour is stable per name. */
export function UserAvatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const tone = TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]
  return (
    <Avatar className={cn(size === 'sm' ? 'size-7 text-[11px]' : size === 'lg' ? 'size-11 text-base' : 'size-9 text-sm', className)}>
      <AvatarFallback className={cn('font-medium', toneSoft[tone])}>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
