/**
 * Master prompt §7 interconnections, end to end across modules: a write through a service and what every other screen's
 * pure read (Today, Pipeline/Reports stats, Matching, the activity log, notifications, assignment history) then shows.
 * The per-effect rules are unit-tested in core/effects.test.ts; this file checks the screens' views of them agree.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import '@/i18n'
import { buildSeed } from '@/data/seed'
import type { AIContext } from '@/ai/types'
import { parseCommandSim } from '@/ai/simulated/commands'
import { OPEN_STAGES } from '@/domain/catalogue'
import type { ID, User } from '@/domain/types'
import { propertiesForLead } from '@/lib/matching'
import { PermissionError } from '@/lib/permissions'
import { useDbStore } from '@/store/db-store'
import { completeAppointmentWithStage, confirmAppointment, createAppointment, deleteAppointment } from './appointments'
import { assignLeads } from './assignments'
import { executeProposal } from './commands'
import { clock, runAs } from './core/actor'
import { getDb } from './core/commit'
import { completeImport } from './imports'
import { changeStage, createLead } from './leads'
import { matchesForLead } from './matching'
import { changePropertyStatus } from './properties'
import { deleteTask, reopenTask, rescheduleTasks, updateTask } from './tasks'
import { executiveToday, managerToday } from './queries/today'
import { funnel, teamBoard } from './queries/stats'
import { visible } from './queries/visibility'
import { deleteRule, saveRule, setRuleEnabled, updateSettings } from './settings'

const NOW = new Date(2026, 10, 27, 10, 0)
const user = (id: ID): User => getDb().users.find((u) => u.id === id)!
const as = <T>(id: ID, fn: () => T): T => runAs(user(id), fn)
const lead = (id: ID) => getDb().leads.find((l) => l.id === id)!
const actsFor = (kind: 'lead' | 'property', id: ID) => getDb().activities.filter((a) => a.refs.some((r) => r.kind === kind && r.id === id))
const notesFor = (userId: ID) => getDb().notifications.filter((n) => n.userId === userId)

const wakad = {
  name: 'Sunil Rao', phone: '9876501234', source: 'acres99' as const, isNri: false, ownerId: null,
  requirement: { propertyTypes: ['apartment' as const], configurations: ['2BHK' as const], cities: ['Pune'], localities: ['Wakad'], budgetMax: 8_000_000, budgetFlexPct: 10, possession: 'any' as const, facing: [], amenities: [], mustHaves: [], purpose: 'sale' as const },
}

beforeEach(() => {
  clock.now = () => NOW
  useDbStore.setState({ db: buildSeed(NOW) })
})

describe('§7 scheduling a site visit from a lead', () => {
  it('creates the appointment, adds a timeline entry, moves the stage, and Today / Pipeline see it', () => {
    const l = visible.leads(getDb(), user('u-arjun')).find((x) => x.stage === 'qualified' || x.stage === 'contacted')!
    const pid = propertiesForLead(l, getDb().properties, getDb().settings, NOW)[0]?.property.id ?? getDb().properties.find((p) => p.status === 'available')!.id
    const start = new Date(NOW.getTime() + 3 * 3_600_000).toISOString()
    const { id: apt } = as('u-arjun', () => createAppointment({ type: 'siteVisit', leadId: l.id, propertyIds: [pid], ownerId: 'u-arjun', start }))

    expect(getDb().appointments.find((a) => a.id === apt)).toMatchObject({ leadId: l.id, status: 'scheduled' })
    expect(lead(l.id).stage).toBe('siteVisitScheduled')
    expect(lead(l.id).stageHistory.at(-1)?.stage).toBe('siteVisitScheduled')
    const kinds = actsFor('lead', l.id).map((a) => a.kind)
    expect(kinds).toContain('appointment.created')
    expect(kinds).toContain('lead.stageChanged')
    // Today (executive) lists the visit; the funnel counts the lead in the new stage
    expect(executiveToday(getDb(), user('u-arjun'), NOW).appointments.some((a) => a.id === apt)).toBe(true)
    expect(funnel(getDb().leads).find((f) => f.stage === 'siteVisitScheduled')!.current).toBeGreaterThan(0)
  })

  it('completing the visit suggests the follow-up (post-visit call) and applies the accepted stage in one step', () => {
    const l = visible.leads(getDb(), user('u-arjun')).find((x) => x.stage === 'qualified' || x.stage === 'contacted')!
    const pid = getDb().properties.find((p) => p.status === 'available' && p.listing === 'live')!.id
    const { id: apt } = as('u-arjun', () => createAppointment({ type: 'siteVisit', leadId: l.id, propertyIds: [pid], ownerId: 'u-arjun', start: new Date(NOW.getTime() - 3_600_000).toISOString() }))
    as('u-arjun', () => completeAppointmentWithStage(apt, { result: 'interested', summary: 'Liked the balcony', likedPropertyIds: [pid] }, 'negotiation'))
    expect(lead(l.id).stage).toBe('negotiation')
    const followUp = getDb().tasks.find((t) => t.leadId === l.id && t.autoReason === 'postVisitCall' && t.status === 'open')
    expect(followUp).toBeDefined()
    expect(executiveToday(getDb(), user('u-arjun'), NOW).items.length).toBeGreaterThan(0)
    expect(actsFor('lead', l.id).map((a) => a.kind)).toContain('appointment.completed')
  })
})

describe('§7 Booked / Sold properties leave every match list', () => {
  it('booking a property removes it from the lead-side and property-side matches and notifies interested owners', () => {
    const db = getDb()
    const withMatch = db.leads.filter((l) => OPEN_STAGES.includes(l.stage)).map((l) => ({ l, m: propertiesForLead(l, db.properties, db.settings, NOW) })).find((x) => x.m.length > 0)!
    const pid = withMatch.m[0].property.id
    as('u-admin', () => changePropertyStatus(pid, 'booked'))
    for (const l of getDb().leads) {
      expect(matchesForLead(getDb(), l.id, NOW).matches.some((m) => m.property.id === pid)).toBe(false)
    }
    expect(actsFor('property', pid).some((a) => a.kind === 'property.statusChanged')).toBe(true)
    as('u-admin', () => changePropertyStatus(pid, 'sold'))
    expect(propertiesForLead(withMatch.l, getDb().properties, getDb().settings, NOW).some((m) => m.property.id === pid)).toBe(false)
  })
})

describe('§7 reassigning a lead', () => {
  it("updates both executives' workloads and Today, the assignment history, and notifies both", () => {
    const l = getDb().leads.find((x) => x.ownerId === 'u-arjun' && OPEN_STAGES.includes(x.stage))!
    const board = () => Object.fromEntries(teamBoard(getDb(), user('u-rohit'), NOW).map((r) => [r.user.id, r.openLeads]))
    const before = board()
    const openTasks = getDb().tasks.filter((t) => t.leadId === l.id && t.status === 'open').length

    as('u-rohit', () => assignLeads([l.id], 'u-sneha', 'Arjun is overloaded'))

    const after = board()
    expect(after['u-arjun']).toBe(before['u-arjun'] - 1)
    expect(after['u-sneha']).toBe(before['u-sneha'] + 1)
    expect(lead(l.id).ownerId).toBe('u-sneha')
    // the work moves with the lead: Sneha's Today has its tasks, Arjun's no longer sees the lead at all
    expect(getDb().tasks.filter((t) => t.leadId === l.id && t.status === 'open' && t.ownerId === 'u-sneha').length).toBe(openTasks)
    expect(visible.leads(getDb(), user('u-arjun')).some((x) => x.id === l.id)).toBe(false)
    expect(executiveToday(getDb(), user('u-arjun'), NOW).items.some((i) => i.leadId === l.id)).toBe(false)
    // history and notifications for both
    expect(getDb().assignments.at(-1)).toMatchObject({ leadId: l.id, fromUserId: 'u-arjun', toUserId: 'u-sneha', by: 'u-rohit', note: 'Arjun is overloaded' })
    expect(notesFor('u-sneha').some((n) => n.kind === 'reassignment' && n.ref?.id === l.id)).toBe(true)
    expect(notesFor('u-arjun').some((n) => n.kind === 'reassignment' && n.ref?.id === l.id)).toBe(true)
    expect(actsFor('lead', l.id).some((a) => a.kind === 'lead.reassigned')).toBe(true)
  })

  it('an assistant reassignment is logged with via "ai"', () => {
    const l = getDb().leads.find((x) => x.ownerId === 'u-arjun' && OPEN_STAGES.includes(x.stage))!
    const ctx: AIContext = { actor: user('u-rohit'), role: 'manager', route: '/today', now: NOW, db: getDb }
    const p = parseCommandSim(`Assign ${l.name} to Sneha`, ctx).proposals[0]
    expect(p?.kind).toMatch(/^assignLead/)
    as('u-rohit', () => executeProposal(p))
    expect(lead(l.id).ownerId).toBe('u-sneha')
    expect(actsFor('lead', l.id).filter((a) => a.kind === 'lead.reassigned').at(-1)?.via).toBe('ai')
  })
})

describe('§7 pipeline stage changes reach Today, Reports and the lead', () => {
  it('a move shows in the stage history, the funnel, the activity log and the owner is notified', () => {
    const l = getDb().leads.find((x) => x.ownerId === 'u-sneha' && x.stage === 'siteVisitDone') ?? getDb().leads.find((x) => x.ownerId === 'u-sneha' && OPEN_STAGES.includes(x.stage) && x.stage !== 'negotiation')!
    const neg = () => funnel(getDb().leads).find((f) => f.stage === 'negotiation')!.current
    const before = neg()
    as('u-rohit', () => changeStage(l.id, 'negotiation'))
    expect(neg()).toBe(before + 1)
    expect(lead(l.id).stageHistory.at(-1)).toMatchObject({ stage: 'negotiation', by: 'u-rohit' })
    expect(actsFor('lead', l.id).at(-1)?.kind).toBe('lead.stageChanged')
    expect(notesFor('u-sneha').some((n) => n.kind === 'stageChanged' && n.ref?.id === l.id)).toBe(true)
    expect(managerToday(getDb(), user('u-rohit'), NOW)).toBeDefined()
  })
})

describe('§7 imported and AI-created leads go through auto-assignment', () => {
  it('an import with no owner column is auto-assigned when auto-assign is on, and stays unassigned when it is off', () => {
    const leads = ['A', 'B'].map((n, i) => ({ ...wakad, name: `Import ${n}`, phone: `98765012${50 + i}` }))
    const { jobId } = as('u-admin', () => completeImport({ kind: 'leads', fileName: 'a.csv', fileType: 'csv', template: 'default', leads, counts: { total: 2 } }))
    const ids = getDb().importJobs.find((j) => j.id === jobId)!.createdIds
    expect(ids.every((id) => !!lead(id).ownerId)).toBe(true)
    expect(ids.every((id) => getDb().assignments.some((a) => a.leadId === id && a.mode === 'auto'))).toBe(true)

    as('u-admin', () => updateSettings('assignment', { autoAssign: false }))
    const more = [{ ...wakad, name: 'Import C', phone: '9876501299' }]
    const { jobId: j2 } = as('u-admin', () => completeImport({ kind: 'leads', fileName: 'b.csv', fileType: 'csv', template: 'default', leads: more, counts: { total: 1 } }))
    expect(lead(getDb().importJobs.find((j) => j.id === j2)!.createdIds[0]).ownerId).toBeNull()
  })

  it('a lead the assistant creates for a manager is auto-assigned like a typed one', () => {
    const ctx: AIContext = { actor: user('u-rohit'), role: 'manager', route: '/leads', now: NOW, db: getDb }
    const p = parseCommandSim('Add lead Kiran Rao 9876512345, 2BHK in Wakad Pune, budget 80 lakh, from 99acres', ctx).proposals.find((x) => x.kind === 'createLead')!
    const out = as('u-rohit', () => executeProposal(p))
    const id = out.links[0].id
    expect(lead(id).ownerId).toBeTruthy()
    expect(getDb().assignments.some((a) => a.leadId === id && a.mode === 'auto')).toBe(true)
    expect(actsFor('lead', id).find((a) => a.kind === 'lead.created')?.via).toBe('ai')
  })

  it('a manually created lead also auto-assigns (and is logged)', () => {
    const { id } = as('u-rohit', () => createLead({ ...wakad, phone: '9876501288', name: 'Typed Lead' }))
    expect(lead(id).ownerId).toBeTruthy()
    expect(notesFor(lead(id).ownerId!).some((n) => n.ref?.id === id)).toBe(true)
  })
})

describe('assignment rules: a manager changes only their own team rules (M8 R6)', () => {
  it('refuses to edit, delete or toggle a company-wide rule, allows their own', () => {
    const global = getDb().settings.assignment.rules.find((r) => r.scope === 'global')
    if (global) {
      expect(() => as('u-rohit', () => deleteRule(global.id))).toThrow(PermissionError)
      expect(() => as('u-rohit', () => saveRule({ ...global, values: ['Hijacked'] }))).toThrow(PermissionError)
      expect(() => as('u-rohit', () => setRuleEnabled(global.id, !global.enabled))).toThrow(PermissionError)
      expect(getDb().settings.assignment.rules.find((r) => r.id === global.id)).toEqual(global)
    }
    const before = getDb().settings.assignment.rules.length
    as('u-rohit', () => saveRule({ kind: 'location', values: ['Pune'], enabled: true, scope: 'global', userIds: ['u-sneha'] }))
    const mine = getDb().settings.assignment.rules.at(-1)!
    expect(getDb().settings.assignment.rules.length).toBe(before + 1)
    expect(mine.scope).toEqual({ managerId: 'u-rohit' })
    as('u-rohit', () => deleteRule(mine.id))
    expect(getDb().settings.assignment.rules.length).toBe(before)
  })
})

describe('§7 every change appears in the activity log', () => {
  it('task edits, reschedules, reopen and delete, and appointment confirm / delete are all logged on the lead', () => {
    const task = getDb().tasks.find((t) => t.ownerId === 'u-arjun' && t.status === 'open' && t.leadId)!
    const count = (kind: string) => getDb().activities.filter((a) => a.kind === kind && a.refs.some((r) => r.id === task.id)).length
    as('u-arjun', () => updateTask(task.id, { priority: 'high' }))
    as('u-arjun', () => rescheduleTasks([task.id], new Date(NOW.getTime() + 86_400_000).toISOString()))
    expect(count('task.updated')).toBe(2)
    expect(getDb().activities.at(-1)?.params.fields).toBe('dueAt')
    expect(actsFor('lead', task.leadId!).at(-1)?.kind).toBe('task.updated')
    as('u-arjun', () => deleteTask(task.id))
    expect(count('task.deleted')).toBe(1)

    const done = getDb().tasks.find((t) => t.status === 'done' && t.ownerId === 'u-arjun')
    if (done) {
      as('u-arjun', () => reopenTask(done.id))
      expect(getDb().activities.at(-1)).toMatchObject({ kind: 'task.updated', params: { fields: 'status' } })
    }

    const apt = getDb().appointments.find((a) => a.ownerId === 'u-arjun' && a.status === 'scheduled')!
    as('u-arjun', () => confirmAppointment(apt.id))
    expect(getDb().activities.at(-1)).toMatchObject({ kind: 'appointment.updated', params: { status: 'confirmed' } })
    as('u-arjun', () => deleteAppointment(apt.id))
    expect(getDb().activities.at(-1)?.kind).toBe('appointment.deleted')
    if (apt.leadId) expect(actsFor('lead', apt.leadId).at(-1)?.kind).toBe('appointment.deleted')
  })
})
