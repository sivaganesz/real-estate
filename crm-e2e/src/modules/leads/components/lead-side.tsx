/**
 * The lead page's side column: the qualification card ("Qualification: 3 of 4 known — Budget ✓, Decision maker ✓,
 * Requirement ✓, Timeline ?", master prompt §9 — the word BANT never appears), the AI reading the notes and asking only
 * the missing questions as chips; generated messages (WhatsApp / SMS / e-mail, English or Hinglish) that open wa.me
 * prefilled and log the send; and the Lead Editing Assistant ("change budget to 1.5 Cr and add Hebbal").
 */
import { useMemo, useState } from 'react'
import { Check, CircleDot, ClipboardCheck, Copy, Loader2, Mail, MessageCircle, MessageSquare, Send, Sparkles, Wand2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAI } from '@/ai'
import type { AIMode, AIText, Extraction, QualificationResult } from '@/ai/types'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { VoiceButton } from '@/components/ai/voice-button'
import { Chip } from '@/components/shared/chip'
import { Meter } from '@/components/shared/meter'
import { ProgressRing } from '@/components/shared/progress-ring'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import type { Lead, LeadInput, MessagePurpose, Qualification } from '@/domain/types'
import { MESSAGE_PURPOSES } from '@/domain/catalogue'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { inrShort } from '@/lib/format'
import { configLabel } from '@/lib/matching'
import { answerPatch, extraQuestions, qualificationCard, readiness, type QualQuestion } from '@/lib/qualification'
import { cn } from '@/lib/utils'
import { mailtoLink, waLink } from '@/lib/whatsapp'
import { logContact } from '@/services/activities'
import { updateLeadFields } from '@/services/leads'
import { editChanges, patchFromChanges, type EditChange } from '../lib/ai-edit'
import { useAIResult } from './use-ai-result'

/* ---------- qualification ---------- */

