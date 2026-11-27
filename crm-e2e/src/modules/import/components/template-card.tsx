/**
 * One default template (master prompt §15.1): what it is for, its required columns, Download .xlsx / .csv (generated
 * with SheetJS on click, so the file always matches the importer) and Upload. A role that may not import this kind
 * sees a lock with the reason instead of the Upload button.
 */
import { useState } from 'react'
import { Download, Loader2, Lock, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { IconTile } from '@/components/shared/icon-tile'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import type { SheetKind } from '../lib/fields'
import { KIND_ICON, KIND_TONE, kindBodyKey, kindPermission } from '../lib/kinds'
import { TEMPLATES } from '../lib/templates'
import { downloadFile } from '../lib/browser'

export function TemplateCard({ kind }: { kind: SheetKind }) {
  const { t } = useTranslation(['import', 'shell'])
  const { can, explain } = usePermission()
  const autoAssign = useDb((db) => db.settings.assignment.autoAssign)
  const [busy, setBusy] = useState<'xlsx' | 'csv' | null>(null)
  const allowed = can(kindPermission(kind))
  const denied = explain(kindPermission(kind))
  const def = TEMPLATES[kind]
  const required = def.columns.filter((c) => c.required).map((c) => c.header)

  const download = async (type: 'xlsx' | 'csv') => {
    setBusy(type)
    try {
      const { templateFile } = await import('../lib/workbook')
      const f = templateFile(kind, type)
      downloadFile(f.name, f.data, f.mime)
      toast.success(t('import:template.downloaded', { file: f.name }))
    } catch {
      toast.error(t('import:template.downloadFailed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card transition-shadow duration-(--dur-fast) hover:shadow-md" data-testid={`template-${kind}`}>
      <header className="flex items-start gap-3">
        <IconTile icon={KIND_ICON[kind]} tone={KIND_TONE[kind]} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t(`import:kind.${kind}.title`)}</h3>
          <p className="mt-0.5 text-meta text-muted-foreground">{t(kindBodyKey(kind, autoAssign))}</p>
        </div>
      </header>
      <div className="flex flex-wrap gap-1">
        {required.map((h) => <span key={h} className="rounded-xs bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">{h}</span>)}
        <span className="rounded-xs px-1.5 py-0.5 text-caption text-subtle-foreground">{t('import:template.columns', { count: def.columns.length })}</span>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {(['xlsx', 'csv'] as const).map((type) => (
          <Button key={type} type="button" variant="secondary" size="sm" onClick={() => void download(type)} disabled={busy !== null} aria-busy={busy === type || undefined}
            aria-label={t('import:template.downloadAria', { type: `.${type}`, name: t(`import:kind.${kind}.title`) })} data-testid={`download-${kind}-${type}`}>
            {busy === type ? <Loader2 className="animate-spin" /> : <Download />}.{type}
          </Button>
        ))}
        {allowed ? (
          <Button asChild size="sm" className="ml-auto"><Link to={paths.importKind(kind)} data-testid={`upload-${kind}`}><Upload />{t('import:template.upload')}</Link></Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-neutral-soft px-2.5 text-meta font-medium text-neutral" data-testid={`locked-${kind}`}>
                <Lock className="size-3.5" aria-hidden="true" />{t('import:template.locked')}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{t(denied.reasonKey, denied.params)}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </article>
  )
}
