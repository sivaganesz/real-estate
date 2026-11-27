/**
 * Page header (DESIGN_SYSTEM §14 rule 1): H1 + one-line subtitle on the left; view switcher, secondary actions and
 * ONE primary action on the right. Wraps under the title on narrow screens.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({ title, subtitle, actions, eyebrow, className }: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-meta text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-2xl font-[650] tracking-[-0.02em] text-foreground [:lang(ta)_&]:tracking-normal">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
