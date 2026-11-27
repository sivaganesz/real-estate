import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A keyboard key hint ("Ctrl K"). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('inline-flex h-5 items-center gap-0.5 rounded-xs border bg-card px-1.5 font-sans text-micro font-medium text-muted-foreground shadow-xs', className)}>
      {children}
    </kbd>
  )
}
