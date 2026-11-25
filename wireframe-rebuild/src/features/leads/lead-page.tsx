/**
 * The lead page (design agreed 26 Nov, after Attio's record page): the person on the left — profile, readiness ring,
 * what they want, budget, owner, follow-up, visits, negotiation — and the work on the right: the stage track, the next step
 * with ✨ a suggestion, and tabs Activity (default, log in place) · Matches · Qualification · HNI (managers).
 * Same rules as the old wireframe (views-customers.js): readiness and classification are separate; HNI is a status,
 * never a score, and is shown to Admins and Sales managers only; marking a lead Lost needs a reason.
 */
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowLeft, CalendarClock, CalendarPlus, Check, ChevronRight, Handshake, Lock, Mail, MapPin, MessageCircle, MoreHorizontal, Pencil,
  Phone, RotateCcw, Share2, ShieldCheck, Sparkles, StickyNote, ThumbsUp, UserRound, Users, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Callout } from '@/components/app/callout'
import { EmptyState } from '@/components/app/empty-state'
import { Page } from '@/components/app/page-header'
import { Segmented } from '@/components/app/segmented'
import { StatusChip } from '@/components/app/status-chip'
import { type Tone, toneFill, toneSoft, toneText } from '@/components/app/tone'
import { UserAvatar } from '@/components/app/user-avatar'
import { useCrumbs } from '@/components/layout/crumbs'
import { STAGE_ORDER } from '@/data/catalogue'
import type { Classification, HniStatus, Lead, LeadActivity, LeadStage, LostReason } from '@/data/types'
import { useIsPhone } from '@/hooks/use-media-query'
import { CLASSIFICATIONS, classificationOf, isHni, suggestedClassification } from '@/lib/classification'
import { fmtDate, inr, inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { type Match, propertiesForLead } from '@/lib/matching'
import { BAND_TONE, readiness } from '@/lib/readiness'
import { cn } from '@/lib/utils'
import { useCan, useStore, useVisibleLeads, userName } from '@/store/db'
import { MATCH_TONE, PropertyPhoto } from '../properties/components/property-bits'
import { isActive } from './lead-list'
import { STAGE_TONE } from './leads-page'
import { dueOf, suggestNext } from './next-step'

const TABS = ['activity', 'matches', 'qualification', 'hni'] as const
type Tab = (typeof TABS)[number]
const LOST_REASONS: LostReason[] = ['boughtElsewhere', 'budget', 'noInventory', 'notResponding', 'postponed', 'loan', 'other']
const HNI_STATUSES: HniStatus[] = ['notDetermined', 'notVerified', 'potential', 'consentInProgress', 'verified', 'declined']
const STROKE: Record<Tone, string> = { neutral: 'stroke-neutral', primary: 'stroke-primary', success: 'stroke-success', warning: 'stroke-warning', danger: 'stroke-danger', info: 'stroke-info', violet: 'stroke-violet' }
const addDays = (iso: string, d: number) => new Date(new Date(iso + 'T00:00:00').getTime() + d * 864e5).toISOString().slice(0, 10)

export function LeadPage() {
  const { id, tab } = useParams()
  const { t } = useTranslation()
  const { db } = useStore()
  const visible = useVisibleLeads()
  const lead = db.leads.find((l) => l.id === id)
  useCrumbs([{ label: t('nav.group.specData') }, { label: t('nav.leads'), to: '/leads' }, { label: id ?? '' }])
  if (!lead || !visible.some((l) => l.id === id)) {
    return (
      <Page>
        <EmptyState icon={lead ? Lock : UserRound} title={lead ? t('lead.notYours') : t('lead.notFound')}
          action={<Button asChild variant="outline"><Link to="/leads"><ArrowLeft /> {t('lead.back')}</Link></Button>} />
      </Page>
    )
  }
  const current: Tab = (TABS as readonly string[]).includes(tab ?? '') ? (tab as Tab) : 'activity'
  return <LeadView key={lead.id} l={lead} tab={current} />
}

/* ---------- shared actions ---------- */

function useLead(l: Lead) {
  const { t } = useTranslation()
  const { db, today, user, updateLead } = useStore()
  return {
    call: () => toast(t('leads.calling', { name: l.name, phone: l.phone }), { description: t('leads.demoHint') }),
    whatsapp: () => toast(t('leads.whatsapping', { name: l.name }), { description: t('leads.demoHint') }),
    /** Follow-up done: log it and set the next one (or none). */
    done: (days: number | null) => {
      const next = days === null ? undefined : addDays(today, days)
      updateLead(l.id, (x) => { x.nextFollowUp = next; x.engagement.responded = true }, next ? t('today.doneNote', { date: fmtDate(next) }) : t('today.doneNoteNone'))
      toast.success(t('today.doneToast', { name: l.name }), { description: next ? t('today.nextOn', { date: fmtDate(next) }) : undefined })
    },
    setFollowUp: (date: string) => {
      updateLead(l.id, (x) => { x.nextFollowUp = date || undefined }, date ? t('lead.followUpSet', { date: fmtDate(date) }) : t('lead.followUpCleared'))
    },
    move: (s: LeadStage) => {
      if (s === l.stage) return
      updateLead(l.id, (x) => { x.stage = s; x.stageSince = today }, t('leads.stageNote', { stage: t(`stage.${s}`) }))
      toast.success(t('leads.stageMoved', { name: l.name, stage: t(`stage.${s}`) }))
    },
    lose: (reason: LostReason, note: string) => {
      updateLead(l.id, (x) => { x.stage = 'lost'; x.stageSince = today; x.nextFollowUp = undefined; x.lost = { reason, note: note || undefined, at: today, by: user.id } },
        t('lost.note', { reason: t(`lost.reason.${reason}`) }) + (note ? ` — ${note}` : ''))
      toast(t('lost.toast', { name: l.name }))
    },
    reopen: () => {
      updateLead(l.id, (x) => { x.stage = 'contacted'; x.stageSince = today; delete x.lost }, t('lost.reopened'))
      toast.success(t('lost.reopenedToast', { name: l.name }))
    },
    reassign: (userId: string) => {
      updateLead(l.id, (x) => { x.ownerId = userId }, t('leads.reassignNote', { name: userName(db, userId) }))
      toast.success(t('leads.reassigned', { name: l.name, to: userName(db, userId) }))
    },
    /** Book a site visit: it goes on the lead, moves an early lead to "Site visit scheduled" and becomes the next follow-up. */
    bookVisit: (propertyId: string, date: string, time: string) => {
      updateLead(l.id, (x) => {
        x.visits.push({ id: `VIS-${Date.now()}`, propertyId, date, time: time || undefined, status: 'scheduled' })
        if (STAGE_ORDER.indexOf(x.stage) < STAGE_ORDER.indexOf('visitScheduled')) { x.stage = 'visitScheduled'; x.stageSince = today }
        x.nextFollowUp = date
        if (!x.recommendedPropertyIds.includes(propertyId)) x.recommendedPropertyIds.push(propertyId)
      }, t('lead.visitNote', { id: propertyId, date: fmtDate(date), time }))
      toast.success(t('lead.visitBooked', { date: fmtDate(date) }))
    },
  }
}

/* ---------- the page ---------- */

function LeadView({ l, tab }: { l: Lead; tab: Tab }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { db } = useStore()
  const can = useCan()
  const phone = useIsPhone()
  const manager = can('lead.seeAll')
  const a = useLead(l)
  const [losing, setLosing] = useState(false)
  const [booking, setBooking] = useState<string | null>(null)
  const matches = propertiesForLead(l, db.properties.filter((p) => p.status === 'available' && !p.archived), db.settings)

  return (
    <Page wide className={cn(phone && 'pb-24')}>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground"><Link to="/leads"><ArrowLeft /> {t('lead.back')}</Link></Button>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Profile l={l} onLose={() => setLosing(true)} onBook={() => setBooking(matches[0]?.property.id ?? '')} />

        <div className="flex min-w-0 flex-col gap-4">
          {l.stage === 'lost' ? (
            <Callout tone="danger" title={t('lost.banner', { reason: l.lost ? t(`lost.reason.${l.lost.reason}`) : '—' })}
              action={<Button size="sm" variant="outline" onClick={a.reopen}><RotateCcw /> {t('lost.reopen')}</Button>}>
              {l.lost?.note}{l.lost && <span className="mt-0.5 block text-meta">{fmtDate(l.lost.at)} · {userName(db, l.lost.by)}</span>}
            </Callout>
          ) : <StageTrack l={l} onMove={a.move} onLose={() => setLosing(true)} />}
          {isActive(l) && <NextStep l={l} onBook={(pid) => setBooking(pid)} />}

          <section className="rounded-2xl border bg-card shadow-card">
            <div className="border-b px-4 pt-2 sm:px-5">
              <Segmented label={t('lead.sections')} value={tab} onChange={(v) => navigate(`/leads/${l.id}${v === 'activity' ? '' : '/' + v}`, { replace: true })}
                segments={[
                  { value: 'activity', label: t('lead.tab.activity'), count: l.activity.length },
                  { value: 'matches', label: t('lead.tab.matches'), count: matches.length },
                  { value: 'qualification', label: t('lead.tab.qualification') },
                  { value: 'hni', label: <span className="flex items-center gap-1">{t('lead.tab.hni')}{!manager && <Lock className="size-3" />}</span> },
                ]} />
            </div>
            <div className="p-4 sm:p-5">
              {tab === 'activity' && <ActivityTab l={l} />}
              {tab === 'matches' && <MatchesTab l={l} matches={matches} onBook={(pid) => setBooking(pid)} />}
              {tab === 'qualification' && <QualificationTab l={l} />}
              {tab === 'hni' && (manager ? <HniTab l={l} /> : <EmptyState icon={Lock} title={t('hniTab.restricted')}>{t('hniTab.restrictedHint')}</EmptyState>)}
            </div>
          </section>
        </div>
      </div>

      {/* phone: the everyday actions stay within thumb reach */}
      {phone && isActive(l) && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t bg-card/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
          <Button variant="outline" className="flex-1" onClick={a.call}><Phone /> {t('leads.call')}</Button>
          <Button variant="outline" className="flex-1" onClick={a.whatsapp}><MessageCircle /> {t('leads.whatsappShort')}</Button>
          <DoneButton onDone={a.done} className="flex-1" />
        </div>
      )}

      <LostDialog open={losing} name={l.name} onOpenChange={setLosing} onConfirm={(r, n) => { a.lose(r, n); setLosing(false) }} />
      <BookVisitDialog l={l} propertyId={booking} matches={matches} onOpenChange={(o) => { if (!o) setBooking(null) }}
        onConfirm={(pid, d, tm) => { a.bookVisit(pid, d, tm); setBooking(null) }} />
    </Page>
  )
}

