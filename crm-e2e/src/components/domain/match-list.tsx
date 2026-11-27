/**
 * Match list (master prompt §14, plan §7.7): ranked matches for a lead (or leads for a property) with the percentage
 * ring, the label, the one-line explanation ("Within budget · Whitefield · 3 BHK; missing: covered parking"), memory
 * ("Already shared 3 days ago") and actions: Shortlist, Share (WhatsApp), Schedule visit, Not interested.
 * `side` decides what each row shows: the property (lead → properties) or the lead (property → leads).
 */
import { useState, type ReactNode } from 'react'
import { Bookmark, CalendarPlus, Copy, Loader2, MessageCircle, Sparkles, ThumbsDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAI } from '@/ai'
import type { AIMode } from '@/ai/types'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { Segmented } from '@/components/shared/segmented'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ID } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { usePermission } from '@/hooks/use-permission'
import { phoneDisplay } from '@/lib/phone'
import { shareMessage, waLink } from '@/lib/whatsapp'
import { markNotInterested, shareProperties, shortlistProperty } from '@/services/matching'
import { AppointmentFormDialog } from './appointment-form-dialog'
import { paths } from '@/app/paths'
import { EmptyMatches } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { ProgressRing } from '@/components/shared/progress-ring'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { coverPhoto, isMatchable } from '@/lib/property'
import { firstName, inrShort } from '@/lib/format'
import { summaryLine, type Match } from '@/lib/matching'
import { matchTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { MatchExplain } from './match-explain'
import { MatchLabelBadge } from './property-pills'

export type MatchActions = {
  onShortlist?: (m: Match) => void
  onShare?: (m: Match) => void
  onSchedule?: (m: Match) => void
  onNotInterested?: (m: Match) => void
}

export function MatchList({ matches, side = 'property', actions = {}, empty, limit, className }: {
  matches: Match[]
  side?: 'property' | 'lead'
  actions?: MatchActions
  empty?: ReactNode
  limit?: number
  className?: string
}) {
  const { t } = useTranslation(['domain', 'matching'])
  const list = limit ? matches.slice(0, limit) : matches
  if (!list.length) return <>{empty ?? <EmptyState compact illustration={EmptyMatches} title={t('domain:match.emptyTitle')} body={t('domain:match.emptyBody')} />}</>
  return (
    <ul className={cn('@container flex flex-col gap-2', className)} data-testid="match-list">
      {list.map((m) => {
        const p = m.property
        const cover = coverPhoto(p)
        const memory = m.memory === 'shared' ? t('domain:match.memory.shared') : m.memory === 'visited' ? t('domain:match.memory.visited') : m.memory === 'liked' ? t('domain:match.memory.liked') : m.memory === 'shortlisted' ? t('domain:match.memory.shortlisted') : null
        return (
          <li key={`${m.lead.id}-${p.id}`} className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs @2xl:flex-row @2xl:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <HoverCard openDelay={150}>
                <HoverCardTrigger asChild>
                  <button type="button" className="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={t('domain:property.whyMatch', { pct: Math.round(m.score) })}>
                    <ProgressRing value={m.score} size={44} tone={matchTone(m.score)} />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent align="start" className="w-72"><MatchExplain match={m} /></HoverCardContent>
              </HoverCard>
              {side === 'property' ? (
                cover ? <img src={cover.url} alt="" className="size-12 shrink-0 rounded-md object-cover @max-md:hidden" /> : null
              ) : (
                <UserAvatar name={m.lead.name} size="md" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  {side === 'property'
                    ? <Link to={paths.property(p.id)} className="truncate text-sm font-semibold hover:underline">{p.title}</Link>
                    : <Link to={paths.lead(m.lead.id)} className="truncate text-sm font-semibold hover:underline">{m.lead.name}</Link>}
                  <MatchLabelBadge label={m.label} />
                  {memory && <span className="text-meta text-muted-foreground">{memory}</span>}
                </p>
                <p className="truncate text-meta text-muted-foreground">
                  {side === 'property' ? `${p.location.locality} · ${p.price ? inrShort(p.price) : t('domain:property.onRequest')} · ` : ''}
                  {summaryLine(m, t)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              {actions.onShortlist && <Button variant="ghost" size="sm" onClick={() => actions.onShortlist?.(m)}><Bookmark />{t('domain:match.shortlist')}</Button>}
              {actions.onShare && <Button variant="ghost" size="sm" className="text-success hover:bg-success-soft hover:text-success" onClick={() => actions.onShare?.(m)}><MessageCircle />{t('domain:match.share')}</Button>}
              {actions.onSchedule && <Button variant="ghost" size="sm" onClick={() => actions.onSchedule?.(m)}><CalendarPlus />{t('domain:match.schedule')}</Button>}
              {actions.onNotInterested && <Button variant="ghost" size="icon-sm" onClick={() => actions.onNotInterested?.(m)} aria-label={t('domain:match.notInterested')} title={t('domain:match.notInterested')}><ThumbsDown /></Button>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The four match actions wired to services, with permission checks, toasts and Undo (M3): Shortlist, Share on WhatsApp
 * (message preview → wa.me, logged as E11), Schedule site visit (appointment dialog prefilled), Not interested
 * (never suggested again; Undo for 6 s). Render `dialogs` once next to the list. Used by Matching, the property page
 * and any lead page that shows matches.
 */
export function useMatchActions(): { actions: Required<MatchActions>; share: (leadId: ID, propertyIds: ID[]) => void; dialogs: ReactNode } {
  const { t } = useTranslation(['matching', 'shell'])
  const { can, explain } = usePermission()
  const navigate = useNavigate()
  const leads = useDb((db) => db.leads)
  const [sharing, setSharing] = useState<{ leadId: ID; propertyIds: ID[] } | null>(null)
  const [visit, setVisit] = useState<{ leadId: ID; propertyIds: ID[]; key: number } | null>(null)

  const allowed = (leadId: ID, action: 'lead.edit' | 'appointment.manage') => {
    const lead = leads.find((l) => l.id === leadId)
    if (lead && can(action, lead)) return true
    const why = explain(action)
    toast.error(t(why.reasonKey, why.params))
    return false
  }
  const share = (leadId: ID, propertyIds: ID[]) => { if (allowed(leadId, 'lead.edit')) setSharing({ leadId, propertyIds }) }
  const actions: Required<MatchActions> = {
    onShortlist: (m) => {
      if (!allowed(m.lead.id, 'lead.edit')) return
      try {
        shortlistProperty(m.lead.id, m.property.id)
        toast.success(t('matching:actions.shortlisted', { title: m.property.title, name: m.lead.name }), {
          action: { label: t('matching:actions.viewLead'), onClick: () => navigate(paths.lead(m.lead.id)) },
        })
      } catch (e) { toastError(e) }
    },
    onShare: (m) => share(m.lead.id, [m.property.id]),
    onSchedule: (m) => { if (allowed(m.lead.id, 'appointment.manage')) setVisit({ leadId: m.lead.id, propertyIds: [m.property.id], key: Date.now() }) },
    onNotInterested: (m) => {
      if (!allowed(m.lead.id, 'lead.edit')) return
      try {
        const { undoToken } = markNotInterested(m.lead.id, m.property.id)
        toastUndo(t('matching:actions.notInterested', { title: m.property.title, name: firstName(m.lead.name) }), undoToken)
      } catch (e) { toastError(e) }
    },
  }
  const dialogs = (
    <>
      {sharing && <ShareDialog key={`${sharing.leadId}:${sharing.propertyIds.join(',')}`} open onOpenChange={(o) => { if (!o) setSharing(null) }} leadId={sharing.leadId} propertyIds={sharing.propertyIds} />}
      {visit && <AppointmentFormDialog key={visit.key} open onOpenChange={(o) => { if (!o) setVisit(null) }} leadId={visit.leadId} propertyIds={visit.propertyIds} type="siteVisit" />}
    </>
  )
  return { actions, share, dialogs }
}

/**
 * Share properties with a lead on WhatsApp: a ready message (the Settings template in English or Hinglish, or drafted by
 * the AI), editable; "Open WhatsApp" logs the share on the lead (shortlist → shared, E11) and opens wa.me with the text.
 */
export function ShareDialog({ open, onOpenChange, leadId, propertyIds }: { open: boolean; onOpenChange: (o: boolean) => void; leadId: ID; propertyIds: ID[] }) {
  const { t } = useTranslation(['matching', 'common', 'domain'])
  const { ai, context } = useAI()
  const lead = useDb((db) => db.leads.find((l) => l.id === leadId))
  const props = useDb((db) => propertyIds.map((id) => db.properties.find((p) => p.id === id)).filter((p) => !!p))
  const templates = useDb((db) => db.settings.templates)
  const agentName = useDb((db) => db.users.find((u) => u.id === lead?.ownerId)?.name)
  const agent = agentName ? firstName(agentName) : undefined
  const [tone, setTone] = useState<'english' | 'hinglish'>('english')
  const [text, setText] = useState(() => (lead ? shareMessage(lead, props, { templates, tone: 'english', agent }) : ''))
  const [aiMode, setAiMode] = useState<AIMode | null>(null)
  const [busy, setBusy] = useState(false)
  if (!lead) return null
  const link = waLink(lead.phone, text)
  const blocked = props.filter((p) => !isMatchable(p))

  const changeTone = (v: 'english' | 'hinglish') => {
    setTone(v)
    setAiMode(null)
    setText(shareMessage(lead, props, { templates, tone: v, agent }))
  }
  const draftWithAI = async () => {
    setBusy(true)
    try {
      const r = await ai.generateMessage({ leadId, purpose: 'share', channel: 'whatsapp', tone, propertyIds }, context())
      setText(r.text)
      setAiMode(r.mode)
    } catch (e) { toastError(e) } finally { setBusy(false) }
  }
  const send = () => {
    try {
      shareProperties(leadId, propertyIds, { tone, via: aiMode ? 'ai' : 'manual' })
      window.open(link, '_blank', 'noopener,noreferrer')
      toast.success(t('matching:share.sent', { name: lead.name, count: props.length }))
      onOpenChange(false)
    } catch (e) { toastError(e) }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('matching:share.copied'))
    } catch { toast.error(t('matching:share.copyFailed')) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg" data-testid="share-dialog">
        <DialogHeader>
          <DialogTitle>{t('matching:share.title')}</DialogTitle>
          <DialogDescription>{t('matching:share.subtitle', { count: props.length, name: lead.name, phone: phoneDisplay(lead.phone) })}</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1.5">
          {props.map((p) => {
            const cover = coverPhoto(p)
            return (
              <li key={p.id} className="flex items-center gap-2.5 rounded-md border bg-card p-2">
                {cover ? <img src={cover.url} alt="" className="size-10 shrink-0 rounded-md object-cover" /> : <span aria-hidden="true" className="size-10 shrink-0 rounded-md bg-primary-soft" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="block truncate text-meta text-muted-foreground">{p.location.locality} · {p.price ? inrShort(p.price) : t('domain:property.onRequest')}</span>
                </span>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented variant="pill" value={tone} onChange={changeTone} label={t('matching:share.tone')} segments={[{ value: 'english', label: t('matching:share.english') }, { value: 'hinglish', label: t('matching:share.hinglish') }]} />
          <span className="flex items-center gap-2">
            {aiMode && <DemoAIBadge mode={aiMode} />}
            <Button type="button" variant="ghost" size="sm" className="text-ai hover:bg-ai-soft hover:text-ai" onClick={() => void draftWithAI()} disabled={busy} aria-busy={busy || undefined}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{t('matching:share.writeWithAI')}
            </Button>
          </span>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('matching:share.message')}
          <Textarea value={text} onChange={(e) => { setText(e.target.value); setAiMode(null) }} rows={8} className="font-normal" data-testid="share-message" />
        </label>
        <p className="text-meta text-muted-foreground">{t('matching:share.hint')}</p>
        {!link && <p role="alert" className="text-meta text-danger">{t('matching:share.noPhone', { name: lead.name })}</p>}
        {blocked.length > 0 && <p role="alert" className="text-meta text-danger">{t('matching:share.unavailable', { titles: blocked.map((p) => p.title).join(', ') })}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="secondary" onClick={() => void copy()}><Copy />{t('matching:share.copy')}</Button>
          <Button type="button" className="bg-success text-success-foreground hover:bg-success/90" onClick={send} disabled={!link || !text.trim() || blocked.length > 0} data-testid="share-open-whatsapp">
            <MessageCircle />{t('matching:share.open')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
