/**
 * Shared pieces of the command reader: the request environment (who, what they may see, the selected record),
 * reply builders, refusals with the permission reason, and finding the lead / user / property a request names.
 */
import i18next from 'i18next'
import type { Appointment, DB, EntityRef, Lead, Property, Task, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { can, explainDenied, type Action } from '@/lib/permissions'
import { localDay } from '@/lib/dates'
import { visible } from '@/services/queries/visibility'
import type { AIContext, CommandPlan } from '../types'
import type { IntentKey } from './intents'
import { named, norm, propertyNamed, timeIn } from './parse'

export const t = (key: string, opts: Record<string, unknown> = {}): string => i18next.t(key, opts)

export type Env = {
  /** The request in English (after the Hinglish rewrite). */
  text: string
  /** Lower-case `text`. */
  s: string
  /** The request as typed (for the message tone). */
  raw: string
  ctx: AIContext
  db: DB
  user: User
  now: Date
  today: string
  /** Leads the user may see, and the open ones among them. */
  leads: Lead[]
  open: Lead[]
  selLead?: Lead
  selProperty?: Property
  selAppointment?: Appointment
}

export function makeEnv(text: string, raw: string, ctx: AIContext): Env {
  const db = ctx.db()
  const user = ctx.actor
  const leads = visible.leads(db, user)
  const sel = ctx.selection
  const selAppointment = sel?.kind === 'appointment' ? db.appointments.find((a) => a.id === sel.id) : undefined
  const selLeadId = sel?.kind === 'lead' ? sel.id : sel?.kind === 'client' ? db.clients.find((c) => c.id === sel.id)?.leadId : selAppointment?.leadId
  return {
    text, raw, s: norm(text).toLowerCase(), ctx, db, user, now: ctx.now, today: localDay(ctx.now),
    leads, open: leads.filter((l) => OPEN_STAGES.includes(l.stage)),
    selLead: selLeadId ? leads.find((l) => l.id === selLeadId) : undefined,
    selProperty: sel?.kind === 'property' ? db.properties.find((p) => p.id === sel.id) : undefined,
    selAppointment,
  }
}

export const say = (intent: IntentKey | string, text: string, extra: Partial<Omit<CommandPlan, 'mode' | 'intent' | 'reply'>> & { links?: EntityRef[]; bullets?: string[]; nav?: { label: string; to: string }[] } = {}): CommandPlan => {
  const { links, bullets, nav, ...rest } = extra
  return { mode: 'simulated', intent, proposals: [], ...rest, reply: { mode: 'simulated', text, links, bullets, nav } }
}

/** A polite refusal with the permission's reason (master prompt §12.5: "politely refused with the reason"). */
export function refuse(intent: IntentKey | string, action: Action, user: User, alternative?: { text: string; command: string; label: string }): CommandPlan {
  const why = explainDenied(user, action)
  return {
    mode: 'simulated', intent, proposals: [],
    reply: { mode: 'simulated', text: t('ai:reply.refused', { reason: t(why.reasonKey, why.params) }), bullets: alternative ? [alternative.text] : undefined },
    refusal: { action, reasonKey: why.reasonKey, params: why.params },
    followUps: alternative ? [{ label: alternative.label, command: alternative.command }] : undefined,
  }
}

/** The lead a request is about: named in the text (exact name first, then first name or a 1-letter typo), else the open record. */
export function leadFor(text: string, env: Env, pool: Lead[] = env.leads): { lead?: Lead; others: Lead[] } {
  const hits = named(text, pool.map((l) => ({ id: l.id, name: l.name })))
  if (hits.length) {
    const lower = norm(text).toLowerCase()
    const exact = hits.filter((h) => lower.includes(h.name.toLowerCase()))
    const pick = exact[0] ?? hits[0]
    const others = (exact.length ? [] : hits.slice(1, 4)).map((h) => pool.find((l) => l.id === h.id)).filter((l): l is Lead => !!l)
    return { lead: pool.find((l) => l.id === pick.id), others }
  }
  // no name: "this lead", "him", "her" and bare commands mean the record that is open
  if (env.selLead) return { lead: env.selLead, others: [] }
  return { others: [] }
}

/** Executives the user can hand leads to (admins: everyone active; managers: their team). */
export function assignees(env: Env): User[] {
  return env.db.users.filter((u) => u.role === 'executive' && u.status === 'active' && (env.user.role === 'admin' || u.managerId === env.user.id))
}

/** A user named in the text, among the given people. */
export function userIn(text: string, people: User[]): User | undefined {
  return named(text, people)[0]
}

/** The appointment a request points at: "my 11 AM", the open appointment, or the lead's next one. */
export function appointmentFor(env: Env, lead?: Lead): Appointment | undefined {
  const mine = env.db.appointments.filter((a) => (a.status === 'scheduled' || a.status === 'confirmed') && can(env.user, 'appointment.view', a, env.db))
  const time = /\bmy\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/.test(env.s) ? timeIn(env.s) : undefined
  if (time) {
    const at = mine.filter((a) => a.ownerId === env.user.id || !lead).find((a) => {
      const d = new Date(a.start)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` === time && localDay(a.start) >= env.today
    })
    if (at) return at
  }
  if (env.selAppointment && !lead) return env.selAppointment
  if (lead) return mine.filter((a) => a.leadId === lead.id && a.start >= new Date(env.now.getTime() - 3_600_000).toISOString()).sort((a, b) => a.start.localeCompare(b.start))[0]
  return undefined
}

/** The open task a request points at for a lead (the earliest due first). */
export function openTaskFor(env: Env, lead: Lead): Task | undefined {
  return env.db.tasks.filter((x) => x.leadId === lead.id && x.status === 'open' && can(env.user, 'task.manage', x, env.db)).sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
}

/** Live, matchable properties a request names. */
export function propertyIn(text: string, env: Env): Property | undefined {
  return propertyNamed(text, env.db.properties.filter((p) => p.listing === 'live'))
}

/** First names of a few records, for the follow-up chips. */
export const first = (name: string) => name.split(/\s+/)[0] ?? name