/* ---------- left: the profile ---------- */

function Ring({ score, tone, size = 72 }: { score: number; tone: Tone; size?: number }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className={STROKE[tone]} />
      </svg>
      <span className="text-xl font-semibold tabular-nums">{score}</span>
    </span>
  )
}

function Profile({ l, onLose, onBook }: { l: Lead; onLose: () => void; onBook: () => void }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { db } = useStore()
  const can = useCan()
  const manager = can('lead.seeAll')
  const a = useLead(l)
  const ready = readiness(l, db)
  const cls = classificationOf(l, db)
  const hniHidden = isHni(cls) && !manager
  const [why, setWhy] = useState(false)
  const r = l.requirement
  const b = l.budget
  const ceiling = Math.round(b.max * (1 + (b.flexPct || 0) / 100))
  const wantsList = [L.type(r.type), r.bhk, r.bedrooms && t('lead.bedrooms', { n: r.bedrooms }), r.sizeSqft && `${num(r.sizeSqft)} sq.ft.`, r.commCategory].filter(Boolean).join(' · ')
  const place = [...r.localities, ...(r.localities.length ? [] : r.cities)].join(', ') + (r.localities.length ? ` · ${r.cities.join(', ')}` : '')
  const extras = [...r.amenities.map((x) => t(`amenity.${x}`, { defaultValue: x })), r.possession && r.possession !== 'any' && t(`lead.possession.${r.possession}`), r.parking === 'required' && t('lead.parkingNeeded'), r.facing && L.facing(r.facing)].filter(Boolean) as string[]
  const consentOk = l.consent?.followUp && !l.consent.withdrawnAt
  const section = (label: string, icon: LucideIcon, children: ReactNode, action?: ReactNode) => {
    const Icon = icon
    return (
      <div className="border-t px-5 py-3.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Icon className="size-3.5" /> <span className="flex-1">{label}</span>{action}
        </div>
        {children}
      </div>
    )
  }
  return (
    <aside className="overflow-hidden rounded-2xl border bg-card shadow-card lg:sticky lg:top-[calc(3rem+1px+1.25rem)]">
      <div className="flex items-start gap-3 px-5 pt-5">
        <UserAvatar name={l.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-tight font-semibold">{l.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {l.purpose ? t(`purpose.buyer.${l.purpose}`) : '—'} · {hniHidden ? <span title={t('leads.restrictedHint')}>🔒 {t('leads.restricted')}</span> : t(`class.${cls}`)}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{l.id} · {l.source} · {fmtDate(l.enquiryDate)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 px-5 pt-3 text-sm">
        <p className="flex items-center gap-2"><Phone className="size-3.5 text-muted-foreground" /> {l.phone} <span className="text-muted-foreground">· {t('lead.prefers', { how: t(`lead.pref.${l.contactPref ?? 'call'}`) })}</span></p>
        {l.email && <p className="flex items-center gap-2"><Mail className="size-3.5 text-muted-foreground" /> <span className="truncate">{l.email}</span></p>}
        <p className={cn('flex items-center gap-2', consentOk ? 'text-success' : 'text-danger')} title={l.consent ? t('lead.consentHint', { date: fmtDate(l.consent.at), how: l.consent.how }) : undefined}>
          <ShieldCheck className="size-3.5" /> {consentOk ? t('lead.consentOk') : t('lead.consentNo')}
        </p>
      </div>
      <div className="flex gap-2 px-5 py-4">
        <Button size="sm" variant="outline" className="flex-1" onClick={a.call}><Phone /> {t('leads.call')}</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={a.whatsapp}><MessageCircle /> {t('leads.whatsappShort')}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon-sm" variant="outline" className="size-8" aria-label={t('props.more')}><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => toast(t('property.comingNext', { what: t('lead.editModule') }))}><Pencil /> {t('lead.edit')}</DropdownMenuItem>
            {isActive(l) && <DropdownMenuItem onClick={onBook}><CalendarPlus /> {t('lead.bookVisit')}</DropdownMenuItem>}
            {manager && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Users /> {t('leads.reassign')}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {db.users.filter((u) => u.role === 'executive').map((u) => <DropdownMenuItem key={u.id} disabled={u.id === l.ownerId} onClick={() => a.reassign(u.id)}>{u.name}</DropdownMenuItem>)}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {isActive(l) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onLose}><X /> {t('lost.mark')}</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* how ready they are, with why */}
      <div className="border-t px-5 py-4">
        <div className="flex items-center gap-4">
          <Ring score={ready.total} tone={BAND_TONE[ready.band]} />
          <div className="min-w-0">
            <p className={cn('font-semibold', toneText[BAND_TONE[ready.band]])}>{t(`readiness.${ready.band}`)}</p>
            <p className="text-sm text-muted-foreground first-letter:uppercase">{t('props.match.readyToBuy')}</p>
            <button type="button" onClick={() => setWhy(!why)} aria-expanded={why} className="mt-0.5 flex items-center gap-0.5 text-sm font-medium text-primary hover:underline">
              {t('lead.why', { score: ready.total })} <ChevronRight className={cn('size-3.5 transition-transform', why && 'rotate-90')} />
            </button>
          </div>
        </div>
        {why && (
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {ready.rows.map((row) => (
              <li key={row.key} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate" title={t(`qual.answer.${row.key}.${row.answer}`, { defaultValue: '' })}>{t(`qual.row.${row.key}`)}</span>
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted"><span className={cn('block h-full rounded-full', toneFill[BAND_TONE[ready.band]])} style={{ width: `${(row.points / row.max) * 100}%` }} /></span>
                <span className="w-11 text-right tabular-nums text-muted-foreground"><b className="text-foreground">{row.points}</b>/{row.max}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {section(t('today.wants'), MapPin, (
        <div className="text-sm">
          <p className="font-medium">{wantsList}</p>
          <p className="text-muted-foreground">{place}</p>
          {extras.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{extras.map((x) => <span key={x} className="rounded-full bg-muted px-2 py-0.5 text-xs">{x}</span>)}</p>}
        </div>
      ))}
      {section(t('lead.budget'), Wallet, (
        <div className="text-sm">
          <p className="font-medium">{inrShort(b.min)} – {inrShort(b.max)} <span className="font-normal text-muted-foreground">· {t('lead.preferred', { amount: inrShort(b.preferred) })}</span></p>
          {b.flexPct > 0 && <p className="text-muted-foreground">{t('lead.flex', { pct: b.flexPct, ceiling: inr(ceiling) })}</p>}
          <p className="text-muted-foreground">{t(`qual.answer.fundingType.${l.qualification.funding}`)} · {t(`qual.answer.funding.${l.qualification.fundingReady}`)}</p>
        </div>
      ))}
      {section(t('leads.col.owner'), UserRound, manager ? (
        <Select value={l.ownerId ?? ''} onValueChange={a.reassign}>
          <SelectTrigger size="sm" className="w-full" aria-label={t('leads.col.owner')}><SelectValue placeholder={t('leads.unassigned')} /></SelectTrigger>
          <SelectContent>{db.users.filter((u) => u.role === 'executive').map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
        </Select>
      ) : <p className="text-sm">{userName(db, l.ownerId) || t('leads.unassigned')}</p>)}
      {isActive(l) && section(t('leads.col.followUp'), CalendarClock, (
        <Input type="date" value={l.nextFollowUp ?? ''} onChange={(e) => a.setFollowUp(e.target.value)} disabled={!consentOk} aria-label={t('leads.col.followUp')}
          title={consentOk ? undefined : t('lead.consentFirst')} className="h-8" />
      ))}
      {section(t('lead.visits'), CalendarPlus, l.visits.length ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {[...l.visits].sort((x, y) => y.date.localeCompare(x.date)).map((v) => (
            <li key={v.id} className="flex items-start gap-2">
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', v.status === 'scheduled' ? 'bg-info' : v.status === 'completed' ? 'bg-success' : 'bg-muted-foreground')} />
              <span className="min-w-0 flex-1">
                <Link to={`/properties/${v.propertyId}`} className="font-medium text-primary hover:underline">{v.propertyId}</Link> · {fmtDate(v.date)}{v.time ? ` ${v.time}` : ''}
                <span className="block text-xs text-muted-foreground">{t(`lead.visitStatus.${v.status}`)}{v.feedback ? ` — ${v.feedback}` : ''}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">{t('lead.noVisits')}</p>,
      isActive(l) && <button type="button" onClick={onBook} className="text-xs font-medium normal-case tracking-normal text-primary hover:underline">＋ {t('lead.bookVisit')}</button>)}
      {l.negotiation && section(t('lead.negotiation'), Handshake, (
        <div className="text-sm">
          <p><Link to={`/properties/${l.negotiation.propertyId}`} className="font-medium text-primary hover:underline">{l.negotiation.propertyId}</Link></p>
          <p className="text-muted-foreground">{t('lead.offer', { offer: l.negotiation.offered ? inrShort(l.negotiation.offered) : '—', counter: l.negotiation.counter ? inrShort(l.negotiation.counter) : '—' })}</p>
          {l.negotiation.notes && <p className="mt-0.5 text-xs text-muted-foreground">{l.negotiation.notes}</p>}
        </div>
      ))}
    </aside>
  )
}

/* ---------- right: stage track and next step ---------- */

function StageTrack({ l, onMove, onLose }: { l: Lead; onMove: (s: LeadStage) => void; onLose: () => void }) {
  const { t } = useTranslation()
  const at = STAGE_ORDER.indexOf(l.stage)
  return (
    <nav aria-label={t('lead.stages')} className="flex items-center gap-1 overflow-x-auto rounded-2xl border bg-card p-1.5 shadow-card [scrollbar-width:none] sm:flex-wrap">
      {STAGE_ORDER.map((s, i) => {
        const done = i < at, now = i === at
        return (
          <button key={s} type="button" onClick={() => onMove(s)} aria-current={now ? 'step' : undefined} title={now ? t('lead.stageSince') : t('lead.moveTo', { stage: t(`stage.${s}`) })}
            className={cn('flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-center text-sm whitespace-nowrap transition-colors',
              now ? cn(toneSoft[STAGE_TONE[s]], 'font-semibold') : done ? 'text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted')}>
            {done ? <Check className="size-3.5 shrink-0 text-success" /> : <span className={cn('size-2 shrink-0 rounded-full', now ? toneFill[STAGE_TONE[s]] : 'border border-muted-foreground/40')} />}
            {t(`stage.${s}`)}
          </button>
        )
      })}
      <button type="button" onClick={onLose} className="flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-2 text-sm whitespace-nowrap text-muted-foreground hover:bg-danger-soft hover:text-danger" title={t('lost.mark')}>
        <X className="size-3.5 shrink-0" /> {t('stage.lost')}
      </button>
    </nav>
  )
}

function NextStep({ l, onBook }: { l: Lead; onBook: (propertyId: string) => void }) {
  const { t } = useTranslation()
  const { db, today } = useStore()
  const a = useLead(l)
  const due = dueOf(l, today)
  const s = suggestNext(l, db, today)
  const tone: Tone = due.kind === 'overdue' ? 'danger' : due.kind === 'today' ? 'warning' : due.kind === 'none' ? 'neutral' : 'info'
  const values = s?.values ? { ...s.values, ...(s.values.date ? { date: fmtDate(String(s.values.date)) } : {}) } : {}
  return (
    <section className={cn('rounded-2xl border bg-card p-4 shadow-card sm:p-5', due.kind === 'overdue' && 'border-danger/30')}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', toneSoft[tone])}><CalendarClock className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('lead.nextStep')}</p>
          <p className={cn('font-semibold', due.kind === 'overdue' && 'text-danger', due.kind === 'today' && 'text-warning')}>
            {due.kind === 'none' ? t('lead.noFollowUp') : due.kind === 'overdue' ? t('today.overdueSince', { date: fmtDate(due.date), days: due.days })
              : due.kind === 'today' ? t('today.dueToday') : t('lead.followUpIn', { date: fmtDate(due.date), count: due.days })}
          </p>
          {s && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-violet-soft/60 px-2.5 py-1.5 text-sm">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet" />
              <span>{t(s.key, values)}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {s?.key === 'next.bookVisit' && s.propertyId && <Button size="sm" variant="outline" onClick={() => onBook(s.propertyId!)}><CalendarPlus /> {t('lead.bookVisit')}</Button>}
          <Popover>
            <PopoverTrigger asChild><Button size="sm" variant="outline"><CalendarClock /> {t('lead.reschedule')}</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-60 rounded-xl p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('lead.newDate')}</p>
              <Input type="date" defaultValue={l.nextFollowUp} min={today} onChange={(e) => e.target.value && a.setFollowUp(e.target.value)} />
            </PopoverContent>
          </Popover>
          <DoneButton onDone={a.done} />
        </div>
      </div>
    </section>
  )
}

/** ✓ Done — and when is the next follow-up? */
function DoneButton({ onDone, className }: { onDone: (days: number | null) => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger asChild><Button size="sm" className={className}><Check /> {t('today.done')}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-xl p-2">
        <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">{t('today.nextWhen')}</p>
        {([[1, 'tomorrow'], [3, 'in3'], [7, 'nextWeek'], [null, 'none']] as const).map(([d, k]) => (
          <button key={k} type="button" onClick={() => onDone(d)} className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">{t(`today.when.${k}`)}</button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/* ---------- Activity: log in place, then the timeline ---------- */

const ACT_ICON: Record<LeadActivity['type'], LucideIcon> = {
  call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, visit: MapPin, note: StickyNote, shared: Share2, recommended: ThumbsUp,
}
const ACT_TONE: Record<LeadActivity['type'], Tone> = {
  call: 'primary', whatsapp: 'success', email: 'info', meeting: 'violet', visit: 'warning', note: 'neutral', shared: 'info', recommended: 'violet',
}
const LOGGABLE: LeadActivity['type'][] = ['call', 'whatsapp', 'visit', 'note']

function ActivityTab({ l }: { l: Lead }) {
  const { t, i18n } = useTranslation()
  const { db, today, user, updateLead } = useStore()
  const [type, setType] = useState<LeadActivity['type']>('call')
  const [text, setText] = useState('')
  const [next, setNext] = useState('')
  const log = () => {
    if (!text.trim()) return
    updateLead(l.id, (x) => {
      x.activity.unshift({ id: `${x.id}-a${x.activity.length + 1}`, at: today, by: user.id, type, text: text.trim() })
      x.engagement.responded = true
      if (next) x.nextFollowUp = next
    })
    toast.success(t('lead.logged'), { description: next ? t('today.nextOn', { date: fmtDate(next) }) : undefined })
    setText('')
    setNext('')
  }
  const entryText = (x: LeadActivity) => {
    if (x.type === 'shared') return <>{t('lead.act.shared', { channel: t(`props.hist.channel.${x.text}`, { defaultValue: x.text }) })} <PropLink id={x.propertyId} /></>
    if (x.type === 'recommended') return <>{t(x.text === 'off' ? 'lead.act.unrecommended' : 'lead.act.recommended')} <PropLink id={x.propertyId} /></>
    return x.text
  }
  // newest first, with a date heading above each day
  const items = [...l.activity].sort((p, q) => q.at.localeCompare(p.at))
  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={(e) => { e.preventDefault(); log() }} className="rounded-xl border bg-background p-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
        <div className="mb-2 flex flex-wrap gap-1">
          {LOGGABLE.map((k) => {
            const Icon = ACT_ICON[k]
            return (
              <button key={k} type="button" onClick={() => setType(k)} aria-pressed={type === k}
                className={cn('inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-sm', type === k ? cn(toneSoft[ACT_TONE[k]], 'font-medium') : 'text-muted-foreground hover:bg-muted')}>
                <Icon className="size-3.5" /> {t(`lead.act.type.${k}`)}
              </button>
            )
          })}
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t(`lead.act.placeholder.${type}`)} aria-label={t('lead.act.what')}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); log() } }}
          className="min-h-16 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-3.5" /> {t('lead.act.next')}
            <Input type="date" value={next} min={today} onChange={(e) => setNext(e.target.value)} className="h-7 w-36 text-sm" />
          </label>
          <span className="flex-1" />
          <Button type="submit" size="sm" disabled={!text.trim()}>{t('lead.act.log')}</Button>
        </div>
      </form>

      {items.length ? (
        <ol className="relative flex flex-col">
          <span aria-hidden className="absolute top-2 bottom-2 left-[0.9375rem] w-px bg-border" />
          {items.map((x, i) => {
            const Icon = ACT_ICON[x.type]
            const day = i === 0 || items[i - 1].at !== x.at
            return (
              <li key={x.id} className={cn('relative flex gap-3', day && i > 0 && 'mt-3')}>
                <span className={cn('relative z-[1] grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-card', toneSoft[ACT_TONE[x.type]])}><Icon className="size-3.5" /></span>
                <div className="min-w-0 flex-1 pb-3">
                  <p className="text-xs text-muted-foreground">
                    {day && <b className="mr-1 font-semibold text-foreground">{fmtDate(x.at, i18n.language)}</b>}
                    {t(`lead.act.type.${x.type}`)} · {userName(db, x.by) || t('history.you')}
                  </p>
                  <p className="text-sm">{entryText(x)}</p>
                </div>
              </li>
            )
          })}
          <li className="relative flex gap-3">
            <span className="relative z-[1] grid size-8 shrink-0 place-items-center rounded-full bg-violet-soft text-violet ring-4 ring-card"><Sparkles className="size-3.5" /></span>
            <p className="pt-1.5 text-sm text-muted-foreground"><b className="font-semibold text-foreground">{fmtDate(l.enquiryDate)}</b> · {t('lead.act.enquiry', { source: l.source })}</p>
          </li>
        </ol>
      ) : <p className="text-sm text-muted-foreground">{t('lead.act.none')}</p>}
    </div>
  )
}

function PropLink({ id }: { id?: string }) {
  const { db } = useStore()
  if (!id) return null
  const p = db.properties.find((x) => x.id === id)
  return <Link to={`/properties/${id}`} className="font-medium text-primary hover:underline">{p ? p.title : id}</Link>
}

/* ---------- Matches ---------- */

function MatchesTab({ l, matches, onBook }: { l: Lead; matches: Match[]; onBook: (propertyId: string) => void }) {
  const { t } = useTranslation()
  const L = useLabels()
  const { recommendProperty } = useStore()
  const [open, setOpen] = useState<string | null>(null)
  if (!matches.length) return <EmptyState title={t('lead.noMatches')}>{t('lead.noMatchesHint')}</EmptyState>
  return (
    <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {matches.slice(0, 9).map((m) => {
        const p = m.property
        const rec = l.recommendedPropertyIds.includes(p.id)
        return (
          <li key={p.id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
            <Link to={`/properties/${p.id}`} className="relative block h-32 overflow-hidden bg-muted">
              <PropertyPhoto type={p.type} media={p.media.find((x) => x.isCover) ?? p.media[0]} alt={p.title} className="size-full" />
              <span className="absolute top-2 right-2 rounded-full bg-card/95 px-2 py-0.5 text-sm font-semibold shadow-sm">
                <span className={toneText[MATCH_TONE[m.label]]}>{m.score}</span> <span className="text-xs font-normal text-muted-foreground">{t(`match.${m.label}`)}</span>
              </span>
            </Link>
            <div className="flex flex-1 flex-col gap-1 p-3 text-sm">
              <Link to={`/properties/${p.id}`} className="truncate font-semibold hover:underline">{p.title}</Link>
              <p className="truncate text-muted-foreground">{inrShort(p.price)} · {L.type(p.type)} · {p.location.locality}</p>
              <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} className="self-start text-xs font-medium text-primary hover:underline">
                {open === p.id ? t('props.match.hideWhy') : t('props.match.why', { score: m.score })}
              </button>
              {open === p.id && (
                <ul className="flex flex-wrap gap-1">
                  {m.reasons.filter((r) => r.ok !== null).map((r, i) => (
                    <li key={i}><StatusChip tone={r.ok ? 'success' : 'danger'} icon={r.ok ? <Check /> : <X />} className="h-auto py-0.5 whitespace-normal">{t(`reason.${r.key}`, { ...r.values })}</StatusChip></li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-1.5 border-t p-2.5">
              <Button size="sm" variant={rec ? 'secondary' : 'outline'} className="flex-1" onClick={() => { recommendProperty(p.id, l.id, !rec); toast.success(t(rec ? 'props.match.unrecommended' : 'props.match.recommended', { name: l.name })) }}>
                <Check /> {rec ? t('props.match.isRecommended') : t('props.match.recommend')}
              </Button>
              <Button size="icon-sm" variant="outline" className="size-8" asChild title={t('lead.shareBrochure')}><Link to={`/properties/${p.id}/share?lead=${l.id}`}><Share2 /></Link></Button>
              <Button size="icon-sm" variant="outline" className="size-8" title={t('lead.bookVisit')} onClick={() => onBook(p.id)}><CalendarPlus /></Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- Qualification: the questions, one tap each; the 100-point table updates as you answer ---------- */

const QUESTIONS = [
  { key: 'need', field: 'need', options: ['clear', 'partly', 'exploring'] },
  { key: 'timeline', field: 'timeline', options: ['m1', 'm1to3', 'm3to6', 'm6to12', 'undecided'] },
  { key: 'authority', field: 'authority', options: ['sole', 'joint', 'needsApproval', 'unknown'] },
  { key: 'fundingType', field: 'funding', options: ['own', 'loan', 'combination'] },
  { key: 'funding', field: 'fundingReady', options: ['ready', 'arranging', 'undecided'] },
] as const

function QualificationTab({ l }: { l: Lead }) {
  const { t } = useTranslation()
  const { db, updateLead } = useStore()
  const ready = readiness(l, db)
  const set = (field: keyof Lead['qualification'], value: string) => updateLead(l.id, (x) => { (x.qualification as Record<string, string>)[field] = value })
  const setEng = (field: keyof Lead['engagement'], value: boolean) => updateLead(l.id, (x) => { x.engagement[field] = value })
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex flex-col gap-5">
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <p className="font-medium">{t(`qual.q.${q.key}`)}</p>
            <p className="mb-2 text-sm text-muted-foreground italic">“{t(`qual.say.${q.key}`)}”</p>
            <div className="flex flex-wrap gap-1.5">
              {q.options.map((o) => {
                const on = l.qualification[q.field] === o
                return (
                  <button key={o} type="button" onClick={() => set(q.field, o)} aria-pressed={on}
                    className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-primary bg-accent font-medium text-primary' : 'hover:bg-muted')}>
                    {t(`qual.answer.${q.key}.${o}`)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div>
          <p className="font-medium">{t('qual.q.engagement')}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {(['responded', 'docsRequested', 'siteVisited'] as const).map((k) => (
              <label key={k} className="flex items-center gap-2"><Checkbox checked={l.engagement[k]} onCheckedChange={(v) => setEng(k, !!v)} /> {t(`qual.eng.${k}`)}</label>
            ))}
          </div>
        </div>
      </div>

      <div className="self-start rounded-xl border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">{t('qual.score')}</p>
          <StatusChip tone={BAND_TONE[ready.band]}>{ready.total}/100</StatusChip>
        </div>
        <ul className="divide-y text-sm">
          {ready.rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1">{t(`qual.row.${r.key}`)}</span>
              <span className="tabular-nums text-muted-foreground"><b className="text-foreground">{r.points}</b> / {r.max}</span>
            </li>
          ))}
        </ul>
        <div className="border-t px-4 py-3">
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full', toneFill[BAND_TONE[ready.band]])} style={{ width: `${ready.total}%` }} /></div>
          <p className="flex flex-wrap gap-1">
            {(['high', 'qualified', 'developing', 'early'] as const).map((b) => <StatusChip key={b} tone={BAND_TONE[b]} variant={ready.band === b ? 'soft' : 'outline'}>{t(`qual.band.${b}`)}</StatusChip>)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{t('qual.fair')}</p>
        </div>
      </div>
    </div>
  )
}

/* ---------- HNI (managers): a status, never a score ---------- */

function HniTab({ l }: { l: Lead }) {
  const { t } = useTranslation()
  const { db, updateLead } = useStore()
  const suggested = suggestedClassification({ ...l, classification: undefined }, db)
  const hni = l.hni ?? { status: 'notDetermined' as HniStatus, potential: false }
  const setHni = (patch: Partial<NonNullable<Lead['hni']>>, note: string) => updateLead(l.id, (x) => { x.hni = { ...hni, ...patch } }, note)
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Callout tone="info" title={t('hniTab.ruleTitle')}>{t('hniTab.rule')}</Callout>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium">{t('hniTab.status')}</p>
          <Select value={hni.status} onValueChange={(v) => setHni({ status: v as HniStatus, potential: v === 'potential' || hni.potential }, t('hniTab.statusNote', { status: t(`hniTab.st.${v}`) }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{HNI_STATUSES.map((s) => <SelectItem key={s} value={s} disabled={s === 'verified' && hni.status !== 'consentInProgress' && hni.status !== 'verified'}>{t(`hniTab.st.${s}`)}</SelectItem>)}</SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{t('hniTab.verifiedNeedsConsent')}</p>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">{t('hniTab.cls')}</p>
          <Select value={l.classification ?? 'auto'} onValueChange={(v) => updateLead(l.id, (x) => { x.classification = v === 'auto' ? undefined : (v as Classification) }, t('hniTab.clsNote', { cls: v === 'auto' ? t('hniTab.auto', { cls: t(`class.${suggested}`) }) : t(`class.${v}`) }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('hniTab.auto', { cls: t(`class.${suggested}`) })}</SelectItem>
              {CLASSIFICATIONS.map((c) => <SelectItem key={c} value={c} disabled={c === 'verifiedHni' && hni.status !== 'verified'}>{t(`class.${c}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">{t('hniTab.clsHint')}</p>
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-xl border p-3">
        <Switch checked={hni.potential} onCheckedChange={(v) => setHni({ potential: v }, t(v ? 'hniTab.potentialOn' : 'hniTab.potentialOff'))} className="mt-0.5" />
        <span className="text-sm"><b className="font-medium">{t('hniTab.potential')}</b><span className="block text-muted-foreground">{t('hniTab.potentialHint')}</span></span>
      </label>
    </div>
  )
}

/* ---------- dialogs ---------- */

function LostDialog({ open, name, onOpenChange, onConfirm }: { open: boolean; name: string; onOpenChange: (o: boolean) => void; onConfirm: (r: LostReason, note: string) => void }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState<LostReason | null>(null)
  const [note, setNote] = useState('')
  const close = (o: boolean) => { if (!o) { setReason(null); setNote('') } onOpenChange(o) }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('lost.title', { name })}</DialogTitle><DialogDescription>{t('lost.why')}</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {LOST_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={reason === r}
              className={cn('rounded-full border px-3 py-1 text-sm', reason === r ? 'border-danger bg-danger-soft font-medium text-danger' : 'hover:bg-muted')}>{t(`lost.reason.${r}`)}</button>
          ))}
        </div>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('lost.notePh')} aria-label={t('lost.notePh')} />
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>{t('action.cancel')}</Button>
          <Button variant="destructive" disabled={!reason || (reason === 'other' && !note.trim())} onClick={() => reason && onConfirm(reason, note.trim())}>{t('lost.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BookVisitDialog({ l, propertyId, matches, onOpenChange, onConfirm }: {
  l: Lead; propertyId: string | null; matches: Match[]; onOpenChange: (o: boolean) => void; onConfirm: (pid: string, date: string, time: string) => void
}) {
  const { t } = useTranslation()
  const { db, today } = useStore()
  const options = [...new Set([...(propertyId ? [propertyId] : []), ...l.recommendedPropertyIds, ...matches.map((m) => m.property.id)])]
    .map((id) => db.properties.find((p) => p.id === id)).filter((p) => p && p.status === 'available' && !p.archived)
  const [pid, setPid] = useState(propertyId ?? '')
  const [date, setDate] = useState(addDays(today, 1))
  const [time, setTime] = useState('11:00')
  const [seen, setSeen] = useState(propertyId)
  if (propertyId !== seen) { setSeen(propertyId); setPid(propertyId ?? '') }
  return (
    <Dialog open={propertyId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('lead.bookVisitTitle', { name: l.name })}</DialogTitle><DialogDescription>{t('lead.bookVisitHint')}</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-3">
          <Select value={pid} onValueChange={setPid}>
            <SelectTrigger className="w-full" aria-label={t('lead.property')}><SelectValue placeholder={t('lead.property')} /></SelectTrigger>
            <SelectContent>{options.map((p) => <SelectItem key={p!.id} value={p!.id}>{p!.id} · {p!.title}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label={t('lead.date')} />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t('lead.time')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('action.cancel')}</Button>
          <Button disabled={!pid || !date} onClick={() => onConfirm(pid, date, time)}><CalendarPlus /> {t('lead.bookVisit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
