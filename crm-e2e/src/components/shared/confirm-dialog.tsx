/**
 * Ask before anything hard to undo. Ported from wireframe-rebuild/src/components/app/confirm-dialog.tsx onto the
 * alert-dialog primitive (focus stays inside; Esc cancels). The confirm button names the action ("Delete 3 leads").
 * Pair it with `toastUndo()` (./undo-toast) for the DS §11.11 undo pattern: confirm → act → toast with Undo for 6 s.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'

export function ConfirmDialog({ open, onOpenChange, title, description, children, confirmLabel, cancelLabel, onConfirm, tone = 'default' }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Extra content (a reason select, a list of what changes). */
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  tone?: 'default' | 'danger'
}) {
  const { t } = useTranslation('common')
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : <AlertDialogDescription className="sr-only">{title}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel ?? t('actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: tone === 'danger' ? 'destructive' : 'default' })} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
