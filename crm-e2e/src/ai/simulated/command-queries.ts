/**
 * Questions to the global assistant (master prompt §12.5 and the ROLE_RESEARCH §5 prompt chips): answers built from the
 * real data the user may see, with links to the records, small graphics (stats) and next-question chips.
 * Read-only; pure over ctx.db().
 */
import type { Lead, LeadSource, LostReason, Property } from '@/domain/types'
import { LOST_REASONS, OPEN_STAGES } from '@/domain/catalogue'
import { can } from '@/lib/permissions'
import { configLabel, leadsForProperty, propertiesForLead } from '@/lib/matching'
import { fmtTime, inrRange, inrShort } from '@/lib/format'
import { daysSince, localDay } from '@/lib/dates'
import { applyPropertyFilters, hasPropertyFilters, parsePropertyQuery } from '@/lib/search'
import { leadScore } from '@/lib/scoring'
import { daysInStage, isStalled } from '@/lib/stalled'
import { suggestNext } from '@/lib/next-action'
import { findDuplicates } from '@/lib/duplicates'
import { visible } from '@/services/queries/visibility'
import { priorityItems } from '@/services/queries/today'
import {
  activityCounts, conversionRate, leadsBySource, periodStart, pipelineValueByStage, scopeUserIds, summaryKpis, targetProgress, teamBoard,
} from '@/services/queries/stats'
import type { AIStat, CommandPlan } from '../types'
import { first, leadFor, propertyIn, refuse, say, t, type Env } from './command-kit'
import { daysIn, lostReasonIn, periodIn } from './intents'
import { amountsIn } from './parse'
import { summarizeSim } from './summarize'

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const scoreOf = (env: Env) => (l: Lead) => leadScore(l, { properties: env.db.properties, settings: env.db.settings, now: env.now })

/* ---------- my work ---------- */

export function todayTasksPlan(env: Env): CommandPlan {
  const mineOnly = env.user.role === 'executive' || /\bmy\b/.test(env.s)
  const tasks = visible.tasks(env.db, env.user)
    .filter((x) => x.status === 'open' && localDay(x.dueAt) <= env.today && (!mineOnly || x.ownerId === env.user.id))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const overdue = tasks.filter((x) => x.dueAt < env.now.toISOString()).length
  return {
    mode: 'simulated', intent: 'todayTasks', proposals: [], results: { kind: 'task', ids: tasks.map((x) => x.id) },
    reply: { mode: 'simulated', text: tasks.length ? t('ai:reply.todayTasks', { count: tasks.length, overdue }) : t('ai:reply.noTasks') },
    statsStyle: 'tiles',
    stats: tasks.length ? [
      { label: t('ai:stat.dueToday'), value: tasks.length - overdue, tone: 'primary' },
      { label: t('ai:stat.overdue'), value: overdue, tone: overdue ? 'danger' : 'success' },
    ] : undefined,
    followUps: [{ label: t('ai:followUp.nextCall'), command: 'Who should I call next?' }],
  }
}

export function todayAppointmentsPlan(env: Env): CommandPlan {
  const ids = env.user.role === 'executive' ? [env.user.id] : scopeUserIds(env.db, env.user)
  const appts = env.db.appointments.filter((a) => ids.includes(a.ownerId) && localDay(a.start) === env.today && a.status !== 'cancelled')
    .sort((a, b) => a.start.localeCompare(b.start))
  const visits = appts.filter((a) => a.type === 'siteVisit').length
  const nextUp = appts.find((a) => a.start >= env.now.toISOString())
  const nextLead = nextUp ? env.db.leads.find((l) => l.id === nextUp.leadId) : undefined
  return {
    mode: 'simulated', intent: 'todayAppointments', proposals: [], results: { kind: 'appointment', ids: appts.map((a) => a.id) },
    reply: {
      mode: 'simulated',
      text: appts.length ? t('ai:reply.todayAppointments', { count: appts.length, visits }) : t('ai:reply.noAppointments'),
      bullets: nextUp ? [t('ai:reply.nextAppointment', { time: fmtTime(nextUp.start), type: t(`catalogue:appointmentType.${nextUp.type}`), name: nextLead?.name ?? '' })] : undefined,
    },
    followUps: nextLead ? [
      { label: t('ai:followUp.draftConfirm', { name: first(nextLead.name) }), command: `Draft visit confirmation for ${nextLead.name}` },
      { label: t('ai:followUp.prep', { name: first(nextLead.name) }), command: `Summarise ${nextLead.name}` },
    ] : undefined,
  }
}

