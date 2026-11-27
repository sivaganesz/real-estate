/**
 * The undo pattern (DESIGN_SYSTEM §11.11): every destructive or bulk action toasts with an Undo button for 6 s.
 * Services return an undo token (services/core/undo.ts keeps one level for 10 s); Undo restores the snapshot.
 */
import i18next from 'i18next'
import { toast } from 'sonner'
import { canUndo, undo } from '@/services/core/undo'

export const UNDO_TOAST_MS = 6_000

export function toastUndo(message: string, undoToken: string | undefined, opts: { description?: string } = {}) {
  if (!undoToken || !canUndo(undoToken)) {
    toast.success(message, { description: opts.description })
    return
  }
  toast.success(message, {
    description: opts.description,
    duration: UNDO_TOAST_MS,
    action: {
      label: i18next.t('common:actions.undo'),
      onClick: () => {
        if (undo(undoToken)) toast(i18next.t('ui:undo.done'))
        else toast.error(i18next.t('ui:undo.expired'))
      },
    },
  })
}

/** A service error (ValidationError, PermissionError, NotFoundError) as a toast; errors stay until dismissed. */
export function toastError(e: unknown) {
  const err = e as { key?: string; reasonKey?: string; params?: Record<string, string>; errors?: { key: string; params?: Record<string, unknown> }[]; message?: string }
  const key = err.errors?.[0] ? `common:validation.${err.errors[0].key}` : err.reasonKey ?? err.key
  toast.error(key ? i18next.t(key, err.params ?? {}) : i18next.t('ui:error.generic'), { duration: Infinity, description: key ? undefined : err.message })
}
