/**
 * The appointment assistant on the detail page (master prompt §16 "AI: preparation points before a visit, meeting
 * summary after"; ROLE_RESEARCH §1.1 "confirms with the client 1–2 hours ahead, shares the location"):
 * - VisitPrepCard: what to check and bring, from the lead, the properties and earlier visits;
 * - VisitSummaryCard: the outcome as a short summary with the next step;
 * - WhatsAppConfirmCard: a ready confirmation with the Google Maps link, editable before sending.
 * All three are simulated AI and carry the Demo AI badge. Nothing is written until the user clicks a button.
 */
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCopy, Lightbulb, Loader2, MapPin, MessageCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAI } from '@/ai'
import type { AIMode } from '@/ai/types'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { SectionCard } from '@/components/shared/section-card'
import { Segmented } from '@/components/shared/segmented'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Appointment, Lead, Property } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { mapsLink, propertyAddress, waLink } from '@/lib/whatsapp'
import { logContact } from '@/services/activities'
import { confirmAppointment } from '@/services/appointments'
import { confirmationMessage } from '../lib/messages'
import { prepPoints, summaryPoints, type AIPoint } from '../lib/visit-ai'

const TONE_ICON = { warn: AlertTriangle, tip: Lightbulb, good: CheckCircle2 } as const
const TONE_CLS = { warn: 'text-warning', tip: 'text-ai', good: 'text-success' } as const

/** Translates a point; params that are catalogue keys or timestamps are rendered for the UI language. */
function usePointText() {
  const { t, i18n } = useTranslation(['appointments', 'catalogue'])
  return (p: AIPoint) => {
    const params: Record<string, string | number> = { ...p.params }
    if (typeof params.who === 'string') params.who = t(`catalogue:decisionMaker.${params.who}`).toLowerCase()
    if (typeof params.level === 'string') params.level = t(`appointments:interest.${params.level}`).toLowerCase()
    if (typeof params.type === 'string') params.type = t(`catalogue:appointmentType.${params.type}`).toLowerCase()
    if (typeof params.at === 'string') params.at = fmtDateTime(params.at, i18n.language)
    return t(`appointments:ai.${p.key}`, params)
  }
}