export function priorityLeadsPlan(env: Env, intent: 'priorityLeads' | 'conversions'): CommandPlan {
  const score = scoreOf(env)
  const mine = env.user.role === 'executive' ? env.open.filter((l) => l.ownerId === env.user.id) : env.open
  const ranked = mine.map((l) => ({ l, s: score(l) }))
    .filter((x) => intent === 'priorityLeads' || ['siteVisitDone', 'negotiation', 'siteVisitScheduled'].includes(x.l.stage))
    .sort((a, b) => (intent === 'conversions' ? b.s.probability - a.s.probability : 0) || b.s.score - a.s.score || b.s.probability - a.s.probability).slice(0, 5)
  return {
    mode: 'simulated', intent, proposals: [], results: { kind: 'lead', ids: ranked.map((x) => x.l.id) },
    reply: {
      mode: 'simulated', text: ranked.length ? t(`ai:reply.${intent}`, { count: ranked.length }) : t('ai:reply.noLeads'),
      bullets: ranked.slice(0, 3).map((x) => intent === 'conversions'
        ? t('ai:reply.conversionRow', { name: x.l.name, stage: t(`catalogue:stage.${x.l.stage}`), pct: Math.round(x.s.probability * 100) })
        : t('ai:reply.priorityRow', { name: x.l.name, stage: t(`catalogue:stage.${x.l.stage}`), score: x.s.score })),
    },
    followUps: ranked[0] ? [{ label: t('ai:followUp.summarise', { name: first(ranked[0].l.name) }), command: `Summarise ${ranked[0].l.name}` }] : undefined,
  }
}

/** A Today reason in words; elapsed minutes become a readable age ("2 days", "3 h 10 min"), as on the Today page. */
function reasonText(x: { reasonKey: string; params: Record<string, unknown> }): string {
  const mins = x.params.mins
  if (typeof mins !== 'number') return t(`today:reason.${x.reasonKey}`, x.params)
  const total = Math.max(0, Math.round(mins))
  const d = Math.floor(total / 1440)
  const h = Math.floor((total % 1440) / 60)
  const age = d ? t('today:due.days', { count: d }) : h ? t('today:due.hours', { h, m: total % 60 }) : t('today:due.mins', { count: total })
  return t(`today:reason.${x.reasonKey}`, { ...x.params, age })
}

/** "Who should I call next?": the top of the Today priority list, with its reason. */
export function nextCallPlan(env: Env): CommandPlan {
  const items = priorityItems(env.db, env.user, env.now).filter((x) => x.leadId)
  const seen = new Set<string>()
  const top = items.filter((x) => (seen.has(x.leadId!) ? false : (seen.add(x.leadId!), true))).slice(0, 3)
  if (!top.length) return priorityLeadsPlan(env, 'priorityLeads')
  const lead = env.db.leads.find((l) => l.id === top[0].leadId)!
  const next = suggestNext(lead, { appointments: env.db.appointments, tasks: env.db.tasks, properties: env.db.properties, settings: env.db.settings, now: env.now })
  return {
    mode: 'simulated', intent: 'nextCall', proposals: [], results: { kind: 'lead', ids: top.map((x) => x.leadId!) },
    reply: {
      mode: 'simulated', text: t('ai:reply.nextCall', { name: lead.name, reason: reasonText(top[0]) }),
      bullets: [
        ...(next ? [t('ai:reply.nextStep', { next: t(`leads:next.${next.key}`, next.params) })] : []),
        ...top.slice(1).map((x) => t('ai:reply.thenCall', { name: env.db.leads.find((l) => l.id === x.leadId)?.name ?? '', reason: reasonText(x) })),
      ],
      links: [{ kind: 'lead', id: lead.id }],
    },
    followUps: [
      { label: t('ai:followUp.summarise', { name: first(lead.name) }), command: `Summarise ${lead.name}` },
      { label: t('ai:followUp.logNoAnswer', { name: first(lead.name) }), command: `Called ${lead.name}, no answer, try again tomorrow` },
    ],
  }
}

