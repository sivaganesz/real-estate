/**
 * Write requests of the global assistant (master prompt §12.5): each one ends in action proposals that run only after
 * the user confirms (services/commands.executeProposal). The reader checks the permission on the actual record and
 * refuses politely with the reason; it never writes.
 */
import type { Lead, LeadInput, PipelineStageKey, Task } from '@/domain/types'
import { DEFAULT_DURATION_MIN } from '@/domain/catalogue'
import { paths } from '@/app/paths'
import { can } from '@/lib/permissions'
import { configLabel, propertiesForLead } from '@/lib/matching'
import { isMatchable } from '@/lib/property'
import { previewAssignments } from '@/lib/assignment'
import { fmtDateTime, inrRange, inrShort } from '@/lib/format'
import { addDaysToDay, localDay } from '@/lib/dates'
import { phoneDisplay } from '@/lib/phone'
import { aiMeta, propose } from '../proposals'
import type { ActionProposal, CommandPlan } from '../types'
import {
  appointmentFor, assignees, first, hiddenLeadNamed, leadFor, notYoursReply, openTaskFor, propertyIn, refuse, say, t, userIn, type Env,
} from './command-kit'
import { extractAppointmentFields } from './extract-appointment'
import { extractLeadFields } from './extract-lead'
import { extractPropertyFields } from './extract-property'
import { propertyInputFrom } from './assist'
import { stageIn } from './intents'
import { readLeadUpdate } from './lead-update'
import { generateMessageSim } from './messages'
import { atLocal, dateIn, named, norm, timeIn } from './parse'
import { changeText, fieldLabelKey } from './summaries'
import { looksHinglish } from './hinglish'

const upTo = () => ({ upTo: t('domain:lead.upTo'), from: t('domain:lead.from') })
const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const whichLead = (intent: string, env: Env, found: { others?: Lead[]; notYours?: string } = {}) => found.notYours ? notYoursReply(intent, found.notYours) :
  say(intent, t('ai:reply.whichLead'), { followUps: (found.others?.length ? found.others : env.open.slice(0, 3)).map((l) => ({ label: l.name, command: `${env.text} ${l.name}` })) })

/* ---------- leads ---------- */

export function createLeadPlan(env: Env): CommandPlan {
  const intent = 'createLead'
  if (!can(env.user, 'lead.create')) return refuse(intent, 'lead.create', env.user)
  const x = extractLeadFields(env.text, { now: env.now, db: env.db })
  if (!x.fields.name && !x.fields.phone) return say(intent, t('ai:reply.leadNeedsDetails'), { nav: [{ label: 'ai:nav.newLead', to: '/leads/new' }] })
  const r = x.fields.requirement
  const summary = [
    { label: 'ai:field.name', value: x.fields.name ?? t('ai:value.missing') },
    { label: 'ai:field.phone', value: x.fields.phone ? phoneDisplay(x.fields.phone) : t('ai:value.missing') },
    // the property type when the message names one ("villa in Sarjapur"), not the apartment assumed from "3 BHK"
    ...(r?.propertyTypes.length && x.meta['requirement.propertyTypes'] && (x.meta['requirement.propertyTypes'].confidence ?? 0) >= 0.8
      ? [{ label: 'ai:field.type', value: r.propertyTypes.map((p) => t(`catalogue:propertyType.${p}`)).join(', ') }] : []),
    ...(r?.configurations.length ? [{ label: 'ai:field.configuration', value: r.configurations.map(configLabel).join(', ') }] : []),
    ...(r?.localities.length || r?.cities.length ? [{ label: 'ai:field.location', value: (r.localities.length ? r.localities : r.cities).join(', ') }] : []),
    ...(r?.budgetMax || r?.budgetMin ? [{ label: 'ai:field.budget', value: inrRange(r.budgetMin, r.budgetMax, upTo()) }] : []),
    ...(x.fields.qualification?.timeline ? [{ label: 'ai:changeField.timeline', value: t(`catalogue:timeline.${x.fields.qualification.timeline}`) }] : []),
    ...(x.fields.qualification?.decisionMakers.length ? [{ label: 'ai:changeField.decisionMakers', value: x.fields.qualification.decisionMakers.map((d) => t(`catalogue:decisionMaker.${d}`)).join(', ') }] : []),
    { label: 'ai:field.source', value: t(`catalogue:source.${x.fields.source ?? 'manual'}`) },
  ]
  const input = { ...x.fields, name: x.fields.name ?? '', source: x.fields.source ?? 'manual', fieldMeta: x.meta } as Partial<LeadInput> & Pick<LeadInput, 'name' | 'source'>
  const proposal = propose({ kind: 'createLead', permission: 'lead.create', summary, payload: { input } })
  const dup = x.duplicates?.[0] ? env.db.leads.find((l) => l.id === x.duplicates?.[0].leadId) : undefined
  const bullets = [
    ...(dup ? [t('ai:reply.duplicate', { name: dup.name })] : []),
    ...(!x.fields.name ? [t('ai:reply.nameMissing')] : []),
    ...(!x.fields.source ? [t('ai:reply.sourceAssumed')] : []),
  ]
  return {
    mode: 'simulated', intent, proposals: [proposal],
    reply: { mode: 'simulated', text: t('ai:reply.createLead', { count: x.filledCount }), bullets: bullets.length ? bullets : undefined, links: dup ? [{ kind: 'lead', id: dup.id }] : undefined },
  }
}

