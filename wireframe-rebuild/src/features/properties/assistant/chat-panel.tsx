import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { Check, CircleHelp, ExternalLink, Paperclip, Plus, SendHorizontal, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/app/chip'
import { Meter } from '@/components/app/meter'
import type { Tone } from '@/components/app/tone'
import { amenityList } from '@/data/catalogue'
import { type ChatMsg, type Decision, decisionChoices, type Draft, type Question } from '@/lib/assistant'
import { inr, sqft } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCan, useStore } from '@/store/db'
import { useFactText } from './use-fact-text'

/** Sample descriptions under the greeting (spec-system-wireframe's "Try:" list). They are things a person types, so they stay as written. */
export const EXAMPLES = [
  '2 BHK flat for sale in Porur, Chennai, 62 lakhs',
  '3 BHK flat in Thirunagar, Madurai. 2nd floor of G+4, 1,350 sq.ft, north-east facing. 1 covered car parking, lift and power backup. Ready to move.',
  'Shop for rent in Srirangam, Trichy',
]

export type ChatHandlers = {
  onSend: (text: string) => void
  onAnswer: (q: Question, value: string | number, label: string) => void
  onPhotos: () => void
  onSkip: (step: 'photos' | 'amenities') => void
  onAmenity: (name: string) => void
  onApproval: (id: string) => void
  /** A decision card's button. */
  onDecide: (choice: string) => void
  onPublish: () => void
}

/** The values a decision card's question and buttons show. `type` is the property type's name ("For all Flat / Apartment"). */
export function decideValues(x: Decision, type: string): Record<string, string | number> {
  switch (x.kind) {
    case 'dup': return { id: x.id }
    case 'newAmenity': return { name: x.name }
    case 'newDetail': return { label: x.label, value: x.value, type }
    case 'priceUnit': return { n: x.n }
    case 'priceCheck': return { rate: inr(x.ppsf), min: inr(x.min), max: inr(x.max), count: x.n }
    case 'pin': return {}
  }
}

const scoreTone = (n: number): Tone => (n >= 80 ? 'success' : n >= 50 ? 'warning' : 'danger')

