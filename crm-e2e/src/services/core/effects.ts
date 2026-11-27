/**
 * Side effects of domain events: the interconnections of master prompt §7 (foundation-plan §5.3, E1–E18).
 * Everything runs inside the commit's draft, so a change and all its consequences land together (one undo, one render).
 *
 *  E1  every event → an Activity (activityFor)
 *  E2  lead.created → owner (self / chosen / auto-assign), duplicate alert
 *  E3  lead.assigned → assignment record, move open tasks + future appointments, notify, first-call task, round-robin cursor
 *  E4  lead.contacted → last/first contact, new → contacted, responded, no-answer retry task
 *  E5  lead.stageChanged → stage history; lost cancels work; booked books the property + client + docs task; converted sells
 *  E6  appointment.created → site visit moves the stage and shortlists; notify the owner
 *  E7  appointment.completed → visited / liked, post-visit call, ready-to-book alert
 *  E8  appointment.noShow / cancelled → reschedule task
 *  E9  appointment.rescheduled → notify the owner
 *  E10 task.completed → lead.contacted
 *  E11 lead.shared → shortlist shared + contacted
 *  E12 property.statusChanged → booked / sold / on hold: tell other interested leads' owners
 *  E13 property.deleted → cascade on shortlists, deals and site visits
 *  E14 user.deactivated → redistribute open leads, drop from rules, alert admins
 *  E15 user.availabilityChanged → on leave: ask the manager to reassign
 *  E16 import.completed → notify importer and admins (assignment notices batched)
 *  E17 client.created → link on the lead
 *  E18 settings.changed → audit activity (E1)
 */