export function followUpLeadsPlan(env: Env): CommandPlan {
  const days = daysIn(env.text) ?? env.db.settings.sla.hotNoContactDays
  const mine = env.user.role === 'executive' ? env.open.filter((l) => l.ownerId === env.user.id) : env.open
  const due = mine.filter((l) => daysSince(l.lastContactAt ?? l.createdAt, env.now) >= days)
    .sort((a, b) => (a.lastContactAt ?? a.createdAt).localeCompare(b.lastContactAt ?? b.createdAt)).slice(0, 10)
  return {
    mode: 'simulated', intent: 'followUpLeads', proposals: [], results: { kind: 'lead', ids: due.map((l) => l.id) },
    reply: {
      mode: 'simulated', text: due.length ? t('ai:reply.followUpLeads', { count: due.length, days }) : t('ai:reply.noFollowUps', { days }),
      bullets: due.slice(0, 3).map((l) => t('ai:reply.lastContact', { name: l.name, days: daysSince(l.lastContactAt ?? l.createdAt, env.now) })),
    },
    followUps: due[0] ? [{ label: t('ai:followUp.draftFollowUp', { name: first(due[0].name) }), command: `Draft a follow-up WhatsApp for ${due[0].name}` }] : undefined,
  }
}

/* ---------- performance ---------- */

export function performancePlan(env: Env): CommandPlan {
  const period = periodIn(env.text, 'month')
  const done = activityCounts(env.db, [env.user.id], period, env.now)
  const p = targetProgress(env.db, env.user, env.now)
  const mine = env.leads.filter((l) => l.ownerId === env.user.id)
  const stats: AIStat[] = period === 'month'
    ? [
      { label: t('ai:stat.calls'), value: p.calls.done, display: t('ai:stat.ofTarget', { done: p.calls.done, target: p.calls.target }), pct: p.calls.pct, tone: p.calls.pct >= 100 ? 'success' : 'primary' },
      { label: t('ai:stat.visits'), value: p.siteVisits.done, display: t('ai:stat.ofTarget', { done: p.siteVisits.done, target: p.siteVisits.target }), pct: p.siteVisits.pct, tone: p.siteVisits.pct >= 100 ? 'success' : 'primary' },
      { label: t('ai:stat.bookings'), value: p.bookings.done, display: t('ai:stat.ofTarget', { done: p.bookings.done, target: p.bookings.target }), pct: p.bookings.pct, tone: p.bookings.pct >= 100 ? 'success' : 'primary' },
    ]
    : [
      { label: t('ai:stat.calls'), value: done.calls, tone: 'primary' },
      { label: t('ai:stat.whatsapp'), value: done.whatsapp, tone: 'success' },
      { label: t('ai:stat.visits'), value: done.visits, tone: 'info' },
      { label: t('ai:stat.bookings'), value: done.bookings, tone: 'ai' },
    ]
  return {
    mode: 'simulated', intent: 'performance', proposals: [],
    reply: {
      mode: 'simulated', text: t('ai:reply.performance', { period: t(`ai:period.${period}`) }),
      bullets: [
        t('ai:reply.perfLeads', { open: mine.filter((l) => OPEN_STAGES.includes(l.stage)).length, conv: conversionRate(mine) }),
        ...(done.revenue ? [t('ai:reply.perfRevenue', { value: inrShort(done.revenue) })] : []),
      ],
    },
    stats,
    statsStyle: period === 'month' ? 'bars' : 'tiles',
    followUps: [{ label: t('ai:followUp.targetLeft'), command: "What's left for my target this month?" }],
  }
}

