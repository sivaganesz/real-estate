/**
 * From a reading to a plan: the changes the assistant proposes, each as old → new with a tick box, and the questions it
 * still has. Applying an item calls the same store actions the buttons use, with the same checks (consent, stages, the
 * required fields). Nothing here writes until a person applies it. Text comes through i18n (`t`).
 */
import type { TFunction } from 'i18next'
import { STAGE_ORDER } from '@/data/catalogue'
import type { Lead, LeadActivity, LostReason } from '@/data/types'
import { hasFollowUpConsent } from '@/lib/consent'
import { addDays, fmtDate, inrShort } from '@/lib/format'
import { propertiesForLead } from '@/lib/matching'
import { pendingApprovals } from '@/lib/property'
import type { Store } from '@/store/db'
import { dateIn } from './parse'
import type { Context, LeadAction, NewLeadFields } from './understand'

export type ItemKind = 'log' | 'visit' | 'outcome' | 'budget' | 'follow' | 'offer' | 'lost' | 'share' | 'consent'
export type PlanItem = {
  id: string
  kind: ItemKind
  title: string
  detail?: string
  /** Old → new, when a value changes. */
  from?: string
  to?: string
  /** What else happens (a stage move, more properties fitting). */
  effect?: string
  /** Why it can't be applied (no consent…). Shown greyed out, never applied. */
  blocked?: string
  apply: (s: Store) => void
}
/** A question with quick replies: picking one adds `add` to the message and reads it again. */
export type Ask = { text: string; options: { label: string; add: string }[] }
export type Plan = { leadId?: string; items: PlanItem[]; asks: Ask[]; warnings: string[] }

const LOST_REASONS: LostReason[] = ['boughtElsewhere', 'budget', 'noInventory', 'notResponding', 'postponed', 'loan', 'other']
const forward = (l: Lead, stage: Lead['stage']) => STAGE_ORDER.indexOf(l.stage) < STAGE_ORDER.indexOf(stage)
const entry = (x: Lead, s: Store, type: LeadActivity['type'], text: string, propertyId?: string) =>
  x.activity.unshift({ id: `${x.id}-a${x.activity.length + 1}`, at: s.today, by: s.user.id, type, text, propertyId, ai: true })

