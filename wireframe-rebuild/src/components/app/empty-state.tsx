import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shown when a list or section has nothing yet: what's missing and the one action that fixes it. */
export function EmptyState({ icon: Icon, title, children, action, className, compact }: {
  icon?: LucideIcon; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string; compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed text-center', compact ? 'px-4 py-6' : 'px-6 py-12', className)}>
      {Icon && <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground"><Icon className="size-5" /></span>}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
