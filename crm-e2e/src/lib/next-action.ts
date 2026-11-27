/**
 * The lead's next best action (ported from wireframe-rebuild/src/features/leads/next-step.ts and extended to the
 * normalised model: appointments and tasks are records, not fields on the lead). Rule-based; the AI provider may
 * reword it but the facts come from here. Returns an i18n key (`leads:next.<key>`), params, and the action the UI
 * offers as its one-click button.
 */
import type { Appointment, ID, Lead, Property, Settings, Task } from '@/domain/types'
import { OPEN_STAGES, UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { fmtDate, inrShort } from './format'
import { propertiesForLead } from './matching'

export type NextActionKind = 'assignLead' | 'call' | 'logOutcome' | 'openAppointment' | 'completeTask' | 'collectDocs'
  | 'negotiate' | 'postVisitCall' | 'scheduleVisit' | 'shareProperties' | 'createTask'
export type NextAction = {
  key: string
  params?: Record<string, string | number>
  action: NextActionKind
  /** The record the button acts on (appointment, task or property). */
  targetId?: ID
}

export type NextContext = {
  appointments: Appointment[]
  tasks: Task[]
  properties: Property[]
  settings: Pick<Settings, 'matching'>
  now: Date
}

const HOUR = 3_600_000

/** A booked appointment whose time has passed (by an hour) still needs its outcome. */
export const needsOutcome = (a: Appointment, now: Date) =>
  UPCOMING_APPOINTMENT_STATUSES.includes(a.status) && new Date(a.start).getTime() + a.durationMin * 60_000 < now.getTime() - HOUR / 2

export function suggestNext(lead: Lead, ctx: NextContext): NextAction | null {
  if (!OPEN_STAGES.includes(lead.stage)) return null
  const nowIso = ctx.now.toISOString()
  const title = (id: ID | undefined) => ctx.properties.find((p) => p.id === id)?.title ?? ''
  const appts = ctx.appointments.filter((a) => a.leadId === lead.id)
  const tasks = ctx.tasks.filter((t) => t.leadId === lead.id && t.status === 'open').sort((a, b) => a.dueAt.localeCompare(b.dueAt))

  if (!lead.ownerId) return { key: 'assign', action: 'assignLead' }

  const pending = appts.filter((a) => needsOutcome(a, ctx.now)).sort((a, b) => a.start.localeCompare(b.start))[0]
  if (pending) return { key: 'recordOutcome', params: { property: title(pending.propertyIds[0]), date: fmtDate(pending.start) }, action: 'logOutcome', targetId: pending.id }

  const overdue = tasks.find((t) => t.dueAt < nowIso)
  if (overdue) return { key: 'overdueTask', params: { title: overdue.title, date: fmtDate(overdue.dueAt) }, action: 'completeTask', targetId: overdue.id }

  if (lead.stage === 'new' && !lead.firstContactAt) return { key: 'firstCall', action: 'call' }

  const upcoming = appts.filter((a) => UPCOMING_APPOINTMENT_STATUSES.includes(a.status) && a.start >= nowIso).sort((a, b) => a.start.localeCompare(b.start))[0]
  if (upcoming) {
    const loan = lead.qualification.loan === 'needed' || lead.qualification.loan === 'preApproved'
    return { key: loan ? 'prepareVisitLoan' : 'prepareVisit', params: { property: title(upcoming.propertyIds[0]), date: fmtDate(upcoming.start) }, action: 'openAppointment', targetId: upcoming.id }
  }

  if (lead.stage === 'booked') return { key: 'collectDocs', action: 'collectDocs' }

  if (lead.stage === 'negotiation') {
    const d = lead.deal
    if (d?.offered && d.counter) return { key: 'negotiation', params: { offer: inrShort(d.offered), counter: inrShort(d.counter), gap: inrShort(d.counter - d.offered) }, action: 'negotiate', targetId: d.propertyId }
    return { key: 'negotiationOpen', params: { property: title(d?.propertyId) }, action: 'negotiate', targetId: d?.propertyId }
  }

  if (lead.stage === 'siteVisitDone') {
    const liked = lead.shortlist.find((s) => s.status === 'liked')
    if (liked) return { key: 'proposeOffer', params: { property: title(liked.propertyId) }, action: 'negotiate', targetId: liked.propertyId }
    return { key: 'afterVisit', action: 'postVisitCall' }
  }

  const sharedNotVisited = lead.shortlist.filter((s) => s.status === 'shared' || s.status === 'shortlisted').at(-1)
  if (sharedNotVisited) return { key: 'bookVisit', params: { property: title(sharedNotVisited.propertyId) }, action: 'scheduleVisit', targetId: sharedNotVisited.propertyId }

  const fresh = propertiesForLead(lead, ctx.properties, ctx.settings, ctx.now, { limit: 1, includeShared: false })[0]
  if (fresh && fresh.label !== 'weak' && fresh.label !== 'conditional') {
    return { key: 'shareMatch', params: { property: fresh.property.title, score: fresh.score }, action: 'shareProperties', targetId: fresh.property.id }
  }

  const next = tasks[0]
  if (next) return { key: 'followUpOn', params: { title: next.title, date: fmtDate(next.dueAt) }, action: 'completeTask', targetId: next.id }

  const last = lead.lastContactAt ?? lead.createdAt
  const days = Math.max(0, Math.floor((ctx.now.getTime() - new Date(last).getTime()) / 86_400_000))
  return { key: 'checkIn', params: { days }, action: 'createTask' }
}
