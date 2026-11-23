import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type Segment<V extends string> = { value: V; label: ReactNode; count?: number; icon?: ReactNode; ariaLabel?: string }

/**
 * Switch between views of one list: tabs with counts (Available · Drafts · All), or cards / table.
 * `variant="tabs"` underlines the current one; `variant="pill"` is a compact button group.
 */
export function Segmented<V extends string>({ value, onChange, segments, label, variant = 'tabs', className }: {
  value: V; onChange: (v: V) => void; segments: Segment<V>[]; label: string; variant?: 'tabs' | 'pill'; className?: string
}) {
  if (variant === 'pill') {
    return (
      <div role="group" aria-label={label} className={cn('inline-flex rounded-lg border bg-card p-0.5', className)}>
        {segments.map((s) => (
          <button key={s.value} type="button" aria-pressed={value === s.value} aria-label={s.ariaLabel} onClick={() => onChange(s.value)}
            className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm [&_svg]:size-4',
              value === s.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>
    )
  }
  return (
    <nav aria-label={label} className={cn('-mb-px flex gap-1 overflow-x-auto', className)}>
      {segments.map((s) => (
        <button key={s.value} type="button" aria-current={value === s.value ? 'page' : undefined} onClick={() => onChange(s.value)}
          className={cn('flex items-center gap-1.5 border-b-2 px-2.5 pb-2.5 text-sm whitespace-nowrap transition-colors',
            value === s.value ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
          {s.icon}{s.label}
          {s.count != null && (
            <span className={cn('rounded-full px-1.5 text-xs tabular-nums', value === s.value ? 'bg-accent text-accent-foreground' : 'bg-muted')}>{s.count}</span>
          )}
        </button>
      ))}
    </nav>
  )
}