export function planForLead(actions: LeadAction[], leadId: string | undefined, candidates: string[], ctx: Context, t: TFunction): Plan {
  const plan: Plan = { leadId, items: [], asks: [], warnings: [] }
  const lead = ctx.leads.find((l) => l.id === leadId)
  if (!lead) {
    // which lead? the ones named, else the most recently active
    const options = (candidates.length ? candidates.map((id) => ctx.leads.find((l) => l.id === id)!) : [...ctx.leads].sort((a, b) => (b.activity[0]?.at ?? '').localeCompare(a.activity[0]?.at ?? '')).slice(0, 4))
    plan.asks.push({ text: t('ai.ask.whichLead'), options: options.map((l) => ({ label: `${l.name} · ${l.id}`, add: l.id })) })
    return plan
  }
  const consent = hasFollowUpConsent(lead)
  const title = (id?: string) => ctx.db.properties.find((p) => p.id === id)?.title ?? id ?? ''
  const fits = propertiesForLead(lead, ctx.db.properties.filter((p) => p.status === 'available' && !p.archived), ctx.db.settings)
  const propOptions = () => [...new Set([...lead.recommendedPropertyIds, ...fits.slice(0, 3).map((m) => m.property.id)])].slice(0, 4)
    .map((id) => ({ label: `${id} · ${title(id)}`, add: id }))
  const dayOptions = () => [
    { label: t('ai.day.tomorrow', { date: fmtDate(addDays(ctx.today, 1)) }), add: 'tomorrow' },
    { label: t('ai.day.saturday', { date: fmtDate(dateIn('saturday', ctx.today)) }), add: 'saturday' },
    { label: t('ai.day.in3', { date: fmtDate(addDays(ctx.today, 3)) }), add: 'in 3 days' },
  ]
  let n = 0
  const id = () => `i${++n}`
  const followPlanned = actions.some((a) => a.kind === 'followUp')

  for (const a of actions) {
    if (a.kind === 'log') {
      plan.items.push({
        id: id(), kind: 'log', title: t(`ai.item.log.${a.type}`), detail: `“${a.text}”`,
        effect: a.responded === true && !lead.engagement.responded ? t('ai.effect.responded') : undefined,
        apply: (s) => s.updateLead(lead.id, (x) => { entry(x, s, a.type, a.text); if (a.responded) x.engagement.responded = true }),
      })
    }
    if (a.kind === 'book') {
      if (!a.propertyId) { plan.asks.push({ text: t('ai.ask.whichProperty'), options: propOptions() }); continue }
      if (!a.date) { plan.asks.push({ text: t('ai.ask.whichDay'), options: dayOptions() }); continue }
      const pid = a.propertyId, date = a.date, time = a.time
      const moves = forward(lead, 'visitScheduled')
      plan.items.push({
        id: id(), kind: 'visit', title: t('ai.item.visit'), detail: `${pid} · ${title(pid)}`, to: `${fmtDate(date)}${time ? ` · ${time}` : ''}`,
        effect: moves ? t('ai.effect.stage', { stage: t('stage.visitScheduled') }) : undefined,
        apply: (s) => s.updateLead(lead.id, (x) => {
          x.visits.push({ id: `VIS-${Date.now()}`, propertyId: pid, date, time, status: 'scheduled' })
          if (forward(x, 'visitScheduled')) { x.stage = 'visitScheduled'; x.stageSince = s.today }
          if (!x.recommendedPropertyIds.includes(pid)) x.recommendedPropertyIds.push(pid)
          entry(x, s, 'visit', t('lead.visitNote', { id: pid, date: fmtDate(date), time: time ?? '' }).trim(), pid)
        }),
      })
      const p = ctx.db.properties.find((x) => x.id === pid)
      if (p && pendingApprovals(p).length) plan.warnings.push(t('ai.warn.docPending', { id: pid, list: pendingApprovals(p).join(', '), name: lead.name }))
      // a reminder the day before the visit, when they've agreed to follow-ups and nothing else is planned
      const dayBefore = addDays(date, -1)
      if (consent && !followPlanned && dayBefore > ctx.today && lead.nextFollowUp !== dayBefore) {
        plan.items.push({
          id: id(), kind: 'follow', title: t('ai.item.followBefore'), from: lead.nextFollowUp ? fmtDate(lead.nextFollowUp) : t('ai.none'), to: fmtDate(dayBefore),
          apply: (s) => s.updateLead(lead.id, (x) => { x.nextFollowUp = dayBefore }),
        })
      }
    }
    if (a.kind === 'outcome') {
      const v = lead.visits.find((x) => x.status === 'scheduled')
      if (!v) continue
      plan.items.push({
        id: id(), kind: 'outcome', title: t(`ai.item.outcome.${a.status}`), detail: `${v.propertyId} · ${fmtDate(v.date)}`,
        to: a.status === 'completed' ? t('ai.interest', { level: t(`lead.outcome.interest.${a.interest ?? 'medium'}`) }) : undefined,
        effect: a.status === 'completed' && !lead.engagement.siteVisited ? t('ai.effect.visited') : undefined,
        apply: (s) => s.updateLead(lead.id, (x) => {
          const y = x.visits.find((z) => z.id === v.id)
          if (!y) return
          y.status = a.status
          y.feedback = a.feedback
          if (a.status === 'completed') { y.interest = a.interest ?? 'medium'; x.engagement.siteVisited = true; x.engagement.responded = true }
          entry(x, s, a.status === 'cancelled' ? 'note' : 'visit', a.status === 'completed'
            ? t('lead.outcome.noteDone', { id: v.propertyId, feedback: a.feedback, interest: t(`lead.outcome.interest.${a.interest ?? 'medium'}`) })
            : t(a.status === 'noShow' ? 'lead.outcome.noteNoShow' : 'lead.outcome.noteCancelled', { id: v.propertyId, date: fmtDate(v.date) }), v.propertyId)
        }),
      })
    }
    if (a.kind === 'budget') {
      const b = lead.budget
      const max = a.max ?? b.max, min = a.min ?? b.min
      if (max === b.max && min === b.min) continue
      const wider = { ...lead, budget: { ...b, max, min: Math.min(min, max), preferred: Math.min(b.preferred, max) } }
      const more = propertiesForLead(wider, ctx.db.properties.filter((p) => p.status === 'available' && !p.archived), ctx.db.settings).length - fits.length
      plan.items.push({
        id: id(), kind: 'budget', title: t('ai.item.budget'), from: `${inrShort(b.min)} – ${inrShort(b.max)}`, to: `${inrShort(min)} – ${inrShort(max)}`,
        effect: more > 0 ? t('ai.effect.moreFit', { count: more }) : undefined,
        apply: (s) => s.updateLead(lead.id, (x) => {
          x.budget = { ...x.budget, max, min: Math.min(min, max), preferred: Math.min(x.budget.preferred, max) }
          entry(x, s, 'note', t('ai.note.budget', { from: `${inrShort(b.min)} – ${inrShort(b.max)}`, to: `${inrShort(min)} – ${inrShort(max)}` }))
        }),
      })
    }
    if (a.kind === 'followUp') {
      plan.items.push({
        id: id(), kind: 'follow', title: t('ai.item.follow'), from: lead.nextFollowUp ? fmtDate(lead.nextFollowUp) : t('ai.none'), to: fmtDate(a.date),
        blocked: consent ? undefined : t('lead.consentFirst'),
        apply: (s) => s.updateLead(lead.id, (x) => { x.nextFollowUp = a.date }),
      })
    }
    if (a.kind === 'offer') {
      const pid = a.propertyId
      if (!pid) { plan.asks.push({ text: t('ai.ask.offerProperty'), options: propOptions() }); continue }
      const n0 = lead.negotiation?.propertyId === pid ? lead.negotiation : undefined
      const moves = forward(lead, 'negotiation')
      const offered = a.offered ?? n0?.offered, counter = a.counter ?? n0?.counter
      plan.items.push({
        id: id(), kind: 'offer', title: t('ai.item.offer'), detail: `${pid} · ${title(pid)}`,
        from: n0 ? t('ai.offerPair', { offer: n0.offered ? inrShort(n0.offered) : '—', counter: n0.counter ? inrShort(n0.counter) : '—' }) : undefined,
        to: t('ai.offerPair', { offer: offered ? inrShort(offered) : '—', counter: counter ? inrShort(counter) : '—' }),
        effect: moves ? t('ai.effect.stage', { stage: t('stage.negotiation') }) : undefined,
        apply: (s) => s.updateLead(lead.id, (x) => {
          x.negotiation = { propertyId: pid, offered, counter, notes: x.negotiation?.propertyId === pid ? x.negotiation.notes : undefined }
          if (forward(x, 'negotiation')) { x.stage = 'negotiation'; x.stageSince = s.today }
          entry(x, s, 'note', t('lead.offerForm.note', { id: pid, offer: offered ? inrShort(offered) : '—', counter: counter ? inrShort(counter) : '—' }), pid)
        }),
      })
    }
    if (a.kind === 'lost' && LOST_REASONS.includes(a.reason)) {
      plan.items.push({
        id: id(), kind: 'lost', title: t('ai.item.lost'), to: t(`lost.reason.${a.reason}`), effect: t('ai.effect.lost'),
        apply: (s) => s.updateLead(lead.id, (x) => {
          x.stage = 'lost'; x.stageSince = s.today; x.nextFollowUp = undefined
          x.lost = { reason: a.reason, at: s.today, by: s.user.id }
          entry(x, s, 'note', t('lost.note', { reason: t(`lost.reason.${a.reason}`) }))
        }),
      })
    }
    if (a.kind === 'share') {
      plan.items.push({
        id: id(), kind: 'share', title: t(`ai.item.share.${a.channel}`), detail: `${a.propertyId} · ${title(a.propertyId)}`,
        effect: forward(lead, 'recommended') ? t('ai.effect.stage', { stage: t('stage.recommended') }) : undefined,
        apply: (s) => s.shareProperty(a.propertyId, lead.id, a.channel),
      })
    }
    if (a.kind === 'consent' && !consent) {
      plan.items.push({
        id: id(), kind: 'consent', title: t('ai.item.consent'), to: t(`lead.consent.via.${a.how}`), effect: t('ai.effect.consentCheck'),
        apply: (s) => s.updateLead(lead.id, (x) => {
          x.consent = { followUp: true, at: s.today, how: a.how }
          entry(x, s, 'note', t('lead.consent.noteRecorded', { how: t(`lead.consent.via.${a.how}`) }))
        }),
      })
    }
  }
  return plan
}

