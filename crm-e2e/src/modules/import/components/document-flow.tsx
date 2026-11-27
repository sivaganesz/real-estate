/**
 * Document extraction (master prompt §15.3): a PDF, a photo or a scan → text (pdf.js, or tesseract.js OCR with its
 * real progress) → the same extractLead / extractProperty as paste-and-fill → a review form with ✦ AI markers and
 * low-confidence fields highlighted → Save, or keep as a Draft when it is uncertain. A brochure with a unit table gives
 * one entry per unit type. The manual path is always there: edit the text and read it again, or fill the form by hand.
 * Nothing is saved until the user clicks Save.
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, FileClock, FileImage, FileText, Loader2, PencilLine, RefreshCw, RotateCcw, Save, ScanText, Sparkles, Upload,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAI } from '@/ai'
import { fileKind, guessRecordKind, readDocument, splitUnits, type DocProgress, type DocText, type KindGuess } from '@/ai/document'
import type { AIMode } from '@/ai/types'
import { paths } from '@/app/paths'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { EffortSaved } from '@/components/ai/effort-saved'
import { Callout } from '@/components/shared/callout'
import { FileUploader } from '@/components/shared/file-uploader'
import { Meter } from '@/components/shared/meter'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { ToneBadge } from '@/components/shared/badges'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ImportJob } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { runImport } from '@/services/imports'
import { checkEntry, entryDraft, entryFromExtraction, isUncertain, prepareText, refineProperty, type DocEntry, type RecordKind } from '../lib/document'
import { ACCEPT_DOCS, MAX_FILE_MB } from '../lib/kinds'
import { RecordForm } from './record-form'
import { SampleList } from './sample-list'
import { WizardStepper } from './wizard-stepper'

type Step = 0 | 1 | 2 | 3
type Saved = { jobId: string; undoToken?: string }

const PROGRESS_STAGES: DocProgress['stage'][] = ['loading', 'pdf', 'ocrEngine', 'ocrLanguage', 'ocrInit', 'ocr']

/** The object URL lives exactly as long as the <img> (a React 19 ref cleanup), so a re-mount never shows a dead URL. */
function ImagePreview({ file }: { file: File }) {
  return (
    <img
      alt={file.name} className="max-h-72 w-full rounded-md border bg-muted object-contain"
      ref={(el) => {
        if (!el) return
        const u = URL.createObjectURL(file)
        el.src = u
        return () => URL.revokeObjectURL(u)
      }}
    />
  )
}

