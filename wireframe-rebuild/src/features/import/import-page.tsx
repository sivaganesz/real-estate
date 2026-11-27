/**
 * Bulk import — add or update many properties at once, from a spreadsheet (our template or anyone's own sheet),
 * a builder's brochure or a photo. As in spec-system-wireframe/views-import.js: ① Upload file → ② Check → ③ Done.
 * Nothing is saved until "Import": the team sees every row first, and rows missing a detail become drafts the AI finishes.
 */
import { type DragEvent, type ReactNode, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Check, ChevronDown, Download, FileImage, FileSpreadsheet, FileText, Loader2, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Callout } from '@/components/app/callout'
import { Page, PageHeader } from '@/components/app/page-header'
import { SectionCard } from '@/components/app/section-card'
import { StatusChip } from '@/components/app/status-chip'
import { type Tone, toneFill, toneSoft } from '@/components/app/tone'
import { useCrumbs } from '@/components/layout/crumbs'
import { TYPE_ORDER } from '@/data/catalogue'
import type { PropertyTypeKey } from '@/data/types'
import { fmtDate, inrShort, num } from '@/lib/format'
import {
  applyUpdate, checkRows, cleanValue, type ColMatch, docSample, docToRows, downloadCsv, EXTRA, headingSig, type ImportBatch, type ImpCol,
  importColumns, type ImpRow, type Issue, norm, OWNER_SHEET, parseCsv, prepare, readXlsx, type RowStatus, rowStatus, rowToProperty, type Source,
  templateSample,
} from '@/lib/import'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useCan, useStore, userName } from '@/store/db'
import { useFactText } from '../properties/assistant/use-fact-text'

const DOC_EXT = /\.(pdf|png|jpe?g|webp|heic)$/i
const STATUS_TONE: Record<RowStatus, Tone> = { new: 'success', draft: 'warning', update: 'info', nochange: 'neutral', error: 'danger' }
type Filter = '' | 'new' | 'draft' | 'update' | 'error'

