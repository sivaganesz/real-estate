import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ChevronUp, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  applyFacts, changesFor, type Draft, draftToProperty, EMPTY_DRAFT, type Fact, missingKeys, nextQuestion, propertyToDraft, type Question,
  readMessage, requiredKeys, SAMPLE_BROCHURE, SAMPLE_SHEET, writeDraftToProperty,
} from '@/lib/assistant'
import { leadsForProperty } from '@/lib/matching'
import { cn } from '@/lib/utils'
import { useCan, useStore } from '@/store/db'
import type { Property } from '@/data/types'
import { Composer, Message, type Msg, type NewMsg, type SampleFile } from './chat'
import { PreviewPanel } from './preview-panel'
import { useFactText } from './use-fact-text'

const EXAMPLES = [
  '2 BHK flat for sale in Porur, Chennai, 980 sq.ft, 62 lakhs, 3rd floor, east facing, RERA registered',
  'East-facing plot in Vilangudi, Madurai, 30x40, 28 L, DTCP approved, 30 ft road',
]
const EDIT_EXAMPLES = ['Price is now 65 L', 'Mark it under negotiation', 'Add: borewell water, CCTV, power backup']

/** P3 — Add a property with the assistant (/properties/new), and Edit with AI (/properties/:id/edit). Managers and admins only. */
export function AddPage({ mode }: { mode: 'add' | 'edit' }) {
  const { id } = useParams()
  const { t } = useTranslation()
  const { db } = useStore()
  const can = useCan()
  const p = mode === 'edit' ? db.properties.find((x) => x.id === id) : undefined
  if (!can('property.manage') || (mode === 'edit' && !p)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
        <p className="text-lg font-medium">{!can('property.manage') ? t('assistant.notAllowed') : t('property.notFound')}</p>
        <Button asChild variant="outline"><Link to="/properties">{t('property.back')}</Link></Button>
      </div>
    )
  }
  return <Assistant key={p?.id ?? 'new'} mode={mode} property={p} />
}

