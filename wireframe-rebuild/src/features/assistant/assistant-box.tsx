/**
 * The assistant (design agreed 26 Nov, "AI-first RealSpec", step A): one box for creating, changing and finding.
 * A message is read (lib/ai/understand.ts), turned into a plan (lib/ai/plan.ts) or an answer (lib/ai/answer.ts), and
 * shown for a person to check. Nothing is saved until they apply it; applying offers Undo for 10 seconds, and every
 * change goes on the lead's timeline marked ✨. Used by the Ask bar, the lead page and Add lead.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, Check, CornerDownLeft, Mic, MicOff, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { StatusChip } from '@/components/app/status-chip'
import { type Tone, toneSoft, toneText } from '@/components/app/tone'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { BAND_TONE } from '@/lib/readiness'
import { answerLeads, withoutChip } from '@/lib/ai/answer'
import { newLeadRecord, planForLead, planNewLead, type Ask, type ItemKind } from '@/lib/ai/plan'
import { understand, type LeadQuery, type NewLeadFields, type Reading } from '@/lib/ai/understand'
import { addDays, fmtDate, inrShort } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads, userName } from '@/store/db'
import { isActive } from '../leads/lead-list'
import { useSpeech } from './use-speech'

export type AssistantMode = 'bar' | 'lead' | 'newLead'

export function AssistantBox({ mode, leadId, onDone, examples, placeholder, autoFocus, composer, onPlainNote }: {
  mode: AssistantMode
  /** One bordered line with small example chips: the composer at the top of a lead's Activity tab. */
  composer?: boolean
  /** "Just add a note": save the text as written, without reading it. */
  onPlainNote?: (text: string) => void
  /** The lead whose page this is: "he", "this lead" mean them. */
  leadId?: string
  /** Called after something was applied or opened (the Ask bar closes). */
  onDone?: () => void
  examples: string[]
  placeholder: string
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const { db, today } = useStore()
  const leads = useVisibleLeads()
  const [text, setText] = useState('')
  const [sent, setSent] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)
  const speech = useSpeech((heard, final) => { setText(heard); if (final && heard.trim()) setSent(heard.trim()) })

  const ctx = useMemo(() => ({ db, today, leads, leadId }), [db, today, leads, leadId])
  const reading: Reading | null = useMemo(() => {
    if (!sent) return null
    const r = understand(sent, ctx)
    // on Add lead every message describes the new lead
    if (mode === 'newLead' && r.kind !== 'addLead') return understand(`new lead ${sent}`, { ...ctx, leadId: undefined })
    return r
  }, [sent, ctx, mode])

  const submit = (value = text) => { const v = value.trim(); if (v) { setText(v); setSent(v) } }
  /** A quick reply adds its words to the message, which is read again. */
  const addToMessage = (add: string) => { const v = `${text.trim()} ${add}`.trim(); setText(v); setSent(v) }
  const reset = () => { setText(''); setSent(''); box.current?.focus() }
  const done = () => { reset(); onDone?.() }

  const btn = composer ? 'size-9' : 'size-11'
  // the plain note: saved as written, no reading (Activity composer only)
  const plainNote = () => { const v = text.trim(); if (!v) { box.current?.focus(); return } onPlainNote?.(v); reset() }

  return (
    <div className="flex flex-col">
      {/* "composer": one bordered line, as a timeline's composer (the lead's Activity tab); otherwise the open Ask bar box */}
      <form onSubmit={(e) => { e.preventDefault(); submit() }}
        className={cn('flex gap-2', composer ? 'items-center rounded-xl border bg-card py-1.5 pr-1.5 pl-3 transition-shadow focus-within:border-primary/60 focus-within:ring-3 focus-within:ring-ring/15' : 'items-start')}>
        <Sparkles className={cn('size-4 shrink-0 text-violet', !composer && 'mt-2.5')} aria-hidden />
        <Textarea ref={box} value={text} autoFocus={autoFocus} rows={composer ? 1 : 2} aria-label={placeholder} placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          className={cn('flex-1 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0', composer ? 'field-sizing-content max-h-40 min-h-9 py-1.5 text-sm md:text-sm' : 'min-h-11 py-2 text-base md:text-base')} />
        {speech.supported && (
          <Button type="button" variant="outline" size="icon" className={cn(btn, 'shrink-0', speech.listening && 'border-danger text-danger')}
            aria-label={speech.listening ? t('ai.stopListening') : t('ai.speak')} title={speech.listening ? t('ai.stopListening') : t('ai.speak')}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}>
            {speech.listening ? <MicOff /> : <Mic />}
          </Button>
        )}
        <Button type="submit" size="icon" className={cn(btn, 'shrink-0')} aria-label={t('ai.send')} title={t('ai.sendHint')} disabled={!text.trim()}><CornerDownLeft /></Button>
      </form>
      {speech.listening && <p className="mt-1 pl-6 text-xs text-danger">{t('ai.listening')}</p>}

      {!reading && composer && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {examples.map((x) => (
            <button key={x} type="button" onClick={() => submit(x)} className="rounded-full bg-violet-soft px-2.5 py-1 text-left text-xs text-violet hover:bg-violet-soft/70">{x}</button>
          ))}
          {onPlainNote && (
            <button type="button" onClick={plainNote} title={t('ai.plainNoteHint')} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">
              {text.trim() ? t('ai.saveAsNote') : t('ai.justNote')}
            </button>
          )}
        </div>
      )}
      {!reading && !composer && (
        <div className="mt-3 flex flex-col gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">{t('ai.tryOne')}</p>
          <div className="flex flex-wrap gap-1.5">
            {examples.map((x) => (
              <button key={x} type="button" onClick={() => submit(x)} className="rounded-full bg-violet-soft px-3 py-1.5 text-left text-sm text-violet hover:bg-violet-soft/70">{x}</button>
            ))}
          </div>
        </div>
      )}

      {reading && (
        <div className={cn(composer ? 'mt-3 rounded-xl border bg-muted/30 p-3' : 'mt-3 border-t pt-3')}>
          {reading.kind === 'unknown' && <Unknown onExample={submit} examples={examples} />}
          {reading.kind === 'findProperties' && (
            <Handoff text={t('ai.findProperties')} action={t('ai.showProperties')} to={`/properties?ask=${encodeURIComponent(reading.text)}`} onGo={done} />
          )}
          {reading.kind === 'addProperty' && (
            <Handoff text={t('ai.addProperty')} action={t('ai.startProperty')} to={`/properties/new?say=${encodeURIComponent(reading.text)}`} onGo={done} />
          )}
          {reading.kind === 'findLeads' && <LeadAnswer key={sent} q={reading.q} onOpen={done} />}
          {reading.kind === 'addLead' && <NewLead key={sent} fields={reading.fields} onAsk={addToMessage} onDone={done} inForm={mode === 'newLead'} />}
          {reading.kind === 'lead' && <LeadPlan key={sent} reading={reading} ctx={ctx} onAsk={addToMessage} onDone={done} onChange={() => box.current?.focus()} />}
        </div>
      )}
    </div>
  )
}

