/**
 * "AI-filled" field marker (DESIGN_SYSTEM §11.9): the wrapper gets `.ai-filled` (Iris wash + 2 px inset bar), a 14 px
 * Sparkles icon sits by the label with the tooltip "Filled by AI from your message · edit freely". Low-confidence
 * values get a warning dotted underline and "Please check". Editing the field by hand removes the marker (the form
 * calls `clear(path)` from useAIFields).
 */
import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { FieldMeta } from '@/domain/types'
import { cn } from '@/lib/utils'
import { LOW_CONFIDENCE } from './use-ai-fields'

export function AIFieldMarker({ meta }: { meta?: FieldMeta }) {
  const { t } = useTranslation('ai')
  if (meta?.origin !== 'ai') return null
  const low = (meta.confidence ?? 1) < LOW_CONFIDENCE
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} data-ai-marker className="inline-flex animate-in zoom-in-50 items-center text-ai duration-200 focus-visible:outline-none">
          <Sparkles className="size-3.5" aria-label={low ? t('field.lowTip') : t('field.tip')} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{low ? t('field.lowTip') : t('field.tip')}</TooltipContent>
    </Tooltip>
  )
}

/** Wraps a field (label + control) and paints the AI marker on it. */
export function AIField({ meta, children, className }: { meta?: FieldMeta; children: ReactNode; className?: string }) {
  const ai = meta?.origin === 'ai'
  const low = ai && (meta.confidence ?? 1) < LOW_CONFIDENCE
  return (
    <div
      data-ai-filled={ai || undefined}
      className={cn(
        'rounded-md transition-colors duration-(--dur-base)',
        ai && 'ai-filled -mx-2 px-2 py-1.5',
        low && '[&_input]:underline [&_input]:decoration-warning [&_input]:decoration-dotted [&_input]:underline-offset-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
