/**
 * The global assistant's command reader (master prompt §12.5), first version. It turns a request into a reply, the
 * records to list (query intents) and action proposals (write intents). Nothing is written here: the panel shows each
 * proposal with Confirm / Edit / Cancel and services/commands runs it. A request the role may not do is refused with
 * the reason. Ported idea: wireframe-rebuild/src/lib/ai/plan.ts ("plan of changes, a person applies") and answer.ts.
 */
import i18next from 'i18next'
import type { DB, EntityRef, Lead, User } from '@/domain/types'
import { OPEN_STAGES, DEFAULT_DURATION_MIN } from '@/domain/catalogue'
import { can, explainDenied, type Action } from '@/lib/permissions'
import { configLabel, propertiesForLead } from '@/lib/matching'
import { fmtDateTime, inrRange, inrShort } from '@/lib/format'
import { addDaysToDay, localDay, daysSince } from '@/lib/dates'
import { phoneDisplay } from '@/lib/phone'
import { applyPropertyFilters, hasPropertyFilters, parsePropertyQuery } from '@/lib/search'
import { leadScore } from '@/lib/scoring'
import { visible } from '@/services/queries/visibility'
import { propose } from '../proposals'
import type { AIContext, CommandPlan } from '../types'
import { extractAppointmentFields } from './extract-appointment'
import { extractLeadFields } from './extract-lead'
import { detectIntent, stageIn } from './intents'
import { atLocal, dateIn, named, norm, timeIn } from './parse'
import { insightsSim, summarizeSim } from './summarize'

const t = (key: string, opts: Record<string, unknown> = {}): string => i18next.t(key, opts)

const refuse = (intent: string, action: Action, user: User): CommandPlan => {
  const why = explainDenied(user, action)
  return {
    mode: 'simulated', intent, proposals: [],
    reply: { mode: 'simulated', text: t('ai:reply.refused', { reason: t(why.reasonKey, why.params) }) },
    refusal: { action, reasonKey: why.reasonKey, params: why.params },
  }
}
const say = (intent: string, text: string, links?: EntityRef[]): CommandPlan =>
  ({ mode: 'simulated', intent, proposals: [], reply: { mode: 'simulated', text, links } })

/** The lead the request is about: named in the text, else the selected record. */
function leadFor(text: string, leads: Lead[], ctx: AIContext): { lead?: Lead; ambiguous: Lead[] } {
  const hits = named(text, leads.map((l) => ({ id: l.id, name: l.name })))
  if (hits.length) {
    const exact = hits.filter((h) => norm(text).toLowerCase().includes(h.name.toLowerCase()))
    const pick = exact[0] ?? hits[0]
    return { lead: leads.find((l) => l.id === pick.id), ambiguous: exact.length ? [] : hits.slice(1, 4).map((h) => leads.find((l) => l.id === h.id)!).filter(Boolean) }
  }
  if (ctx.selection?.kind === 'lead') return { lead: leads.find((l) => l.id === ctx.selection?.id), ambiguous: [] }
  return { ambiguous: [] }
}

