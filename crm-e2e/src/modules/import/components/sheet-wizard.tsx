/**
 * The sheet import wizard (master prompt §15.1–15.2; foundation-plan §8.3 M5):
 *   1 Upload   xlsx / xls / csv (a PDF or image switches to document extraction) or a sample; SheetJS reads it for real
 *   2 Columns  the tab and the table are found (Instructions tabs, title and totals rows skipped), headings mapped with
 *              confidence (template / saved / synonym / fuzzy / value), a manual dropdown per column, "Save mapping",
 *              and values for all rows where a required column is missing
 *   3 Check    every row validated and de-duplicated: ready / draft / duplicate / needs fixing, inline fixing with
 *              re-check, "set for all", skip, then the options (skip or update duplicates, publish) and Import
 *   4 Done     counts, links, auto-assignment, the failed rows as CSV, Undo
 * Nothing is written before the user confirms on step 3.
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { BookmarkPlus, CheckCircle2, FileSpreadsheet, Loader2, Rows3, Sparkles, Table2, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { Callout } from '@/components/shared/callout'
import { FileUploader } from '@/components/shared/file-uploader'
import { MappingTable } from '@/components/shared/mapping-table'
import { SectionCard } from '@/components/shared/section-card'
import { ToneBadge } from '@/components/shared/badges'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAI } from '@/ai'
import { fileKind } from '@/ai/document'
import type { ColumnMapping, ID } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { runImport, saveMappingProfile } from '@/services/imports'
import { fieldsFor, type SheetKind } from '../lib/fields'
import { ACCEPT_DOCS, ACCEPT_SHEETS, MAX_FILE_MB } from '../lib/kinds'
import { autoMap, bestProfile, mappingConfidence, mappingToProfileColumns, methodCounts, missingRequired } from '../lib/mapping'
import { planImport, type ImportPlan } from '../lib/plan'
import { evaluateRows } from '../lib/rows'
import { chooseSheet, detectTable, type RawSheet, type SheetChoice, type Table } from '../lib/sheet'
import { isDefaultTemplate } from '../lib/templates'
import { readSource } from '../lib/values'
import { CheckStep } from './check-step'
import { DoneStep } from './done-step'
import { SampleList } from './sample-list'
import { TemplateCard } from './template-card'
import { DefaultInput, WizardNav } from './wizard-bits'
import { WizardStepper } from './wizard-stepper'

type Step = 0 | 1 | 2 | 3
type Loaded = { file: File; sheets: RawSheet[]; choices: SheetChoice[]; sheet: string; table: Table }
export type ImportResult = { jobId: ID; plan: ImportPlan; undoToken?: string }

/** "99acres-leads.csv" → the source for rows that do not say. */
function sourceFromName(name: string): string {
  const r = readSource(name.replace(/[-_.]/g, ' '))
  return 'ok' in r && r.ok !== 'other' && r.ok !== 'manual' ? r.ok : ''
}