export function teamPerformancePlan(env: Env): CommandPlan {
  if (!can(env.user, 'team.view')) return refuse('teamPerformance', 'team.view', env.user, { text: t('ai:reply.ownInstead'), label: t('ai:followUp.myPerformance'), command: 'How am I doing this month?' })
  const period = periodIn(env.text, 'week')
  const execs = env.db.users.filter((u) => u.role === 'executive' && u.status === 'active' && (env.user.role === 'admin' || u.managerId === env.user.id))
  const rows = execs.map((u) => ({ u, c: activityCounts(env.db, [u.id], period, env.now) }))
    .sort((a, b) => b.c.bookings - a.c.bookings || b.c.visits - a.c.visits || b.c.calls - a.c.calls)
  const total = activityCounts(env.db, execs.map((u) => u.id), period, env.now)
  const maxCalls = Math.max(1, ...rows.map((r) => r.c.calls))
  return {
    mode: 'simulated', intent: 'teamPerformance', proposals: [], results: { kind: 'user', ids: rows.map((r) => r.u.id) },
    reply: {
      mode: 'simulated', text: t('ai:reply.teamPerformance', { period: t(`ai:period.${period}`), calls: total.calls, visits: total.visits, bookings: total.bookings }),
      bullets: rows.slice(0, 4).map((r) => t('ai:reply.teamRow', { name: r.u.name, calls: r.c.calls, visits: r.c.visits, bookings: r.c.bookings })),
      nav: [{ label: 'ai:nav.team', to: '/team' }, { label: 'ai:nav.reports', to: '/reports' }],
    },
    stats: rows.map((r) => ({ label: r.u.name, value: r.c.calls, display: t('ai:stat.callsVisits', { calls: r.c.calls, visits: r.c.visits }), pct: pct(r.c.calls, maxCalls), tone: 'primary' as const })),
    followUps: [{ label: t('ai:followUp.overloaded'), command: 'Who is overloaded today?' }],
  }
}

export function targetLeftPlan(env: Env): CommandPlan {
  const p = targetProgress(env.db, env.user, env.now)
  const end = new Date(env.now.getFullYear(), env.now.getMonth() + 1, 0)
  const daysLeft = Math.max(1, end.getDate() - env.now.getDate() + 1)
  const left = (x: { done: number; target: number }) => Math.max(0, x.target - x.done)
  const rows = [
    { key: 'calls', v: p.calls }, { key: 'visits', v: p.siteVisits }, { key: 'bookings', v: p.bookings },
  ] as const
  const bullets = rows.filter((r) => r.v.target > 0).map((r) => left(r.v)
    ? t(`ai:reply.left.${r.key}`, { count: left(r.v), perDay: Math.ceil(left(r.v) / daysLeft) })
    : t(`ai:reply.met.${r.key}`))
  return {
    mode: 'simulated', intent: 'targetLeft', proposals: [],
    reply: { mode: 'simulated', text: t('ai:reply.targetLeft', { days: daysLeft }), bullets },
    stats: rows.map((r) => ({ label: t(`ai:stat.${r.key}`), value: r.v.done, display: t('ai:stat.ofTarget', { done: r.v.done, target: r.v.target }), pct: r.v.pct, tone: r.v.pct >= 100 ? 'success' as const : 'primary' as const })),
    followUps: [{ label: t('ai:followUp.nextCall'), command: 'Who should I call next?' }],
  }
}

/* ---------- managers and admins ---------- */

export function workloadPlan(env: Env): CommandPlan {
  if (!can(env.user, 'team.view')) return refuse('workload', 'team.view', env.user)
  const rows = teamBoard(env.db, env.user, env.now).filter((r) => r.user.status === 'active')
  if (!rows.length) return say('workload', t('ai:reply.noTeam'))
  const avg = rows.reduce((n, r) => n + r.openLeads, 0) / rows.length
  const cap = env.db.settings.assignment.maxActivePerExec
  const over = rows.filter((r) => (cap ? r.openLeads > cap : r.openLeads > avg * 1.25) || r.overdue >= 3).sort((a, b) => b.openLeads - a.openLeads)
  const max = Math.max(1, ...rows.map((r) => r.openLeads))
  const light = [...rows].filter((r) => r.user.availability !== 'onLeave').sort((a, b) => a.openLeads - b.openLeads)[0]
  return {
    mode: 'simulated', intent: 'workload', proposals: [], results: { kind: 'user', ids: rows.map((r) => r.user.id) },
    reply: {
      mode: 'simulated',
      text: over.length ? t('ai:reply.overloaded', { names: over.map((r) => r.user.name).join(', '), count: over.length }) : t('ai:reply.balanced'),
      bullets: [
        ...over.map((r) => t('ai:reply.loadRow', { name: r.user.name, open: r.openLeads, overdue: r.overdue, visits: r.visitsToday })),
        ...(light && over.length ? [t('ai:reply.lightest', { name: light.user.name, open: light.openLeads })] : []),
      ],
    },
    stats: rows.sort((a, b) => b.openLeads - a.openLeads).map((r) => ({
      label: r.user.name, value: r.openLeads, display: t('ai:stat.openOverdue', { open: r.openLeads, overdue: r.overdue }),
      pct: pct(r.openLeads, max), tone: over.includes(r) ? 'danger' as const : r.user.availability === 'onLeave' ? 'neutral' as const : 'primary' as const,
    })),
    followUps: over[0] && light && can(env.user, 'lead.assign') ? [{ label: t('ai:followUp.rebalance', { from: first(over[0].user.name), to: first(light.user.name) }), command: `Reassign ${over[0].user.name}'s leads to ${light.user.name}` }] : undefined,
  }
}

