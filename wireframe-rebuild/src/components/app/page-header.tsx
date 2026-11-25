import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The top of every page: optional back link, title, one line of description, and the page's actions on the right. */
/** Breadcrumbs: "Properties / PROP-1002". The last one is the current page. */
export function Crumbs({ items }: { items: { to?: string; label: ReactNode }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {c.to ? <Link to={c.to} className="text-primary hover:underline">{c.label}</Link> : <span aria-current="page" className="font-medium text-foreground">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function PageHeader({ title, description, actions, back, eyebrow, className }: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  /** Small line above the title: an id, a status, badges. */
  eyebrow?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-5 flex flex-col gap-3', className)}>
      {back && (
        <Link to={back.to} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {back.label}
        </Link>
      )}
      {/* phone: title, then actions below it; wider: side by side */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-1.5 flex flex-wrap items-center gap-2">{eyebrow}</div>}
          <h1 className="text-xl font-bold tracking-[-.01em] text-balance">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

/** Page width and padding, the same on every page. */
/**
 * The page area beside the sidebar.
 * - `full`: list pages (tables) fill the whole width, so they line up with the top bar on any screen.
 * - otherwise the page is capped (1380 px, or 1600 px with `wide`) and centred, so text stays readable on a large screen.
 */
export function Page({ children, className, wide, full }: { children: ReactNode; className?: string; wide?: boolean; full?: boolean }) {
  return <div className={cn('w-full px-4 pt-5 pb-[60px] md:px-6', !full && 'mx-auto', full ? '' : wide ? 'max-w-[1600px]' : 'max-w-[1380px]', className)}>{children}</div>
}