/** "Add property 2.5BHK 1200 sqft east facing in Kondapur 85 L ready to move, owner Ramesh 98450 12345". */
export function createPropertyPlan(env: Env): CommandPlan {
  const intent = 'createProperty'
  if (!can(env.user, 'property.create')) return refuse(intent, 'property.create', env.user)
  const text = env.text.replace(/^(?:please |pls )?(?:add|create|list|post|save|enter|register|new)\s+(?:a |an |this |my |the |new )*(?:property|listing)\b[:,-]?\s*/i, '')
  const x = extractPropertyFields(text, { now: env.now })
  const input = propertyInputFrom(x)
  const nav = [{ label: 'ai:nav.newProperty', to: paths.newProperty() }]
  if (!input) {
    const missing = x.missing.length ? x.missing : ['location']
    return say(intent, t('ai:reply.propertyNeedsDetails', { fields: missing.map((m) => t(`ai:missingField.${m}`)).join(', ') }), { nav })
  }
  const area = input.area.carpet ?? input.area.builtUp ?? input.area.superBuiltUp ?? input.area.plot
  const summary = [
    ...(input.title ? [{ label: 'ai:field.title', value: input.title }] : []),
    { label: 'ai:field.type', value: t(`catalogue:propertyType.${input.type}`) },
    { label: 'ai:field.location', value: [input.location.locality, input.location.city].filter(Boolean).join(', ') },
    { label: 'ai:changeField.price', value: inrShort(input.price) },
    ...(area ? [{ label: 'ai:changeField.area', value: `${area.toLocaleString('en-IN')} sq ft` }] : []),
    ...(input.facing ? [{ label: 'ai:changeField.facing', value: t(`catalogue:facing.${input.facing}`) }] : []),
    ...(input.possession ? [{ label: 'ai:changeField.possession', value: t(`catalogue:possession.${input.possession.status}`) }] : []),
  ]
  const proposal = propose({ kind: 'createProperty', permission: 'property.create', summary, payload: { input: { ...input, fieldMeta: x.meta } as unknown as Record<string, unknown> } })
  return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.createProperty', { count: x.filledCount }) } }
}