export function ImportPage() {
  const { t } = useTranslation()
  const L = useLabels()
  const ft = useFactText()
  const { db, importBatch, checkpoint, restore } = useStore()
  const can = useCan()
  const manager = can('property.manage')
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.import') }])

  const [type, setType] = useState<PropertyTypeKey>('plot')
  const [src, setSrc] = useState<Source | null>(null)
  const [reading, setReading] = useState('')
  const [done, setDone] = useState<ImportBatch | null>(null)
  const [filter, setFilter] = useState<Filter>('')
  const [colsOpen, setColsOpen] = useState(false)
  const [sender, setSender] = useState('')
  const [update, setUpdate] = useState(true)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const cols = useMemo(() => importColumns(type, db.settings), [type, db.settings])
  const colLabel = (key: string) => key === 'id' ? t('imp.col.id') : key === 'lat' ? t('imp.col.lat') : key === 'lng' ? t('imp.col.lng') : ft.label(key, type)
  const say = (x: Issue) => {
    const v = { ...x.v }
    if (typeof v.col === 'string') v.col = colLabel(v.col)
    if (typeof v.type === 'string') v.type = L.type(v.type as PropertyTypeKey)
    if (x.k === 'readMoney' && typeof v.to === 'number') v.to = inrShort(v.to)
    return t(`imp.msg.${x.k}`, v)
  }

  /* ---------- the rows, checked again whenever a column match changes ---------- */
  const checked = useMemo(() => {
    if (!src) return null
    const byKey = Object.fromEntries(cols.map((c) => [c.key, c]))
    const conv: Issue[][] = []
    const objs = src.data.map((r, ri) => {
      const data: Record<string, string> = {}
      const extra: { label: string; value: string }[] = []
      conv[ri] = []
      src.matches.forEach((m, i) => {
        if (!m.key) return
        if (m.key === EXTRA) { extra.push({ label: m.heading, value: String(r[i] ?? '').trim() }); return }
        const c = cleanValue(byKey[m.key], r[i], db.settings.approvalTypes)
        data[m.key] = c.v
        if (c.note) conv[ri].push(c.note)
      })
      return { data, extra }
    })
    const rows = checkRows(objs, src.lines, cols, type, db, manager)
    rows.forEach((row, ri) => {
      row.notes.push(...conv[ri])
      const it = src.doc?.items[ri]
      if (!it) return
      Object.assign(row, { page: it.page, quote: it.quote, photos: it.photos, confirm: it.confirm ?? [] })
      row.notes.push(...(it.notes ?? []))
    })
    const fileNotes: Issue[] = []
    if (src.limited) fileNotes.push({ k: 'limited', v: { n: 500 } })
    const missing = cols.filter((c) => c.req && !src.matches.some((m) => m.key === c.key))
    if (missing.length) fileNotes.push({ k: 'notInFile', v: { list: missing.map((c) => colLabel(c.key)).join(', ') } })
    return { rows, fileNotes }
    // colLabel only reads t and the type, which are in the list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, cols, type, db, manager, t])

  const rows = checked?.rows ?? []
  const willImport = (r: ImpRow) => { const s = rowStatus(r); return s === 'new' || s === 'draft' || (s === 'update' && update) }
  const where = (r: ImpRow) => r.page ? (src?.doc?.kind === 'image' ? t('imp.wherePhoto') : t('imp.wherePage', { n: r.page })) : t('imp.whereLine', { n: r.line })

  /* ---------- loading a file ---------- */
  const reset = () => { setSrc(null); setDone(null); setFilter(''); setColsOpen(false); setSender(''); setReading('') }
  const load = (table: unknown[][], file: string, ty = type) => {
    const res = prepare(table, file, importColumns(ty, db.settings), ty, db)
    if ('error' in res) { toast.error(t(`imp.err.${res.error}`)); return }
    reset()
    setSrc(res.src)
    setSender(res.src.format?.sender ?? '')
  }
  const readDoc = (file: string, kind: 'pdf' | 'image', real: boolean) => {
    reset()
    setReading(file)
    setTimeout(() => {
      const doc = docSample(kind)
      const { rows: table, extraLabels } = docToRows(doc)
      setType(doc.type)
      const res = prepare(table, file, importColumns(doc.type, db.settings), doc.type, db)
      setReading('')
      if ('error' in res) return
      res.src.matches.forEach((m) => { if (extraLabels.includes(m.heading)) Object.assign(m, { key: EXTRA, how: 'extra' }) })
      setSrc({ ...res.src, doc: { ...doc, real }, format: undefined, found: [], template: false })
    }, 900)
  }
  const readFile = (f?: File | null) => {
    if (!f) return
    if (/\.xlsx$/i.test(f.name)) {
      f.arrayBuffer().then(readXlsx).then((r) => load(r, f.name)).catch((e: Error) => toast.error(t('imp.err.xlsx', { why: e.message })))
    } else if (DOC_EXT.test(f.name)) readDoc(f.name, /\.pdf$/i.test(f.name) ? 'pdf' : 'image', true)
    else if (/\.xls$/i.test(f.name)) toast.error(t('imp.err.xls'))
    else if (!/\.csv$/i.test(f.name)) toast.error(t('imp.err.kind'))
    else f.text().then((s) => load(parseCsv(s), f.name))
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0]) }
  const template = () => { downloadCsv(`property-import-template-${type}.csv`, [cols.map((c) => c.heading)]); toast.success(t('imp.templateSaved')) }

  /* ---------- import ---------- */
  const apply = () => {
    if (!src || !checked) return
    const doc = src.doc
    const batch = importBatch((next, o) => {
      const b: ImportBatch = { id: `IMP-${String((next.imports?.length ?? 0) + 1).padStart(3, '0')}`, at: o.at, by: o.by, type, file: src.file,
        sender: sender.trim() || undefined, total: rows.length, created: [], pending: [], drafts: [], updated: [], skipped: 0 }
      // another sheet's format: the matches are remembered, and the whole format is saved for this sender
      if (!src.template && !doc) {
        next.importMemory = { ...next.importMemory }
        const map: Record<string, string> = {}
        for (const m of src.matches) {
          if (!norm(m.heading)) continue
          map[norm(m.heading)] = m.key
          if (m.how !== 'exact') next.importMemory[norm(m.heading)] = m.key
        }
        next.importFormats = next.importFormats ?? []
        const sig = headingSig(src.headings)
        let f = src.format && next.importFormats.find((x) => x.id === src.format!.id)
        if (!f) {
          f = { id: `FMT-${String(next.importFormats.length + 1).padStart(3, '0')}`, type, sender: '', sig, headings: [], map: {}, uses: 0, last: o.at, by: o.by }
          next.importFormats.push(f)
        }
        Object.assign(f, { sender: sender.trim() || f.sender, sig, headings: src.headings.filter(Boolean), map, uses: f.uses + 1, last: o.at })
      }
      for (const r of rows) {
        if (!willImport(r)) { b.skipped++; continue }
        if (r.mode === 'new') {
          const id = o.newPropId()
          const p = rowToProperty(r, cols, type, next.settings, { id, by: o.by, at: o.at, manager, ai: !!doc })
          p.history = [{ id: `${id}-h1`, at: o.at, by: o.by, text: t('imp.history.created', { batch: b.id, file: src.file, where: where(r) }) +
            (b.sender ? t('imp.history.from', { sender: b.sender }) : '') + (r.photos ? t('imp.history.photos', { count: r.photos }) : '') }]
          next.properties.unshift(p)
          ;(p.status !== 'draft' ? b.created : p.submitted ? b.pending : b.drafts).push(id)
        } else if (r.existing) {
          const p = next.properties.find((x) => x.id === r.existing!.id)!
          applyUpdate(p, r, cols, next.settings)
          p.updated = { by: o.by, at: o.at }
          p.history.unshift({ id: `${p.id}-h${p.history.length + 1}`, at: o.at, by: o.by, text: t('imp.history.updated', { batch: b.id, list: r.changes.map((c) => c.extra ? c.key : colLabel(c.key)).join(', ') }) })
          b.updated.push(p.id)
        }
      }
      return b
    })
    setSrc(null)
    setDone(batch)
    const parts = (['created', 'pending', 'drafts', 'updated'] as const).filter((k) => batch[k].length).map((k) => t(`imp.toastPart.${k}`, { count: batch[k].length }))
    if (batch.skipped) parts.push(t('imp.toastPart.skipped', { count: batch.skipped }))
    toast.success(t('imp.toast', { batch: batch.id, list: parts.join(', ') }))
  }

  const step = done ? 2 : src || reading ? 1 : 0

  return (
    <Page>
      <PageHeader title={t('imp.title')} description={t('imp.lead')}
        actions={<Button variant="outline" asChild><Link to="/properties">← {t('nav.properties')}</Link></Button>} />
      <Stepper at={step} labels={[t('imp.step.upload'), t('imp.step.check'), t('imp.step.done')]} />

      {done ? (
        doneCard(done)
      ) : reading ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="font-semibold">{t('imp.reading', { file: reading })}</p>
            <p className="text-sm text-muted-foreground">{t('imp.readingWhat')}</p>
          </div>
        </SectionCard>
      ) : src && checked ? (
        checkCard()
      ) : (
        startCard()
      )}

      {history()}
    </Page>
  )

  /* ---------- ① choose the type and drop a file ---------- */
  function startCard() {
    return (
      <div className="flex flex-col gap-4">
        <SectionCard>
          <p className="text-sm font-semibold">{t('imp.whatsIn')} <span className="font-normal text-muted-foreground">{t('imp.whatsInHint')}</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('imp.whatsIn')}>
            {TYPE_ORDER.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={k === type} onClick={() => setType(k)}
                className={cn('rounded-full border px-3 py-1 text-sm transition-colors', k === type ? 'border-primary bg-accent font-medium text-accent-foreground' : 'hover:bg-muted')}>
                {L.type(k)}
              </button>
            ))}
          </div>
          <label onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
            className={cn('mt-4 flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-9 text-center transition-colors',
              dragging ? 'border-primary bg-accent' : 'hover:border-primary/60 hover:bg-muted/40')}>
            <input ref={fileRef} type="file" className="sr-only" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = '' }}
              accept=".xlsx,.csv,.pdf,image/*,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
            <span className="flex gap-2 text-muted-foreground"><FileSpreadsheet className="size-6" /><FileText className="size-6" /><FileImage className="size-6" /></span>
            <span className="font-semibold">{t('imp.drop')}</span>
            <span className="max-w-xl text-sm text-muted-foreground">{t('imp.dropHint')}</span>
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-muted-foreground">{t('imp.try')}</span>
            <LinkBtn onClick={() => load(templateSample(type, cols, db), `sample-${type}.csv`)}>{t('imp.trySample')}</LinkBtn>
            <span aria-hidden className="text-muted-foreground">·</span>
            <LinkBtn onClick={() => { setType('plot'); load(OWNER_SHEET, 'ABC Realty — plots.xlsx', 'plot') }}>{t('imp.tryOwner')}</LinkBtn>
            <span aria-hidden className="text-muted-foreground">·</span>
            <LinkBtn onClick={() => readDoc('Green-Meadows-brochure.pdf', 'pdf', false)}>{t('imp.tryPdf')}</LinkBtn>
            <span aria-hidden className="text-muted-foreground">·</span>
            <LinkBtn onClick={() => readDoc('board-photo.jpg', 'image', false)}>{t('imp.tryPhoto')}</LinkBtn>
            <span className="flex-1" />
            <LinkBtn onClick={template}><Download className="size-3.5" /> {t('imp.template', { type: L.type(type).toLowerCase() })}</LinkBtn>
          </div>
          <p className="mt-3 flex gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-violet" />{t('imp.promise')}
          </p>
        </SectionCard>
        <details className="group rounded-xl border bg-card shadow-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold md:px-5">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
            {t('imp.whichCols')} <span className="font-normal text-muted-foreground">{t('imp.whichColsN', { count: cols.length - 1, type: L.type(type).toLowerCase() })}</span>
          </summary>
          <div className="px-4 pb-4 md:px-5">
            <div className="flex flex-wrap gap-1.5">
              {cols.filter((c) => c.key !== 'id').map((c) => (
                <span key={c.key} className={cn('rounded-full px-2.5 py-0.5 text-xs', c.req ? cn(toneSoft.warning, 'font-medium') : 'bg-muted')}>{colLabel(c.key)}</span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t('imp.whichColsNote')}</p>
          </div>
        </details>
      </div>
    )
  }

  /* ---------- ② check every row ---------- */
  function checkCard() {
    const s = src!
    const count = (st: RowStatus) => rows.filter((r) => rowStatus(r) === st).length
    const n = { all: rows.length, new: count('new'), draft: count('draft'), update: count('update') + count('nochange'), error: count('error') }
    const toImport = rows.filter(willImport).length
    const chips: [Filter, string, number, Tone][] = [
      ['', t('imp.f.all'), n.all, 'neutral'], ['new', t('imp.f.new'), n.new, 'success'], ['draft', t('imp.f.draft'), n.draft, 'warning'],
      ['update', t('imp.f.update'), n.update, 'info'], ['error', t('imp.f.error'), n.error, 'danger'],
    ]
    const shown = rows.filter((r) => !filter || rowStatus(r) === filter || (filter === 'update' && rowStatus(r) === 'nochange'))
    const errorsCsv = () => downloadCsv(`import-errors-${type}.csv`, [[t('imp.csvLine'), t('imp.csvErrors'), ...cols.map((c) => c.heading)],
      ...rows.filter((r) => r.errors.length).map((r) => [r.line, r.errors.map(say).join(' | '), ...cols.map((c) => r.data[c.key])])])
    return (
      <SectionCard title={<span className="flex flex-wrap items-center gap-2">{s.file} <StatusChip tone="info">{L.type(type)}</StatusChip>
        <span className="text-sm font-normal text-muted-foreground">{t(s.doc ? 'imp.nProps' : 'imp.nRows', { count: rows.length })}</span></span>}
        action={<Button variant="outline" size="sm" onClick={reset}>{t('imp.another')}</Button>}>
        <div className="flex flex-col gap-2">
          {s.doc ? docSummary() : !s.template && columnSummary()}
          {s.found.map((x, i) => <p key={i} className="text-sm text-muted-foreground">🔎 {say(x)}</p>)}
          {!manager && <Callout tone="info">{t('imp.execNote')}</Callout>}
          {checked!.fileNotes.map((x, i) => <Callout key={i} tone="warning">{say(x)}</Callout>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5" role="tablist" aria-label={t('imp.f.label')}>
          {chips.filter(([k, , c]) => c || !k).map(([k, l, c, tone]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm', filter === k ? 'border-primary bg-accent font-medium' : 'hover:bg-muted')}>
              {k && <span className={cn('size-2 rounded-full', toneFill[tone])} />}{l} <b className="tabular-nums">{c}</b>
            </button>
          ))}
        </div>
        <ul className="mt-3 divide-y rounded-lg border">
          {shown.length ? shown.map(rowItem) : <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t('imp.noRowsHere')}</li>}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {n.error > 0 && <LinkBtn onClick={errorsCsv}><Download className="size-3.5" /> {t('imp.errorsCsv', { count: n.error })}</LinkBtn>}
          {n.update > 0 && (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={update} onCheckedChange={(v) => setUpdate(v === true)} /> {t('imp.updateExisting')}</label>
          )}
          <span className="flex-1" />
          <Button variant="outline" onClick={reset}>{t('action.cancel')}</Button>
          <Button onClick={apply} disabled={!toImport}><Upload /> {t('imp.import', { count: toImport })}</Button>
        </div>
      </SectionCard>
    )
  }

  function rowItem(r: ImpRow) {
    const st = rowStatus(r), d = r.data, p = r.existing
    const title = d.title || p?.title || r.suggestedTitle || '—'
    const area = d.area && !isNaN(+d.area) ? `${num(+d.area)} sq.ft.` : d.area
    const price = d.price && !isNaN(+d.price) ? inrShort(+d.price) : d.price
    const val = (key: string, v: unknown) => key.startsWith('spec:') || ['price', 'area', 'purpose', 'facing', 'status', 'amenities', 'approvals'].includes(key) ? ft.value(key, v, type) : String(v ?? '')
    const main = st === 'error' ? (
      <span className="text-danger">✗ {say(r.errors[0])}{r.errors.length > 1 && <span className="text-muted-foreground"> {t('imp.more', { count: r.errors.length - 1 })}</span>}</span>
    ) : st === 'draft' ? (
      <span className="text-warning">{t('imp.draftAsk')} {[
        r.needs.length ? t('imp.draftNeeds', { list: r.needs.map(colLabel).join(', ') }) : '',
        r.confirm.length ? t('imp.draftConfirm', { list: r.confirm.map((x) => x.v?.what).join('; ') }) : '',
      ].filter(Boolean).join(t('imp.and'))}</span>
    ) : st === 'update' ? (
      <span>{t('imp.updateLabel')} {r.changes.map((c, i) => (
        <span key={i}>{i > 0 && ', '}{c.extra ? c.key : colLabel(c.key)} {c.from != null && c.from !== '' && !Array.isArray(c.to) && <s className="text-muted-foreground">{c.extra ? String(c.from) : val(c.key, c.from)}</s>} → <b>{c.extra ? String(c.to) : val(c.key, c.to)}</b></span>
      ))}</span>
    ) : st === 'nochange' ? <span className="text-muted-foreground">{t('imp.noChange')}</span>
      : <span className="text-success">{manager ? t('imp.ready') : t('imp.readyApproval')}</span>
    const notes = [...r.warnings.map((w) => ({ w: true, s: say(w) })), ...r.notes.filter((x) => x.k !== 'readAs' && x.k !== 'readMoney').map((x) => ({ w: false, s: say(x) }))]
    return (
      <li key={r.line} className="grid gap-x-4 gap-y-1 px-3 py-2.5 text-sm md:grid-cols-[minmax(0,15rem)_6.5rem_minmax(0,1fr)]">
        <div className="flex min-w-0 gap-2.5">
          <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneFill[STATUS_TONE[st]])} title={t(`imp.f.${st === 'nochange' ? 'update' : st}`)} />
          <div className="min-w-0">
            <p className="truncate font-medium">{title}{!d.title && r.suggestedTitle && <Sparkles className="ml-1 inline size-3.5 text-violet" aria-label={t('imp.aiTitle')} />}</p>
            <p className="truncate text-xs text-muted-foreground">
              {p && <><Link to={`/properties/${p.id}`} className="font-mono text-primary hover:underline">{p.id}</Link> · </>}
              {[d.locality || p?.location.locality, d.city || p?.location.city].filter(Boolean).join(', ')} · {where(r)}{r.photos > 0 && ` · 📷 ${r.photos}`}
            </p>
          </div>
        </div>
        <div className="pl-4.5 text-xs text-muted-foreground tabular-nums md:pl-0 md:text-right"><span className="md:block">{area}</span>{area && price && <span className="md:hidden"> · </span>}<span className="font-medium text-foreground md:block">{price}</span></div>
        <div className="min-w-0 pl-4.5 md:pl-0">
          <p>{main}</p>
          {r.quote && <p className="mt-0.5 text-xs text-muted-foreground italic">{r.page && src?.doc?.kind === 'image' ? '🖼' : '📄'} {where(r)}: “{r.quote}”</p>}
          {notes.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{notes.map((x, i) => <span key={i}>{i > 0 && ' · '}<span className={cn(x.w && 'text-warning')}>{x.w && '⚠ '}{x.s}</span></span>)}</p>}
        </div>
      </li>
    )
  }

  /** A brochure or photo: what the AI read. */
  function docSummary() {
    const doc = src!.doc!
    const photos = doc.items.reduce((a, it) => a + it.photos, 0)
    return (
      <div className="flex gap-3 rounded-lg bg-violet-soft/60 px-3 py-2.5 text-sm">
        {doc.kind === 'pdf' ? <FileText className="mt-0.5 size-5 shrink-0 text-violet" /> : <FileImage className="mt-0.5 size-5 shrink-0 text-violet" />}
        <div>
          <p><Sparkles className="mr-1 inline size-3.5 text-violet" /><b>{t('imp.doc.read')}</b> {t(`imp.doc.${doc.what}`)}
            {doc.kind === 'pdf' && ` · ${t('imp.doc.pages', { count: doc.pages })}`} · <b>{t('imp.doc.found', { count: doc.items.length })}</b>
            {photos > 0 && ` · ${t('imp.doc.photos', { count: photos })}`} · {L.type(doc.type)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('imp.doc.note')}</p>
          {doc.real && <p className="mt-0.5 text-xs text-warning">{t('imp.doc.sampleNote')}</p>}
        </div>
      </div>
    )
  }

  /** Another sheet: who sent it, how many columns were matched, and the matches to check or change. */
  function columnSummary() {
    const s = src!
    const used = s.matches.filter((m) => m.heading && m.key && m.key !== EXTRA)
    const kept = s.matches.filter((m) => m.heading && m.key === EXTRA)
    const unused = s.matches.filter((m) => m.heading && !m.key)
    const ai = used.filter((m) => m.how === 'ai').length
    const dupKeys = s.matches.map((m) => m.key).filter((k, i, a) => k && k !== EXTRA && a.indexOf(k) !== i)
    const conv = rows.flatMap((r) => r.notes.filter((x) => x.k === 'readAs' || x.k === 'readMoney'))
    const senders = [...new Set((db.importFormats ?? []).map((f) => f.sender).filter(Boolean))]
    const setMatch = (i: number, key: string) => setSrc({ ...s, matches: s.matches.map((m, j): ColMatch => (j === i ? { ...m, key, how: 'you' } : m)) })
    return (
      <div className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {s.format ? (
            <span className="text-success">📁 <b>{t('imp.fmt.known', { sender: s.format.sender || t('imp.fmt.this') })}</b> {t('imp.fmt.knownHow', { count: s.format.uses })}</span>
          ) : <span className="text-muted-foreground">{t('imp.fmt.new')}</span>}
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">{t('imp.fmt.sentBy')}</span>
            <Input key={s.file} defaultValue={sender} onBlur={(e) => setSender(e.target.value)} list="imp-senders" placeholder={t('imp.fmt.sentByPh')} className="h-8 w-48" />
            <datalist id="imp-senders">{senders.map((x) => <option key={x} value={x} />)}</datalist>
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-start gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1">
            <Sparkles className="mr-1 inline size-3.5 text-violet" /><b>{t('imp.cols.matched', { n: used.length, total: used.length + kept.length + unused.length })}</b>
            {ai > 0 && ` · ${t('imp.cols.byAi', { count: ai })}`}
            {kept.length > 0 && ` · ${t('imp.cols.kept', { list: kept.map((m) => m.heading).join(', ') })}`}
            {unused.length > 0 && ` · ${t('imp.cols.unused', { list: unused.map((m) => m.heading).join(', ') })}`}
            {conv.length > 0 && ` · ${t('imp.cols.conv', { count: conv.length, example: `${conv[0].v?.from} → ${conv[0].k === 'readMoney' ? inrShort(Number(conv[0].v?.to)) : conv[0].v?.to}` })}`}
          </p>
          <LinkBtn onClick={() => setColsOpen(!colsOpen)}>{colsOpen ? t('imp.cols.done') : t('imp.cols.check')}</LinkBtn>
        </div>
        {dupKeys.length > 0 && <p className="mt-1.5 text-danger">{t('imp.cols.dup')}</p>}
        {colsOpen && (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {s.matches.map((m, i) => m.heading && (
                <div key={i} className={cn('rounded-lg border bg-card p-2.5', dupKeys.includes(m.key) && 'border-danger')}>
                  <p className="flex items-center gap-1.5 text-sm font-medium">{m.heading}
                    {m.how === 'ai' && <Sparkles className="size-3.5 text-violet" aria-label={t('imp.cols.aiMatched')} />}
                    {(m.how === 'format' || m.how === 'remembered') && <span className="text-xs font-normal text-muted-foreground">{t('imp.cols.asLast')}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.samples.slice(0, 2).join(' · ') || t('imp.cols.empty')}</p>
                  <Select value={m.key || '_none'} onValueChange={(v) => setMatch(i, v === '_none' ? '' : v)}>
                    <SelectTrigger size="sm" className="mt-1.5 w-full" aria-label={t('imp.cols.goesTo', { heading: m.heading })}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t('imp.cols.dontUse')}</SelectItem>
                      <SelectItem value={EXTRA}>{t('imp.cols.keepExtra')}</SelectItem>
                      {cols.map((c: ImpCol) => <SelectItem key={c.key} value={c.key}>{colLabel(c.key)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t('imp.cols.saved')}</p>
          </>
        )}
      </div>
    )
  }

  /* ---------- ③ done ---------- */
  function doneCard(b: ImportBatch) {
    const link = (id: string, draft = false) => <Link key={id} to={draft ? `/properties/${id}/edit` : `/properties/${id}`} className="font-mono text-primary hover:underline">{id}</Link>
    const list = (ids: string[], draft = false) => ids.map((id, i) => <span key={id}>{i > 0 && ', '}{link(id, draft)}</span>)
    return (
      <SectionCard title={<span className="flex items-center gap-2"><Check className="size-5 text-success" /> {t('imp.done.title', { file: b.file })}</span>}>
        <div className="flex flex-wrap gap-1.5">
          {b.created.length > 0 && <StatusChip tone="success">{t('imp.done.added')} <b>{b.created.length}</b></StatusChip>}
          {b.pending.length > 0 && <StatusChip tone="info">{t('imp.done.pending')} <b>{b.pending.length}</b></StatusChip>}
          {b.drafts.length > 0 && <StatusChip tone="warning">{t('imp.done.drafts')} <b>{b.drafts.length}</b></StatusChip>}
          {b.updated.length > 0 && <StatusChip tone="info">{t('imp.done.updated')} <b>{b.updated.length}</b></StatusChip>}
          {b.skipped > 0 && <StatusChip>{t('imp.done.skipped')} <b>{b.skipped}</b></StatusChip>}
        </div>
        <div className="mt-3 flex flex-col gap-1.5 text-sm">
          {b.created.length > 0 && <p><b>{t('imp.done.added')}:</b> {list(b.created)} <span className="text-muted-foreground">— {t('imp.done.addedNote')}</span></p>}
          {b.updated.length > 0 && <p><b>{t('imp.done.updated')}:</b> {list(b.updated)}</p>}
          {b.pending.length > 0 && <p><b>{t('imp.done.pending')}:</b> {list(b.pending, true)} <span className="text-muted-foreground">— {t('imp.done.pendingNote')}</span></p>}
          {b.drafts.length > 0 && <p><b>{t('imp.done.drafts')}:</b> {list(b.drafts, true)} <span className="text-muted-foreground">— {t('imp.done.draftsNote')}</span></p>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {b.created.length > 0 && <Button variant="outline" asChild><Link to="/properties">{t('imp.done.openProps')}</Link></Button>}
          {b.drafts.length + b.pending.length > 0 && <Button variant="outline" asChild><Link to="/properties/drafts">{t('imp.done.openDrafts')}</Link></Button>}
          <span className="flex-1" />
          <Button onClick={reset}>{t('imp.done.again')}</Button>
        </div>
      </SectionCard>
    )
  }

  /* ---------- past imports and saved formats ---------- */
  function history() {
    const list = db.imports ?? [], formats = db.importFormats ?? []
    if (!list.length && !formats.length) return null
    const th = 'px-3 py-2 text-left font-medium text-muted-foreground', td = 'px-3 py-2 align-top'
    return (
      <div className="mt-4 flex flex-col gap-3">
        {list.length > 0 && (
          <Fold title={t('imp.past.title')} count={list.length}>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className={th}>{t('imp.past.batch')}</th><th className={th}>{t('imp.past.date')}</th><th className={th}>{t('imp.past.by')}</th><th className={th}>{t('imp.past.file')}</th>
                <th className={cn(th, 'text-right')}>{t('imp.done.added')}</th><th className={cn(th, 'text-right')}>{t('imp.f.draft')}</th><th className={cn(th, 'text-right')}>{t('imp.done.updated')}</th><th className={cn(th, 'text-right')}>{t('imp.done.skipped')}</th></tr></thead>
              <tbody className="divide-y">
                {list.map((b) => (
                  <tr key={b.id}>
                    <td className={cn(td, 'font-mono')}>{b.id}</td><td className={td}>{fmtDate(b.at)}</td><td className={td}>{userName(db, b.by)}</td>
                    <td className={td}>{b.file}{b.sender && <span className="block text-xs text-muted-foreground">{t('imp.past.from', { sender: b.sender })}</span>}</td>
                    <td className={cn(td, 'text-right tabular-nums')}>{b.created.length + b.pending.length}</td><td className={cn(td, 'text-right tabular-nums')}>{b.drafts.length}</td>
                    <td className={cn(td, 'text-right tabular-nums')}>{b.updated.length}</td><td className={cn(td, 'text-right tabular-nums')}>{b.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Fold>
        )}
        {formats.length > 0 && (
          <Fold title={t('imp.formats.title')} count={formats.length} hint={t('imp.formats.hint')}>
            <table className="w-full text-sm">
              <thead><tr className="border-b"><th className={th}>{t('imp.formats.sender')}</th><th className={th}>{t('imp.formats.type')}</th><th className={th}>{t('imp.formats.cols')}</th>
                <th className={cn(th, 'text-right')}>{t('imp.formats.used')}</th><th className={th}>{t('imp.formats.last')}</th><th className={th}><span className="sr-only">{t('imp.formats.forget')}</span></th></tr></thead>
              <tbody className="divide-y">
                {formats.map((f) => (
                  <tr key={f.id}>
                    <td className={cn(td, 'font-medium')}>{f.sender || t('imp.formats.unnamed')}</td><td className={td}>{L.type(f.type)}</td>
                    <td className={cn(td, 'text-xs text-muted-foreground')}>{f.headings.slice(0, 6).join(', ')}{f.headings.length > 6 && ` +${f.headings.length - 6}`}</td>
                    <td className={cn(td, 'text-right tabular-nums')}>{f.uses}</td><td className={td}>{fmtDate(f.last)}</td>
                    <td className={cn(td, 'text-right')}>{manager && <Button variant="ghost" size="sm" onClick={() => {
                      forgetFormat(f.id)
                      toast.success(t('imp.formats.forgotten'))
                    }}>{t('imp.formats.forget')}</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Fold>
        )}
      </div>
    )
  }

  /** Forget a saved format (Admin / Sales manager): the next file like it is matched afresh. */
  function forgetFormat(id: string) {
    const now = checkpoint()
    restore({ ...now, importFormats: (now.importFormats ?? []).filter((f) => f.id !== id) })
  }
}

/* ---------- small pieces ---------- */

function LinkBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-primary hover:underline">{children}</button>
}

function Fold({ title, count, hint, children }: { title: string; count: number; hint?: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border bg-card shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold md:px-5">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />{title} <span className="font-normal text-muted-foreground">({count}){hint && ` — ${hint}`}</span>
      </summary>
      <div className="overflow-x-auto px-2 pb-3 md:px-3">{children}</div>
    </details>
  )
}

/** ① Upload file ── ② Check ── ③ Done */
function Stepper({ at, labels }: { at: number; labels: string[] }) {
  return (
    <ol className="mb-4 flex items-center gap-2 text-sm">
      {labels.map((l, i) => {
        const done = i < at || at === labels.length - 1
        return (
          <li key={l} className="flex flex-1 items-center gap-2 last:flex-none">
            <span className={cn('flex items-center gap-2', i === at ? 'font-semibold text-foreground' : done ? 'text-foreground' : 'text-muted-foreground')} aria-current={i === at ? 'step' : undefined}>
              <span className={cn('flex size-6 items-center justify-center rounded-full border text-xs font-semibold',
                done ? 'border-success bg-success text-white' : i === at ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}>
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              {l}
            </span>
            {i < labels.length - 1 && <span className={cn('h-px flex-1', i < at ? 'bg-success' : 'bg-border')} />}
          </li>
        )
      })}
    </ol>
  )
}
