/**
 * Badges and pills (DESIGN_SYSTEM §11.12): `h-5 rounded-full px-2 text-meta`. Ported from
 * wireframe-rebuild/src/components/app/status-chip.tsx and restyled to DS tokens.
 *  - ToneBadge: soft (tinted), outline, or dot (dot + plain label). Colour is never the only signal: pass an icon or a dot.
 *  - CountBadge: the small count bubble used in nav, tabs and pills.
 *  - StatusDot: a 6–8 px solid dot for lists and legends.
 */
import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { TONE, type Tone, type ToneClasses } from '@/lib/tones'
import { cn } from '@/lib/utils'

type BadgeProps = Omit<ComponentProps<'span'>, 'children'> & {
  tone?: Tone
  /** A domain tone from lib/tones (stage, temperature, …); wins over `tone`. */
  classes?: ToneClasses
  variant?: 'soft' | 'outline' | 'dot'
  icon?: LucideIcon | null
  size?: 'sm' | 'md'
  children: ReactNode
}

export function ToneBadge({ tone = 'neutral', classes, variant = 'soft', icon, size = 'sm', className, children, ...props }: BadgeProps) {
  const c = classes ?? TONE[tone]
  const Icon = icon === null ? undefined : (icon ?? undefined)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap tabular-nums',
        size === 'sm' ? 'h-5 px-2 text-meta' : 'h-6 px-2.5 text-ui',
        variant === 'soft' && cn(c.soft, c.text),
        variant === 'outline' && cn('border bg-card', c.text),
        variant === 'dot' && 'px-0 text-foreground',
        className,
      )}
      {...props}
    >
      {variant === 'dot' && <span aria-hidden="true" className={cn('size-1.5 rounded-full', c.solid)} />}
      {Icon && <Icon aria-hidden="true" className="size-3 shrink-0" strokeWidth={2} />}
      <span className="truncate">{children}</span>
    </span>
  )
}

/** A soft wash + solid dot + foreground label: for stage and appointment colours, which are marks, not text. */
export function DotBadge({ classes, children, className, title }: { classes: ToneClasses; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-meta font-medium whitespace-nowrap text-foreground', classes.soft, className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', classes.solid)} />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function CountBadge({ count, tone = 'neutral', className, label }: { count: number; tone?: Tone; className?: string; label?: string }) {
  const c = TONE[tone]
  return (
    <span aria-label={label} className={cn('inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-micro font-semibold tabular-nums', tone === 'neutral' ? 'bg-muted text-muted-foreground' : cn(c.soft, c.text), className)}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function StatusDot({ classes, tone = 'neutral', className }: { classes?: ToneClasses; tone?: Tone; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-2 shrink-0 rounded-full', (classes ?? TONE[tone]).solid, className)} />
}