/** "Called Priya, no answer, try tomorrow", "Karthik's budget is now 2 Cr", "Rahul wants 4BHK now, wife will decide". */
export function updateLeadPlan(env: Env, opts: { leadId?: string } = {}): CommandPlan {
  const intent = 'updateLead'
  const found = opts.leadId ? { lead: env.leads.find((l) => l.id === opts.leadId), others: [] } : leadFor(env.text, env)
  const lead = found.lead
  if (!lead) return whichLead(intent, env, found)
  if (!can(env.user, 'lead.edit', lead, env.db)) return refuse(intent, 'lead.edit', env.user)
  // the lead's own name must not be read as a place or a decision maker
  const text = norm(env.text).replace(new RegExp(lead.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ')
  const r = readLeadUpdate(text, lead, { now: env.now })
  // the name was blanked out above: "Called  , he wants…" → "Called, he wants…"
  const tidy = (s: string) => s.replace(/\s+([,.;:!?])/g, '$1').replace(/\s{2,}/g, ' ').replace(/^[\s,.;:-]+/, '').trim()
  if (r.contact?.text) r.contact.text = tidy(r.contact.text)
  if (r.note) r.note = tidy(r.note)
  const proposals: ActionProposal[] = []
  const target = [{ kind: 'lead' as const, id: lead.id }]
  if (r.contact) {
    proposals.push(propose({
      kind: 'logActivity', permission: 'lead.edit', targets: target,
      summary: [
        { label: 'ai:field.lead', value: lead.name },
        { label: 'ai:field.channel', value: t(`ai:channel.${r.contact.channel}`) },
        ...(r.contact.result ? [{ label: 'ai:field.result', value: t(`ai:callResult.${r.contact.result}`) }] : []),
        { label: 'ai:field.note', value: r.contact.text },
      ],
      payload: { leadId: lead.id, channel: r.contact.channel, text: r.contact.text, result: r.contact.result },
    }))
  }
  if (r.changes.length) {
    proposals.push(propose({
      kind: 'updateLead', permission: 'lead.edit', targets: target,
      summary: [{ label: 'ai:field.lead', value: lead.name }, ...r.changes.map((c) => ({ label: fieldLabelKey(c.field), value: changeText(c.field, c.from, c.to) }))],
      payload: { leadId: lead.id, patch: r.patch, fieldMeta: aiMeta(r.patch) },
    }))
  }
  if (r.lost) {
    proposals.push(propose({
      kind: 'moveStage', permission: 'lead.moveStage', targets: target,
      summary: [
        { label: 'ai:field.lead', value: lead.name },
        { label: 'ai:field.from', value: t(`catalogue:stage.${lead.stage}`) },
        { label: 'ai:field.to', value: t('catalogue:stage.lost') },
        { label: 'ai:field.reason', value: t(`catalogue:lostReason.${r.lost}`) },
      ],
      payload: { leadId: lead.id, to: 'lost', lostReason: r.lost },
    }))
  }
  if (r.followUp) {
    const dueAt = atLocal(r.followUp.day, r.followUp.time ?? '10:00')
    const title = t(`ai:taskTitle.${r.followUp.type}`, { name: lead.name })
    proposals.push(propose({
      kind: 'createTask', permission: 'task.manage', targets: target,
      summary: [{ label: 'ai:field.title', value: title }, { label: 'ai:field.due', value: fmtDateTime(dueAt) }],
      payload: { input: { title, type: r.followUp.type, ownerId: lead.ownerId ?? env.user.id, dueAt, leadId: lead.id, origin: 'ai' } },
    }))
  }
  if (r.note) {
    proposals.push(propose({
      kind: 'logActivity', permission: 'lead.edit', targets: target,
      summary: [{ label: 'ai:field.lead', value: lead.name }, { label: 'ai:field.note', value: r.note }],
      payload: { leadId: lead.id, channel: 'note', text: r.note },
    }))
  }
  if (!proposals.length) return say(intent, t('ai:reply.noChange', { name: lead.name }), { links: target })
  return {
    mode: 'simulated', intent, proposals,
    reply: {
      mode: 'simulated', text: t('ai:reply.updateLead', { name: lead.name, count: proposals.length }), links: target,
      bullets: r.contact?.result === 'notReachable' || r.contact?.result === 'busy' ? [t('ai:reply.retryAuto')] : undefined,
    },
  }
}

export function moveStagePlan(env: Env): CommandPlan {
  const intent = 'moveStage'
  const { lead, others, notYours } = leadFor(env.text.split(/\b(?:to|as|into)\b/i)[0], env)
  const to = stageIn(env.text)
  if (!lead) return whichLead(intent, env, { others, notYours })
  if (!to) return say(intent, t('ai:reply.whichStage'), { followUps: (['contacted', 'qualified', 'negotiation', 'lost'] as PipelineStageKey[]).map((s) => ({ label: t(`catalogue:stage.${s}`), command: `Move ${lead.name} to ${s}` })) })
  const action = to === 'booked' || to === 'converted' ? 'lead.markBooked' : 'lead.moveStage'
  if (!can(env.user, action, lead, env.db)) return refuse(intent, action, env.user)
  if (to === lead.stage) return say(intent, t('ai:reply.alreadyInStage', { name: lead.name, stage: t(`catalogue:stage.${to}`) }), { links: [{ kind: 'lead', id: lead.id }] })
  if (to === 'booked' || to === 'converted') return say(intent, t('ai:reply.bookingNeedsDialog', { name: lead.name }), { links: [{ kind: 'lead', id: lead.id }] })
  const s = env.s
  const lostReason = to === 'lost'
    ? /budget|expensive|costly/.test(s) ? 'budgetMismatch' as const : /bought|elsewhere|another/.test(s) ? 'boughtElsewhere' as const : /not respond|no response|unreachable/.test(s) ? 'notResponding' as const : /location|far/.test(s) ? 'location' as const : /loan/.test(s) ? 'loanRejected' as const : 'other' as const
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

/* ---------- appointments and follow-ups ---------- */

export function createAppointmentPlan(env: Env): CommandPlan {
  const intent = 'createAppointment'
  // another executive's lead named on a lead page is never replaced by the open lead
  const hidden = hiddenLeadNamed(env.text, env)
  if (!can(env.user, 'appointment.manage')) return refuse(intent, 'appointment.manage', env.user)
  const x = extractAppointmentFields(env.text, {
    now: env.now, leads: env.leads, properties: env.db.properties.filter((p) => p.listing === 'live'), selectedLeadId: hidden ? undefined : env.selLead?.id,
  })
  const lead = env.leads.find((l) => l.id === x.fields.leadId)
  if (!lead) return whichLead(intent, env, { notYours: hidden })
  const ownerId = lead.ownerId ?? env.user.id
  if (!can(env.user, 'appointment.manage', { ownerId }, env.db)) return refuse(intent, 'appointment.manage', env.user)
  const type = x.fields.type ?? 'siteVisit'
  const day = x.date ?? addDaysToDay(env.today, 1)
  const time = x.time ?? '11:00'
  const start = atLocal(day, time)
  const props = (x.fields.propertyIds ?? []).map((id) => env.db.properties.find((p) => p.id === id)).filter((p) => !!p)
  const owner = env.db.users.find((u) => u.id === ownerId)
  const clash = env.db.appointments.find((a) => a.ownerId === ownerId && (a.status === 'scheduled' || a.status === 'confirmed')
    && Math.abs(new Date(a.start).getTime() - new Date(start).getTime()) < Math.max(a.durationMin, 30) * 60_000)
  const proposal = propose({
    kind: 'createAppointment', permission: 'appointment.manage', targets: [{ kind: 'lead', id: lead.id }],
    summary: [
      { label: 'ai:field.type', value: t(`catalogue:appointmentType.${type}`) },
      { label: 'ai:field.lead', value: lead.name },
      { label: 'ai:field.when', value: fmtDateTime(start) },
      ...(props.length ? [{ label: 'ai:field.property', value: props.map((p) => p.title).join(', ') }] : []),
      { label: 'ai:field.owner', value: owner?.name ?? '' },
    ],
    payload: { input: { type, leadId: lead.id, ownerId, start, durationMin: x.fields.durationMin ?? DEFAULT_DURATION_MIN[type], propertyIds: x.fields.propertyIds ?? [], location: x.fields.location, notes: x.fields.notes } },
  })
  const bullets = [
    ...(!x.date ? [t('ai:reply.assumedDate')] : []),
    ...(!x.time ? [t('ai:reply.assumedTime')] : []),
    ...(type === 'siteVisit' && !props.length ? [t('ai:reply.noPropertyYet')] : []),
    ...(clash ? [t('ai:reply.clash', { when: fmtDateTime(clash.start) })] : []),
  ]
  return {
    mode: 'simulated', intent, proposals: [proposal],
    reply: { mode: 'simulated', text: t('ai:reply.createAppointment', { name: lead.name }), bullets: bullets.length ? bullets : undefined },
    followUps: [{ label: t('ai:followUp.draftConfirm', { name: first(lead.name) }), command: `Draft visit confirmation for ${lead.name}` }],
  }
}

export function createTaskPlan(env: Env): CommandPlan {
  const intent = 'createTask'
  if (!can(env.user, 'task.manage')) return refuse(intent, 'task.manage', env.user)
  const { lead, notYours } = leadFor(env.text, env)
  if (!lead && notYours) return notYoursReply(intent, notYours)
  const day = dateIn(env.text, env.today) ?? addDaysToDay(env.today, 1)
  const dueAt = atLocal(day, timeIn(env.text) ?? '10:00')
  const s = env.s
  const type: Task['type'] = /\bwhats ?app\b/.test(s) ? 'whatsapp' : /\b(call|ring|phone)\b/.test(s) ? 'call' : /\b(e-?mail|mail)\b/.test(s) ? 'email' : /\b(document|docs|papers|kyc)\b/.test(s) ? 'document' : 'followUp'
  const custom = norm(env.text)
    .replace(/^(?:please\s+)?(?:remind me to|reminder to|remind me|(?:create|add|make|new|set) (?:a |an |new )*(?:task|to-?do|reminder)(?: to)?|task|todo|to-do|schedule (?:a )?follow[- ]?up(?: with)?|set (?:a )?follow[- ]?up(?: with)?|add (?:a )?follow[- ]?up(?: with)?|plan (?:a )?follow[- ]?up(?: with)?)\s*[:\-–]?\s*/i, '')
    .replace(/\b(?:tomorrow|today|day after tomorrow|next week|on \w+day|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi, '')
    .replace(/\s{2,}/g, ' ').trim()
  const title = lead && (custom.split(/\s+/).length <= 3 || !custom) ? t(`ai:taskTitle.${type === 'document' ? 'followUp' : type}`, { name: lead.name }) : (custom.charAt(0).toUpperCase() + custom.slice(1)).slice(0, 80)
  if (!title) return say(intent, t('ai:reply.taskNeedsTitle'))
  const ownerId = lead?.ownerId ?? env.user.id
  if (!can(env.user, 'task.manage', { ownerId }, env.db)) return refuse(intent, 'task.manage', env.user)
  const proposal = propose({
    kind: 'createTask', permission: 'task.manage', targets: lead ? [{ kind: 'lead', id: lead.id }] : undefined,
    summary: [
      { label: 'ai:field.title', value: title },
      { label: 'ai:field.type', value: t(`catalogue:taskType.${type}`) },
      { label: 'ai:field.due', value: fmtDateTime(dueAt) },
      ...(lead ? [{ label: 'ai:field.lead', value: lead.name }] : []),
    ],
    payload: { input: { title, type, ownerId, dueAt, leadId: lead?.id, origin: 'ai' } },
  })
  const bullets = [...(!dateIn(env.text, env.today) ? [t('ai:reply.assumedTaskDate')] : [])]
  return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.createTask'), bullets: bullets.length ? bullets : undefined } }
}

/** "Reschedule Priya's follow-up to tomorrow 5 PM", "move my 11 AM visit to Saturday", "postpone Karthik's call by 2 days". */
export function reschedulePlan(env: Env): CommandPlan {
  const intent = 'reschedule'
  const [head, tail = ''] = env.text.split(/\b(?:to|till|until|for|on)\b(?!.*\b(?:to|till|until|for|on)\b)/i)
  const { lead, notYours } = leadFor(head, env)
  if (!lead && notYours) return notYoursReply(intent, notYours)
  const wantsVisit = /\b(visit|site visit|meeting|appointment|video call|my \d)/.test(env.s)
  const appt = wantsVisit ? appointmentFor(env, lead) : undefined
  const task = !appt && lead ? openTaskFor(env, lead) : undefined
  if (!appt && !task) {
    if (!lead) return whichLead(intent, env)
    return say(intent, t(wantsVisit ? 'ai:reply.noUpcomingVisit' : 'ai:reply.noOpenTask', { name: lead.name }), { links: [{ kind: 'lead', id: lead.id }] })
  }
  const shift = /\bby (\d{1,2}) days?\b/.exec(env.s)
  const current = appt?.start ?? task!.dueAt
  const newDay = shift ? addDaysToDay(localDay(current), Number(shift[1])) : dateIn(tail || env.text, env.today) ?? localDay(current)
  const newTime = timeIn(tail) ?? (shift ? undefined : timeIn(env.text.replace(/\bmy\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, ''))) ?? hhmm(current)
  const when = atLocal(newDay, newTime)
  if (when === current) return say(intent, t('ai:reply.whichTime'))
  if (appt) {
    if (!can(env.user, 'appointment.manage', appt, env.db)) return refuse(intent, 'appointment.manage', env.user)
    const name = env.db.leads.find((l) => l.id === appt.leadId)?.name ?? ''
    const proposal = propose({
      kind: 'rescheduleAppointment', permission: 'appointment.manage', targets: [{ kind: 'appointment', id: appt.id }],
      summary: [
        { label: 'ai:field.type', value: t(`catalogue:appointmentType.${appt.type}`) },
        { label: 'ai:field.lead', value: name },
        { label: 'ai:field.from', value: fmtDateTime(appt.start) },
        { label: 'ai:field.to', value: fmtDateTime(when) },
      ],
      payload: { appointmentId: appt.id, start: when },
    })
    return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.rescheduleAppointment', { name }) } }
  }
  const tk = task!
  if (!can(env.user, 'task.manage', tk, env.db)) return refuse(intent, 'task.manage', env.user)
  const proposal = propose({
    kind: 'rescheduleTask', permission: 'task.manage', targets: [{ kind: 'task', id: tk.id }, ...(lead ? [{ kind: 'lead' as const, id: lead.id }] : [])],
    summary: [
      { label: 'ai:field.title', value: tk.title },
      { label: 'ai:field.from', value: fmtDateTime(tk.dueAt) },
      { label: 'ai:field.to', value: fmtDateTime(when) },
    ],
    payload: { taskId: tk.id, dueAt: when },
  })
  return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.rescheduleTask', { name: lead?.name ?? '' }) } }
}

export function completeTaskPlan(env: Env): CommandPlan {
  const intent = 'completeTask'
  const { lead, others, notYours } = leadFor(env.text, env)
  if (!lead) return whichLead(intent, env, { others, notYours })
  const task = openTaskFor(env, lead)
  if (!task) return say(intent, t('ai:reply.noOpenTask', { name: lead.name }), { links: [{ kind: 'lead', id: lead.id }] })
  if (!can(env.user, 'task.manage', task, env.db)) return refuse(intent, 'task.manage', env.user)
  const s = env.s
  const callResult: Task['callResult'] | undefined = task.type !== 'call' ? undefined
    : /\b(no answer|not reachable|didn'?t pick|switched off)\b/.test(s) ? 'notReachable' : /\bbusy\b/.test(s) ? 'busy' : /\bwrong number\b/.test(s) ? 'wrongNumber' : 'connected'
  const proposal = propose({
    kind: 'completeTask', permission: 'task.manage', targets: [{ kind: 'task', id: task.id }, { kind: 'lead', id: lead.id }],
    summary: [
      { label: 'ai:field.title', value: task.title },
      { label: 'ai:field.due', value: fmtDateTime(task.dueAt) },
      ...(callResult ? [{ label: 'ai:field.result', value: t(`ai:callResult.${callResult}`) }] : []),
    ],
    payload: { taskId: task.id, callResult },
  })
  return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.completeTask', { name: lead.name }) } }
}

/* ---------- assignment ---------- */

const TO_SPLIT = /(?:\bto\b|→|->|=>)(?!.*(?:\bto\b|→|->|=>))/i

export function assignLeadPlan(env: Env): CommandPlan {
  const intent = 'assignLead'
  if (!can(env.user, 'lead.assign')) {
    const { lead } = leadFor(env.text.split(TO_SPLIT)[0], env)
    const alt = lead && can(env.user, 'lead.requestReassign', lead, env.db)
      ? { text: t('ai:reply.requestInstead'), label: t('ai:followUp.requestReassign', { name: first(lead.name) }), command: `Request reassignment of ${lead.name}` }
      : undefined
    return refuse(intent, 'lead.assign', env.user, alt)
  }
  const [leadPart, toPart = ''] = norm(env.text).split(TO_SPLIT)
  const { lead, others, notYours } = leadFor(leadPart.replace(/\b(lead|leads|enquiry)\b/gi, ' '), env)
  const people = assignees(env)
  const target = userIn(toPart, people)
  if (!lead) return whichLead(intent, env, { others, notYours })
  if (!can(env.user, 'lead.assign', lead, env.db)) return refuse(intent, 'lead.assign', env.user)
  const auto = /\b(auto|anyone|best|whoever|least busy|lowest)\b/i.test(toPart)
  if (!target && !auto) {
    const outside = named(toPart, env.db.users.filter((u) => u.role === 'executive'))[0]
    if (outside) return say(intent, t(outside.status !== 'active' ? 'ai:reply.userInactive' : 'ai:reply.notInTeam', { name: outside.name }))
    return say(intent, t('ai:reply.whichExecutive'), { followUps: people.slice(0, 3).map((u) => ({ label: u.name, command: `Assign ${lead.name} to ${u.name}` })) })
  }
  if (target && target.id === lead.ownerId) return say(intent, t('ai:reply.alreadyOwner', { name: lead.name, owner: target.name }), { links: [{ kind: 'lead', id: lead.id }] })
  const preview = !target ? previewAssignments(env.db, [lead.id], env.user.role === 'manager' ? env.user.id : undefined)[0] : undefined
  const autoName = preview?.to ? env.db.users.find((u) => u.id === preview.to)?.name : undefined
  const proposal = propose({
    kind: 'assignLead', permission: 'lead.assign', targets: [{ kind: 'lead', id: lead.id }],
    summary: [
      { label: 'ai:field.lead', value: lead.name },
      { label: 'ai:field.from', value: env.db.users.find((u) => u.id === lead.ownerId)?.name ?? t('ai:value.unassigned') },
      { label: 'ai:field.to', value: target?.name ?? (autoName ? t('ai:value.autoWho', { name: autoName }) : t('ai:value.auto')) },
    ],
    payload: { leadId: lead.id, to: target?.id ?? 'auto' },
  })
  const bullets = target?.availability === 'onLeave' ? [t('ai:reply.targetOnLeave', { name: target.name })] : undefined
  return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.assignLead', { name: lead.name }), bullets } }
}

function bulkProposal(env: Env, ids: string[], to: string | 'auto', reasonLabel: string): { proposal: ReturnType<typeof propose<'assignLeads'>>; bullets: string[] } {
  const preview = to === 'auto' ? previewAssignments(env.db, ids, env.user.role === 'manager' ? env.user.id : undefined) : ids.map((leadId) => ({ leadId, to, reasonKey: 'manual' as const }))
  const byUser = new Map<string, number>()
  for (const p of preview) byUser.set(p.to ?? '', (byUser.get(p.to ?? '') ?? 0) + 1)
  const bullets = [...byUser.entries()].map(([uid, n]) => t('ai:reply.previewRow', { name: env.db.users.find((u) => u.id === uid)?.name ?? t('ai:value.unassigned'), count: n }))
  const toUser = to !== 'auto' ? env.db.users.find((u) => u.id === to) : undefined
  const proposal = propose({
    kind: 'assignLeads', permission: 'lead.assign', targets: ids.slice(0, 8).map((id) => ({ kind: 'lead' as const, id })),
    summary: [
      { label: 'ai:field.leads', value: t('ai:value.leadCount', { count: ids.length }) },
      { label: 'ai:field.which', value: reasonLabel },
      { label: 'ai:field.to', value: toUser?.name ?? t('ai:value.auto') },
    ],
    payload: { leadIds: ids, to },
  })
  return { proposal, bullets }
}

/** "Assign new leads", "auto-assign all unassigned leads", "assign today's new leads to Sneha". */
export function bulkAssignPlan(env: Env): CommandPlan {
  const intent = 'bulkAssign'
  if (!can(env.user, 'lead.assign')) return refuse(intent, 'lead.assign', env.user)
  const ids = env.open.filter((l) => l.ownerId === null && can(env.user, 'lead.assign', l, env.db)).map((l) => l.id)
  if (!ids.length) return say(intent, t('ai:reply.noUnassigned'))
  const toPart = TO_SPLIT.test(env.text) ? env.text.split(TO_SPLIT)[1] : ''
  const target = toPart ? userIn(toPart, assignees(env)) : undefined
  const { proposal, bullets } = bulkProposal(env, ids, target?.id ?? 'auto', t('ai:value.unassignedLeads'))
  return {
    mode: 'simulated', intent, proposals: [proposal], results: { kind: 'lead', ids },
    reply: { mode: 'simulated', text: t('ai:reply.bulkAssign', { count: ids.length }), bullets },
  }
}

/** "Reassign Arjun's leads, he's on leave", "redistribute Farhan's open leads to Sneha". */
export function reassignFromPlan(env: Env): CommandPlan {
  const intent = 'reassignFrom'
  if (!can(env.user, 'lead.assign')) return refuse(intent, 'lead.assign', env.user)
  const execs = env.db.users.filter((u) => u.role === 'executive' && (env.user.role === 'admin' || u.managerId === env.user.id))
  const [fromPart, toPart = ''] = TO_SPLIT.test(env.text) ? env.text.split(TO_SPLIT) : [env.text, '']
  const from = userIn(fromPart, execs)
  if (!from) return say(intent, t('ai:reply.whichExecutiveFrom'), { followUps: execs.filter((u) => u.status === 'active').slice(0, 3).map((u) => ({ label: u.name, command: `Reassign ${u.name}'s leads` })) })
  const ids = env.open.filter((l) => l.ownerId === from.id && can(env.user, 'lead.assign', l, env.db)).map((l) => l.id)
  if (!ids.length) return say(intent, t('ai:reply.noLeadsOwned', { name: from.name }))
  const target = toPart ? userIn(toPart, assignees(env).filter((u) => u.id !== from.id)) : undefined
  const { proposal, bullets } = bulkProposal(env, ids, target?.id ?? 'auto', t('ai:value.leadsOf', { name: from.name }))
  const note = from.availability === 'onLeave' ? [t('ai:reply.fromOnLeave', { name: from.name })] : []
  return {
    mode: 'simulated', intent, proposals: [proposal], results: { kind: 'lead', ids },
    reply: { mode: 'simulated', text: t('ai:reply.reassignFrom', { name: from.name, count: ids.length }), bullets: [...note, ...bullets] },
  }
}

export function requestReassignPlan(env: Env): CommandPlan {
  const intent = 'requestReassign'
  const { lead, others, notYours } = leadFor(env.text.replace(/\b(request|reassign(?:ment)?|transfer|of|for)\b/gi, ' '), env)
  if (!lead) return whichLead(intent, env, { others, notYours })
  if (can(env.user, 'lead.assign', lead, env.db)) return assignLeadPlan({ ...env, text: `Assign ${lead.name} to auto`, s: `assign ${lead.name.toLowerCase()} to auto` })
  if (!can(env.user, 'lead.requestReassign', lead, env.db)) return refuse(intent, 'lead.requestReassign', env.user)
  const note = /\b(?:because|as|since|reason)\b(.+)$/i.exec(env.text)?.[1]?.trim()
  const proposal = propose({
    kind: 'requestReassign', permission: 'lead.requestReassign', targets: [{ kind: 'lead', id: lead.id }],
    summary: [{ label: 'ai:field.lead', value: lead.name }, ...(note ? [{ label: 'ai:field.note', value: note }] : [])],
    payload: { leadId: lead.id, note },
  })
  return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.requestReassign', { name: lead.name }) } }
}

/* ---------- sharing and messages ---------- */

export function sharePlan(env: Env, shortlistOnly = false): CommandPlan {
  const intent = shortlistOnly ? 'shortlist' : 'shareProperties'
  const parts = env.text.split(/\b(?:with|to|for)\b/i)
  const { lead, others, notYours } = leadFor(parts.length > 1 ? parts.slice(1).join(' ') : env.text, env)
  if (!lead) return whichLead(intent, env, { others, notYours })
  if (!can(env.user, 'lead.edit', lead, env.db)) return refuse(intent, 'lead.edit', env.user)
  const named1 = propertyIn(parts[0], env) ?? env.selProperty
  const n = Number(/\b(?:top|best|first)\s+(\d)\b/.exec(env.s)?.[1] ?? 3)
  const props = named1 ? [named1] : propertiesForLead(lead, env.db.properties, env.db.settings, env.now, { limit: n }).map((m) => m.property)
  const live = props.filter((p) => isMatchable(p))
  if (!live.length) return say(intent, t(named1 ? 'ai:reply.propertyNotAvailable' : 'ai:reply.noMatches', { name: named1?.title ?? lead.name }), { links: [{ kind: 'lead', id: lead.id }] })
  if (shortlistOnly) {
    const proposals = live.map((p) => propose({
      kind: 'shortlistProperty', permission: 'lead.edit', targets: [{ kind: 'lead', id: lead.id }, { kind: 'property', id: p.id }],
      summary: [{ label: 'ai:field.lead', value: lead.name }, { label: 'ai:field.property', value: `${p.title} · ${inrShort(p.price)}` }],
      payload: { leadId: lead.id, propertyId: p.id },
    }))
    return { mode: 'simulated', intent, proposals, reply: { mode: 'simulated', text: t('ai:reply.shortlist', { name: lead.name, count: proposals.length }) } }
  }
  const proposal = propose({
    kind: 'shareProperties', permission: 'lead.edit', targets: [{ kind: 'lead', id: lead.id }, ...live.map((p) => ({ kind: 'property' as const, id: p.id }))],
    summary: [
      { label: 'ai:field.lead', value: lead.name },
      { label: 'ai:field.properties', value: live.map((p) => `${p.title} · ${inrShort(p.price)}`).join('\n') },
      { label: 'ai:field.channel', value: t('ai:channel.whatsapp') },
    ],
    payload: { leadId: lead.id, propertyIds: live.map((p) => p.id) },
  })
  return { mode: 'simulated', intent, proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.share', { name: lead.name, count: live.length }), bullets: [t('ai:reply.shareOpensWhatsApp')] } }
}

/** "Draft visit confirmation for my 11 AM", "WhatsApp Priya a follow-up in Hinglish", "write an intro message to Karthik". */
export function draftMessagePlan(env: Env): CommandPlan {
  const intent = 'draftMessage'
  const appt = appointmentFor(env)
  const found = leadFor(env.text, env)
  const lead = found.lead ?? (appt?.leadId && !found.notYours ? env.leads.find((l) => l.id === appt.leadId) : undefined)
  if (!lead) return whichLead(intent, env, found)
  const s = env.s
  const purpose = /\bconfirm/.test(s) ? 'visitConfirm' as const : /\b(after (?:the )?visit|post[- ]visit|thank)/.test(s) ? 'postVisit' as const
    : /\breminder|remind\b/.test(s) ? 'reminder' as const : /\b(offer|price|counter|negotiat)/.test(s) ? 'offer' as const
      : /\b(intro|introduc|first message|welcome|hello)/.test(s) ? 'intro' as const : 'followUp' as const
  const channel = /\b(sms|text message)\b/.test(s) ? 'sms' as const : /\b(e-?mail|mail)\b/.test(s) ? 'email' as const : 'whatsapp' as const
  const tone = /\b(hinglish|hindi)\b/.test(s) || looksHinglish(env.raw) ? 'hinglish' as const : 'english' as const
  const leadAppt = appt?.leadId === lead.id ? appt : appointmentFor(env, lead)
  const msg = generateMessageSim({ leadId: lead.id, purpose, channel, tone, appointmentId: leadAppt?.id }, env.db, env.user)
  return {
    mode: 'simulated', intent, proposals: [],
    reply: { mode: 'simulated', text: t('ai:reply.draft', { name: lead.name, purpose: t(`catalogue:messagePurpose.${purpose}`) }), links: [{ kind: 'lead', id: lead.id }] },
    draft: { leadId: lead.id, channel, purpose, tone, text: msg.text },
    followUps: tone === 'english'
      ? [{ label: t('ai:followUp.hinglish'), command: `Draft ${purpose === 'visitConfirm' ? 'visit confirmation' : purpose} message for ${lead.name} in Hinglish` }]
      : [{ label: t('ai:followUp.english'), command: `Draft ${purpose === 'visitConfirm' ? 'visit confirmation' : purpose} message for ${lead.name}` }],
  }
}
