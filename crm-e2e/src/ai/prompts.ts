/**
 * Suggested prompt chips per role (ROLE_RESEARCH §5) for the global assistant, filled with real names from the data the
 * user sees (a lead with an open follow-up, the next visit's time, the executive on leave), plus chips for the open
 * record. Labels are translated (namespace `ai`); the command text stays English because that is what the simulated
 * reader understands best. `prefill` chips put text in the box for the user to finish (e.g. paste a message).
 * Pure apart from i18next; no React, no store.
 */
import i18next from 'i18next'
import type { DB, EntityRef, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { can } from '@/lib/permissions'
import { inrShort } from '@/lib/format'
import { localDay } from '@/lib/dates'
import { visible } from '@/services/queries/visibility'

export type PromptChip = { id: string; label: string; command: string; prefill?: boolean }

const t = (key: string, opts: Record<string, unknown> = {}): string => i18next.t(key, opts)
const firstOf = (name: string) => name.split(/\s+/)[0] ?? name
const time12 = (iso: string) => {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`
}

/** Chips for the record that is open (lead, property, appointment). */
function recordChips(db: DB, user: User, sel: EntityRef | undefined): PromptChip[] {
  if (!sel) return []
  if (sel.kind === 'lead' || sel.kind === 'client') {
    const lead = sel.kind === 'lead' ? db.leads.find((l) => l.id === sel.id) : db.leads.find((l) => l.id === db.clients.find((c) => c.id === sel.id)?.leadId)
    if (!lead) return []
    const n = firstOf(lead.name)
    const out: PromptChip[] = [
      { id: 'rec-summary', label: t('ai:prompt.record.summary'), command: `Summarise ${lead.name} before my call` },
      { id: 'rec-match', label: t('ai:prompt.record.matches', { name: n }), command: `Find matching properties for ${lead.name}` },
      { id: 'rec-draft', label: t('ai:prompt.record.draft', { name: n }), command: `Draft a follow-up WhatsApp for ${lead.name}` },
    ]
    if (can(user, 'appointment.manage', { ownerId: lead.ownerId ?? user.id }, db)) out.push({ id: 'rec-visit', label: t('ai:prompt.record.visit'), command: `Schedule a site visit with ${lead.name} tomorrow 11am` })
    if (can(user, 'lead.edit', lead, db)) out.push({ id: 'rec-log', label: t('ai:prompt.record.log'), command: `Called ${lead.name}, `, prefill: true })
    return out
  }
  if (sel.kind === 'property') {
    const p = db.properties.find((x) => x.id === sel.id)
    if (!p) return []
    return [{ id: 'rec-buyers', label: t('ai:prompt.record.buyers'), command: `Which buyers match ${p.title}?` }]
  }
  if (sel.kind === 'appointment') {
    const a = db.appointments.find((x) => x.id === sel.id)
    const lead = a?.leadId ? db.leads.find((l) => l.id === a.leadId) : undefined
    if (!a || !lead) return []
    return [
      { id: 'rec-confirm', label: t('ai:prompt.record.confirm'), command: `Draft visit confirmation for ${lead.name}` },
      { id: 'rec-prep', label: t('ai:prompt.record.prep'), command: `Summarise ${lead.name}` },
    ]
  }
  return []
}

export function rolePrompts(db: DB, user: User, now: Date, selection?: EntityRef): PromptChip[] {
  const leads = visible.leads(db, user).filter((l) => OPEN_STAGES.includes(l.stage))
  const mine = user.role === 'executive' ? leads.filter((l) => l.ownerId === user.id) : leads
  const withBudget = mine.find((l) => l.requirement.budgetMax) ?? mine[0]
  const withTask = mine.find((l) => db.tasks.some((x) => x.leadId === l.id && x.status === 'open')) ?? mine[1] ?? mine[0]
  const out: PromptChip[] = [...recordChips(db, user, selection)]

  if (user.role === 'executive') {
    const nextVisit = db.appointments
      .filter((a) => a.ownerId === user.id && (a.status === 'scheduled' || a.status === 'confirmed') && a.start >= now.toISOString() && localDay(a.start) <= localDay(new Date(now.getTime() + 2 * 86_400_000)))
      .sort((a, b) => a.start.localeCompare(b.start))[0]
    out.push({ id: 'exec-next', label: t('ai:prompt.exec.nextCall'), command: 'Who should I call next?' })
    out.push({ id: 'exec-add', label: t('ai:prompt.exec.addLead'), command: 'Add lead: ', prefill: true })
    if (nextVisit) out.push({ id: 'exec-confirm', label: t('ai:prompt.exec.confirm', { time: time12(nextVisit.start) }), command: `Draft visit confirmation for my ${time12(nextVisit.start)}` })
    if (withBudget?.requirement.budgetMax) out.push({ id: 'exec-match', label: t('ai:prompt.exec.match', { name: firstOf(withBudget.name), budget: inrShort(withBudget.requirement.budgetMax) }), command: `Match properties for ${withBudget.name} under ${inrShort(withBudget.requirement.budgetMax).replace('₹', '')}` })
    if (withTask) out.push({ id: 'exec-resched', label: t('ai:prompt.exec.reschedule', { name: firstOf(withTask.name) }), command: `Reschedule ${withTask.name}'s follow-up to tomorrow 5 PM` })
    if (!selection && mine[0]) out.push({ id: 'exec-summary', label: t('ai:prompt.exec.summary', { name: firstOf(mine[0].name) }), command: `Summarise ${mine[0].name} before my call` })
    out.push({ id: 'exec-target', label: t('ai:prompt.exec.target'), command: "What's left for my target this month?" })
  } else if (user.role === 'manager') {
    const away = db.users.find((u) => u.role === 'executive' && u.managerId === user.id && u.status === 'active' && u.availability === 'onLeave')
    out.push({ id: 'mgr-assign', label: t('ai:prompt.mgr.assign'), command: 'Assign new leads' })
    out.push({ id: 'mgr-overload', label: t('ai:prompt.mgr.overloaded'), command: 'Who is overloaded today?' })
    out.push({ id: 'mgr-stalled', label: t('ai:prompt.mgr.stalled'), command: 'Show stalled deals over 10 days' })
    if (away) out.push({ id: 'mgr-leave', label: t('ai:prompt.mgr.leave', { name: firstOf(away.name) }), command: `Reassign ${away.name}'s leads, on leave` })
    out.push({ id: 'mgr-team', label: t('ai:prompt.mgr.team'), command: 'Summarise team performance this week' })
    out.push({ id: 'mgr-source', label: t('ai:prompt.mgr.source'), command: 'Which source converts best to visits?' })
    out.push({ id: 'mgr-nocontact', label: t('ai:prompt.mgr.noContact'), command: 'Leads with no contact in 5 days' })
  } else {
    const gone = db.users.find((u) => u.role === 'executive' && u.status === 'deactivated')
    out.push({ id: 'adm-import', label: t('ai:prompt.admin.import'), command: 'Import this CSV from 99acres' })
    out.push({ id: 'adm-lost', label: t('ai:prompt.admin.lost'), command: 'How many leads did we lose to budget mismatch this month?' })
    if (gone) out.push({ id: 'adm-redistribute', label: t('ai:prompt.admin.redistribute', { name: firstOf(gone.name) }), command: `Reassign ${gone.name}'s leads` })
    out.push({ id: 'adm-inventory', label: t('ai:prompt.admin.inventory'), command: 'Which project has most unsold inventory?' })
    out.push({ id: 'adm-business', label: t('ai:prompt.admin.business'), command: 'Business summary for today' })
    out.push({ id: 'adm-dupes', label: t('ai:prompt.admin.duplicates'), command: 'Find duplicate leads' })
  }
  // never repeat a command
  const seen = new Set<string>()
  return out.filter((c) => (seen.has(c.command) ? false : (seen.add(c.command), true)))
}
