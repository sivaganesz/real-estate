import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The top of every page: optional back link, title, one line of description, and the page's actions on the right. */
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
          <h1 className="text-xl font-semibold tracking-tight text-balance md:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

/** Page width and padding, the same on every page. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 py-5 md:px-6 md:py-6', wide ? 'max-w-[1600px]' : 'max-w-[1380px]', className)}>{children}</div>
}
