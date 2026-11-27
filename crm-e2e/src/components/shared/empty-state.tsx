/**
 * Empty state (DESIGN_SYSTEM §9, §11.10): centred illustration (120 px), a title, one muted line, then one primary
 * action and one secondary (usually the AI path). `compact` is the filtered-empty variant (80 px, no hero).
 */
import type { ReactNode } from 'react'
import type { Illustration } from '@/components/illustrations'
import { cn } from '@/lib/utils'

export function EmptyState({ illustration: Art, title, body, primary, secondary, badge, compact, className }: {
  illustration?: Illustration
  title: ReactNode
  body?: ReactNode
  primary?: ReactNode
  secondary?: ReactNode
  badge?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'py-8' : 'py-12', className)}>
      {Art && <Art size={compact ? 80 : 120} />}
      {badge && <div className="mt-4">{badge}</div>}
      <h2 className={cn('text-base font-semibold text-foreground', badge ? 'mt-2' : 'mt-4')}>{title}</h2>
      {body && <div className="mt-1 max-w-md text-sm text-muted-foreground">{body}</div>}
      {(primary || secondary) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primary}
          {secondary}
        </div>
      )}
    </div>
  )
}