/* ---------- results ---------- */

function Unknown({ examples, onExample }: { examples: string[]; onExample: (x: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>{t('ai.unknown')}</p>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((x) => <button key={x} type="button" onClick={() => onExample(x)} className="rounded-full bg-violet-soft px-3 py-1.5 text-left text-violet hover:bg-violet-soft/70">{x}</button>)}
      </div>
    </div>
  )
}

function Handoff({ text, action, to, onGo }: { text: string; action: string; to: string; onGo: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <p className="min-w-0 flex-1">{text}</p>
      <Button onClick={() => { navigate(to); onGo() }}>{action} <ArrowRight /></Button>
    </div>
  )
}

function Asks({ asks, onAsk }: { asks: Ask[]; onAsk: (add: string) => void }) {
  return (
    <>
      {asks.map((a) => (
        <div key={a.text} className="flex items-start gap-3 rounded-xl border border-primary/30 bg-card p-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-soft font-bold text-violet" aria-hidden>?</span>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="font-medium">{a.text}</p>
            {a.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {a.options.map((o) => <button key={o.add} type="button" onClick={() => onAsk(o.add)} className="rounded-full border px-3 py-1.5 text-sm hover:border-primary hover:bg-accent hover:text-primary">{o.label}</button>)}
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  )
}

const KIND_TONE: Record<ItemKind, Tone> = {
  log: 'primary', visit: 'warning', outcome: 'success', budget: 'info',
  follow: 'info', offer: 'violet', lost: 'danger', share: 'primary', consent: 'success',
}

function LeadPlan({ reading, ctx, onAsk, onDone, onChange }: {
  reading: Extract<Reading, { kind: 'lead' }>; ctx: Parameters<typeof planForLead>[3]; onAsk: (add: string) => void; onDone: () => void; onChange: () => void
}) {
  const { t } = useTranslation()
  const store = useStore()
  const plan = planForLead(reading.actions, reading.leadId, reading.candidates, ctx, t)
  const lead = ctx.leads.find((l) => l.id === plan.leadId)
  const [off, setOff] = useState<Set<string>>(() => new Set())
  const chosen = plan.items.filter((i) => !i.blocked && !off.has(i.id))
  const apply = () => {
    const before = store.checkpoint()
    chosen.forEach((i) => i.apply(store))
    toast.success(t('ai.applied', { count: chosen.length, name: lead?.name ?? '' }), {
      duration: 10000, action: { label: t('ai.undo'), onClick: () => { store.restore(before); toast(t('ai.undone')) } },
    })
    onDone()
  }
  return (
    <div className="flex flex-col gap-3 text-sm">
      {lead && <p className="text-muted-foreground">{t('ai.forLead')} <Link to={`/leads/${lead.id}`} className="font-medium text-primary hover:underline">{lead.name}</Link> · {lead.id}{plan.items.length > 0 && <> · {t('ai.changes', { count: plan.items.length })}</>}</p>}
      <Asks asks={plan.asks} onAsk={onAsk} />
      {plan.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {plan.items.map((i) => (
            <li key={i.id}>
              <label className={cn('flex items-start gap-3 rounded-xl border bg-card p-3', i.blocked ? 'opacity-60' : 'cursor-pointer hover:border-primary/40')}>
                <Checkbox checked={!i.blocked && !off.has(i.id)} disabled={!!i.blocked} className="mt-0.5"
                  onCheckedChange={(v) => setOff((s) => { const n = new Set(s); if (v) n.delete(i.id); else n.add(i.id); return n })} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-medium', toneSoft[KIND_TONE[i.kind]])}>{t(`ai.kind.${i.kind}`)}</span>
                    <b className="font-semibold">{i.title}</b>
                  </span>
                  {i.detail && <span className="text-muted-foreground">{i.detail}</span>}
                  {(i.from || i.to) && (
                    <span>{i.from && <><s className="text-muted-foreground">{i.from}</s> → </>}<b className="font-semibold">{i.to}</b></span>
                  )}
                  {i.effect && <span className="text-violet">{i.effect}</span>}
                  {i.blocked && <span className="text-danger">{i.blocked}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {plan.warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-warning"><TriangleAlert className="mt-0.5 size-4 shrink-0" /> <span className="text-foreground">{w}</span></p>
      ))}
      {plan.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">{t('ai.nothingSaved')}</span>
          <span className="flex-1" />
          <Button variant="outline" onClick={onChange}>{t('ai.changeSomething')}</Button>
          <Button disabled={!chosen.length} onClick={apply}><Check /> {t('ai.apply', { count: chosen.length })}</Button>
        </div>
      )}
    </div>
  )
}

function NewLead({ fields, onAsk, onDone, inForm }: { fields: NewLeadFields; onAsk: (add: string) => void; onDone: () => void; inForm: boolean }) {
  const { t } = useTranslation()
  const L = useLabels()
  const navigate = useNavigate()
  const { db, today, user, addLead } = useStore()
  const can = useCan()
  const manager = can('lead.seeAll')
  const leads = useVisibleLeads()
  const executives = db.users.filter((u) => u.role === 'executive')
  const auto = [...executives].sort((a, b) =>
    db.leads.filter((l) => l.ownerId === a.id && isActive(l)).length - db.leads.filter((l) => l.ownerId === b.id && isActive(l)).length)[0]?.id ?? user.id
  const owner = manager ? auto : user.id
  const plan = planNewLead(fields, { db, today, leads }, t, owner)
  const f = plan.fields
  const create = () => {
    const note = t('leadForm.noteCreated', { owner: userName(db, owner) }) + ' ' + (f.consent ? t('leadForm.noteFollow', { date: fmtDate(addDays(today, 1)) }) : t('leadForm.noteNoConsent'))
    const id = addLead((nid) => newLeadRecord(f, nid, owner, today), note, true)
    toast.success(t('leadForm.created', { id }))
    navigate(`/leads/${id}/matches`)
    onDone()
  }
  const review = () => { navigate('/leads/new', { state: { prefill: f } }); onDone() }
  const cell = (label: string, value: ReactNode, sub?: string) => (
    <div className="border-b px-3 py-2 even:border-l sm:[&:nth-last-child(-n+2)]:border-b-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-medium', !value && 'text-muted-foreground')}>{value || '—'}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">{t('ai.understoodNewLead')}</p>
      <div className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2">
        {cell(t('leadForm.name'), f.name)}
        {cell(t('leadForm.phone'), f.phone)}
        {cell(t('lead.group.lookingFor'), [f.type && L.type(f.type), f.bhk].filter(Boolean).join(' · '))}
        {cell(t('ai.where'), [...f.localities, ...(f.localities.length ? [] : f.cities)].join(', ') + (f.localities.length ? ` · ${f.cities.join(', ')}` : ''), f.localities.length ? t('ai.cityFromLocality') : undefined)}
        {cell(t('lead.group.money'), f.max ? `${f.min ? inrShort(f.min) + ' – ' : t('ai.upTo') + ' '}${inrShort(f.max)}` : '')}
        {cell(t('ai.purpose'), f.purpose ? t(`purpose.buyer.${f.purpose}`) : '')}
        {cell(t('ai.contactSource'), [f.contactPref && t(`leadForm.pref.${f.contactPref}`), f.source].filter(Boolean).join(' · '))}
        {cell(t('leadForm.owner'), userName(db, owner), manager ? t('ai.autoOwner') : undefined)}
      </div>
      <Asks asks={plan.asks} onAsk={onAsk} />
      <div className="flex flex-wrap gap-1.5">
        {plan.checks.map((c) => <StatusChip key={c.text} tone={c.ok ? 'success' : 'warning'} icon={c.ok ? <Check /> : <X />} className="h-auto py-1 whitespace-normal">{c.text}</StatusChip>)}
      </div>
      {f.consent && <p className="text-xs text-muted-foreground">{t('ai.consentConfirm')}</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground">{t('ai.nothingSaved')}</span>
        <span className="flex-1" />
        <Button variant="outline" onClick={review}>{inForm ? t('ai.fillForm') : t('ai.reviewForm')}</Button>
        <Button disabled={!plan.ready} onClick={create} title={plan.ready ? undefined : t('ai.answerFirst')}><Check /> {t('leadForm.create')}</Button>
      </div>
    </div>
  )
}

function LeadAnswer({ q: start, onOpen }: { q: LeadQuery; onOpen: () => void }) {
  const { t } = useTranslation()
  const { db, today } = useStore()
  const leads = useVisibleLeads()
  const can = useCan()
  const [q, setQ] = useState(start)
  const a = answerLeads(q, leads, db, today, t)
  const first = a.rows[0]
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-base font-semibold">
        {a.rows.length ? t('ai.answer.found', { count: a.rows.length }) : t('ai.answer.none')}
        {first && !q.count && <span className="font-normal text-muted-foreground"> {t('ai.answer.top', { name: first.lead.name, id: first.top?.property.id ?? '—' })}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t('ai.answer.readAs')}</span>
        {a.chips.map((c) => (
          c.key === 'count'
            ? <StatusChip key={c.key} tone="neutral" variant="outline">{c.label}</StatusChip>
            : <button key={c.key} type="button" onClick={() => setQ(withoutChip(q, c.key))} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:border-danger/40 hover:text-danger" title={t('ai.answer.remove')}>
              {c.label} <X className="size-3" />
            </button>
        ))}
      </div>
      {a.rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground uppercase">
              <th scope="col" className="px-3 py-2 font-medium">{t('ai.answer.lead')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('lead.assess.ready')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('lead.group.money')}</th>
              <th scope="col" className="px-3 py-2 font-medium">{t('ai.answer.bestFit')}</th>
            </tr></thead>
            <tbody>
              {a.rows.slice(0, 8).map((r) => (
                <tr key={r.lead.id} className="border-t">
                  <td className="px-3 py-2"><Link to={`/leads/${r.lead.id}`} onClick={onOpen} className="font-medium text-primary hover:underline">{r.lead.name}</Link><span className="block text-xs text-muted-foreground">{r.lead.id} · {userName(db, r.lead.ownerId)}</span></td>
                  <td className="px-3 py-2"><b className={toneText[BAND_TONE[r.band]]}>{r.ready}</b> <span className="text-xs text-muted-foreground">{t(`lead.assess.band.${r.band}`)}</span></td>
                  <td className="px-3 py-2">{inrShort(r.lead.budget.min)} – {inrShort(r.lead.budget.max)}</td>
                  <td className="px-3 py-2">{r.top ? <Link to={`/properties/${r.top.property.id}`} onClick={onOpen} className="hover:underline">{r.top.property.id} · {r.top.score}</Link> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.rows.length > 8 && <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t('ai.answer.more', { count: a.rows.length - 8 })}</p>}
        </div>
      )}
      {!can('lead.seeAll') && <p className="text-xs text-muted-foreground">{t('ai.answer.yours')}</p>}
    </div>
  )
}
