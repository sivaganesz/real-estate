/**
 * Summaries and insights from the real app data (first versions; M7 deepens them). Sentences come from the `ai`
 * namespace so they follow the UI language; numbers and names come from the store.
 */
import i18next from 'i18next'
import type { DB, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { configLabel } from '@/lib/matching'
import { fmtDateTime, inrRange, inrShort } from '@/lib/format'
import { daysSince, localDay } from '@/lib/dates'
import { leadScore } from '@/lib/scoring'
import { isStalled } from '@/lib/stalled'
import { suggestNext } from '@/lib/next-action'
import { visible } from '@/services/queries/visibility'
import { activityCounts, pipelineValueByStage, scopeUserIds, summaryKpis, targetProgress } from '@/services/queries/stats'
import type { AIText, SummaryTarget } from '../types'

const t = (key: string, opts: Record<string, unknown> = {}): string => i18next.t(key, opts)

export function summarizeSim(target: SummaryTarget, db: DB, user: User, now: Date): AIText {
  const today = localDay(now)
  if ((target.kind === 'lead' || target.kind === 'visitPrep') && target.id) {
    const lead = db.leads.find((l) => l.id === target.id)
    if (!lead) return { mode: 'simulated', text: t('ai:summary.notFound') }
    const r = lead.requirement
    const score = leadScore(lead, { properties: db.properties, settings: db.settings, now })
    const next = suggestNext(lead, { appointments: db.appointments, tasks: db.tasks, properties: db.properties, settings: db.settings, now })
    const bullets = [
      t('ai:summary.leadWants', {
        config: r.configurations.map(configLabel).join(' / ') || t('ai:summary.anyConfig'),
        places: r.localities.join(', ') || r.cities.join(', ') || t('ai:summary.anyPlace'),
        budget: r.budgetMax ? inrRange(r.budgetMin, r.budgetMax, { upTo: t('domain:lead.upTo'), from: t('domain:lead.from') }) : t('ai:summary.budgetUnknown'),
      }),
      t('ai:summary.leadStage', { stage: t(`catalogue:stage.${lead.stage}`), days: daysSince(lead.stageSince, now) }),
      t('ai:summary.leadScore', { score: score.score, temperature: t(`catalogue:temperature.${score.temperature}`) }),
    ]
    if (lead.qualification.timeline) bullets.push(t('ai:summary.leadTimeline', { timeline: t(`catalogue:timeline.${lead.qualification.timeline}`) }))
    if (next) bullets.push(t('ai:summary.leadNext', { next: t(`leads:next.${next.key}`, next.params) }))
    return { mode: 'simulated', text: t('ai:summary.leadTitle', { name: lead.name }), bullets, links: [{ kind: 'lead', id: lead.id }] }
  }
  if ((target.kind === 'appointment' || target.kind === 'visitSummary') && target.id) {
    const a = db.appointments.find((x) => x.id === target.id)
    if (!a) return { mode: 'simulated', text: t('ai:summary.notFound') }
    const lead = db.leads.find((l) => l.id === a.leadId)
    const props = a.propertyIds.map((id) => db.properties.find((p) => p.id === id)?.title).filter(Boolean)
    return {
      mode: 'simulated',
      text: t('ai:summary.appointment', { type: t(`catalogue:appointmentType.${a.type}`), name: lead?.name ?? '', when: fmtDateTime(a.start), properties: props.join(', ') || '—' }),
      bullets: a.outcome?.summary ? [a.outcome.summary] : undefined,
      links: [{ kind: 'appointment', id: a.id }, ...(lead ? [{ kind: 'lead' as const, id: lead.id }] : [])],
    }
  }
  if (target.kind === 'day') {
    const ids = user.role === 'executive' ? [user.id] : scopeUserIds(db, user)
    const appts = db.appointments.filter((a) => ids.includes(a.ownerId) && localDay(a.start) === today && a.status !== 'cancelled')
    const tasks = visible.tasks(db, user).filter((x) => x.status === 'open' && localDay(x.dueAt) <= today)
    const overdue = tasks.filter((x) => x.dueAt < now.toISOString()).length
    return {
      mode: 'simulated',
      text: t('ai:summary.day', { appointments: appts.length, tasks: tasks.length, overdue }),
      bullets: appts.slice(0, 5).map((a) => `${fmtDateTime(a.start)} · ${t(`catalogue:appointmentType.${a.type}`)} · ${db.leads.find((l) => l.id === a.leadId)?.name ?? ''}`),
      links: appts.slice(0, 5).map((a) => ({ kind: 'appointment' as const, id: a.id })),
    }
  }
  if (target.kind === 'pipeline') {
    const leads = visible.leads(db, user).filter((l) => OPEN_STAGES.includes(l.stage))
    const stalled = leads.filter((l) => isStalled(l, db.settings, now))
    const value = pipelineValueByStage(leads).reduce((n, s) => n + s.value, 0)
    return {
      mode: 'simulated',
      text: t('ai:summary.pipeline', { count: leads.length, value: inrShort(value), stalled: stalled.length }),
      bullets: stalled.slice(0, 5).map((l) => t('ai:summary.stalledLead', { name: l.name, stage: t(`catalogue:stage.${l.stage}`), days: daysSince(l.stageSince, now) })),
      links: stalled.slice(0, 5).map((l) => ({ kind: 'lead' as const, id: l.id })),
    }
  }
  return insightsSim(target.kind === 'team' ? 'team' : target.kind === 'business' ? 'business' : 'personal', db, user, now)
}

export function insightsSim(scope: 'personal' | 'team' | 'business', db: DB, user: User, now: Date): AIText {
  const k = summaryKpis(db, user, now)
  const bullets: string[] = []
  if (scope === 'personal') {
    const p = targetProgress(db, user, now)
    const done = activityCounts(db, [user.id], 'month', now)
    bullets.push(t('ai:insight.calls', { done: done.calls, target: p.calls.target, pct: p.calls.pct }))
    bullets.push(t('ai:insight.visits', { done: done.visits, target: p.siteVisits.target, pct: p.siteVisits.pct }))
    bullets.push(t('ai:insight.bookings', { done: done.bookings, target: p.bookings.target }))
  } else {
    bullets.push(t('ai:insight.pipeline', { value: inrShort(k.pipelineValue), open: k.openLeads }))
    bullets.push(t('ai:insight.conversion', { pct: k.conversionPct }))
    bullets.push(t('ai:insight.visitsToday', { count: k.visitsToday }))
    if (scope === 'business') bullets.push(t('ai:insight.inventory', { count: k.availableInventory }))
  }
  return { mode: 'simulated', text: t(`ai:insight.title.${scope}`), bullets }
}