export function stalledPlan(env: Env): CommandPlan {
  const days = daysIn(env.text)
  const list = env.open
    .filter((l) => (days ? daysInStage(l, env.now) >= days && !['new'].includes(l.stage) : isStalled(l, env.db.settings, env.now)))
    .sort((a, b) => daysInStage(b, env.now) - daysInStage(a, env.now)).slice(0, 10)
  const value = pipelineValueByStage(list).reduce((n, s) => n + s.value, 0)
  return {
    mode: 'simulated', intent: 'stalledDeals', proposals: [], results: { kind: 'lead', ids: list.map((l) => l.id) },
    reply: {
      mode: 'simulated',
      text: list.length ? t('ai:reply.stalled', { count: list.length, value: inrShort(value), days: days ?? '' }) : t('ai:reply.noStalled'),
      bullets: list.slice(0, 3).map((l) => {
        const next = suggestNext(l, { appointments: env.db.appointments, tasks: env.db.tasks, properties: env.db.properties, settings: env.db.settings, now: env.now })
        return t('ai:reply.stalledRow', { name: l.name, stage: t(`catalogue:stage.${l.stage}`), days: daysInStage(l, env.now), next: next ? t(`leads:next.${next.key}`, next.params) : t('ai:next.none') })
      }),
      nav: [{ label: 'ai:nav.pipeline', to: '/pipeline' }],
    },
  }
}

export function sourceConversionPlan(env: Env): CommandPlan {
  const rows = leadsBySource(env.leads).map((r) => ({ ...r, visitPct: pct(r.visited, r.count), bookPct: pct(r.booked, r.count) }))
    .filter((r) => r.count >= 1).sort((a, b) => b.visitPct - a.visitPct || b.count - a.count)
  if (!rows.length) return say('sourceConversion', t('ai:reply.noLeads'))
  const bestVisit = rows[0]
  const bestBook = [...rows].sort((a, b) => b.bookPct - a.bookPct || b.count - a.count)[0]
  const src = (s: LeadSource) => t(`catalogue:source.${s}`)
  return {
    mode: 'simulated', intent: 'sourceConversion', proposals: [],
    reply: {
      mode: 'simulated', text: t('ai:reply.bestSource', { source: src(bestVisit.source), pct: bestVisit.visitPct, count: bestVisit.count }),
      bullets: [
        t('ai:reply.bestBookingSource', { source: src(bestBook.source), pct: bestBook.bookPct }),
        ...(rows.length > 2 ? [t('ai:reply.weakSource', { source: src(rows[rows.length - 1].source), pct: rows[rows.length - 1].visitPct })] : []),
      ],
      nav: can(env.user, 'report.view') ? [{ label: 'ai:nav.reports', to: '/reports' }] : undefined,
    },
    stats: rows.slice(0, 6).map((r) => ({ label: src(r.source), value: r.visitPct, display: t('ai:stat.visitRate', { pct: r.visitPct, count: r.count }), pct: r.visitPct, tone: r === bestVisit ? 'success' as const : 'primary' as const })),
  }
}

