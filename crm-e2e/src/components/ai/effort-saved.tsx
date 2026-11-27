/** "✦ 8 fields auto-filled" (master prompt §12.0: show how much manual effort AI saved). */
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function EffortSaved({ count, kind = 'fields', className }: { count: number; kind?: 'fields' | 'leads' | 'tasks'; className?: string }) {
  const { t } = useTranslation('ai')
  if (!count) return <p className={cn('text-meta text-muted-foreground', className)}>{t('effort.none')}</p>
  return (
    <p className={cn('inline-flex items-center gap-1.5 text-meta font-medium text-ai', className)} data-testid="effort-saved">
      <Sparkles className="size-3.5" aria-hidden="true" />
      {t(`effort.${kind}`, { count })}
    </p>
  )
}
