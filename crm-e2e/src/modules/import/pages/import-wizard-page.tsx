/**
 * /import/:kind — the wizard. Sheet kinds (leads, apartments, villas, plots, commercial) run the sheet import; a PDF
 * or an image dropped there, or /import/document, runs document extraction. `?sample=<file>` loads a demo file from
 * public/samples exactly as if it had been picked.
 */
import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router'
import { paths } from '@/app/paths'
import { ErrorState } from '@/components/shared/error-state'
import { IconTile } from '@/components/shared/icon-tile'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { useDb } from '@/hooks/use-db'
import { fileKind } from '@/ai/document'
import { DocumentFlow } from '../components/document-flow'
import { SheetWizard } from '../components/sheet-wizard'
import { isPropertyKind, isSheetKind } from '../lib/fields'
import { KIND_ICON, KIND_TONE, kindBodyKey } from '../lib/kinds'
import { loadSample } from '../lib/browser'

export default function ImportWizardPage() {
  const { t } = useTranslation(['import', 'common'])
  const { kind = '' } = useParams()
  const [search, setSearch] = useSearchParams()
  const autoAssign = useDb((db) => db.settings.assignment.autoAssign)
  const sample = search.get('sample')
  const [file, setFile] = useState<File | null>(null)
  const [docFile, setDocFile] = useState<File | null>(null)
  // which sample the current file / error belongs to: loading = a sample is asked for and not settled yet
  const [settled, setSettled] = useState<string | null>(null)
  const [sampleError, setSampleError] = useState<string | null>(null)
  const loading = !!sample && settled !== sample

  useEffect(() => {
    if (!sample) return
    let alive = true
    loadSample(sample)
      .then((f) => {
        if (!alive) return
        const fk = fileKind(f)
        setSampleError(null)
        if (kind !== 'document' && (fk === 'pdf' || fk === 'image')) setDocFile(f)
        else setFile(f)
      })
      .catch(() => { if (alive) setSampleError(sample) })
      .finally(() => { if (alive) setSettled(sample) })
    return () => { alive = false }
  }, [sample, kind])

  const valid = kind === 'document' || isSheetKind(kind)
  if (!valid) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('import:wizard.title')} />
        <section className="rounded-lg border bg-card shadow-card">
          <ErrorState title={t('import:wizard.unknownTitle')} body={t('import:wizard.unknownBody', { kind })} />
          <div className="flex justify-center pb-8"><Button asChild variant="secondary"><Link to={paths.import()}><ArrowLeft />{t('import:wizard.backToImport')}</Link></Button></div>
        </section>
      </div>
    )
  }

  const Icon = KIND_ICON[kind as keyof typeof KIND_ICON]
  const isDoc = kind === 'document' || !!docFile
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={<Link to={paths.import()} className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />{t('import:title')}</Link>}
        title={<span className="flex items-center gap-3"><IconTile icon={Icon} tone={KIND_TONE[kind as keyof typeof KIND_TONE]} size="lg" />{isDoc && kind !== 'document' ? t('import:kind.document.title') : t(`import:kind.${kind}.wizardTitle`)}</span>}
        subtitle={isDoc ? t('import:kind.document.body') : t(kindBodyKey(kind as keyof typeof KIND_ICON, autoAssign))}
        actions={(sample || docFile) && (
          <Button variant="ghost" onClick={() => { setSearch({}); setFile(null); setDocFile(null) }}>{t('import:wizard.clearSample')}</Button>
        )}
      />
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{t('import:wizard.loadingSample', { file: sample })}</p>}
      {sampleError && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{t('import:wizard.sampleFailed', { file: sampleError })}</p>}
      {isDoc ? (
        <DocumentFlow key={docFile?.name ?? file?.name ?? 'doc'} initialFile={docFile ?? file} target={kind === 'leads' ? 'lead' : isPropertyKind(kind) ? 'property' : undefined} />
      ) : isSheetKind(kind) && (
        <SheetWizard key={kind} kind={kind} initialFile={file} onDocument={setDocFile} />
      )}
    </div>
  )
}
