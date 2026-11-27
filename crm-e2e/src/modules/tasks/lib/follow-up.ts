/**
 * The Follow-up Assistant (master prompt §12 "Follow-up Assistant: suggests timing + drafts messages"; ROLE_RESEARCH
 * §1.3 #2: follow-ups are forgotten after 1–2 unanswered attempts). Rule-based and pure: it reads the lead, the call
 * history and the visits, and suggests WHEN to follow up, on WHICH channel and with WHAT kind of message. The message
 * itself is drafted by the AI service (`generateMessage`) from the purpose returned here.
 */
import type { Appointment, Lead, MessagePurpose, Task, Temperature } from '@/domain/types'
import { UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { localAt, localDay, minutesBetween } from '@/lib/dates'

export type FollowUpSuggestion = {
  at: string
  channel: 'call' | 'whatsapp'
  purpose: MessagePurpose
  /** `tasks:assistant.reason.<key>` */
  reasonKey: string
  params?: Record<string, string | number>
  /** The visit a confirmation is about (so the draft carries its time, property and map link). */
  appointmentId?: string
}

const WORK_START = 10 * 60
const WORK_END = 19 * 60 + 30
const EVENING = '18:30'

/** Moves a time into calling hours (10:00–19:30): too late → 10:30 next morning; too early → 10:30 the same day. */
export function intoWorkingHours(iso: string): string {
  const d = new Date(iso)
  const m = d.getHours() * 60 + d.getMinutes()
  if (m > WORK_END) return localAt(d, 1, '10:30')
  if (m < WORK_START) return localAt(d, 0, '10:30')
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return d.toISOString()
}

/** Unanswered call attempts (not reachable / busy) for a lead in the last 7 days, newest first. */
export function missedAttempts(tasks: Pick<Task, 'leadId' | 'status' | 'callResult' | 'completedAt'>[], leadId: string, now: Date) {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  return tasks
    .filter((t) => t.leadId === leadId && t.status === 'done' && (t.callResult === 'notReachable' || t.callResult === 'busy') && (t.completedAt ?? '') >= weekAgo)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
}

export function suggestFollowUp(input: {
  task: Pick<Task, 'id' | 'type' | 'dueAt' | 'autoReason' | 'appointmentId'>
  lead?: Pick<Lead, 'id' | 'stage' | 'contactPref' | 'lastContactAt' | 'engagement'>
  temperature?: Temperature
  tasks: Pick<Task, 'leadId' | 'status' | 'callResult' | 'completedAt'>[]
  appointments: (Pick<Appointment, 'leadId' | 'status' | 'start' | 'type'> & { id?: string })[]
  now: Date
}): FollowUpSuggestion {
  const { task, lead, temperature, tasks, appointments, now } = input
  if (!lead) return { at: intoWorkingHours(new Date(now.getTime() + 2 * 3_600_000).toISOString()), channel: 'call', purpose: 'followUp', reasonKey: 'noLead' }

  const missed = missedAttempts(tasks, lead.id, now)
  const nextVisit = appointments
    .filter((a) => a.leadId === lead.id && UPCOMING_APPOINTMENT_STATUSES.includes(a.status) && a.start > now.toISOString())
    .sort((a, b) => a.start.localeCompare(b.start))[0]
  const lastVisit = appointments
    .filter((a) => a.leadId === lead.id && a.status === 'completed' && a.type === 'siteVisit' && a.start <= now.toISOString())
    .sort((a, b) => b.start.localeCompare(a.start))[0]
  const prefersWa = lead.contactPref === 'whatsapp'

  // A visit is coming up: confirm it a couple of hours ahead (ROLE_RESEARCH §1.1: confirms 1–2 hours ahead).
  if (nextVisit && minutesBetween(now, nextVisit.start) <= 26 * 60) {
    const ahead = new Date(new Date(nextVisit.start).getTime() - 2 * 3_600_000)
    const at = ahead.getTime() < now.getTime() ? new Date(now.getTime() + 10 * 60_000).toISOString() : intoWorkingHours(ahead.toISOString())
    return { at, channel: 'whatsapp', purpose: 'visitConfirm', reasonKey: 'confirmVisit', appointmentId: nextVisit.id }
  }

  // Two or more unanswered calls: switch channel, try in the evening when people are off work.
  if (missed.length >= 2) {
    const evening = localAt(now, 0, EVENING)
    return { at: evening > now.toISOString() ? evening : localAt(now, 1, EVENING), channel: 'whatsapp', purpose: 'followUp', reasonKey: 'switchChannel', params: { count: missed.length } }
  }
  // One unanswered call: try at the other half of the day.
  if (missed.length === 1) {
    const last = new Date(missed[0].completedAt ?? now.toISOString())
    const morning = last.getHours() < 14
    const slot = morning ? localAt(now, 0, '17:30') : localAt(now, 1, '11:00')
    return { at: slot > now.toISOString() ? slot : localAt(now, 1, morning ? '17:30' : '11:00'), channel: prefersWa ? 'whatsapp' : 'call', purpose: 'followUp', reasonKey: morning ? 'retryEvening' : 'retryMorning' }
  }

  // Within a day of a site visit: the post-visit call is the costliest leak (ROLE_RESEARCH §1.4).
  if (task.autoReason === 'postVisitCall' || (lastVisit && minutesBetween(lastVisit.start, now) <= 48 * 60)) {
    const evening = localAt(now, 0, EVENING)
    return { at: evening > now.toISOString() ? evening : intoWorkingHours(new Date(now.getTime() + 30 * 60_000).toISOString()), channel: prefersWa ? 'whatsapp' : 'call', purpose: 'postVisit', reasonKey: 'postVisit' }
  }

  if (lead.stage === 'new') {
    return { at: intoWorkingHours(new Date(now.getTime() + 15 * 60_000).toISOString()), channel: 'call', purpose: 'intro', reasonKey: 'firstContact' }
  }

  const sinceContact = lead.lastContactAt ? Math.floor(minutesBetween(lead.lastContactAt, now) / 1440) : undefined
  if (temperature === 'hot') {
    return { at: intoWorkingHours(new Date(now.getTime() + 60 * 60_000).toISOString()), channel: prefersWa ? 'whatsapp' : 'call', purpose: lead.stage === 'negotiation' ? 'offer' : 'followUp', reasonKey: 'hot' }
  }
  if (temperature === 'cold') {
    return { at: localAt(now, 3, '11:00'), channel: 'whatsapp', purpose: 'followUp', reasonKey: 'cold', params: { days: sinceContact ?? 0 } }
  }
  if (sinceContact != null && sinceContact >= 5) {
    return { at: intoWorkingHours(new Date(now.getTime() + 60 * 60_000).toISOString()), channel: prefersWa ? 'whatsapp' : 'call', purpose: 'followUp', reasonKey: 'silent', params: { days: sinceContact } }
  }
  return { at: localAt(now, 1, '11:00'), channel: prefersWa ? 'whatsapp' : 'call', purpose: 'followUp', reasonKey: 'warm' }
}

/** True when the suggestion is materially different from the task's current due time (> 30 min apart). */
export const differsFromDue = (s: Pick<FollowUpSuggestion, 'at'>, dueAt: string) =>
  Math.abs(new Date(s.at).getTime() - new Date(dueAt).getTime()) > 30 * 60_000

export const sameDay = (a: string, b: string) => localDay(a) === localDay(b)