export function SheetWizard({ kind, initialFile, onDocument }: { kind: SheetKind; initialFile?: File | null; onDocument: (f: File) => void }) {
  const { t } = useTranslation(['import', 'catalogue', 'common'])
  const { can } = usePermission()
  const profiles = useDb((db) => db.settings.mappingProfiles)
  const leads = useDb((db) => db.leads)
  const properties = useDb((db) => db.properties)
  const [step, setStep] = useState<Step>(0)
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [profileId, setProfileId] = useState<ID | undefined>()
  const [defaults, setDefaults] = useState<Record<string, string>>({})
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({})
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<ImportResult | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const started = useRef<File | null>(null)

  // a property's city comes from its locality (lib/mapping.missingRequired), so the table does not ask for it then
  const cityFromLocality = kind !== 'leads' && mapping.some((m) => m.field === 'location.locality')
  const fields = useMemo(
    () => fieldsFor(kind).map((f) => ({ value: f.key, label: t(`import:field.${f.key}`), required: f.required && !(cityFromLocality && f.key === 'location.city') })),
    [kind, t, cityFromLocality],
  )
  const columns = useMemo(() => (loaded ? loaded.table.headers.map((_, c) => loaded.table.rows.map((r) => r.cells[c])) : []), [loaded])
  const samples = useMemo(() => columns.map((col) => col.slice(0, 3).map((v) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)))), [columns])
  const rows = useMemo(
    () => (loaded && step >= 2 ? evaluateRows(loaded.table, { kind, mapping, defaults, edits, db: { leads, properties } }) : []),
    [loaded, step, kind, mapping, defaults, edits, leads, properties],
  )
  const kindProfiles = profiles.filter((p) => p.kind === kind)
  const missing = missingRequired(mapping, kind, defaults)
  const isTemplate = loaded ? isDefaultTemplate(loaded.table.headers, kind) : false

  const openSheet = (file: File, sheets: RawSheet[], choices: SheetChoice[], name: string) => {
    const sheet = sheets.find((s) => s.name === name)
    const table = sheet ? detectTable(sheet, kind) : null
    if (!table || !table.headers.length || !table.rows.length) {
      setParseError(t('import:upload.noTable', { sheet: name }))
      return false
    }
    const cols = table.headers.map((_, c) => table.rows.map((r) => r.cells[c]))
    const profile = bestProfile(profiles, table.headers, kind)
    setMapping(autoMap(table.headers, cols, kind, { profile }))
    setProfileId(profile?.id)
    setLoaded({ file, sheets, choices, sheet: name, table })
    setEdits({})
    setSkipped(new Set())
    if (profile) toast.success(t('import:columns.profileApplied', { name: profile.name }))
    return true
  }

  const parse = async (file: File) => {
    const fk = fileKind(file)
    if (fk === 'pdf' || fk === 'image' || fk === 'text') { onDocument(file); return }
    if (fk !== 'sheet') { setParseError(t('import:upload.unsupported', { file: file.name })); return }
    setParsing(true)
    setParseError(null)
    try {
      const { readWorkbook } = await import('../lib/workbook')
      const sheets = readWorkbook(new Uint8Array(await file.arrayBuffer()), file.name)
      const { choices, best } = chooseSheet(sheets, kind)
      if (!best) { setParseError(t('import:upload.noSheet')); return }
      setDefaults(kind === 'leads' && sourceFromName(file.name) ? { source: sourceFromName(file.name) } : {})
      if (openSheet(file, sheets, choices, best)) setStep(1)
    } catch {
      setParseError(t('import:upload.readFailed', { file: file.name }))
    } finally {
      setParsing(false)
    }
  }

  // only a new file (a sample, or the page handing over an upload) starts the parse again
  const start = useEffectEvent((f: File) => {
    started.current = f
    setFiles([f])
    void parse(f)
  })
  useEffect(() => {
    if (initialFile && started.current !== initialFile) start(initialFile)
  }, [initialFile])

  const reset = () => {
    setStep(0); setFiles([]); setLoaded(null); setMapping([]); setDefaults({}); setEdits({}); setSkipped(new Set()); setResult(null); setParseError(null)
    started.current = null
  }

  const doImport = (opts: { duplicates: 'skip' | 'update'; publish: boolean }) => {
    if (!loaded) return
    const plan = planImport(rows, { kind, fileName: loaded.file.name, duplicates: opts.duplicates, publish: opts.publish, skipped })
    try {
      const { jobId, undoToken } = runImport({
        kind, fileName: loaded.file.name, fileType: /\.csv$/i.test(loaded.file.name) ? 'csv' : 'xlsx', template: isTemplate ? 'default' : 'custom',
        mapping, mappingProfileId: profileId, leads: plan.leads, properties: plan.properties, leadUpdates: plan.leadUpdates,
        propertyUpdates: plan.propertyUpdates, drafts: plan.drafts, counts: plan.counts, errorRows: plan.errorRows,
      })
      toastUndo(t('import:done.toast', { count: plan.counts.imported + plan.counts.updated }), undoToken, { description: loaded.file.name })
      setResult({ jobId, plan, undoToken })
      setStep(3)
    } catch (e) {
      toastError(e)
    }
  }

  const steps = [t('import:step.upload'), t('import:step.columns'), t('import:step.check'), t('import:step.done')]

  return (
    <div className="flex flex-col gap-5" data-testid="sheet-wizard">
      <WizardStepper steps={steps} current={step} label={t('import:step.label')} />

      {step === 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <SectionCard className="lg:col-span-7" icon={FileSpreadsheet} title={t('import:upload.title')} description={t('import:upload.body')}>
            <div className="flex flex-col gap-4">
              <FileUploader
                files={files} onFilesChange={(f) => { setFiles(f); if (f[0]) void parse(f[0]) }}
                accept={[...ACCEPT_SHEETS, ...ACCEPT_DOCS]} maxSizeMb={MAX_FILE_MB} label={t('import:upload.drop')}
                hint={t('import:upload.hint', { size: MAX_FILE_MB })} disabled={parsing}
              />
              {parsing && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{t('import:upload.reading')}</p>}
              {parseError && <Callout tone="danger" title={t('import:upload.errorTitle')}>{parseError}</Callout>}
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t('import:samples.titleShort')}</h3>
                <SampleList compact only={(s) => s.kind === kind || s.kind === 'document'} />
              </div>
            </div>
          </SectionCard>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <TemplateCard kind={kind} />
            <Callout tone="ai" title={t('import:upload.customTitle')}>{t('import:upload.customBody')}</Callout>
          </div>
        </div>
      )}

      {step === 1 && loaded && (
        <div className="flex flex-col gap-4">
          <SectionCard
            icon={Table2}
            title={loaded.file.name}
            description={t('import:columns.found', { rows: loaded.table.rows.length, columns: loaded.table.headers.length, header: loaded.table.headerRow })}
            action={loaded.choices.length > 1 && (
              <Select value={loaded.sheet} onValueChange={(name) => openSheet(loaded.file, loaded.sheets, loaded.choices, name)}>
                <SelectTrigger className="w-56" aria-label={t('import:columns.sheet')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {loaded.choices.map((c) => (
                    <SelectItem key={c.name} value={c.name} disabled={c.ignored}>
                      {c.ignored ? t('import:columns.sheetIgnored', { name: c.name }) : t('import:columns.sheetRows', { name: c.name, count: c.dataRows })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {loaded.choices.filter((c) => c.ignored).map((c) => <ToneBadge key={c.name} tone="neutral">{t('import:columns.tabIgnored', { name: c.name })}</ToneBadge>)}
                {(['title', 'total', 'note', 'blank'] as const).map((r) => {
                  const n = loaded.table.skipped.filter((s) => s.reason === r).length
                  return n ? <ToneBadge key={r} tone="neutral" title={loaded.table.skipped.filter((s) => s.reason === r).map((s) => `${s.rowNumber}: ${s.text}`).join('\n')}>{t(`import:columns.skipped.${r}`, { count: n })}</ToneBadge> : null
                })}
              </div>
              {isTemplate ? (
                <Callout tone="success" title={t('import:columns.templateTitle')}>{t('import:columns.templateBody')}</Callout>
              ) : (
                <Callout tone="ai" title={<span className="flex flex-wrap items-center gap-2">{t('import:columns.customTitle', { pct: Math.round(mappingConfidence(mapping) * 100) })}<DemoAIBadge mode={getAI().mode} /></span>}>
                  {t('import:columns.customBody')}
                </Callout>
              )}
              <MethodChips mapping={mapping} />
            </div>
          </SectionCard>

          <SectionCard
            icon={Wand2} title={t('import:columns.mapTitle')} description={t('import:columns.mapBody')}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                {kindProfiles.length > 0 && (
                  <Select value={profileId ?? ''} onValueChange={(id) => {
                    const p = kindProfiles.find((x) => x.id === id)
                    if (!p) return
                    setMapping(autoMap(loaded.table.headers, columns, kind, { profile: p }))
                    setProfileId(p.id)
                    toast.success(t('import:columns.profileApplied', { name: p.name }))
                  }}>
                    <SelectTrigger className="w-52" aria-label={t('import:columns.useSaved')}><SelectValue placeholder={t('import:columns.useSaved')} /></SelectTrigger>
                    <SelectContent>{kindProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {can(kind === 'leads' ? 'import.leads' : 'import.properties') && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSaveOpen(true)} data-testid="save-mapping"><BookmarkPlus />{t('import:columns.save')}</Button>
                )}
              </div>
            )}
          >
            <MappingTable mapping={mapping} fields={fields} samples={samples} onChange={(m) => { setMapping(m); setProfileId(undefined) }} />
            {mapping.some((m) => !m.field) && (
              <p className="mt-3 text-meta text-muted-foreground">
                {t(kind === 'leads' ? 'import:columns.unmappedLeads' : 'import:columns.unmappedProps', { columns: mapping.filter((m) => !m.field).map((m) => m.column).join(', ') })}
              </p>
            )}
          </SectionCard>

          {(missing.length > 0 || Object.keys(defaults).length > 0) && (
            <SectionCard icon={Rows3} title={t('import:columns.defaultsTitle')} description={t('import:columns.defaultsBody')}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...new Set([...missing, ...Object.keys(defaults)])].map((f) => (
                  <DefaultInput key={f} field={f} value={defaults[f] ?? ''} onChange={(v) => setDefaults((d) => ({ ...d, [f]: v }))} />
                ))}
              </div>
              {missing.length > 0 && <p className="mt-3 text-meta text-warning">{t('import:columns.stillMissing', { fields: missing.map((f) => t(`import:field.${f}`)).join(', ') })}</p>}
            </SectionCard>
          )}

          <WizardNav
            onBack={() => { setStep(0); setFiles([]); setLoaded(null); started.current = null }}
            backLabel={t('import:nav.changeFile')}
            onNext={() => setStep(2)}
            nextLabel={t('import:nav.checkRows', { count: loaded.table.rows.length })}
            testId="to-check"
          />
        </div>
      )}

      {step === 2 && loaded && (
        <CheckStep
          kind={kind} rows={rows} skipped={skipped} setSkipped={setSkipped}
          onFix={(row, values) => setEdits((e) => ({ ...e, [row]: { ...e[row], ...values } }))}
          onSetAll={(field, value, rowNumbers) => setEdits((e) => ({ ...e, ...Object.fromEntries(rowNumbers.map((n) => [n, { ...e[n], [field]: value }])) }))}
          onBack={() => setStep(1)} onImport={doImport}
        />
      )}

      {step === 3 && loaded && result && (
        <DoneStep kind={kind} result={result} table={loaded.table} fileName={loaded.file.name} onAgain={reset} />
      )}

      <SaveMappingDialog
        key={saveOpen ? 'open' : 'closed'}
        open={saveOpen} onOpenChange={setSaveOpen} defaultName={loaded?.file.name.replace(/\.[^.]+$/, '') ?? ''}
        onSave={(name) => {
          try {
            const { id } = saveMappingProfile({ name, kind, columns: mappingToProfileColumns(mapping) })
            setProfileId(id)
            setSaveOpen(false)
            toast.success(t('import:columns.saved', { name }))
          } catch (e) { toastError(e) }
        }}
      />
    </div>
  )
}

function MethodChips({ mapping }: { mapping: ColumnMapping[] }) {
  const { t } = useTranslation('import')
  const c = methodCounts(mapping)
  const items = (['template', 'saved', 'synonym', 'fuzzy', 'value', 'manual', 'unmapped'] as const).filter((k) => c[k])
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t('columns.methodsLabel')}>
      {items.map((k) => (
        <li key={k}>
          <ToneBadge tone={k === 'unmapped' ? 'warning' : k === 'template' || k === 'saved' || k === 'manual' ? 'success' : 'ai'} icon={k === 'fuzzy' || k === 'value' || k === 'synonym' ? Sparkles : k === 'unmapped' ? null : CheckCircle2}>
            {t(`columns.method.${k}`, { count: c[k] })}
          </ToneBadge>
        </li>
      ))}
    </ul>
  )
}

function SaveMappingDialog({ open, onOpenChange, defaultName, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; defaultName: string; onSave: (name: string) => void }) {
  const { t } = useTranslation(['import', 'common'])
  const [name, setName] = useState(defaultName)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('import:columns.saveTitle')}</DialogTitle>
          <DialogDescription>{t('import:columns.saveBody')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim()) }} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mapping-name" className="text-sm font-medium">{t('import:columns.saveName')}</label>
            <Input id="mapping-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
            <Button type="submit" disabled={!name.trim()}>{t('common:actions.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

