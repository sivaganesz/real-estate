import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A white panel with an optional header row. The wireframe's `.card` + `.card-head`. */
export function SectionCard({ title, description, action, children, className, bodyClassName, id, ...props }: Omit<ComponentProps<'section'>, 'title'> & {
  title?: ReactNode
  description?: ReactNode
  /** Buttons or a link on the right of the header. */
  action?: ReactNode
  bodyClassName?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined}
      className={cn('scroll-mt-24 rounded-xl border bg-card text-card-foreground shadow-card', className)} {...props}>
      {(title || action) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 md:px-5">
          <div className="min-w-40 flex-1">
            {title && <h2 id={headingId} className="text-base font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn('p-4 md:px-5', title || action ? 'pt-3' : '', bodyClassName)}>{children}</div>
    </section>
  )
}
