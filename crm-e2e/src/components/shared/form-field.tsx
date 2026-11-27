/**
 * A form field wrapper (DESIGN_SYSTEM §11.12 inputs): label above (`text-sm` 500), "(optional)" in muted text,
 * helper text, and an inline error in `text-danger text-xs` with an AlertCircle; required fields say "Required" to
 * screen readers, never asterisk-only. `ai` marks a value filled by AI (see components/ai/ai-field).
 */
import { useId, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function FormField({ label, optional, required, hint, error, children, className, id: idProp, labelEnd }: {
  label: ReactNode
  optional?: boolean
  required?: boolean
  hint?: ReactNode
  error?: ReactNode
  /** Render prop gets the input id and the describedby ids. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
  id?: string
  /** Something at the end of the label row (the ✦ AI marker). */
  labelEnd?: ReactNode
}) {
  const { t } = useTranslation('common')
  const auto = useId()
  const id = idProp ?? auto
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
        <span>{label}</span>
        {optional && <span className="font-normal text-muted-foreground">{t('optional')}</span>}
        {required && <span className="sr-only">{t('required')}</span>}
        {labelEnd}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && !error && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={errId} className="flex items-center gap-1 text-xs text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
