import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Ask before anything hard to undo (archive, mark sold, reassign). The confirm button names the action. */
export function ConfirmDialog({ open, onOpenChange, title, children, confirmLabel, onConfirm, danger, className }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  children?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  danger?: boolean
  /** e.g. a wider dialog for more content */
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {children && <DialogDescription asChild><div>{children}</div></DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('action.cancel')}</Button>
          <Button variant={danger ? 'destructive' : 'default'} onClick={() => { onConfirm(); onOpenChange(false) }}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
