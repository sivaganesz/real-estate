/**
 * A card with an optional header row: title (+ icon), description and actions on the right. Ported from
 * wireframe-rebuild/src/components/app/section-card.tsx; restyled to DS §5 (rounded-lg, shadow-card, p-5 / p-4).
 */
import type { ComponentProps, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SectionCard({ title, description, action, icon: Icon, children, className, bodyClassName, id, ...props }: Omit<ComponentProps<'section'>, 'title'> & {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  bodyClassName?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn('scroll-mt-24 rounded-lg border bg-card text-card-foreground shadow-card', className)} {...props}>
      {(title || action) && (
        <header className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 pt-4 md:px-5 md:pt-5">
          <div className="min-w-40 flex-1">
            {title && (
              <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold">
                {Icon && <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-meta text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn('p-4 md:p-5', (title || action) && 'pt-3 md:pt-3', bodyClassName)}>{children}</div>
    </section>
  )
}