export function lostReasonsPlan(env: Env): CommandPlan {
  const period = periodIn(env.text, 'month')
  const from = periodStart(period, env.now).toISOString()
  const lost = env.leads.filter((l) => l.stage === 'lost' && (l.lost?.at ?? l.stageSince) >= from)
  const only = lostReasonIn(env.text)
  const counts = LOST_REASONS.map((reason) => ({ reason, count: lost.filter((l) => l.lost?.reason === reason).length })).filter((x) => x.count)
    .sort((a, b) => b.count - a.count)
  const max = Math.max(1, ...counts.map((c) => c.count))
  const label = (r: LostReason) => t(`catalogue:lostReason.${r}`)
  const focus = only ? lost.filter((l) => l.lost?.reason === only) : lost
  return {
    mode: 'simulated', intent: 'lostReasons', proposals: [], results: { kind: 'lead', ids: focus.map((l) => l.id) },
    reply: {
      mode: 'simulated',
      text: only
        ? t('ai:reply.lostTo', { count: focus.length, reason: label(only), period: t(`ai:period.${period}`), total: lost.length })
        : t('ai:reply.lostTotal', { count: lost.length, period: t(`ai:period.${period}`) }),
      bullets: counts[0] && !only ? [t('ai:reply.topLostReason', { reason: label(counts[0].reason), count: counts[0].count })] : undefined,
    },
    stats: counts.map((c) => ({ label: label(c.reason), value: c.count, pct: pct(c.count, max), tone: c.reason === only ? 'danger' as const : 'neutral' as const })),
  }
}

export function unsoldInventoryPlan(env: Env): CommandPlan {
  const unsold = env.db.properties.filter((p) => p.listing === 'live' && (p.status === 'available' || p.status === 'onHold'))
  const groups = new Map<string, Property[]>()
  for (const p of unsold) {
    const key = p.projectName ?? p.location.locality
    groups.set(key, [...(groups.get(key) ?? []), p])
  }
  const rows = [...groups.entries()].map(([name, list]) => ({ name, list, value: list.reduce((n, p) => n + p.price, 0) }))
    .sort((a, b) => b.list.length - a.list.length || b.value - a.value)
  if (!rows.length) return say('unsoldInventory', t('ai:reply.noInventory'))
  const max = Math.max(1, ...rows.map((r) => r.list.length))
  return {
    mode: 'simulated', intent: 'unsoldInventory', proposals: [], results: { kind: 'property', ids: rows[0].list.map((p) => p.id) },
    reply: {
      mode: 'simulated', text: t('ai:reply.unsold', { name: rows[0].name, count: rows[0].list.length, value: inrShort(rows[0].value) }),
      bullets: [t('ai:reply.unsoldTotal', { count: unsold.length, value: inrShort(unsold.reduce((n, p) => n + p.price, 0)) })],
      nav: [{ label: 'ai:nav.properties', to: '/properties' }],
    },
    stats: rows.slice(0, 6).map((r) => ({ label: r.name, value: r.list.length, display: t('ai:stat.unitsValue', { count: r.list.length, value: inrShort(r.value) }), pct: pct(r.list.length, max), tone: 'primary' as const })),
  }
}

export function businessSummaryPlan(env: Env): CommandPlan {
  const k = summaryKpis(env.db, env.user, env.now)
  const scope = env.user.role === 'admin' ? 'business' : env.user.role === 'manager' ? 'team' : 'personal'
  const stalled = env.open.filter((l) => isStalled(l, env.db.settings, env.now)).length
  const unassigned = env.open.filter((l) => l.ownerId === null).length
  return {
    mode: 'simulated', intent: 'businessSummary', proposals: [],
    reply: {
      mode: 'simulated', text: t(`ai:insight.title.${scope}`),
      bullets: [
        t('ai:reply.bizToday', { leads: k.newLeadsToday, visits: k.visitsToday }),
        t('ai:insight.pipeline', { value: inrShort(k.pipelineValue), open: k.openLeads }),
        t('ai:reply.bizMonth', { bookings: k.bookingsThisMonth, conv: k.conversionPct }),
        ...(unassigned ? [t('ai:reply.bizUnassigned', { count: unassigned })] : []),
        ...(stalled ? [t('ai:reply.bizStalled', { count: stalled })] : []),
        ...(scope === 'business' ? [t('ai:insight.inventory', { count: k.availableInventory })] : []),
      ],
      nav: can(env.user, 'report.view') ? [{ label: 'ai:nav.reports', to: '/reports' }] : undefined,
    },
    statsStyle: 'tiles',
    stats: [
      { label: t('ai:stat.newLeads'), value: k.newLeadsToday, tone: 'primary' },
      { label: t('ai:stat.visitsToday'), value: k.visitsToday, tone: 'info' },
      { label: t('ai:stat.pipeline'), value: k.pipelineValue, display: inrShort(k.pipelineValue), tone: 'ai' },
      { label: t('ai:stat.conversion'), value: k.conversionPct, display: `${k.conversionPct}%`, pct: k.conversionPct, tone: 'success' },
    ],
    followUps: [
      ...(unassigned && can(env.user, 'lead.assign') ? [{ label: t('ai:followUp.assignNew'), command: 'Assign new leads' }] : []),
      ...(stalled ? [{ label: t('ai:followUp.stalled'), command: 'Show stalled deals' }] : []),
    ],
  }
}

