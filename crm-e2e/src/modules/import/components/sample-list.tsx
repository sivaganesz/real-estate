/**
 * "Try a sample" (foundation-plan §8.3 M5): every demo file in public/samples with what it shows, a Try button that
 * opens the right wizard with the file already loaded, and a plain download link.
 */
import { Download, FileImage, FileSpreadsheet, FileText, Lock, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePermission } from '@/hooks/use-permission'
import { cn } from '@/lib/utils'
import { SAMPLES, kindPermission, sampleHref, sampleKey, type Sample } from '../lib/kinds'

const ICON = { csv: FileSpreadsheet, xlsx: FileSpreadsheet, pdf: FileText, image: FileImage } as const

export function SampleList({ only, compact, className }: { only?: (s: Sample) => boolean; compact?: boolean; className?: string }) {
  const { t } = useTranslation(['import', 'shell'])
  const { can, explain } = usePermission()
  const list = only ? SAMPLES.filter(only) : SAMPLES
  return (
    <ul className={cn('flex flex-col gap-2', className)} data-testid="sample-list">
      {list.map((s) => {
        const Icon = ICON[s.type]
        const allowed = can(kindPermission(s.kind))
        const denied = explain(kindPermission(s.kind))
        const key = sampleKey(s.file)
        return (
          <li key={s.file} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4.5" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{t(`import:samples.items.${key}.title`)}</span>
              {!compact && <span className="block truncate text-meta text-muted-foreground">{t(`import:samples.items.${key}.body`)}</span>}
            </span>
            <Button asChild variant="ghost" size="icon-sm" className="max-sm:hidden">
              <a href={`${import.meta.env.BASE_URL}samples/${s.file}`} download aria-label={t('import:samples.download', { file: s.file })}><Download /></a>
            </Button>
            {allowed ? (
              <Button asChild size="sm" variant="secondary">
                <Link to={sampleHref(s)} data-testid={`try-${key}`}><Play />{t('import:samples.try')}</Link>
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex h-8 items-center gap-1 rounded-md bg-neutral-soft px-2 text-meta text-neutral"><Lock className="size-3.5" aria-hidden="true" />{t('import:template.locked')}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">{t(denied.reasonKey, denied.params)}</TooltipContent>
              </Tooltip>
            )}
          </li>
        )
      })}
    </ul>
  )
}