/* ---------- a new lead ---------- */

export type NewLeadPlan = { fields: NewLeadFields; asks: Ask[]; checks: { ok: boolean; text: string }[]; owner: string; ready: boolean }

export function planNewLead(f: NewLeadFields, ctx: Context, t: TFunction, autoOwner: string): NewLeadPlan {
  const asks: Ask[] = []
  if (!f.purpose) asks.push({ text: t('ai.ask.purpose'), options: (['ownUse', 'investment', 'rentalIncome', 'businessUse'] as const).map((p) => ({ label: t(`purpose.buyer.${p}`), add: t(`ai.purposeWord.${p}`) })) })
  if (!f.cities.length) asks.push({ text: t('ai.ask.city'), options: ['Madurai', 'Chennai', 'Coimbatore', 'Tiruchirappalli'].map((c) => ({ label: c, add: `in ${c}` })) })
  if (!f.max) asks.push({ text: t('ai.ask.budget'), options: [] })
  if (!f.name) asks.push({ text: t('ai.ask.name'), options: [] })
  if (!f.phone) asks.push({ text: t('ai.ask.phone'), options: [] })
  const dup = f.phone ? ctx.db.leads.find((l) => l.phone.replace(/\D/g, '').endsWith(f.phone!.replace(/\D/g, '').slice(-10))) : undefined
  const fitting = f.max && f.type && f.cities.length ? propertiesForLead({
    id: '', name: '', phone: '', source: '', enquiryDate: ctx.today, ownerId: null, qualification: { need: 'partly', timeline: 'undecided', authority: 'unknown', funding: 'own', fundingReady: 'undecided' },
    engagement: { responded: false, docsRequested: false, siteVisited: false }, budget: { min: f.min ?? 0, preferred: f.max, max: f.max, flexPct: 0 },
    requirement: { type: f.type, cities: f.cities, localities: f.localities, amenities: [], approvalRequired: true, bhk: f.bhk }, stage: 'new', stageSince: ctx.today,
    recommendedPropertyIds: [], visits: [], activity: [],
  }, ctx.db.properties.filter((p) => p.status === 'available' && !p.archived), ctx.db.settings).length : undefined
  const checks = [
    ...(f.phone ? [dup ? { ok: false, text: t('ai.check.dup', { id: dup.id, name: dup.name }) } : { ok: true, text: t('ai.check.noDup') }] : []),
    f.consent ? { ok: true, text: t('ai.check.consent', { date: fmtDate(addDays(ctx.today, 1)) }) } : { ok: false, text: t('ai.check.noConsent') },
    ...(fitting !== undefined ? [fitting ? { ok: true, text: t('ai.check.fits', { count: fitting }) } : { ok: false, text: t('ai.check.noneFits') }] : []),
  ]
  return { fields: f, asks, checks, owner: autoOwner, ready: !!(f.name && f.phone && f.purpose && f.max && f.cities.length) && !dup }
}

/** The new lead itself, as the form would make it. */
export function newLeadRecord(f: NewLeadFields, id: string, ownerId: string, today: string): Lead {
  return {
    id, name: f.name!.trim(), phone: f.phone!, email: f.email, source: f.source ?? 'Walk-in', enquiryDate: today, ownerId,
    purpose: f.purpose, contactPref: f.contactPref ?? 'call',
    qualification: { need: 'partly', timeline: 'undecided', authority: 'unknown', funding: 'own', fundingReady: 'undecided' },
    engagement: { responded: true, docsRequested: false, siteVisited: false },
    budget: { min: f.min ?? 0, preferred: f.max!, max: f.max!, flexPct: 0 },
    requirement: { type: f.type ?? 'plot', cities: f.cities, localities: f.localities, sizeSqft: f.sizeSqft, amenities: [], approvalRequired: true, ...(f.bhk ? { bhk: f.bhk } : {}) },
    stage: 'new', stageSince: today, nextFollowUp: f.consent ? addDays(today, 1) : undefined,
    recommendedPropertyIds: [], visits: [], activity: [],
    consent: f.consent ? { followUp: true, at: today, how: f.contactPref === 'whatsapp' ? 'whatsapp' : 'call' } : undefined,
  }
}
