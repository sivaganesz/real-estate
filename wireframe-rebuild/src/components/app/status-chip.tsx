import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { type Tone, toneFill, toneSoft, toneText } from './tone'

type Props = ComponentProps<'span'> & {
  tone?: Tone
  /** soft (default): tinted pill · outline: bordered, no fill · dot: a coloured dot and plain text */
  variant?: 'soft' | 'outline' | 'dot'
  icon?: ReactNode
}

/** A status label: property status, lead stage, match strength, document state. */
export function StatusChip({ tone = 'neutral', variant = 'soft', icon, className, children, ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3.5',
        variant === 'soft' && toneSoft[tone],
        variant === 'outline' && cn('border bg-card', toneText[tone]),
        variant === 'dot' && 'px-0 text-foreground',
        className,
      )}
      {...props}
    >
      {variant === 'dot' && <span className={cn('size-2 rounded-full', toneFill[tone])} aria-hidden />}
      {icon}
      {children}
    </span>
  )
}
