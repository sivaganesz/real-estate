import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type ChipTone = 'primary' | 'violet'
/** idle: off · on: pressed / selected · add: a dashed "add something" action */
const LOOK: Record<ChipTone, { idle: string; on: string; add: string }> = {
  primary: {
    idle: 'bg-card text-muted-foreground hover:bg-muted',
    on: 'border-primary/40 bg-accent text-accent-foreground',
    add: 'border-dashed text-primary hover:bg-accent',
  },
  violet: { // the AI colour: suggestions and "needs attention" filters
    idle: 'border-violet/30 bg-card text-violet hover:bg-violet-soft',
    on: 'border-violet bg-violet text-violet-foreground',
    add: 'border-dashed border-violet/40 bg-card text-violet hover:bg-violet-soft',
  },
}
const SIZE = { sm: 'px-2.5 py-0.5 text-meta', md: 'inline-flex h-7 items-center gap-1 px-2.5 text-sm [&_svg]:size-3.5' }

/**
 * A small rounded button: a filter or option switched on and off (`pressed`), a suggestion, or a dashed "add" action (`dashed`).
 * Status labels that aren't clickable use StatusChip instead.
 */
export function Chip({ tone = 'primary', size = 'md', pressed, dashed, type = 'button', className, ...props }: ComponentProps<'button'> & {
  tone?: ChipTone
  /** sm: 12.5 px text, for chips inside a strip of text · md: 28 px tall, for rows of options */
  size?: 'sm' | 'md'
  /** on/off state; also sets aria-pressed */
  pressed?: boolean
  dashed?: boolean
}) {
  const look = LOOK[tone]
  return <button type={type} aria-pressed={pressed} className={cn('rounded-full border', SIZE[size], dashed ? look.add : pressed ? look.on : look.idle, className)} {...props} />
}