export function DocumentFlow({ initialFile, target: fixedTarget }: { initialFile?: File | null; target?: RecordKind }) {
  const { t } = useTranslation(['import', 'common'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const job = useDb((db) => db.importJobs)
  const [step, setStep] = useState<Step>(0)
  const [files, setFiles] = useState<File[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<DocProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocText | null>(null)
  const [text, setText] = useState('')
  const [readText, setReadText] = useState('')
  const [guess, setGuess] = useState<KindGuess | null>(null)
  const [target, setTarget] = useState<RecordKind>(fixedTarget ?? 'lead')
  const [entries, setEntries] = useState<DocEntry[]>([])
  const [active, setActive] = useState(0)
  const [mode, setMode] = useState<AIMode | null>(null)
  const [filled, setFilled] = useState(0)
  const [extracting, setExtracting] = useState(false)
  const [saved, setSaved] = useState<Saved | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const started = useRef<File | null>(null)

  const checked = useMemo(() => entries.map((e) => checkEntry(target, e)), [entries, target])
  const complete = checked.filter((c) => c.complete).length
  const uncertain = checked.some((c) => isUncertain(c, doc?.confidence))
  const canProperty = can('property.create')

  const extract = async (source: string, kind: RecordKind, ocrConfidence?: number) => {
    setExtracting(true)
    try {
      const ctx = context()
      if (kind === 'lead') {
        const x = await ai.extractLead(prepareText(source), ctx)
        setEntries([entryFromExtraction('lead', x.fields as Record<string, unknown>, x.meta, { ocrConfidence, sourceText: source })])
        setMode(x.mode)
        setFilled(x.filledCount)
      } else {
        const units = splitUnits(source)
        const out: DocEntry[] = []
        let count = 0
        let m: AIMode = ai.mode
        for (const u of units) {
          const x = await ai.extractProperty(u.text.replace(/\b(site|sales)\s+office\b/gi, 'sales desk'), ctx)
          const entry = entryFromExtraction('property', x.fields as Record<string, unknown>, x.meta, { ocrConfidence, label: u.label })
          out.push(refineProperty(entry, source, u.label ? { line: u.label, header: u.header } : undefined))
          count += x.filledCount
          m = x.mode
        }
        setEntries(out)
        setMode(m)
        setFilled(count)
      }
      setActive(0)
      setReadText(source)
    } catch (e) {
      toastError(e)
    } finally {
      setExtracting(false)
    }
  }

  const read = async (f: File) => {
    const fk = fileKind(f)
    if (fk !== 'pdf' && fk !== 'image' && fk !== 'text') { setError(t('import:doc.unsupported', { file: f.name })); return }
    setFile(f)
    setError(null)
    setErrorDetail(null)
    setStep(1)
    setProgress({ stage: 'loading', progress: 0 })
    try {
      const d = await readDocument(f, setProgress)
      if (!d.text.trim()) {
        setError(t('import:doc.noText'))
        setStep(0)
        setPasteOpen(true)
        return
      }
      setDoc(d)
      setText(d.text)
      const g = guessRecordKind(d.text)
      setGuess(g)
      const kind = fixedTarget ?? (g.kind === 'property' && !canProperty ? 'lead' : g.kind)
      setTarget(kind)
      await extract(d.text, kind, d.confidence)
      setStep(2)
    } catch (e) {
      setError(t(fk === 'image' ? 'import:doc.ocrFailed' : 'import:doc.readFailed', { file: f.name }))
      setErrorDetail(e instanceof Error ? e.message : String(e))
      setStep(0)
    }
  }

  const start = useEffectEvent((f: File) => {
    started.current = f
    setFiles([f])
    void read(f)
  })
  useEffect(() => {
    if (initialFile && started.current !== initialFile) start(initialFile)
  }, [initialFile])

  const fromText = async () => {
    const clean = text.trim()
    if (!clean) return
    setFile(null)
    setDoc({ text: clean, source: 'text' })
    const g = guessRecordKind(clean)
    setGuess(g)
    const kind = fixedTarget ?? (g.kind === 'property' && !canProperty ? 'lead' : g.kind)
    setTarget(kind)
    await extract(clean, kind)
    setStep(2)
  }
  const manual = () => {
    setFile(null)
    setDoc(null)
    setGuess(null)
    setMode(null)
    setFilled(0)
    setEntries([{ label: '', values: {}, meta: {} }])
    setStep(2)
  }
  const reset = () => {
    setStep(0); setFiles([]); setFile(null); setDoc(null); setText(''); setReadText(''); setEntries([]); setSaved(null); setError(null); setProgress(null); setGuess(null)
    started.current = null
  }

  const edit = (field: string, value: string) => setEntries((list) => list.map((e, i) => (i === active ? { ...e, values: { ...e.values, [field]: value }, meta: { ...e.meta, [field]: { origin: 'manual' } } } : e)))

  const save = (asDrafts: boolean) => {
    const fileName = file?.name ?? t('import:doc.pastedName')
    const fileType: ImportJob['fileType'] = !doc || doc.source === 'text' ? 'text' : doc.source === 'image' ? 'image' : 'pdf'
    const source = { type: (doc?.source === 'image' || doc?.source === 'scan' ? 'image' : doc?.source === 'pdf' ? 'pdf' : 'paste') as 'image' | 'pdf' | 'paste', fileName: file?.name, text: (readText || text).slice(0, 4000) }
    const keep = entries.map((e, i) => ({ e, c: checked[i] }))
    const records = asDrafts ? [] : keep.filter((x) => x.c.complete)
    const drafts = keep.filter((x) => asDrafts || !x.c.complete).map((x) => entryDraft(target, x.e, x.c, source, t('import:doc.untitled')))
    try {
      const { jobId, undoToken } = runImport({
        kind: 'document', fileName, fileType, template: 'document',
        leads: target === 'lead' ? records.map((x) => x.c.lead!) : [],
        properties: target === 'property' ? records.map((x) => x.c.property!) : [],
        drafts, counts: { total: entries.length, imported: records.length, drafts: drafts.length },
      })
      toastUndo(t(drafts.length && !records.length ? 'import:doc.savedDrafts' : 'import:doc.saved', { count: records.length || drafts.length }), undoToken, { description: fileName })
      setSaved({ jobId, undoToken })
      setStep(3)
    } catch (e) {
      toastError(e)
    }
  }

  const savedJob = saved ? job.find((j) => j.id === saved.jobId) : undefined
  const steps = [t('import:step.upload'), t('import:step.read'), t('import:step.review'), t('import:step.done')]
  const pct = Math.round((progress?.progress ?? 0) * 100)
  const entry = entries[active]
  const check = checked[active]

  return (
    <div className="flex flex-col gap-5" data-testid="document-flow">
      <WizardStepper steps={steps} current={step} label={t('import:step.label')} />

      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-12">
          <SectionCard className="lg:col-span-7" icon={ScanText} title={t('import:doc.title')} description={t('import:doc.body')} action={<DemoAIBadge mode={ai.mode} />}>
            <div className="flex flex-col gap-4">
              <FileUploader files={files} onFilesChange={(f) => { setFiles(f); if (f[0]) void read(f[0]) }} accept={ACCEPT_DOCS} maxSizeMb={MAX_FILE_MB}
                label={t('import:doc.drop')} hint={t('import:doc.hint', { size: MAX_FILE_MB })} />
              {error && (
                <Callout tone="danger" title={t('import:doc.errorTitle')}>
                  {error}
                  {errorDetail && <span className="mt-1 block font-mono text-caption text-muted-foreground" data-testid="doc-error-detail">{errorDetail}</span>}
                </Callout>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}><FileText />{t('import:doc.pasteToggle')}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={manual} data-testid="doc-manual"><PencilLine />{t('import:doc.manual')}</Button>
              </div>
              {pasteOpen && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="doc-paste" className="text-sm font-medium">{t('import:doc.pasteLabel')}</label>
                  <Textarea id="doc-paste" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('import:doc.pastePlaceholder')} className="text-prompt" />
                  <div><Button type="button" variant="ai" disabled={!text.trim() || extracting} onClick={() => void fromText()}>{extracting ? <Loader2 className="animate-spin" /> : <Sparkles />}{t('import:doc.extract')}</Button></div>
                </div>
              )}
            </div>
          </SectionCard>
          <SectionCard className="lg:col-span-5" title={t('import:samples.titleShort')} description={t('import:doc.samplesBody')}>
            <SampleList compact only={(s) => s.kind === 'document'} />
          </SectionCard>
        </div>
      )}

      {step === 1 && (
        <SectionCard icon={file && fileKind(file) === 'image' ? FileImage : FileText} title={file?.name ?? ''} description={t('import:doc.readingBody')}>
          <div className="flex flex-col gap-4" role="status" aria-live="polite" data-testid="doc-progress">
            <ol className="flex flex-wrap gap-2">
              {PROGRESS_STAGES.filter((s) => (file && fileKind(file) === 'image' ? s !== 'pdf' : true)).map((s) => {
                const idx = PROGRESS_STAGES.indexOf(s)
                const cur = progress ? PROGRESS_STAGES.indexOf(progress.stage) : -1
                return (
                  <li key={s}>
                    <ToneBadge tone={idx < cur || progress?.stage === 'done' ? 'success' : idx === cur ? 'ai' : 'neutral'} icon={idx === cur ? Loader2 : null} className={idx === cur ? '[&_svg]:animate-spin' : undefined}>
                      {t(`import:doc.stage.${s}`)}
                    </ToneBadge>
                  </li>
                )
              })}
            </ol>
            <div className="flex items-center gap-3">
              <Meter value={pct} tone="ai" size="md" label={t('import:doc.progress')} />
              <span className="w-12 text-right text-sm tabular-nums">{pct}%</span>
            </div>
            <p className="text-meta text-muted-foreground">
              {progress?.pages ? t('import:doc.pageOf', { page: progress.page ?? 1, pages: progress.pages }) : ''}{' '}
              {extracting ? t('import:doc.extracting') : progress && progress.stage.startsWith('ocr') ? t('import:doc.ocrNote') : ''}
            </p>
          </div>
        </SectionCard>
      )}

      {step === 2 && entry && check && (
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="flex flex-col gap-4 xl:col-span-5">
            <SectionCard icon={doc?.source === 'image' ? FileImage : FileText} title={file?.name ?? t(doc ? 'import:doc.pastedName' : 'import:doc.manualTitle')}
              description={doc ? t(`import:doc.source.${doc.source}`, { count: doc.pages ?? 1 }) : t('import:doc.manualBody')}>
              <div className="flex flex-col gap-3">
                {file && fileKind(file) === 'image' && <ImagePreview file={file} />}
                {doc?.confidence != null && (
                  <div className="flex items-center gap-3">
                    <span className="text-meta text-muted-foreground">{t('import:doc.ocrConfidence')}</span>
                    <Meter value={doc.confidence * 100} tone={doc.confidence < 0.75 ? 'warning' : 'success'} className="flex-1" label={t('import:doc.ocrConfidence')} />
                    <span className="text-meta tabular-nums">{Math.round(doc.confidence * 100)}%</span>
                  </div>
                )}
                {doc && (
                  <>
                    <label htmlFor="doc-text" className="text-sm font-medium">{t('import:doc.textLabel')}</label>
                    <Textarea id="doc-text" rows={10} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-meta" data-testid="doc-text" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="ai" size="sm" disabled={extracting || !text.trim()} onClick={() => void extract(text, target, doc.confidence)}>
                        {extracting ? <Loader2 className="animate-spin" /> : <RefreshCw />}{t('import:doc.reread')}
                      </Button>
                      {text !== readText && <span className="text-meta text-warning">{t('import:doc.textChanged')}</span>}
                    </div>
                  </>
                )}
              </div>
            </SectionCard>
          </div>

          <div className="flex flex-col gap-4 xl:col-span-7">
            <SectionCard
              title={t('import:doc.reviewTitle')}
              description={mode ? t('import:doc.reviewBody') : t('import:doc.reviewManual')}
              action={mode && <DemoAIBadge mode={mode} />}
            >
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {!fixedTarget && (
                    <Segmented
                      variant="pill" value={target} label={t('import:doc.target')}
                      onChange={(k) => { setTarget(k); if (doc) void extract(text, k, doc.confidence); else setEntries([{ label: '', values: {}, meta: {} }]) }}
                      segments={(['lead', 'property'] as const).filter((k) => k === 'lead' || canProperty).map((k) => ({ value: k, label: t(`import:doc.as.${k}`) }))}
                    />
                  )}
                  {guess && guess.signals.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-ai-soft px-2 py-1 text-meta text-ai">
                      <Sparkles className="size-3" aria-hidden="true" />
                      {t('import:doc.guess', { kind: t(`import:doc.as.${guess.kind}`), pct: Math.round(guess.confidence * 100), signals: guess.signals.join(', ') })}
                    </span>
                  )}
                </div>
                {mode && <EffortSaved count={filled} />}
                {entries.length > 1 && (
                  <div className="overflow-x-auto border-b [scrollbar-width:none]">
                    <Segmented value={String(active)} onChange={(v) => setActive(Number(v))} label={t('import:doc.units')}
                      segments={entries.map((e, i) => ({ value: String(i), label: e.label.split(/\s{2,}/)[0] || t('import:doc.unitN', { n: i + 1 }), badge: checked[i].complete ? undefined : <span className="size-1.5 rounded-full bg-warning" aria-label={t('import:doc.needsInfo')} /> }))} />
                  </div>
                )}
                {check.low.length > 0 && <Callout tone="warning" title={t('import:doc.lowTitle', { count: check.low.length })}>{t('import:doc.lowBody')}</Callout>}
                {check.blocking.length > 0 && <Callout tone="info" title={t('import:doc.missingTitle', { count: check.blocking.length })}>{t('import:doc.missingBody')}</Callout>}
                {extracting ? (
                  <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-14 rounded-md" />)}</div>
                ) : (
                  <RecordForm kind={target} values={entry.values} meta={entry.meta} issues={check.issues} onChange={edit} idPrefix={`doc-${active}`} />
                )}
              </div>
            </SectionCard>
            <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-popover/95 p-3 shadow-lg backdrop-blur mr-14 md:bottom-4 md:mr-16">
              <Button type="button" variant="ghost" onClick={reset}><RotateCcw />{t('import:doc.startOver')}</Button>
              <div className="flex flex-wrap items-center gap-2">
                {uncertain && <span className="text-meta text-warning max-sm:hidden">{t('import:doc.uncertain')}</span>}
                <Button type="button" variant={uncertain ? 'default' : 'secondary'} onClick={() => save(true)} disabled={extracting} data-testid="doc-save-draft">
                  <FileClock />{t('import:doc.saveDraft', { count: entries.length })}
                </Button>
                {complete > 0 && (
                  <Button type="button" variant={uncertain ? 'secondary' : 'default'} onClick={() => save(false)} disabled={extracting} data-testid="doc-save">
                    <Save />{complete === entries.length ? t(`import:doc.save.${target}`, { count: complete }) : t('import:doc.saveMixed', { records: complete, drafts: entries.length - complete })}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && saved && (
        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card" data-testid="doc-done">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><Save className="size-6" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{savedJob ? t('import:doc.doneTitle', { records: savedJob.createdIds.length, drafts: savedJob.draftIds.length }) : t('import:done.undoneTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('import:doc.doneBody')}</p>
            </div>
            <Button variant="secondary" onClick={reset}><Upload />{t('import:doc.another')}</Button>
          </div>
          {savedJob && (
            <ul className="flex flex-wrap gap-2">
              {savedJob.createdIds.map((id) => (
                <li key={id}><Button asChild size="sm"><Link to={id.startsWith('LEAD') ? paths.lead(id) : paths.property(id)}>{t(id.startsWith('LEAD') ? 'import:doc.openLead' : 'import:doc.openProperty', { id })}<ArrowRight /></Link></Button></li>
              ))}
              {savedJob.draftIds.map((id) => (
                <li key={id}><Button asChild size="sm" variant="ai"><Link to={paths.draft(id)}><FileClock />{t('import:doc.openDraft', { id })}</Link></Button></li>
              ))}
            </ul>
          )}
        </section>
      )}
      {step === 2 && !entry && <Callout tone="danger">{t('import:doc.nothing')}</Callout>}
    </div>
  )
}