export function duplicatesPlan(env: Env): CommandPlan {
  const seen = new Set<string>()
  const pairs: [Lead, Lead][] = []
  for (const l of env.leads) {
    if (seen.has(l.id)) continue
    for (const d of findDuplicates({ leads: env.leads }, { phone: l.phone, altPhone: l.altPhone, email: l.email, excludeId: l.id })) {
      if (seen.has(d.lead.id)) continue
      pairs.push([l, d.lead])
      seen.add(d.lead.id)
    }
    seen.add(l.id)
  }
  const ids = [...new Set(pairs.flat().map((l) => l.id))]
  return {
    mode: 'simulated', intent: 'duplicates', proposals: [], results: { kind: 'lead', ids },
    reply: {
      mode: 'simulated', text: pairs.length ? t('ai:reply.duplicates', { count: pairs.length }) : t('ai:reply.noDuplicates'),
      bullets: pairs.slice(0, 4).map(([a, b]) => t('ai:reply.dupRow', { a: `${a.name} (${a.id})`, b: `${b.name} (${b.id})` })),
    },
  }
}

/* ---------- records ---------- */

export function summarizeLeadPlan(env: Env): CommandPlan {
  const { lead } = leadFor(env.text, env)
  if (!lead) return { mode: 'simulated', intent: 'summarizeLead', proposals: [], reply: summarizeSim({ kind: 'day' }, env.db, env.user, env.now) }
  const reply = summarizeSim({ kind: 'lead', id: lead.id }, env.db, env.user, env.now)
  return {
    mode: 'simulated', intent: 'summarizeLead', proposals: [], reply,
    followUps: [
      { label: t('ai:followUp.matches', { name: first(lead.name) }), command: `Find matching properties for ${lead.name}` },
      { label: t('ai:followUp.draftFollowUp', { name: first(lead.name) }), command: `Draft a follow-up WhatsApp for ${lead.name}` },
    ],
  }
}