export function QualificationCard({ lead }: { lead: Lead }) {
  const { t } = useTranslation(['leads', 'catalogue'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const db = useWholeDb()
  const now = useNow()
  const edit = can('lead.edit', lead)
  const card = qualificationCard(lead)
  const extras = extraQuestions(lead)
  const ready = useMemo(() => readiness(lead, { properties: db.properties, settings: db.settings, now }), [lead, db.properties, db.settings, now])
  const notes = db.activities.filter((a) => a.text && a.refs.some((r) => r.kind === 'lead' && r.id === lead.id)).length
  const { data: res } = useAIResult<QualificationResult>(`${lead.id}:${lead.updatedAt}:${notes}`, () => ai.qualifyLead(lead.id, context()))
  const inferred = Object.entries(res?.inferred ?? {}).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)) as [keyof Qualification, unknown][]

  const answer = (q: QualQuestion, value: unknown) => {
    const patch = answerPatch(lead, q.field, value)
    if (!patch) return
    try {
      const r = updateLeadFields(lead.id, patch, { undoable: true })
      toastUndo(t('leads:qualify.saved'), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const applyInferred = () => {
    try {
      const qualification = Object.fromEntries(inferred) as Partial<Qualification>
      const fieldMeta = Object.fromEntries(inferred.map(([k]) => [`qualification.${k}`, { origin: 'ai' as const, confidence: 0.8 }]))
      const r = updateLeadFields(lead.id, { qualification }, { via: 'ai', fieldMeta, undoable: true })
      toastUndo(t('leads:qualify.appliedFromNotes', { count: inferred.length }), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const valueLabel = (k: keyof Qualification, v: unknown) => {
    if (k === 'decisionMakers') return (v as string[]).map((x) => t(`catalogue:decisionMaker.${x}`)).join(', ')
    const ns = k === 'buyerPurpose' ? 'buyerPurpose' : k === 'fundingReady' ? 'funding' : k
    return t(`catalogue:${ns}.${String(v)}`)
  }
  const known = card.known.length
  return (
    <section aria-labelledby="qual-title" className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card md:p-5" data-testid="qualification-card">
      <div className="flex items-center gap-3">
        <ProgressRing value={(known / 4) * 100} size={44} tone={known === 4 ? 'success' : known >= 2 ? 'primary' : 'warning'} label={t('leads:qualify.title')}>{known}/4</ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 id="qual-title" className="text-base font-semibold">{t('leads:qualify.title')}</h2>
          <p className="text-meta text-muted-foreground">{t('leads:qualify.known', { count: known })}</p>
        </div>
        <DemoAIBadge mode={res?.mode ?? ai.mode} />
      </div>
      <ul className="grid grid-cols-2 gap-1.5">
        {card.checks.map((c) => (
          <li key={c.key} className={cn('flex items-center gap-1.5 rounded-md px-2 py-1.5 text-meta font-medium', c.known ? 'bg-success-soft text-success' : 'bg-muted text-muted-foreground')}>
            {c.known ? <Check className="size-3.5" aria-hidden="true" /> : <CircleDot className="size-3.5" aria-hidden="true" />}
            <span className="text-foreground">{t(`leads:qualify.check.${c.key}`)}</span>
            <span className="sr-only">{c.known ? t('leads:qualify.isKnown') : t('leads:qualify.isMissing')}</span>
            <span aria-hidden="true" className="ml-auto">{c.known ? '✓' : '?'}</span>
          </li>
        ))}
      </ul>
      {inferred.length > 0 && edit && (
        <div className="flex flex-col gap-2 rounded-md border border-ai-border/60 bg-ai-soft/40 p-3" data-testid="qual-inferred">
          <p className="flex items-center gap-1.5 text-meta font-semibold text-ai"><Sparkles className="size-3.5" aria-hidden="true" />{t('leads:qualify.fromNotes')}</p>
          <ul className="flex flex-col gap-0.5 text-sm">
            {inferred.map(([k, v]) => <li key={k}><span className="text-muted-foreground">{t(`leads:qualify.field.${k}`)}:</span> {valueLabel(k, v)}</li>)}
          </ul>
          <Button size="sm" variant="ai" className="self-start" onClick={applyInferred}>{t('leads:qualify.apply')}</Button>
        </div>
      )}
      {edit && [...card.questions, ...extras].length > 0 && (
        <div className="flex flex-col gap-3" aria-label={t('leads:qualify.ask')}>
          <p className="flex items-center gap-1.5 text-meta font-semibold text-ai"><Sparkles className="size-3.5" aria-hidden="true" />{t('leads:qualify.ask')}</p>
          {[...card.questions, ...extras].map((q) => (
            <div key={q.field} className="flex flex-col gap-1.5">
              <p className="text-sm">
                {t(q.prompt)}
                {q.essential && <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 text-micro font-semibold text-warning">{t('leads:qualify.essential')}</span>}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {q.chips?.map((c) => <Chip key={String(c.value)} size="sm" tone="ai" onClick={() => answer(q, c.value)}>{t(c.label)}</Chip>)}
              </div>
            </div>
          ))}
        </div>
      )}
      {known === 4 && !extras.length && <p className="flex items-center gap-1.5 text-meta text-success"><ClipboardCheck className="size-4" aria-hidden="true" />{t('leads:qualify.complete')}</p>}
      <Collapsible>
        <CollapsibleTrigger className="text-meta font-medium text-primary hover:underline">{t('leads:qualify.readiness', { score: ready.total })}</CollapsibleTrigger>
        <CollapsibleContent className="mt-2 flex flex-col gap-2">
          {ready.rows.map((r) => (
            <div key={r.key} className="flex flex-col gap-1">
              <div className="flex justify-between text-meta"><span>{t(`leads:readiness.${r.key}`)}</span><span className="tabular-nums text-muted-foreground">{r.points}/{r.max}</span></div>
              <Meter value={(r.points / r.max) * 100} size="xs" tone="primary" label={t(`leads:readiness.${r.key}`)} />
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}

/* ---------- generated messages ---------- */

type Channel = 'whatsapp' | 'sms' | 'email'
const PURPOSES: MessagePurpose[] = MESSAGE_PURPOSES.filter((p) => p !== 'share')

export function MessageComposer({ lead, defaultPurpose = 'followUp' }: { lead: Lead; defaultPurpose?: MessagePurpose }) {
  const { t } = useTranslation(['leads', 'catalogue'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const [purpose, setPurpose] = useState<MessagePurpose>(defaultPurpose)
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [tone, setTone] = useState<'english' | 'hinglish'>('english')
  const appointmentId = useWholeDb().appointments.filter((a) => a.leadId === lead.id && (a.status === 'scheduled' || a.status === 'confirmed')).sort((a, b) => a.start.localeCompare(b.start))[0]?.id
  const genKey = `${lead.id}:${purpose}:${channel}:${tone}:${appointmentId ?? ''}`
  const gen = useAIResult<AIText>(genKey, () => ai.generateMessage({ leadId: lead.id, purpose, channel, tone, appointmentId }, context()))
  // the user's edits belong to the draft they edited; a new purpose / channel / tone starts from the AI's new draft
  const [draft, setDraft] = useState<{ key: string; text: string } | null>(null)
  const edited = draft?.key === genKey
  const text = edited ? draft.text : gen.data?.text ?? ''
  const busy = gen.loading
  const mode: AIMode = gen.data?.mode ?? ai.mode
  const setText = (v: string) => setDraft({ key: genKey, text: v })
  const mayLog = can('lead.edit', lead)
  const log = () => { if (mayLog) logContact(lead.id, { channel, text }) }
  const href = channel === 'whatsapp' ? waLink(lead.phone, text) : channel === 'sms' ? `sms:${lead.phone}?body=${encodeURIComponent(text)}` : mailtoLink(lead.email, t(`catalogue:messagePurpose.${purpose}`), text)
  const disabled = !text.trim() || (channel === 'email' ? !lead.email : !lead.phone)
  return (
    <section aria-labelledby="msg-title" className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card md:p-5" data-testid="message-composer">
      <div className="flex items-center gap-2">
        <h2 id="msg-title" className="flex flex-1 items-center gap-2 text-base font-semibold"><MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />{t('leads:msg.title')}</h2>
        <DemoAIBadge mode={mode} />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('leads:msg.purpose')}>
        {PURPOSES.map((p) => <Chip key={p} size="sm" pressed={purpose === p} onClick={() => setPurpose(p)}>{t(`catalogue:messagePurpose.${p}`)}</Chip>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border bg-muted/60 p-0.5" role="group" aria-label={t('leads:msg.channel')}>
          {([['whatsapp', MessageCircle], ['sms', MessageSquare], ['email', Mail]] as const).map(([c, Icon]) => (
            <button key={c} type="button" aria-pressed={channel === c} onClick={() => setChannel(c)}
              className={cn('inline-flex h-7 items-center gap-1 rounded-sm px-2 text-meta font-medium', channel === c ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
              <Icon className={cn('size-3.5', c === 'whatsapp' && 'text-success')} aria-hidden="true" />{t(`leads:msg.ch.${c}`)}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-md border bg-muted/60 p-0.5" role="group" aria-label={t('leads:msg.tone')}>
          {(['english', 'hinglish'] as const).map((x) => (
            <button key={x} type="button" aria-pressed={tone === x} onClick={() => setTone(x)} data-testid={`msg-tone-${x}`}
              className={cn('inline-flex h-7 items-center rounded-sm px-2 text-meta font-medium', tone === x ? 'bg-card shadow-xs' : 'text-muted-foreground hover:text-foreground')}>
              {t(`leads:msg.toneOpt.${x}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label={t('leads:msg.text')} className={cn('text-sm', !edited && 'ai-filled')} data-testid="msg-text" />
        {busy && <Loader2 className="absolute top-2 right-2 size-4 animate-spin text-ai" aria-hidden="true" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild={!disabled} disabled={disabled} className={channel === 'whatsapp' ? 'bg-success text-success-foreground hover:bg-[color-mix(in_oklch,var(--success),var(--foreground)_12%)]' : undefined} data-testid="msg-send">
          {disabled ? <span><Send />{t(`leads:msg.send.${channel}`)}</span> : (
            <a href={href} target={channel === 'whatsapp' ? '_blank' : undefined} rel="noopener noreferrer" onClick={() => { log(); toast.success(t('leads:msg.logged', { channel: t(`leads:msg.ch.${channel}`) })) }}>
              <Send />{t(`leads:msg.send.${channel}`)}
            </a>
          )}
        </Button>
        <Button variant="secondary" size="sm" disabled={!text} onClick={() => { void navigator.clipboard?.writeText(text).then(() => toast.success(t('leads:msg.copied')), () => toast.error(t('leads:msg.copyFailed'))) }}>
          <Copy />{t('leads:msg.copy')}
        </Button>
      </div>
      {channel === 'email' && !lead.email && <p className="text-meta text-warning">{t('leads:msg.noEmail')}</p>}
      <p className="text-meta text-muted-foreground">{t('leads:msg.hint')}</p>
    </section>
  )
}

/* ---------- edit with AI ---------- */

export function EditWithAI({ lead, onApply, compact }: {
  lead: Lead
  /** Default: save to the lead (with Undo). The edit page passes its own to fill the form instead. */
  onApply?: (changes: EditChange[]) => void
  compact?: boolean
}) {
  const { t } = useTranslation(['leads', 'catalogue', 'ai'])
  const { ai, context } = useAI()
  const { can } = usePermission()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [changes, setChanges] = useState<EditChange[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<AIMode>(ai.mode)
  if (!can('lead.edit', lead)) return null

  const read = async (input = text) => {
    const clean = input.trim()
    if (!clean) return
    setBusy(true)
    try {
      const x: Extraction<LeadInput> = await ai.extractLead(clean, context())
      const c = editChanges(lead, clean, x)
      setChanges(c)
      setPicked(new Set(c.map((ch) => ch.path)))
      setMode(x.mode)
    } finally {
      setBusy(false)
    }
  }
  const apply = () => {
    const list = (changes ?? []).filter((c) => picked.has(c.path))
    if (!list.length) return
    if (onApply) onApply(list)
    else {
      try {
        const { patch, fieldMeta } = patchFromChanges(lead, list)
        const r = updateLeadFields(lead.id, patch, { via: 'ai', fieldMeta, undoable: true })
        toastUndo(t('leads:aiEdit.applied', { count: list.length }), r.undoToken)
      } catch (e) {
        toastError(e)
        return
      }
    }
    setChanges(null)
    setText('')
  }
  const show = (path: string, v: unknown): string => {
    if (v === undefined || v === null || (Array.isArray(v) && !v.length)) return '—'
    const key = path.split('.').pop() ?? path
    if (/^budget/.test(key)) return inrShort(v as number)
    if (key === 'configurations') return (v as string[]).map((c) => configLabel(c as never)).join(', ')
    const map: Record<string, string> = {
      propertyTypes: 'propertyType', timeline: 'timeline', possession: 'possession', decisionMakers: 'decisionMaker', authority: 'authority', loan: 'loan',
      buyerPurpose: 'buyerPurpose', facing: 'facing', furnishing: 'furnishing', amenities: 'amenity', source: 'source', purpose: 'purpose', transaction: 'transaction', need: 'need',
    }
    const ns = map[key]
    const one = (x: unknown) => (ns ? t(`catalogue:${ns}.${String(x)}`, { defaultValue: String(x) }) : typeof x === 'boolean' ? (x ? t('leads:aiEdit.yes') : t('leads:aiEdit.no')) : String(x))
    return Array.isArray(v) ? v.map(one).join(', ') : one(v)
  }
  return (
    <section aria-labelledby="aiedit-title" className={cn('flex flex-col gap-3 rounded-xl border border-dashed border-ai-border bg-ai-soft/30 p-4', compact && 'p-3')} data-testid="edit-with-ai">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground"><Wand2 className="size-3.5" /></span>
        <h2 id="aiedit-title" className="flex-1 text-sm font-semibold">{t('leads:aiEdit.title')}</h2>
        <DemoAIBadge mode={mode} />
      </div>
      <Textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={2} className="bg-card text-prompt" placeholder={t('leads:aiEdit.placeholder')} aria-label={t('leads:aiEdit.title')}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void read() } }} data-testid="aiedit-text"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ai" disabled={!text.trim() || busy} onClick={() => void read()} data-testid="aiedit-read">
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{t('leads:aiEdit.read')}
        </Button>
        <VoiceButton size="icon-sm" onText={(heard, final) => { setText(heard); if (final) void read(heard) }} />
      </div>
      {changes && (
        changes.length === 0 ? <p className="text-meta text-muted-foreground">{t('leads:aiEdit.nothing')}</p> : (
          <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" aria-live="polite">
            <p className="text-meta font-semibold">{t('leads:aiEdit.review', { count: changes.length })}</p>
            <ul className="flex flex-col gap-1.5">
              {changes.map((c) => (
                <li key={c.path}>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox className="mt-0.5" checked={picked.has(c.path)} onCheckedChange={(v) => setPicked((s) => { const n = new Set(s); if (v === true) n.add(c.path); else n.delete(c.path); return n })} />
                    <span className="min-w-0">
                      <span className="font-medium">{t(`leads:field.${c.path}`, { defaultValue: c.path })}</span>
                      <span className="block text-meta"><span className="text-muted-foreground line-through">{show(c.path, c.from)}</span> → <span className="font-semibold text-ai">{show(c.path, c.to)}</span></span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply} disabled={!picked.size} data-testid="aiedit-apply">{onApply ? t('leads:aiEdit.fill') : t('leads:aiEdit.apply', { count: picked.size })}</Button>
              <Button size="sm" variant="ghost" onClick={() => setChanges(null)}>{t('common:actions.cancel')}</Button>
            </div>
          </div>
        )
      )}
    </section>
  )
}
