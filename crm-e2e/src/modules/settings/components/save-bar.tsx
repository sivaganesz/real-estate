/**
 * The save row under an editable settings card: "Unsaved changes" with Discard and Save (disabled while invalid),
 * or a quiet "Saved" when nothing changed. Saving goes through services/settings, which toasts with Undo.
 */
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function SaveBar({ dirty, valid = true, onSave, onDiscard, invalidText, className, testId }: {
  dirty: boolean
  valid?: boolean
  onSave: () => void
  onDiscard: () => void
  invalidText?: string
  className?: string
  testId?: string
}) {
  const { t } = useTranslation('settings')
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 border-t pt-4', className)}>
      <span role="status" className={cn('mr-auto text-meta', dirty ? (valid ? 'text-warning' : 'text-danger') : 'text-muted-foreground')}>
        {dirty ? (valid ? t('save.unsaved') : invalidText ?? t('save.invalid')) : <span className="inline-flex items-center gap-1"><Check className="size-3.5" aria-hidden="true" />{t('save.saved')}</span>}
      </span>
      {dirty && <Button variant="ghost" onClick={onDiscard}>{t('save.discard')}</Button>}
      <Button onClick={onSave} disabled={!dirty || !valid} data-testid={testId}>{t('save.save')}</Button>
    </div>
  )
}