function PointList({ points }: { points: AIPoint[] }) {
  const text = usePointText()
  return (
    <ul className="flex flex-col gap-2" data-testid="ai-points">
      {points.map((p, i) => {
        const Icon = TONE_ICON[p.tone]
        return (
          <li key={`${p.key}-${i}`} className="flex items-start gap-2 text-sm">
            <Icon className={cn('mt-0.5 size-4 shrink-0', TONE_CLS[p.tone])} aria-hidden="true" />
            <span>{text(p)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function copy(text: string, done: string) {
  navigator.clipboard?.writeText(text).then(() => toast.success(done), () => toast.error(done))
}

function AIHeaderAction({ mode, onCopy }: { mode: AIMode; onCopy?: () => void }) {
  const { t } = useTranslation('appointments')
  return (
    <span className="flex items-center gap-1.5">
      <DemoAIBadge mode={mode} />
      {onCopy && <Button variant="ghost" size="icon-sm" onClick={onCopy} aria-label={t('ai.copy')}><ClipboardCopy /></Button>}
    </span>
  )
}

export function VisitPrepCard({ appointment, lead }: { appointment: Appointment; lead?: Lead }) {
  const { t } = useTranslation('appointments')
  const now = useNow()
  const properties = useDb((db) => db.properties)
  const history = useDb((db) => db.appointments)
  const text = usePointText()
  const points = useMemo(() => prepPoints({ appointment, lead, properties, history, now }), [appointment, lead, properties, history, now])
  return (
    <SectionCard
      icon={Sparkles}
      title={t('ai.prepTitle')}
      description={t('ai.prepBody')}
      action={<AIHeaderAction mode="simulated" onCopy={() => copy(points.map((p) => `• ${text(p)}`).join('\n'), t('ai.copied'))} />}
      className="border-ai-border bg-[radial-gradient(500px_circle_at_0_0,color-mix(in_oklch,var(--ai)_8%,transparent),transparent_60%)]"
      data-testid="visit-prep"
    >
      {points.length ? <PointList points={points} /> : <p className="text-sm text-muted-foreground">{t('ai.prepNone')}</p>}
    </SectionCard>
  )
}

export function VisitSummaryCard({ appointment, lead }: { appointment: Appointment; lead?: Lead }) {
  const { t } = useTranslation('appointments')
  const properties = useDb((db) => db.properties)
  const text = usePointText()
  const o = appointment.outcome
  if (!o) return null
  const { headline, points } = summaryPoints({ outcome: o, properties, leadName: lead?.name, durationMin: appointment.durationMin, type: appointment.type })
  return (
    <SectionCard
      icon={Sparkles}
      title={t('ai.summaryTitle')}
      action={<AIHeaderAction mode="simulated" onCopy={() => copy([text(headline), ...points.map((p) => `• ${text(p)}`), o.summary ?? ''].filter(Boolean).join('\n'), t('ai.copied'))} />}
      className="border-ai-border"
      data-testid="visit-summary"
    >
      <p className="mb-3 text-base font-semibold">{text(headline)}</p>
      <PointList points={points} />
      {o.summary && <blockquote className="mt-3 border-l-2 border-ai-border pl-3 text-sm text-muted-foreground">{o.summary}</blockquote>}
    </SectionCard>
  )
}

export function WhatsAppConfirmCard({ appointment: a, lead, properties }: { appointment: Appointment; lead: Lead; properties: Property[] }) {
  const { t } = useTranslation('appointments')
  const { ai, context } = useAI()
  const user = useCurrentUser()
  const owner = useDb((db) => db.users.find((u) => u.id === a.ownerId))
  const { can } = usePermission()
  const [tone, setTone] = useState<'english' | 'hinglish'>('english')
  const [nonce, setNonce] = useState(0)
  // The draft is keyed by what it was written for; a hand edit is kept until the key changes (new time, tone, redraft).
  const [draft, setDraft] = useState<{ key: string; text: string; mode: AIMode } | null>(null)
  const [edit, setEdit] = useState<{ key: string; text: string } | null>(null)
  const first = properties[0]
  const map = a.location?.mapUrl ?? (first ? mapsLink(propertyAddress(first)) : '')
  const agent = owner?.name ?? user.name
  const key = [a.id, a.start, a.type, a.location?.mapUrl ?? '', tone, nonce].join('|')
  const loading = draft?.key !== key
  const text = edit?.key === key ? edit.text : draft?.key === key ? draft.text : ''
  const mode = draft?.mode ?? ai.mode

  useEffect(() => {
    let live = true
    const run = async () => {
      if (a.type === 'siteVisit') {
        const r = await ai.generateMessage({ leadId: lead.id, purpose: 'visitConfirm', channel: 'whatsapp', tone, appointmentId: a.id, propertyIds: a.propertyIds }, context())
        return { text: r.text, mode: r.mode }
      }
      return { text: confirmationMessage({ appointment: a, leadName: lead.name, agent, when: fmtDateTime(a.start), property: first?.title, tone }), mode: 'simulated' as AIMode }
    }
    run().then(
      (r) => { if (live) setDraft({ key, ...r }) },
      (e: unknown) => { if (live) { setDraft({ key, text: '', mode: 'simulated' }); toastError(e) } },
    )
    return () => { live = false }
  }, [key, a, ai, context, lead.id, lead.name, agent, first?.title, tone])
  const setText = (v: string) => setEdit({ key, text: v })

  const href = waLink(lead.phone, text)
  const mayConfirm = can('appointment.manage', a) && a.status !== 'confirmed' && a.status !== 'completed' && a.status !== 'cancelled' && a.status !== 'noShow'
  const sent = () => {
    if (!can('lead.edit', lead)) return
    try {
      logContact(lead.id, { channel: 'whatsapp', text: t('whatsapp.logged') })
    } catch (e) {
      toastError(e)
    }
  }
  return (
    <SectionCard
      icon={MessageCircle}
      title={t('whatsapp.title')}
      description={t('whatsapp.body', { name: lead.name })}
      action={<DemoAIBadge mode={mode} />}
      data-testid="whatsapp-confirm"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented variant="pill" value={tone} onChange={setTone} label={t('whatsapp.tone')}
            segments={[{ value: 'english', label: t('whatsapp.english') }, { value: 'hinglish', label: t('whatsapp.hinglish') }]} />
          <Button variant="ghost" size="sm" onClick={() => setNonce((n) => n + 1)} className="text-ai hover:bg-ai-soft hover:text-ai"><RefreshCw />{t('whatsapp.regenerate')}</Button>
        </div>
        {loading ? (
          <div className="flex h-28 items-center justify-center gap-2 rounded-md border bg-muted/40 text-meta text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{t('whatsapp.drafting')}</div>
        ) : (
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label={t('whatsapp.message')} className="ai-filled" data-testid="whatsapp-text" />
        )}
        {map && (
          <a href={map} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start text-meta text-primary hover:underline">
            <MapPin className="size-3.5" aria-hidden="true" />{t('whatsapp.mapIncluded')}
          </a>
        )}
        <div className="flex flex-wrap gap-2">
          {href ? (
            <Button asChild size="sm" className="bg-success text-success-foreground hover:bg-success/90">
              <a href={href} target="_blank" rel="noopener noreferrer" onClick={sent} data-testid="whatsapp-send"><MessageCircle />{t('whatsapp.send')}</a>
            </Button>
          ) : (
            <p className="text-meta text-muted-foreground">{t('whatsapp.noPhone')}</p>
          )}
          {mayConfirm && (
            <Button size="sm" variant="secondary" onClick={() => { try { confirmAppointment(a.id); toast.success(t('actions.confirmed')) } catch (e) { toastError(e) } }}>
              <CheckCircle2 />{t('whatsapp.markConfirmed')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => copy(text, t('ai.copied'))}><ClipboardCopy />{t('ai.copy')}</Button>
        </div>
        <p className="text-meta text-muted-foreground">{t('whatsapp.note')}</p>
      </div>
    </SectionCard>
  )
}