import type { Draft } from 'immer'
import type {
  Activity, ActivityKind, Appointment, AssignmentMode, AssignmentReasonKey, Client, EntityRef, ID, Lead, Notification, NotificationKind,
  PipelineStageKey, Property, PropertyStatus, Task,
} from '@/domain/types'
import { OPEN_STAGES, STAGE_RANK, UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { pickAssignee } from '@/lib/assignment'
import { addMinutesIso, clockTime, localAt, localDay, retrySlot } from '@/lib/dates'
import { findDuplicates } from '@/lib/duplicates'
import { upsertShortlist } from '@/lib/matching'
import { isSystem } from './actor'
import type { Tx } from './commit'
import type { DomainEvent, EventOf } from './events'

type D<T> = Draft<T>

/* ---------- small helpers (also used by services) ---------- */

export const actorId = (tx: Tx) => tx.actor.id
export const leadOf = (tx: Tx, id: ID | undefined): D<Lead> | undefined => (id ? tx.db.leads.find((l) => l.id === id) : undefined)
export const propertyOf = (tx: Tx, id: ID | undefined): D<Property> | undefined => (id ? tx.db.properties.find((p) => p.id === id) : undefined)
export const appointmentOf = (tx: Tx, id: ID): D<Appointment> | undefined => tx.db.appointments.find((a) => a.id === id)
export const taskOf = (tx: Tx, id: ID): D<Task> | undefined => tx.db.tasks.find((t) => t.id === id)
export const userName = (tx: Tx, id: ID | null | undefined) => (id ? tx.db.users.find((u) => u.id === id)?.name ?? '' : '')
const isOpen = (l: Pick<Lead, 'stage'>) => OPEN_STAGES.includes(l.stage)
const isUpcoming = (a: Pick<Appointment, 'status' | 'start'>, nowIso: string) => UPCOMING_APPOINTMENT_STATUSES.includes(a.status) && a.start >= nowIso

/** The manager of a user (executives), else every active manager. */
export function managersFor(tx: Tx, userId: ID | null | undefined): ID[] {
  const u = userId ? tx.db.users.find((x) => x.id === userId) : undefined
  if (u?.managerId) return [u.managerId]
  return tx.db.users.filter((x) => x.role === 'manager' && x.status === 'active').map((x) => x.id)
}
export const adminIds = (tx: Tx) => tx.db.users.filter((u) => u.role === 'admin' && u.status === 'active').map((u) => u.id)

export function appendActivity(tx: Tx, a: Omit<Activity, 'id' | 'at' | 'actorId' | 'via'> & Partial<Pick<Activity, 'at' | 'actorId' | 'via'>>): ID {
  const id = tx.id('ACT')
  tx.db.activities.push({ id, at: a.at ?? tx.now, actorId: a.actorId ?? actorId(tx), via: a.via ?? tx.via, kind: a.kind, refs: a.refs, params: a.params, text: a.text })
  return id
}

/** Adds a notification unless one with the same dedupeKey exists, or the recipient is missing or deactivated. */
export function notify(
  tx: Tx, userId: ID | null | undefined, kind: NotificationKind, params: Notification['params'],
  opts: { ref?: EntityRef; priority?: Notification['priority']; dedupeKey?: string } = {},
): ID | undefined {
  if (!userId) return undefined
  const user = tx.db.users.find((u) => u.id === userId)
  if (!user || user.status !== 'active') return undefined
  if (opts.dedupeKey && tx.db.notifications.some((n) => n.dedupeKey === opts.dedupeKey && n.userId === userId)) return undefined
  const id = tx.id('NTF')
  tx.db.notifications.push({ id, userId, kind, at: tx.now, params, ref: opts.ref, priority: opts.priority ?? 'normal', dedupeKey: opts.dedupeKey })
  return id
}

export type NewTask = Pick<Task, 'title' | 'type' | 'ownerId' | 'dueAt'> & Partial<Omit<Task, 'id' | 'status' | 'createdAt'>>
/** Creates an open task and emits task.created. */
export function addTask(tx: Tx, t: NewTask): ID {
  const id = tx.id('TSK')
  const origin = t.origin ?? tx.via
  tx.db.tasks.push({
    id, title: t.title, type: t.type, status: 'open', priority: t.priority ?? 'medium',
    leadId: t.leadId, clientId: t.clientId, appointmentId: t.appointmentId, ownerId: t.ownerId, dueAt: t.dueAt,
    createdBy: t.createdBy ?? actorId(tx), createdAt: tx.now, origin, autoReason: t.autoReason, notes: t.notes,
  })
  tx.emit({ type: 'task.created', id, via: origin })
  return id
}

/** Moves a lead to a stage (no-op when already there) and emits lead.stageChanged; E5 records the history. */
export function moveStage(tx: Tx, lead: D<Lead>, to: PipelineStageKey): void {
  if (lead.stage === to) return
  const from = lead.stage
  lead.stage = to
  lead.updatedAt = tx.now
  tx.emit({ type: 'lead.stageChanged', leadId: lead.id, from, to })
}

/** Forward-only automatic move (never backwards, never out of a closed stage). */
export function advanceStage(tx: Tx, lead: D<Lead>, to: PipelineStageKey): void {
  if (!isOpen(lead) || STAGE_RANK[lead.stage] >= STAGE_RANK[to]) return
  moveStage(tx, lead, to)
}

export function setPropertyStatus(tx: Tx, p: D<Property>, to: PropertyStatus): void {
  if (p.status === to) return
  const from = p.status
  p.status = to
  p.updatedAt = tx.now
  if (to !== 'onHold') {
    p.heldUntil = undefined
    p.heldForLeadId = undefined
  }
  tx.emit({ type: 'property.statusChanged', id: p.id, from, to })
}

/**
 * Gives a lead to a user (or nobody) right away and emits lead.assigned; E3 writes the history and moves the work.
 * Setting the owner immediately lets a loop of picks see the updated workloads and round-robin cursor.
 */
export function assignNow(
  tx: Tx, lead: D<Lead>, to: ID | null, mode: AssignmentMode, reasonKey: AssignmentReasonKey,
  extra: { reasonParams?: Record<string, string | number>; workload?: Record<ID, number>; note?: string } = {},
): void {
  const from = lead.ownerId
  lead.ownerId = to
  if (mode === 'auto' && to) tx.db.settings.assignment.rrCursor = to
  tx.emit({ type: 'lead.assigned', leadId: lead.id, from, to, mode, reasonKey, ...extra })
}

/** Runs the engine for one lead (manager actors stay within their team). */
export function autoPick(tx: Tx, lead: D<Lead>, managerId?: ID) {
  return pickAssignee({ lead, users: tx.db.users, leads: tx.db.leads, settings: tx.db.settings.assignment, managerId })
}

/* ---------- E1: the activity for an event ---------- */

const leadRef = (id: ID): EntityRef => ({ kind: 'lead', id })

function activityFor(tx: Tx, e: DomainEvent): Omit<Activity, 'id' | 'at' | 'actorId' | 'via'> & { via?: Activity['via'] } | null {
  const via = e.via
  switch (e.type) {
    case 'lead.created': {
      const l = leadOf(tx, e.leadId)
      return { kind: 'lead.created', refs: [leadRef(e.leadId)], params: { name: l?.name ?? '', source: l?.source ?? '' }, via: e.via }
    }
    case 'lead.updated':
      return { kind: 'lead.updated', refs: [leadRef(e.leadId)], params: { fields: e.fields.join(','), name: leadOf(tx, e.leadId)?.name ?? '' }, via }
    case 'lead.stageChanged': {
      const l = leadOf(tx, e.leadId)
      return { kind: 'lead.stageChanged', refs: [leadRef(e.leadId)], params: { from: e.from, to: e.to, name: l?.name ?? '' }, text: e.to === 'lost' ? l?.lost?.note : undefined, via }
    }
    case 'lead.assigned':
      return {
        kind: e.from ? 'lead.reassigned' : 'lead.assigned', refs: [leadRef(e.leadId), ...(e.to ? [{ kind: 'user' as const, id: e.to }] : [])],
        params: { to: userName(tx, e.to), from: userName(tx, e.from), reason: e.reasonKey, mode: e.mode }, text: e.note,
        via: via ?? (e.mode === 'auto' || e.mode === 'redistribution' ? 'automation' : undefined),
      }
    case 'lead.deleted':
      return { kind: 'lead.deleted', refs: [leadRef(e.lead.id)], params: { name: e.lead.name }, via }
    case 'lead.contacted':
      if (e.silent) return null
      return { kind: `comm.${e.channel}` as ActivityKind, refs: [leadRef(e.leadId)], params: { result: e.result ?? null, name: leadOf(tx, e.leadId)?.name ?? '' }, text: e.text, via }
    case 'lead.noted':
      return { kind: 'note', refs: [leadRef(e.leadId)], params: { name: leadOf(tx, e.leadId)?.name ?? '' }, text: e.text, via }
    case 'lead.shortlisted':
      return { kind: 'property.shortlisted', refs: [leadRef(e.leadId), { kind: 'property', id: e.propertyId }], params: { title: propertyOf(tx, e.propertyId)?.title ?? '', status: e.status }, via }
    case 'lead.shared':
      return {
        kind: 'property.shared', refs: [leadRef(e.leadId), ...e.propertyIds.map((id) => ({ kind: 'property' as const, id }))],
        params: { count: e.propertyIds.length, channel: e.channel, titles: e.propertyIds.map((id) => propertyOf(tx, id)?.title ?? id).join(', '), name: leadOf(tx, e.leadId)?.name ?? '' }, via,
      }
    case 'appointment.created': case 'appointment.rescheduled': case 'appointment.completed': case 'appointment.cancelled': case 'appointment.noShow': {
      const a = appointmentOf(tx, e.id)
      if (!a) return null
      const text = e.type === 'appointment.completed' ? a.outcome?.summary : e.type === 'appointment.cancelled' ? a.cancelReason : undefined
      return {
        kind: e.type, refs: [{ kind: 'appointment', id: a.id }, ...(a.leadId ? [leadRef(a.leadId)] : []), ...(a.clientId ? [{ kind: 'client' as const, id: a.clientId }] : [])],
        params: { type: a.type, result: a.outcome?.result ?? null, name: leadOf(tx, a.leadId)?.name ?? '', start: a.start }, text, via,
      }
    }
    case 'appointment.updated': {
      const a = appointmentOf(tx, e.id)
      if (!a) return null
      return {
        kind: 'appointment.updated', refs: [{ kind: 'appointment', id: a.id }, ...(a.leadId ? [leadRef(a.leadId)] : []), ...(a.clientId ? [{ kind: 'client' as const, id: a.clientId }] : [])],
        params: { type: a.type, name: leadOf(tx, a.leadId)?.name ?? '', start: a.start, fields: e.fields.join(','), status: a.status }, via,
      }
    }
    case 'appointment.deleted': {
      const a = e.appointment
      return { kind: 'appointment.deleted', refs: [{ kind: 'appointment', id: a.id }, ...(a.leadId ? [leadRef(a.leadId)] : [])], params: { type: a.type, name: leadOf(tx, a.leadId)?.name ?? '', start: a.start }, via }
    }
    case 'task.updated': {
      const t = taskOf(tx, e.id)
      if (!t) return null
      return {
        kind: 'task.updated', refs: [{ kind: 'task', id: t.id }, ...(t.leadId ? [leadRef(t.leadId)] : []), ...(t.clientId ? [{ kind: 'client' as const, id: t.clientId }] : [])],
        params: { title: t.title, type: t.type, fields: e.fields.join(','), dueAt: t.dueAt }, via,
      }
    }
    case 'task.deleted':
      return { kind: 'task.deleted', refs: [{ kind: 'task', id: e.task.id }, ...(e.task.leadId ? [leadRef(e.task.leadId)] : [])], params: { title: e.task.title, type: e.task.type }, via }
    case 'task.created': case 'task.completed': case 'task.cancelled': {
      const t = taskOf(tx, e.id)
      if (!t) return null
      return {
        kind: e.type, refs: [{ kind: 'task', id: t.id }, ...(t.leadId ? [leadRef(t.leadId)] : []), ...(t.clientId ? [{ kind: 'client' as const, id: t.clientId }] : [])],
        params: { title: t.title, type: t.type, result: t.callResult ?? null }, text: e.type === 'task.completed' ? t.outcome : undefined, via,
      }
    }
    case 'property.created': case 'property.updated': {
      const p = propertyOf(tx, e.id)
      return { kind: e.type, refs: [{ kind: 'property', id: e.id }], params: { title: p?.title ?? '', fields: e.type === 'property.updated' ? e.fields.join(',') : null }, via }
    }
    case 'property.statusChanged':
      return { kind: 'property.statusChanged', refs: [{ kind: 'property', id: e.id }], params: { title: propertyOf(tx, e.id)?.title ?? '', from: e.from, to: e.to }, via }
    case 'property.deleted': {
      // the affected leads are listed so the note shows on each lead's timeline (E13)
      const affected = tx.db.leads.filter((l) => l.shortlist.some((s) => s.propertyId === e.property.id) || l.deal?.propertyId === e.property.id)
      return { kind: 'property.deleted', refs: [{ kind: 'property', id: e.property.id }, ...affected.map((l) => leadRef(l.id))], params: { title: e.property.title }, via }
    }
    case 'client.created': case 'client.updated': {
      const c = tx.db.clients.find((x) => x.id === e.id)
      return { kind: e.type, refs: [{ kind: 'client', id: e.id }, ...(c ? [leadRef(c.leadId)] : [])], params: { name: c?.name ?? '', fields: e.type === 'client.updated' ? e.fields.join(',') : null }, via }
    }
    case 'import.completed': {
      const j = tx.db.importJobs.find((x) => x.id === e.jobId)
      return { kind: 'import.completed', refs: [{ kind: 'importJob', id: e.jobId }], params: { fileName: j?.fileName ?? '', imported: j?.counts.imported ?? 0, kind: j?.kind ?? '' }, via: via ?? 'import' }
    }
    case 'draft.saved': {
      const d = tx.db.drafts.find((x) => x.id === e.id)
      return { kind: 'draft.saved', refs: [{ kind: 'draft', id: e.id }, ...(d?.savedAs ? [d.savedAs] : [])], params: { title: d?.title ?? '' }, via }
    }
    case 'user.created': case 'user.updated': case 'user.deactivated': case 'user.activated':
      return { kind: e.type, refs: [{ kind: 'user', id: e.id }], params: { name: userName(tx, e.id), fields: e.type === 'user.updated' ? e.fields.join(',') : null }, via }
    case 'user.availabilityChanged':
      return { kind: 'user.availability', refs: [{ kind: 'user', id: e.id }], params: { name: userName(tx, e.id), from: e.from, to: e.to }, via }
    case 'settings.changed':
      return { kind: 'settings.changed', refs: [{ kind: 'settings', id: 'settings' }], params: { section: e.section }, via }
  }
}

/* ---------- E2–E18 ---------- */

function onLeadCreated(tx: Tx, e: EventOf<'lead.created'>) {
  const lead = leadOf(tx, e.leadId)
  if (!lead) return
  const actor = tx.actor
  if (!isSystem(actor) && actor.role === 'executive') {
    assignNow(tx, lead, actor.id, 'self', 'creatorOwns')
  } else if (lead.ownerId) {
    const owner = lead.ownerId
    lead.ownerId = null
    assignNow(tx, lead, owner, e.via === 'import' ? 'import' : 'manual', 'manual')
  } else if (tx.db.settings.assignment.autoAssign) {
    const pick = autoPick(tx, lead, !isSystem(actor) && actor.role === 'manager' ? actor.id : undefined)
    if (pick.userId) assignNow(tx, lead, pick.userId, 'auto', pick.reason.key, { reasonParams: pick.reason.params, workload: pick.workload })
  }
  // duplicates: the UI warned before saving; admins get a note to clean up
  const dupes = findDuplicates(tx.db, { phone: lead.phone, altPhone: lead.altPhone, email: lead.email, excludeId: lead.id })
  if (dupes.length) {
    for (const admin of adminIds(tx)) {
      notify(tx, admin, 'duplicateFound', { name: lead.name, other: dupes[0].lead.name }, { ref: leadRef(lead.id), dedupeKey: `duplicate:${lead.id}` })
    }
  }
}

function onLeadAssigned(tx: Tx, e: EventOf<'lead.assigned'>) {
  const lead = leadOf(tx, e.leadId)
  if (!lead) return
  lead.ownerId = e.to
  lead.updatedAt = tx.now
  if (e.to && !lead.firstOwnerId) lead.firstOwnerId = e.to
  tx.db.assignments.push({
    id: tx.id('ASG'), leadId: lead.id, fromUserId: e.from, toUserId: e.to, at: tx.now, by: actorId(tx), mode: e.mode,
    reason: { key: e.reasonKey, params: e.reasonParams }, workload: e.workload, note: e.note,
  })
  if (e.mode === 'auto' && e.to) tx.db.settings.assignment.rrCursor = e.to
  if (e.to) {
    for (const t of tx.db.tasks) if (t.leadId === lead.id && t.status === 'open') t.ownerId = e.to
    for (const a of tx.db.appointments) if (a.leadId === lead.id && isUpcoming(a, tx.now)) a.ownerId = e.to
  }
  const by = actorId(tx)
  if (e.to && e.to !== by) {
    if (tx.via === 'import' || e.mode === 'import') tx.batch.assigned[e.to] = (tx.batch.assigned[e.to] ?? 0) + 1
    else if (e.from) notify(tx, e.to, 'reassignment', { name: lead.name, from: userName(tx, e.from) }, { ref: leadRef(lead.id) })
    else notify(tx, e.to, 'assignment', { name: lead.name, count: 1 }, { ref: leadRef(lead.id) })
  }
  if (e.from && e.from !== e.to && e.from !== by) {
    notify(tx, e.from, 'reassignment', { name: lead.name, from: userName(tx, e.from), to: userName(tx, e.to) }, { ref: leadRef(lead.id) })
  }
  // a lead that just got its first owner and was never called gets the SLA first-call task
  const hasFirstCall = tx.db.tasks.some((t) => t.leadId === lead.id && t.status === 'open' && t.autoReason === 'slaFirstCall')
  if (e.to && !e.from && lead.stage === 'new' && !lead.firstContactAt && !hasFirstCall) {
    addTask(tx, {
      title: `Call ${lead.name}`, type: 'call', ownerId: e.to, leadId: lead.id, priority: 'high', origin: 'automation', autoReason: 'slaFirstCall',
      dueAt: addMinutesIso(lead.createdAt, tx.db.settings.sla.firstResponseMins), createdBy: 'system',
    })
  }
}

function onLeadContacted(tx: Tx, e: EventOf<'lead.contacted'>) {
  const lead = leadOf(tx, e.leadId)
  if (!lead) return
  lead.lastContactAt = tx.now
  if (!lead.firstContactAt) lead.firstContactAt = tx.now
  lead.updatedAt = tx.now
  if (lead.stage === 'new') moveStage(tx, lead, 'contacted')
  if (e.result === 'connected') lead.engagement.responded = true
  if (e.channel === 'call') {
    // the first call happened: the SLA task is done
    for (const t of tx.db.tasks) {
      if (t.leadId === lead.id && t.status === 'open' && t.autoReason === 'slaFirstCall') {
        t.status = 'done'
        t.completedAt = tx.now
        t.callResult = e.result
      }
    }
  }
  if (e.result === 'notReachable' || e.result === 'busy') {
    const due = retrySlot(tx.nowDate)
    const existing = tx.db.tasks.find((t) => t.leadId === lead.id && t.status === 'open' && t.autoReason === 'noAnswerRetry')
    const owner = lead.ownerId ?? (isSystem(tx.actor) ? null : tx.actor.id)
    if (existing) existing.dueAt = due
    else if (owner) {
      addTask(tx, {
        title: `Call ${lead.name} again`, type: 'call', ownerId: owner, leadId: lead.id,
        priority: 'medium', origin: 'automation', autoReason: 'noAnswerRetry', dueAt: due, createdBy: 'system',
      })
    }
  }
}

const DEFAULT_CLIENT_DOCS = ['PAN card', 'Aadhaar card', 'Booking form', 'Token receipt', 'Bank statement (6 months)']

function onStageChanged(tx: Tx, e: EventOf<'lead.stageChanged'>) {
  const lead = leadOf(tx, e.leadId)
  if (!lead) return
  lead.stageSince = tx.now
  lead.stageHistory.push({ stage: e.to, at: tx.now, by: actorId(tx) })
  lead.updatedAt = tx.now
  const property = propertyOf(tx, lead.deal?.propertyId)

  if (e.to === 'lost') {
    for (const t of tx.db.tasks) if (t.leadId === lead.id && t.status === 'open') t.status = 'cancelled'
    for (const a of tx.db.appointments) {
      if (a.leadId === lead.id && isUpcoming(a, tx.now)) {
        a.status = 'cancelled'
        a.cancelReason = 'leadLost'
        a.updatedAt = tx.now
      }
    }
  }

  if (e.to === 'booked') {
    lead.deal ??= {}
    lead.deal.bookedAt ??= tx.now
    if (property) setPropertyStatus(tx, property, 'booked')
    const ownerId = lead.ownerId ?? (isSystem(tx.actor) ? null : tx.actor.id)
    let client = lead.clientId ? tx.db.clients.find((c) => c.id === lead.clientId) : undefined
    if (!client && ownerId) {
      const c: Client = {
        id: tx.id('CL'), leadId: lead.id, name: lead.name, phone: lead.phone, email: lead.email, ownerId,
        city: property?.location.city ?? lead.requirement.cities[0], propertyId: property?.id,
        dealValue: lead.deal.value ?? property?.price, bookingAmount: lead.deal.bookingAmount, bookedAt: lead.deal.bookedAt,
        status: 'booked', kyc: 'pending', documents: DEFAULT_CLIENT_DOCS.map((name) => ({ name, status: 'pending' as const })),
        createdAt: tx.now, updatedAt: tx.now,
      }
      tx.db.clients.push(c)
      client = tx.db.clients[tx.db.clients.length - 1]
      tx.emit({ type: 'client.created', id: c.id })
    } else if (client) {
      client.status = 'booked'
      client.updatedAt = tx.now
    }
    if (ownerId) {
      addTask(tx, {
        title: `Collect booking documents from ${lead.name}`, type: 'document', ownerId, leadId: lead.id, clientId: client?.id,
        priority: 'high', origin: 'automation', autoReason: 'bookingDocs', dueAt: addMinutesIso(tx.now, 3 * 24 * 60), createdBy: 'system',
      })
    }
    const recipients = new Set([...managersFor(tx, lead.ownerId), ...adminIds(tx)])
    recipients.delete(actorId(tx))
    for (const id of recipients) {
      notify(tx, id, 'booking', { name: lead.name, property: property?.title ?? '', amount: lead.deal.bookingAmount ?? 0, owner: userName(tx, lead.ownerId) }, { ref: leadRef(lead.id), priority: 'high' })
    }
  }

  if (e.to === 'converted') {
    const client = lead.clientId ? tx.db.clients.find((c) => c.id === lead.clientId) : undefined
    if (client) {
      client.status = 'converted'
      client.updatedAt = tx.now
    }
    if (property) setPropertyStatus(tx, property, 'sold')
  }

  if (lead.ownerId && lead.ownerId !== actorId(tx)) {
    notify(tx, lead.ownerId, 'stageChanged', { name: lead.name, stage: e.to, from: e.from }, { ref: leadRef(lead.id) })
  }
}

function onAppointmentCreated(tx: Tx, e: EventOf<'appointment.created'>) {
  const a = appointmentOf(tx, e.id)
  if (!a) return
  const lead = leadOf(tx, a.leadId)
  if (lead && a.type === 'siteVisit') {
    advanceStage(tx, lead, 'siteVisitScheduled')
    for (const pid of a.propertyIds) upsertShortlist(lead, pid, 'shortlisted', tx.now, actorId(tx), { onlyUpgrade: true })
  }
  if (a.ownerId !== actorId(tx)) {
    notify(tx, a.ownerId, 'appointmentCreated', { name: lead?.name ?? '', time: clockTime(a.start), date: localDay(a.start), type: a.type }, { ref: { kind: 'appointment', id: a.id } })
  }
}

function onAppointmentCompleted(tx: Tx, e: EventOf<'appointment.completed'>) {
  const a = appointmentOf(tx, e.id)
  if (!a) return
  const lead = leadOf(tx, a.leadId)
  if (!lead) return
  lead.lastContactAt = tx.now
  if (!lead.firstContactAt) lead.firstContactAt = tx.now
  lead.engagement.responded = true
  const outcome = a.outcome
  if (a.type === 'siteVisit') {
    lead.engagement.siteVisited = true
    advanceStage(tx, lead, 'siteVisitDone')
    for (const pid of a.propertyIds) upsertShortlist(lead, pid, 'visited', tx.now, actorId(tx), { onlyUpgrade: true })
    for (const pid of outcome?.likedPropertyIds ?? []) upsertShortlist(lead, pid, 'liked', tx.now, actorId(tx))
    addTask(tx, {
      title: `Post-visit call: ${lead.name}`, type: 'call', ownerId: lead.ownerId ?? a.ownerId, leadId: lead.id, appointmentId: a.id,
      priority: 'high', origin: 'automation', autoReason: 'postVisitCall', dueAt: outcome?.nextFollowUpAt ?? addMinutesIso(tx.now, 24 * 60), createdBy: 'system',
    })
  } else if (outcome?.nextFollowUpAt) {
    addTask(tx, {
      title: `Follow up with ${lead.name}`, type: 'followUp', ownerId: lead.ownerId ?? a.ownerId, leadId: lead.id, appointmentId: a.id,
      priority: 'medium', origin: 'automation', dueAt: outcome.nextFollowUpAt, createdBy: 'system',
    })
  }
  if (outcome?.result === 'readyToBook') {
    for (const m of managersFor(tx, lead.ownerId)) {
      notify(tx, m, 'system', { variant: 'readyToBook', name: lead.name, owner: userName(tx, lead.ownerId) }, { ref: leadRef(lead.id), priority: 'high' })
    }
  }
}

function onAppointmentMissed(tx: Tx, e: EventOf<'appointment.noShow'> | EventOf<'appointment.cancelled'>) {
  const a = appointmentOf(tx, e.id)
  if (!a || a.cancelReason === 'leadLost') return
  const lead = leadOf(tx, a.leadId)
  if (!lead || !isOpen(lead)) return
  const noShow = e.type === 'appointment.noShow'
  addTask(tx, {
    title: noShow ? `Missed visit: call ${lead.name} to reschedule` : `Reschedule with ${lead.name}`, type: 'call',
    ownerId: lead.ownerId ?? a.ownerId, leadId: lead.id, appointmentId: a.id, priority: 'high', origin: 'automation',
    autoReason: noShow ? 'noShowReschedule' : 'visitCancelledReschedule', dueAt: localAt(tx.nowDate, 1, '11:00'), createdBy: 'system',
  })
}

function onAppointmentRescheduled(tx: Tx, e: EventOf<'appointment.rescheduled'>) {
  const a = appointmentOf(tx, e.id)
  if (!a || a.ownerId === actorId(tx)) return
  notify(tx, a.ownerId, 'system', { variant: 'rescheduled', name: leadOf(tx, a.leadId)?.name ?? '', time: clockTime(a.start), date: localDay(a.start) }, { ref: { kind: 'appointment', id: a.id } })
}

function onTaskCompleted(tx: Tx, e: EventOf<'task.completed'>) {
  const t = taskOf(tx, e.id)
  if (!t?.leadId || !['call', 'whatsapp', 'followUp'].includes(t.type)) return
  tx.emit({ type: 'lead.contacted', leadId: t.leadId, channel: t.type === 'whatsapp' ? 'whatsapp' : 'call', result: t.callResult, silent: true })
}

function onShared(tx: Tx, e: EventOf<'lead.shared'>) {
  const lead = leadOf(tx, e.leadId)
  if (!lead) return
  for (const pid of e.propertyIds) upsertShortlist(lead, pid, 'shared', tx.now, actorId(tx), { onlyUpgrade: true })
  tx.emit({ type: 'lead.contacted', leadId: lead.id, channel: e.channel, silent: true })
}

function onPropertyStatusChanged(tx: Tx, e: EventOf<'property.statusChanged'>) {
  if (e.to === 'available') return
  const p = propertyOf(tx, e.id)
  if (!p) return
  for (const lead of tx.db.leads) {
    if (!isOpen(lead) || lead.id === p.heldForLeadId) continue
    if (lead.deal?.propertyId === p.id && (lead.stage === 'booked' || lead.stage === 'negotiation')) continue
    const shortlisted = lead.shortlist.some((s) => s.propertyId === p.id && s.status !== 'notInterested')
    const visiting = tx.db.appointments.some((a) => a.leadId === lead.id && a.type === 'siteVisit' && a.propertyIds.includes(p.id) && isUpcoming(a, tx.now))
    if (!shortlisted && !visiting) continue
    notify(tx, lead.ownerId, 'propertyUnavailable', { property: p.title, status: e.to, name: lead.name }, {
      ref: { kind: 'property', id: p.id }, priority: visiting ? 'high' : 'normal', dedupeKey: `unavailable:${p.id}:${e.to}:${lead.id}`,
    })
  }
}

function onPropertyDeleted(tx: Tx, e: EventOf<'property.deleted'>) {
  const id = e.property.id
  for (const lead of tx.db.leads) {
    const before = lead.shortlist.length
    lead.shortlist = lead.shortlist.filter((s) => s.propertyId !== id)
    if (lead.deal?.propertyId === id) lead.deal.propertyId = undefined
    if (before !== lead.shortlist.length) lead.updatedAt = tx.now
  }
  for (const a of tx.db.appointments) {
    if (!a.propertyIds.includes(id)) continue
    if (a.type === 'siteVisit' && isUpcoming(a, tx.now) && a.propertyIds.length === 1) {
      a.status = 'cancelled'
      a.cancelReason = 'propertyDeleted'
    } else a.propertyIds = a.propertyIds.filter((p) => p !== id)
    a.updatedAt = tx.now
  }
}

function onLeadDeleted(tx: Tx, e: EventOf<'lead.deleted'>) {
  for (const t of tx.db.tasks) if (t.leadId === e.lead.id && t.status === 'open') t.status = 'cancelled'
  for (const a of tx.db.appointments) {
    if (a.leadId === e.lead.id && isUpcoming(a, tx.now)) {
      a.status = 'cancelled'
      a.cancelReason = 'leadDeleted'
    }
  }
}

function onUserDeactivated(tx: Tx, e: EventOf<'user.deactivated'>) {
  const user = tx.db.users.find((u) => u.id === e.id)
  if (!user) return
  let left = 0
  for (const lead of tx.db.leads) {
    if (lead.ownerId !== user.id || !isOpen(lead)) continue
    if (e.redistribute === 'unassign') {
      assignNow(tx, lead, null, 'redistribution', 'ownerDeactivated')
      left++
    } else if (e.redistribute === 'auto') {
      const pick = autoPick(tx, lead, user.managerId)
      assignNow(tx, lead, pick.userId, 'redistribution', 'ownerDeactivated', { workload: pick.workload, reasonParams: { pick: pick.reason.key } })
      if (!pick.userId) left++
    } else assignNow(tx, lead, e.redistribute.toUserId, 'redistribution', 'ownerDeactivated')
  }
  for (const rule of tx.db.settings.assignment.rules) rule.userIds = rule.userIds.filter((id) => id !== user.id)
  if (left) for (const admin of adminIds(tx)) notify(tx, admin, 'deactivatedOwner', { name: user.name, count: left }, { ref: { kind: 'user', id: user.id }, priority: 'high' })
}

function onAvailabilityChanged(tx: Tx, e: EventOf<'user.availabilityChanged'>) {
  if (e.to !== 'onLeave') return
  const user = tx.db.users.find((u) => u.id === e.id)
  if (!user) return
  const count = tx.db.leads.filter((l) => l.ownerId === user.id && isOpen(l)).length
  if (!count) return
  for (const m of managersFor(tx, user.id)) {
    notify(tx, m, 'leaveReassign', { name: user.name, count }, { ref: { kind: 'user', id: user.id }, priority: 'high', dedupeKey: `leave:${user.id}:${localDay(tx.nowDate)}` })
  }
}

function onImportCompleted(tx: Tx, e: EventOf<'import.completed'>) {
  const job = tx.db.importJobs.find((j) => j.id === e.jobId)
  if (!job) return
  const recipients = new Set([job.createdBy, ...adminIds(tx)])
  for (const id of recipients) {
    notify(tx, id, 'importFinished', { fileName: job.fileName, imported: job.counts.imported, duplicates: job.counts.duplicates, errors: job.counts.errors, drafts: job.counts.drafts }, { ref: { kind: 'importJob', id: job.id } })
  }
}

function onClientCreated(tx: Tx, e: EventOf<'client.created'>) {
  const c = tx.db.clients.find((x) => x.id === e.id)
  const lead = leadOf(tx, c?.leadId)
  if (c && lead) lead.clientId = c.id
}

/** Runs E1 and the event's own effects. */
export function handleEvent(tx: Tx, e: DomainEvent): void {
  const act = activityFor(tx, e)
  if (act) appendActivity(tx, act)
  switch (e.type) {
    case 'lead.created': return onLeadCreated(tx, e)
    case 'lead.assigned': return onLeadAssigned(tx, e)
    case 'lead.contacted': return onLeadContacted(tx, e)
    case 'lead.stageChanged': return onStageChanged(tx, e)
    case 'lead.shared': return onShared(tx, e)
    case 'lead.deleted': return onLeadDeleted(tx, e)
    case 'appointment.created': return onAppointmentCreated(tx, e)
    case 'appointment.completed': return onAppointmentCompleted(tx, e)
    case 'appointment.noShow': case 'appointment.cancelled': return onAppointmentMissed(tx, e)
    case 'appointment.rescheduled': return onAppointmentRescheduled(tx, e)
    case 'task.completed': return onTaskCompleted(tx, e)
    case 'property.statusChanged': return onPropertyStatusChanged(tx, e)
    case 'property.deleted': return onPropertyDeleted(tx, e)
    case 'user.deactivated': return onUserDeactivated(tx, e)
    case 'user.availabilityChanged': return onAvailabilityChanged(tx, e)
    case 'import.completed': return onImportCompleted(tx, e)
    case 'client.created': return onClientCreated(tx, e)
    default: return undefined
  }
}

/** End of a commit: one "N new leads assigned to you" per assignee for imports (E16). */
export function flushBatches(tx: Tx): void {
  for (const [userId, count] of Object.entries(tx.batch.assigned)) {
    notify(tx, userId, 'assignment', { variant: 'assignmentBatch', count, name: '' })
  }
  tx.batch.assigned = {}
}