/** The left column: "✨ AI assistant" with the listing's completion, the conversation, and the message box. */
export function ChatPanel({ chat, draft, score, publishLabel, canWrite, examples, h, inputRef }: {
  chat: ChatMsg[]
  draft: Draft
  score: number
  publishLabel: string
  /** false: read-only (someone else's draft waiting for approval). */
  canWrite: boolean
  /** Show the "Try:" examples until the first message (a new property only). */
  examples: boolean
  h: ChatHandlers
  inputRef: RefObject<HTMLTextAreaElement | null>
}) {
  const { t } = useTranslation()
  const logRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const seen = useRef(chat.length)
  const fresh = !chat.some((m) => m.from === 'user')

  // keep the newest message in view: the log scrolls on desktop; on a phone the page scrolls (only once the chat moves on)
  useEffect(() => {
    const log = logRef.current
    if (log && log.scrollHeight > log.clientHeight) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' })
    else if (chat.length !== seen.current) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    seen.current = chat.length
  }, [chat.length])

  return (
    <section aria-label={t('assistant.panelTitle')}
      className="flex min-h-[65svh] flex-col rounded-xl border bg-card shadow-card lg:h-full lg:min-h-[440px] lg:overflow-hidden">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-violet" /> {t('assistant.panelTitle')}</h2>
        <span className="flex-1" />
        <span className="flex items-center gap-2 text-meta text-muted-foreground tabular-nums" title={t('assistant.completion')}>
          <Meter value={score} tone={fresh && !score ? 'neutral' : scoreTone(score)} label={t('assistant.completion')} className="w-20" />
          {score}%
        </span>
      </header>

      <div ref={logRef} className="flex flex-1 flex-col gap-3 p-4 lg:min-h-0 lg:overflow-y-auto" aria-live="polite">
        {chat.map((m, i) => <Message key={m.id} m={m} latest={i === chat.length - 1} draft={draft} publishLabel={publishLabel} canWrite={canWrite} h={h} />)}
        {examples && fresh && canWrite && (
          <div className="flex flex-col items-start gap-1.5">
            <span className="text-meta text-muted-foreground">{t('assistant.try')}</span>
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => h.onSend(e)}
                className="max-w-full rounded-full border border-primary/30 bg-card px-3 py-1 text-left text-sm text-primary hover:bg-accent">
                <span className="line-clamp-1">{e}</span>
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <Composer disabled={!canWrite} onSend={h.onSend} onPhotos={h.onPhotos} inputRef={inputRef} />
    </section>
  )
}

/* ---------- one message ---------- */

function Message({ m, latest, draft, publishLabel, canWrite, h }: {
  m: ChatMsg; latest: boolean; draft: Draft; publishLabel: string; canWrite: boolean; h: ChatHandlers
}) {
  const { t } = useTranslation()
  const ft = useFactText()
  const { db } = useStore()
  const can = useCan()
  const live = latest && canWrite // buttons only on the newest message

  if (m.from === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-line text-primary-foreground">{m.text}</p>
      </div>
    )
  }

  const bubble = (children: ReactNode, actions?: ReactNode) => (
    <div className="flex max-w-[90%] flex-col items-start gap-2">
      <div className="rounded-2xl rounded-tl-md bg-muted px-3.5 py-2 text-sm">{children}</div>
      {actions && live && <div className="flex flex-wrap gap-1.5">{actions}</div>}
    </div>
  )
  const hint = (text: string) => text && <span className="mt-0.5 block text-meta text-muted-foreground">{text}</span>
  const pill = (key: string, label: ReactNode, onClick: () => void, on?: boolean) => (
    <Chip key={key} pressed={on} onClick={onClick} className={cn(!on && 'border-primary/30 text-primary')}>{label}</Chip>
  )

  switch (m.kind) {
    case 'text':
      return bubble(t(m.key, m.values ?? {}))
    case 'read': {
      const labels = m.facts.map((f) => ft.label(f.key, draft.type))
      const notes = m.facts.filter((f) => f.note)
      return bubble(
        <>
          {t('assistant.filledIn', { list: ft.list([...new Set(labels)]) })}
          {notes.map((f) => (
            <span key={f.key} className={cn('mt-0.5 block text-meta', f.note!.k === 'onwards' ? 'text-warning' : 'text-muted-foreground')}>
              {ft.label(f.key, draft.type)}: {ft.note(f)}
            </span>
          ))}
        </>,
      )
    }
    case 'ask': {
      const key = m.q.key.replace('spec:', 'spec_')
      const text = m.q.key === 'locality' && draft.city ? t('assistant.ask.localityIn', { city: draft.city })
        : m.q.key === 'price' && draft.purpose === 'rent' ? t('assistant.ask.rent')
          : t(`assistant.ask.${key}`, { defaultValue: t('assistant.ask.generic', { fact: ft.label(m.q.key, draft.type).toLowerCase() }) })
      return bubble(
        <>{text}{m.q.hint && hint(t(`assistant.hint.${m.q.key.replace('spec:', '')}`, { defaultValue: '' }))}</>,
        m.q.options?.map((o) => {
          const label = o.i18n ? t(o.label) : m.q.key === 'spec:floor' && o.value === 0 ? t('assistant.groundFloor') : o.label
          return pill(String(o.value), label, () => h.onAnswer(m.q, o.value as string | number, label))
        }),
      )
    }
    case 'photos':
      return bubble(
        <>{t('assistant.photosAsk')}{hint(t('assistant.photosHint'))}</>,
        <>
          <Button size="sm" onClick={h.onPhotos}><Paperclip /> {t('assistant.addPhotos')}</Button>
          <Button size="sm" variant="outline" onClick={() => h.onSkip('photos')}>{t('assistant.skipForNow')}</Button>
        </>,
      )
    case 'amenities': {
      const list = [...new Set([...amenityList(db.settings), ...draft.amenities])]
      return bubble(
        <>{t('assistant.amenitiesAsk')}{hint(t('assistant.amenitiesHint'))}</>,
        <>
          {list.map((a) => pill(a, <>{draft.amenities.includes(a) ? <Check /> : <Plus />} {t(`amenity.${a}`, { defaultValue: a })}</>, () => h.onAmenity(a), draft.amenities.includes(a)))}
          <Button size="sm" variant={draft.amenities.length ? 'default' : 'outline'} onClick={() => h.onSkip('amenities')}>
            {draft.amenities.length ? t('action.done') : t('assistant.skip')}
          </Button>
        </>,
      )
    }
    case 'approvals':
      return bubble(
        <>{t('assistant.approvalsAsk')}</>,
        db.settings.approvalTypes.map((a) => pill(a.id, <>{draft.approvals.includes(a.id) ? <Check /> : <Plus />} {ft.approval(a.id)}</>, () => h.onApproval(a.id), draft.approvals.includes(a.id))),
      )
    case 'decide': {
      const x = m.d
      const values = decideValues(x, ft.value('type', draft.type))
      const other = x.kind === 'dup' ? db.properties.find((p) => p.id === x.id) : undefined
      const place = draft.locality || draft.city || ''
      const question =
        x.kind === 'dup' ? (
          <>
            {t('assistant.decide.dup.q')}{' '}
            {other ? (
              <Link to={other.status === 'draft' ? `/properties/${other.id}/edit` : `/properties/${other.id}`} target="_blank" className="font-medium text-primary hover:underline">
                {other.id} — {other.title}
              </Link>
            ) : x.id}
            {other && <span className="mt-0.5 block text-meta text-muted-foreground">{t('assistant.decide.dup.why', { area: sqft(other.areaSqft), locality: other.location.locality, status: t(`status.${other.status}`) })}</span>}
          </>
        ) : x.kind === 'pin' ? (
          <>
            {t('assistant.decide.pin.q', { place })}{' '}
            <a className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer"
              href={`https://www.google.com/maps?q=${encodeURIComponent([draft.locality, draft.city].filter(Boolean).join(', '))}`}>{t('assistant.decide.pin.view')} <ExternalLink className="size-3" /></a>
          </>
        ) : x.kind === 'priceCheck' ? (
          <>{t('assistant.decide.priceCheck.q', { ...values, city: draft.city ?? '' })}{hint(t('assistant.decide.priceCheck.why', values))}</>
        ) : t(`assistant.decide.${x.kind}.q`, values)
      const choices = decisionChoices(x, { manager: can('property.manage'), hasType: !!draft.type })
      // without the "add to the list" choice (executives), the question asks only about this property
      const onlyHere = (x.kind === 'newAmenity' || x.kind === 'newDetail') && !choices.includes(x.kind === 'newAmenity' ? 'list' : 'type')
      return bubble(
        <span className="flex gap-2">
          <CircleHelp aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
          <span className="min-w-0">{onlyHere ? t(`assistant.decide.${x.kind}.qOnly`, values) : question}</span>
        </span>,
        choices.map((c, i) => (
          <Button key={c} size="sm" variant={i === 0 ? 'default' : 'outline'} onClick={() => h.onDecide(c)}>{t(`assistant.decide.${x.kind}.${c}`, values)}</Button>
        )),
      )
    }
    case 'ready': {
      const offer = db.settings.approvalTypes.filter((a) => !draft.approvals.includes(a.id))
      return bubble(
        <>{t('assistant.readyAsk')}{offer.length > 0 && hint(t('assistant.readyHint'))}</>,
        <>
          <Button size="sm" onClick={h.onPublish}>{publishLabel}</Button>
          {offer.map((a) => pill(a.id, <><Plus /> {ft.approval(a.id)}</>, () => h.onApproval(a.id)))}
        </>,
      )
    }
  }
}

