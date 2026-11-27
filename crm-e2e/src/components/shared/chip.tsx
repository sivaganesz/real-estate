/**
 * A small rounded button: an option switched on and off (`pressed`), a suggestion, or a dashed "add" action. Ported
 * from wireframe-rebuild/src/components/app/chip.tsx; the violet tone became the AI (Iris) tone.
 */
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type ChipTone = 'primary' | 'ai'
const LOOK: Record<ChipTone, { idle: string; on: string; add: string }> = {
  primary: {
    idle: 'bg-card text-foreground hover:bg-muted',
    on: 'border-primary/40 bg-primary-soft text-primary',
    add: 'border-dashed text-primary hover:bg-primary-soft',
  },
  ai: {
    idle: 'border-ai-border bg-card text-ai hover:bg-ai-soft',
    on: 'border-ai bg-ai text-ai-foreground',
    add: 'border-dashed border-ai-border bg-card text-ai hover:bg-ai-soft',
  },
}
const SIZE = { sm: 'h-6 px-2 text-meta [&_svg]:size-3', md: 'h-7 px-2.5 text-ui [&_svg]:size-3.5' }

export function Chip({ tone = 'primary', size = 'md', pressed, dashed, type = 'button', className, ...props }: ComponentProps<'button'> & {
  tone?: ChipTone
  size?: 'sm' | 'md'
  pressed?: boolean
  dashed?: boolean
}) {
  const look = LOOK[tone]
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap transition-colors duration-(--dur-fast) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50',
        SIZE[size], dashed ? look.add : pressed ? look.on : look.idle, className,
      )}
      {...props}
    />
  )
}