export function parseCommandSim(text: string, ctx: AIContext): CommandPlan {
  const db: DB = ctx.db()
  const user = ctx.actor
  const now = ctx.now
  const today = localDay(now)
  const intent = detectIntent(text)
  const leads = visible.leads(db, user)
  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage))
  const score = (l: Lead) => leadScore(l, { properties: db.properties, settings: db.settings, now })

  switch (intent) {
    // Destructive and admin requests: refused for roles without the permission; otherwise done on the record
    // page, where delete has a confirm and undo (the assistant never deletes).
    case 'deleteProperty':
      return can(user, 'property.delete') ? say(intent, t('ai:reply.deleteOnRecord')) : refuse(intent, 'property.delete', user)
    case 'deleteLead':
      return can(user, 'lead.delete') ? say(intent, t('ai:reply.deleteOnRecord')) : refuse(intent, 'lead.delete', user)
    case 'manageUsers':
      return can(user, 'user.manage') ? say(intent, t('ai:reply.manageUsersOnTeam')) : refuse(intent, 'user.manage', user)

    case 'help':
    case 'unknown':
      return say(intent, t(intent === 'help' ? 'ai:reply.help' : 'ai:reply.unknown'))

    case 'createLead': {
      if (!can(user, 'lead.create')) return refuse(intent, 'lead.create', user)
      const x = extractLeadFields(text, { now, db })
      if (!x.fields.name && !x.fields.phone) return say(intent, t('ai:reply.leadNeedsDetails'))
      const r = x.fields.requirement
      const summary = [
        { label: 'ai:field.name', value: x.fields.name ?? t('ai:value.missing') },
        { label: 'ai:field.phone', value: x.fields.phone ? phoneDisplay(x.fields.phone) : t('ai:value.missing') },
        ...(r?.configurations.length ? [{ label: 'ai:field.configuration', value: r.configurations.map(configLabel).join(', ') }] : []),
        ...(r?.localities.length || r?.cities.length ? [{ label: 'ai:field.location', value: (r.localities.length ? r.localities : r.cities).join(', ') }] : []),
        ...(r?.budgetMax ? [{ label: 'ai:field.budget', value: inrRange(r.budgetMin, r.budgetMax, { upTo: t('domain:lead.upTo'), from: t('domain:lead.from') }) }] : []),
        { label: 'ai:field.source', value: t(`catalogue:source.${x.fields.source ?? 'manual'}`) },
      ]
      const proposal = propose({
        kind: 'createLead', permission: 'lead.create', summary,
        payload: { input: { ...x.fields, name: x.fields.name ?? '', source: x.fields.source ?? 'manual', fieldMeta: x.meta } },
      })
      const dup = x.duplicates?.[0] ? db.leads.find((l) => l.id === x.duplicates?.[0].leadId) : undefined
      return {
        mode: 'simulated', intent, proposals: [proposal],
        reply: {
          mode: 'simulated', text: t('ai:reply.createLead', { count: x.filledCount }),
          bullets: dup ? [t('ai:reply.duplicate', { name: dup.name })] : undefined,
          links: dup ? [{ kind: 'lead', id: dup.id }] : undefined,
        },
      }
    }

    case 'createAppointment': {
      if (!can(user, 'appointment.manage')) return refuse(intent, 'appointment.manage', user)
      const x = extractAppointmentFields(text, { now, leads, properties: db.properties.filter((p) => p.listing === 'live'), selectedLeadId: ctx.selection?.kind === 'lead' ? ctx.selection.id : undefined })
      const lead = leads.find((l) => l.id === x.fields.leadId)
      if (!lead) return say(intent, t('ai:reply.whichLead'))
      const type = x.fields.type ?? 'siteVisit'
      const day = x.date ?? addDaysToDay(today, 1)
      const time = x.time ?? '11:00'
      const start = atLocal(day, time)
      const ownerId = lead.ownerId ?? user.id
      const props = (x.fields.propertyIds ?? []).map((id) => db.properties.find((p) => p.id === id)).filter((p) => !!p)
      const proposal = propose({
        kind: 'createAppointment', permission: 'appointment.manage', targets: [{ kind: 'lead', id: lead.id }],
        summary: [
          { label: 'ai:field.type', value: t(`catalogue:appointmentType.${type}`) },
          { label: 'ai:field.lead', value: lead.name },
          { label: 'ai:field.when', value: fmtDateTime(start) },
          ...(props.length ? [{ label: 'ai:field.property', value: props.map((p) => p.title).join(', ') }] : []),
          { label: 'ai:field.owner', value: db.users.find((u) => u.id === ownerId)?.name ?? '' },
        ],
        payload: { input: { type, leadId: lead.id, ownerId, start, durationMin: x.fields.durationMin ?? DEFAULT_DURATION_MIN[type], propertyIds: x.fields.propertyIds ?? [], location: x.fields.location, notes: x.fields.notes } },
      })
      const assumed = [!x.date && t('ai:reply.assumedDate'), !x.time && t('ai:reply.assumedTime')].filter((s): s is string => !!s)
      return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.createAppointment', { name: lead.name }), bullets: assumed.length ? assumed : undefined } }
    }

    case 'createTask': {
      if (!can(user, 'task.manage')) return refuse(intent, 'task.manage', user)
      const { lead } = leadFor(text, leads, ctx)
      const day = dateIn(text, today) ?? addDaysToDay(today, 1)
      const dueAt = atLocal(day, timeIn(text) ?? '10:00')
      const kind = /\bwhats ?app\b/i.test(text) ? 'whatsapp' : /\bcall\b/i.test(text) ? 'call' : /\bemail|mail\b/i.test(text) ? 'email' : 'followUp'
      const title = lead ? t(`ai:taskTitle.${kind}`, { name: lead.name }) : norm(text).replace(/^(remind me to|reminder to|create (?:a )?task(?: to)?|add (?:a )?task(?: to)?)\s*/i, '').slice(0, 80)
      const proposal = propose({
        kind: 'createTask', permission: 'task.manage', targets: lead ? [{ kind: 'lead', id: lead.id }] : undefined,
        summary: [
          { label: 'ai:field.title', value: title },
          { label: 'ai:field.due', value: fmtDateTime(dueAt) },
          ...(lead ? [{ label: 'ai:field.lead', value: lead.name }] : []),
        ],
        payload: { input: { title, type: kind, ownerId: lead?.ownerId ?? user.id, dueAt, leadId: lead?.id, origin: 'ai' } },
      })
      return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.createTask') } }
    }

    case 'assignLead': {
      if (!can(user, 'lead.assign')) return refuse(intent, 'lead.assign', user)
      const [leadPart, toPart = ''] = norm(text).split(/\bto\b(?!.*\bto\b)/i)
      const { lead } = leadFor(leadPart, leads, ctx)
      const people = db.users.filter((u) => u.role === 'executive' && u.status === 'active' && (user.role === 'admin' || u.managerId === user.id))
      const target = named(toPart, people)[0]
      if (!lead) return say(intent, t('ai:reply.whichLead'))
      if (!target && !/\bauto|anyone|best\b/i.test(toPart)) return say(intent, t('ai:reply.whichExecutive'))
      const proposal = propose({
        kind: 'assignLead', permission: 'lead.assign', targets: [{ kind: 'lead', id: lead.id }],
        summary: [
          { label: 'ai:field.lead', value: lead.name },
          { label: 'ai:field.from', value: db.users.find((u) => u.id === lead.ownerId)?.name ?? t('ai:value.unassigned') },
          { label: 'ai:field.to', value: target?.name ?? t('ai:value.auto') },
        ],
        payload: { leadId: lead.id, to: target?.id ?? 'auto' },
      })
      return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.assignLead', { name: lead.name }) } }
    }

    case 'moveStage': {
      if (!can(user, 'lead.moveStage')) return refuse(intent, 'lead.moveStage', user)
      const { lead } = leadFor(text.split(/\b(?:to|as|into)\b/i)[0], leads, ctx)
      const to = stageIn(text)
      if (!lead) return say(intent, t('ai:reply.whichLead'))
      if (!to) return say(intent, t('ai:reply.whichStage'))
      if (to === 'booked' || to === 'converted') return say(intent, t('ai:reply.bookingNeedsDialog', { name: lead.name }), [{ kind: 'lead', id: lead.id }])
      const lostReason = to === 'lost'
        ? /budget|expensive|costly/i.test(text) ? 'budgetMismatch' : /bought|elsewhere|another/i.test(text) ? 'boughtElsewhere' : /not respond|no response|unreachable/i.test(text) ? 'notResponding' : /location|far/i.test(text) ? 'location' : /loan/i.test(text) ? 'loanRejected' : 'other'
        : undefined
      const proposal = propose({
        kind: 'moveStage', permission: 'lead.moveStage', targets: [{ kind: 'lead', id: lead.id }],
        summary: [
          { label: 'ai:field.lead', value: lead.name },
          { label: 'ai:field.from', value: t(`catalogue:stage.${lead.stage}`) },
          { label: 'ai:field.to', value: t(`catalogue:stage.${to}`) },
          ...(lostReason ? [{ label: 'ai:field.reason', value: t(`catalogue:lostReason.${lostReason}`) }] : []),
        ],
        payload: { leadId: lead.id, to, lostReason },
      })
      return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.moveStage', { name: lead.name }) } }
    }

    case 'findMatches': {
      if (!can(user, 'matching.run')) return refuse(intent, 'matching.run', user)
      const { lead } = leadFor(text, leads, ctx)
      if (!lead) return say(intent, t('ai:reply.whichLead'))
      const matches = propertiesForLead(lead, db.properties, db.settings, now, { limit: 5 })
      if (!matches.length) return say(intent, t('ai:reply.noMatches', { name: lead.name }), [{ kind: 'lead', id: lead.id }])
      return {
        mode: 'simulated', intent, proposals: [],
        results: { kind: 'property', ids: matches.map((m) => m.property.id) },
        reply: {
          mode: 'simulated', text: t('ai:reply.matches', { count: matches.length, name: lead.name }),
          bullets: matches.map((m) => `${m.property.title} · ${inrShort(m.property.price)} · ${m.score}%`),
          links: [{ kind: 'lead', id: lead.id }, ...matches.map((m) => ({ kind: 'property' as const, id: m.property.id }))],
        },
      }
    }

    case 'todayTasks': {
      const tasks = visible.tasks(db, user).filter((x) => x.status === 'open' && localDay(x.dueAt) <= today && (user.role !== 'executive' || x.ownerId === user.id))
        .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      const overdue = tasks.filter((x) => x.dueAt < now.toISOString()).length
      return {
        mode: 'simulated', intent, proposals: [], results: { kind: 'task', ids: tasks.map((x) => x.id) },
        reply: { mode: 'simulated', text: t('ai:reply.todayTasks', { count: tasks.length, overdue }), bullets: tasks.slice(0, 6).map((x) => `${fmtDateTime(x.dueAt)} · ${x.title}`) },
      }
    }

    case 'todayAppointments': {
      const s = summarizeSim({ kind: 'day' }, db, user, now)
      return { mode: 'simulated', intent, proposals: [], reply: s, results: { kind: 'appointment', ids: (s.links ?? []).map((l) => l.id) } }
    }

    case 'priorityLeads':
    case 'conversions': {
      const ranked = open.map((l) => ({ l, s: score(l) }))
        .filter((x) => intent === 'priorityLeads' || ['siteVisitDone', 'negotiation', 'siteVisitScheduled'].includes(x.l.stage))
        .sort((a, b) => b.s.score - a.s.score || b.s.probability - a.s.probability).slice(0, 5)
      return {
        mode: 'simulated', intent, proposals: [], results: { kind: 'lead', ids: ranked.map((x) => x.l.id) },
        reply: {
          mode: 'simulated', text: t(`ai:reply.${intent}`, { count: ranked.length }),
          bullets: ranked.map((x) => `${x.l.name} · ${t(`catalogue:stage.${x.l.stage}`)} · ${x.s.score}`),
          links: ranked.map((x) => ({ kind: 'lead' as const, id: x.l.id })),
        },
      }
    }

    case 'followUpLeads': {
      const days = db.settings.sla.hotNoContactDays
      const due = open.filter((l) => daysSince(l.lastContactAt ?? l.createdAt, now) >= days)
        .sort((a, b) => (a.lastContactAt ?? a.createdAt).localeCompare(b.lastContactAt ?? b.createdAt)).slice(0, 8)
      return {
        mode: 'simulated', intent, proposals: [], results: { kind: 'lead', ids: due.map((l) => l.id) },
        reply: {
          mode: 'simulated', text: t('ai:reply.followUpLeads', { count: due.length, days }),
          bullets: due.map((l) => t('ai:reply.lastContact', { name: l.name, days: daysSince(l.lastContactAt ?? l.createdAt, now) })),
          links: due.map((l) => ({ kind: 'lead' as const, id: l.id })),
        },
      }
    }

    case 'performance':
      return { mode: 'simulated', intent, proposals: [], reply: insightsSim('personal', db, user, now) }
    case 'teamPerformance':
      if (!can(user, 'team.view')) return refuse(intent, 'team.view', user)
      return { mode: 'simulated', intent, proposals: [], reply: insightsSim(user.role === 'admin' ? 'business' : 'team', db, user, now) }

    case 'summarizeLead': {
      const { lead } = leadFor(text, leads, ctx)
      if (!lead) return { mode: 'simulated', intent, proposals: [], reply: summarizeSim({ kind: 'day' }, db, user, now) }
      return { mode: 'simulated', intent, proposals: [], reply: summarizeSim({ kind: 'lead', id: lead.id }, db, user, now) }
    }

    case 'propertySearch': {
      const f = parsePropertyQuery(text)
      if (!hasPropertyFilters(f)) return say('unknown', t('ai:reply.unknown'))
      const list = applyPropertyFilters(db.properties.filter((p) => p.listing === 'live' && p.status !== 'sold'), { ...f, text: undefined }).slice(0, 8)
      return {
        mode: 'simulated', intent, proposals: [], results: { kind: 'property', ids: list.map((p) => p.id) },
        reply: {
          mode: 'simulated', text: t('ai:reply.propertySearch', { count: list.length }),
          bullets: list.slice(0, 5).map((p) => `${p.title} · ${p.location.locality} · ${inrShort(p.price)}`),
          links: list.slice(0, 5).map((p) => ({ kind: 'property' as const, id: p.id })),
        },
      }
    }
  }
  return say('unknown', t('ai:reply.unknown'))
}