/* ---------- the message box ---------- */

/** Enter sends; Shift+Enter adds a line. The clip adds photos. */
function Composer({ onSend, onPhotos, disabled, inputRef }: {
  onSend: (text: string) => void; onPhotos: () => void; disabled: boolean; inputRef: RefObject<HTMLTextAreaElement | null>
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const send = () => { if (text.trim()) { onSend(text.trim()); setText('') } }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  return (
    // phone: the message box stays at the bottom of the screen while the page scrolls
    <form className="sticky bottom-0 rounded-b-xl bg-card p-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:pt-0 lg:pb-3" onSubmit={(e) => { e.preventDefault(); send() }}>
      <div className={cn('flex items-end gap-1 rounded-2xl border bg-background p-1.5 pl-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30', disabled && 'opacity-60')}>
        <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} rows={1} disabled={disabled}
          placeholder={disabled ? t('assistant.readOnly') : t('assistant.placeholder')} aria-label={t('assistant.messageLabel')}
          className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-base outline-none field-sizing-content placeholder:text-muted-foreground md:text-sm" />
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t('assistant.addPhotos')} title={t('assistant.addPhotos')} onClick={onPhotos}><Paperclip /></Button>
        <Button type="submit" size="icon" className="rounded-full" disabled={disabled || !text.trim()} aria-label={t('assistant.send')} title={t('assistant.send')}><SendHorizontal /></Button>
      </div>
    </form>
  )
}
