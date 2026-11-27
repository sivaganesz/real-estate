/**
 * Switch between views of one list. Ported from wireframe-rebuild/src/components/app/segmented.tsx and restyled:
 * `tabs` is the underline style with a 2 px Peacock indicator and counts in `bg-muted` pills (DS §11.12);
 * `pill` is a compact button group (cards / table, day / week / month).
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Segment<V extends string> = { value: V; label: ReactNode; count?: number; icon?: ReactNode; ariaLabel?: string; badge?: ReactNode }

export function Segmented<V extends string>({ value, onChange, segments, label, variant = 'tabs', className }: {
  value: V
  onChange: (v: V) => void
  segments: Segment<V>[]
  label: string
  variant?: 'tabs' | 'pill'
  className?: string
}) {
  if (variant === 'pill') {
    return (
      <div role="group" aria-label={label} className={cn('inline-flex rounded-md border bg-muted/60 p-0.5', className)}>
        {segments.map((s) => (
          <button
            key={s.value} type="button" aria-pressed={value === s.value} aria-label={s.ariaLabel} onClick={() => onChange(s.value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-ui font-medium transition-colors duration-(--dur-fast) [&_svg]:size-4',
              value === s.value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s.icon}
            {s.label}
            {s.count != null && <span className="text-meta text-muted-foreground tabular-nums">{s.count}</span>}
          </button>
        ))}
      </div>
    )
  }
  return (
    <nav aria-label={label} className={cn('-mb-px flex gap-1 overflow-x-auto border-b', className)}>
      {segments.map((s) => {
        const on = value === s.value
        return (
          <button
            key={s.value} type="button" aria-current={on ? 'page' : undefined} aria-label={s.ariaLabel} onClick={() => onChange(s.value)}
            className={cn(
              'relative flex items-center gap-1.5 px-2.5 pt-1 pb-2.5 text-ui whitespace-nowrap transition-colors duration-(--dur-fast) [&_svg]:size-4',
              on ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s.icon}
            {s.label}
            {s.badge}
            {s.badge == null && s.count != null && (
              <span className={cn('rounded-full px-1.5 text-meta tabular-nums', on ? 'bg-primary-soft text-primary' : 'bg-muted')}>{s.count}</span>
            )}
            <span aria-hidden="true" className={cn('absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary transition-opacity duration-(--dur-base)', on ? 'opacity-100' : 'opacity-0')} />
          </button>
        )
      })}
    </nav>
  )
}