/** "Find matching properties for Priya", "Match properties for Rahul under 1.2 Cr", "properties within Karthik's budget". */
export function findMatchesPlan(env: Env): CommandPlan {
  const intent = 'findMatches'
  if (!can(env.user, 'matching.run')) return refuse(intent, 'matching.run', env.user)
  const { lead, others } = leadFor(env.text.replace(/\b(propert(?:y|ies)|matching|matches|options|units)\b/gi, ' '), env)
  // on a property page (or a property named): the buyers who fit it
  // "Which buyers match Aranya Greens?" asks for buyers even when a lead's name looks alike ("Aranya" ~ "Ananya")
  const asksBuyers = /\b(buyers?|leads?|clients?)\b.*\b(for|match(?:es)?|fit(?:s)?|want(?:s)?|suit(?:s)?)\b|\bwho (?:fits|wants|matches)\b/.test(env.s)
  const property = !lead || asksBuyers ? (propertyIn(env.text, env) ?? env.selProperty) : undefined
  if (property && (!lead || asksBuyers)) {
    const buyers = leadsForProperty(property, env.open, env.db.settings, env.now, { limit: 5 })
    return {
      mode: 'simulated', intent, proposals: [], results: { kind: 'lead', ids: buyers.map((m) => m.lead.id) },
      reply: {
        mode: 'simulated', text: buyers.length ? t('ai:reply.buyersFor', { count: buyers.length, name: property.title }) : t('ai:reply.noBuyers', { name: property.title }),
        links: [{ kind: 'property', id: property.id }],
        nav: [{ label: 'ai:nav.matching', to: `/matching?property=${property.id}` }],
      },
      stats: buyers.map((m) => ({ label: m.lead.name, value: m.score, display: `${m.score}%`, pct: m.score, tone: m.score >= 80 ? 'success' as const : m.score >= 60 ? 'primary' as const : 'warning' as const })),
    }
  }
  if (!lead) return say(intent, t('ai:reply.whichLead'), { followUps: (others.length ? others : env.open.slice(0, 3)).map((l) => ({ label: l.name, command: `Find matching properties for ${l.name}` })) })
  const capAmount = /\b(under|below|within|upto|up to|max|less than)\b/.test(env.s) ? amountsIn(env.text)[0]?.value : undefined
  const withinBudget = /\bwithin\b.*\bbudget\b|\bin (?:his|her|their) budget\b/.test(env.s)
  const cap = capAmount ?? (withinBudget ? lead.requirement.budgetMax : undefined)
  const all = propertiesForLead(lead, env.db.properties, env.db.settings, env.now, { limit: 20 })
  const matches = all.filter((m) => !cap || m.property.price <= cap).slice(0, 5)
  const r = lead.requirement
  const want = t('ai:reply.wants', {
    config: r.configurations.map(configLabel).join(' / ') || t('ai:summary.anyConfig'),
    places: r.localities.join(', ') || r.cities.join(', ') || t('ai:summary.anyPlace'),
    budget: r.budgetMax ? inrRange(r.budgetMin, r.budgetMax, { upTo: t('domain:lead.upTo'), from: t('domain:lead.from') }) : t('ai:summary.budgetUnknown'),
  })
  if (!matches.length) {
    return say(intent, cap ? t('ai:reply.noMatchesUnder', { name: lead.name, cap: inrShort(cap) }) : t('ai:reply.noMatches', { name: lead.name }), {
      links: [{ kind: 'lead', id: lead.id }], bullets: [want], nav: [{ label: 'ai:nav.matching', to: `/matching?lead=${lead.id}` }],
    })
  }
  return {
    mode: 'simulated', intent, proposals: [],
    results: { kind: 'property', ids: matches.map((m) => m.property.id) },
    reply: {
      mode: 'simulated',
      text: cap ? t('ai:reply.matchesUnder', { count: matches.length, name: lead.name, cap: inrShort(cap) }) : t('ai:reply.matches', { count: matches.length, name: lead.name }),
      bullets: [want],
      links: [{ kind: 'lead', id: lead.id }],
      nav: [{ label: 'ai:nav.matching', to: `/matching?lead=${lead.id}` }],
    },
    stats: matches.map((m) => ({ label: m.property.title, value: m.score, display: `${m.score}% · ${inrShort(m.property.price)}`, pct: m.score, tone: m.score >= 80 ? 'success' as const : m.score >= 60 ? 'primary' as const : 'warning' as const })),
    followUps: can(env.user, 'lead.edit', lead, env.db) ? [{ label: t('ai:followUp.shareTop', { name: first(lead.name), count: Math.min(3, matches.length) }), command: `Share top ${Math.min(3, matches.length)} matches with ${lead.name}` }] : undefined,
  }
}

export function propertySearchPlan(env: Env): CommandPlan {
  const f = parsePropertyQuery(env.text)
  if (!hasPropertyFilters(f)) return say('unknown', t('ai:reply.unknown'))
  const list = applyPropertyFilters(env.db.properties.filter((p) => p.listing === 'live' && p.status !== 'sold' && p.status !== 'booked'), { ...f, text: undefined }).slice(0, 8)
  return {
    mode: 'simulated', intent: 'propertySearch', proposals: [], results: { kind: 'property', ids: list.map((p) => p.id) },
    reply: {
      mode: 'simulated', text: list.length ? t('ai:reply.propertySearch', { count: list.length }) : t('ai:reply.noProperties'),
      nav: [{ label: 'ai:nav.properties', to: '/properties' }],
    },
  }
}

/** A lead named on its own ("Priya Sharma?") is a request to summarise it. */
export function namedLeadPlan(env: Env): CommandPlan | undefined {
  const words = env.s.split(/\s+/).filter(Boolean)
  if (words.length > 4) return undefined
  const { lead } = leadFor(env.text, { ...env, selLead: undefined })
  return lead ? summarizeLeadPlan({ ...env, text: lead.name }) : undefined
}