function Assistant({ mode, property }: { mode: 'add' | 'edit'; property?: Property }) {
  const { t } = useTranslation()
  const ft = useFactText()
  const navigate = useNavigate()
  const { db, user, today, addProperty, updateProperty } = useStore()
  const [draft, setDraft] = useState<Draft>(() => (property ? propertyToDraft(property) : EMPTY_DRAFT))
  const nextId = useRef(1)
  const [msgs, setMsgs] = useState<Msg[]>(() => [
    mode === 'add'
      ? { id: 0, from: 'ai', kind: 'text', key: 'assistant.hello', examples: EXAMPLES, samples: true }
      : { id: 0, from: 'ai', kind: 'text', key: 'assistant.editHello', values: { title: property!.title }, examples: EDIT_EXAMPLES },
  ])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs.length])

  // ids come from a counter so React keys stay stable
  const push = (...ms: NewMsg[]) => setMsgs((prev) => [...prev, ...ms.map((m) => ({ ...m, id: nextId.current++ }) as Msg)])
  const lastAsk = [...msgs].reverse().find((m) => m.from === 'ai')
  const asking = lastAsk && lastAsk.from === 'ai' && lastAsk.kind === 'ask' ? lastAsk.q.key : undefined

  /** After facts land: ask the next missing required fact, or say it's ready. */
  const follow = (d: Draft): NewMsg => {
    const q = nextQuestion(d)
    return q ? { from: 'ai', kind: 'ask', q } : { from: 'ai', kind: 'ready' }
  }

  const take = (facts: Fact[], source?: string) => {
    const nd = applyFacts(draft, facts)
    setDraft(nd)
    push({ from: 'ai', kind: 'read', facts, source }, follow(nd))
    return nd
  }

  const onSend = (text: string) => {
    push({ from: 'user', text })
    if (mode === 'edit') {
      const facts = readMessage(text, draft)
      const changes = changesFor(draft, facts)
      push(changes.length ? { from: 'ai', kind: 'confirm', changes, facts, state: 'open' } : { from: 'ai', kind: 'text', key: 'assistant.noChange' })
      return
    }
    const facts = readMessage(text, draft, asking).filter((f) => f.key !== 'status')
    if (!facts.length) {
      const q = nextQuestion(draft)
      push({ from: 'ai', kind: 'text', key: 'assistant.notUnderstood' }, ...(q ? [{ from: 'ai', kind: 'ask', q } as NewMsg] : []))
      return
    }
    take(facts)
  }

  const onAnswer = (q: Question, value: string | number, label: string) => {
    push({ from: 'user', text: label })
    const nd = applyFacts(draft, [{ key: q.key, value }])
    setDraft(nd)
    push(follow(nd))
  }

  const addPhotos = (count: number) => {
    if (mode === 'edit') {
      updateProperty(property!.id, (x) => {
        const n = x.media.length
        x.media.push(...Array.from({ length: count }, (_, i) => ({ id: `${x.id}-ph${n + i + 1}`, kind: 'photo' as const, url: '', isCover: n + i === 0 })))
      }, t('history.photos', { count }))
    }
    setDraft((d) => ({ ...d, photos: d.photos + count }))
    push({ from: 'ai', kind: 'text', key: 'assistant.photosAdded', values: { count } })
  }

  const readBrochure = (file: string) => {
    push({ from: 'user', text: t('assistant.brochureMsg'), file })
    if (mode === 'edit') { push({ from: 'ai', kind: 'text', key: 'assistant.editFilesHint' }); return }
    const facts = readMessage(SAMPLE_BROCHURE.text, draft)
    const nd = applyFacts(draft, facts)
    nd.photos += SAMPLE_BROCHURE.photos
    setDraft(nd)
    push(
      { from: 'ai', kind: 'read', facts, source: t('assistant.brochureSource', { file, page: SAMPLE_BROCHURE.page }) },
      { from: 'ai', kind: 'text', key: 'assistant.brochurePhotos', values: { count: SAMPLE_BROCHURE.photos } },
      follow(nd),
    )
  }

  const openSheet = (file: string, rows: number) => {
    push({ from: 'user', text: t('assistant.sheetMsg'), file }, { from: 'ai', kind: 'import', file, rows })
  }

  const onSample = (s: SampleFile) => {
    if (s === 'brochure') readBrochure(SAMPLE_BROCHURE.file)
    else if (s === 'sheet') openSheet(SAMPLE_SHEET.file, SAMPLE_SHEET.rows)
    else { push({ from: 'user', text: t('assistant.photosMsg', { count: 3 }) }); addPhotos(3) }
  }

  const onFiles = (files: File[]) => {
    if (!files.length) return
    const images = files.filter((f) => f.type.startsWith('image/'))
    const sheets = files.filter((f) => /\.(xlsx|xls|csv)$/i.test(f.name))
    const pdfs = files.filter((f) => /\.pdf$/i.test(f.name))
    if (images.length) { push({ from: 'user', text: t('assistant.photosMsg', { count: images.length }) }); addPhotos(images.length) }
    if (sheets.length) openSheet(sheets[0].name, SAMPLE_SHEET.rows)
    if (pdfs.length) readBrochure(pdfs[0].name)
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); onFiles([...e.dataTransfer.files]) }

  /* ---------- saving ---------- */

  const save = (status: 'available' | 'draft') => {
    const build = (id: string) => draftToProperty(draft, id, user.id, today, status)
    const id = addProperty(build, status === 'draft' ? t('history.draftAi') : t('history.publishedAi'))
    navigate(`/properties/${id}`)
    if (status === 'draft') { toast.success(t('assistant.draftSaved')); return }
    const fit = leadsForProperty(build(id), db.leads, db.settings)
    toast.success(t('property.published'), {
      description: fit.length ? t('property.publishedFit', { count: fit.length }) : t('property.publishedNoFit'),
      action: fit.length ? { label: t('matches.notify'), onClick: () => toast.success(t('matches.notified', { count: new Set(fit.map((m) => m.lead.ownerId)).size })) } : undefined,
    })
  }

  const onConfirm = (msgId: number, apply: boolean) => {
    const m = msgs.find((x) => x.id === msgId)
    if (!m || m.from !== 'ai' || m.kind !== 'confirm') return
    setMsgs((prev) => prev.map((x) => (x.id === msgId ? { ...x, state: apply ? 'applied' : 'cancelled' } as Msg : x)))
    if (!apply) return
    const nd = applyFacts({ ...draft, titleEdited: true }, m.facts.filter((f) => f.key !== 'type'))
    const summary = m.changes.map((c) => Array.isArray(c.to) ? `${ft.label(c.key)}: + ${ft.value(c.key, c.to, draft.type)}` : `${ft.label(c.key)}: ${ft.value(c.key, c.from, draft.type) || '—'} → ${ft.value(c.key, c.to, draft.type)}`).join('; ')
    updateProperty(property!.id, (x) => writeDraftToProperty(x, nd), t('history.editedAi', { changes: summary }))
    setDraft(nd)
    push({ from: 'ai', kind: 'text', key: 'assistant.appliedMore' })
    toast.success(t('assistant.savedToProperty'))
  }

  const onFact = (f: Fact) => {
    if (mode === 'edit') {
      const changes = changesFor(draft, [f])
      if (changes.length) push({ from: 'ai', kind: 'confirm', changes, facts: [f], state: 'open' })
      return
    }
    const nd = applyFacts(draft, [f])
    setDraft(nd)
    const q = nextQuestion(nd)
    // keep the conversation in step with a correction made in the preview
    if (asking && asking === f.key) push(q ? { from: 'ai', kind: 'ask', q } : { from: 'ai', kind: 'ready' })
  }

  const handlers = { onSend, onAnswer, onSample, onPublish: () => save('available'), onSaveDraft: () => save('draft'), onOpenImport: () => navigate('/properties/import'), onConfirm }
  const req = requiredKeys(draft).length + 1
  const done = req - missingKeys(draft).length
  const preview = (
    <PreviewPanel draft={draft} mode={mode} onFact={onFact}
      approvalStatus={property ? Object.fromEntries(property.approvals.map((x) => [x.approvalId, x.status])) : undefined} onAddPhotos={() => onSample('photos')}
      onPublish={() => save('available')} onSaveDraft={() => save('draft')} onDone={() => navigate(`/properties/${property!.id}`)} />
  )

  return (
    <div className="mx-auto grid h-[calc(100svh-3.5rem)] w-full max-w-7xl gap-6 px-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label={t('assistant.chatLabel')} className="relative flex min-h-0 flex-col"
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <div className="flex items-center gap-2 py-3">
          <Link to={property ? `/properties/${property.id}` : '/properties'} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {property ? t('assistant.backToProperty') : t('property.back')}
          </Link>
        </div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{mode === 'add' ? t('assistant.addTitle') : t('assistant.editTitle', { title: property!.title })}</h1>

        {/* phone: progress + preview */}
        <button type="button" onClick={() => setPreviewOpen(true)} className="mt-3 flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left text-sm lg:hidden">
          <span className="font-medium">{t('assistant.requiredCount', { done, total: req })}</span>
          <Progress value={(done / req) * 100} className="h-1.5 flex-1" />
          <span className="flex items-center gap-1 text-primary">{t('assistant.preview')} <ChevronUp className="size-4" /></span>
        </button>

        <div className="-mx-1 mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-3" aria-live="polite">
          {msgs.map((m, i) => <Message key={m.id} m={m} latest={i === msgs.length - 1} type={draft.type} h={handlers} />)}
          <div ref={endRef} />
        </div>

        <div className="pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Composer onSend={onSend} onFiles={onFiles} voiceSample={mode === 'add' ? EXAMPLES[0] : EDIT_EXAMPLES[0]}
            placeholder={mode === 'add' ? t('assistant.placeholder') : t('assistant.editPlaceholder')} />
        </div>

        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-background/90 text-primary">
            <Upload className="size-8" /> <p className="font-medium">{t('assistant.dropHere')}</p>
          </div>
        )}
      </section>

      <aside className={cn('hidden min-h-0 overflow-y-auto py-5 lg:block')}>{preview}</aside>

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="bottom" className="max-h-[90svh] overflow-y-auto rounded-t-2xl lg:hidden">
          <SheetHeader><SheetTitle>{t('assistant.preview')}</SheetTitle></SheetHeader>
          <div className="px-4 pb-4">{preview}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
