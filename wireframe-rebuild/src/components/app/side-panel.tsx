import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsPhone } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

/**
 * A panel for a focused task (share, filters, quick edit): from the right on tablet and desktop,
 * from the bottom on a phone — within thumb reach.
 */
export function SidePanel({ open, onOpenChange, title, description, footer, children, className }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  const phone = useIsPhone()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={phone ? 'bottom' : 'right'} className={cn(phone ? 'max-h-[90svh] rounded-t-2xl' : 'w-full sm:max-w-md', className)}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">{children}</div>
        {footer && <SheetFooter className="border-t">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
