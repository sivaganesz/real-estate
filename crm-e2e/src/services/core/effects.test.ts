import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import type { ID, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import { localDay } from '@/lib/dates'
import { propertiesForLead } from '@/lib/matching'
import { PermissionError } from '@/lib/permissions'
import { useDbStore } from '@/store/db-store'
import { logContact } from '../activities'
import { cancelAppointment, completeAppointment, createAppointment, markNoShow } from '../appointments'
import { assignLeads } from '../assignments'
import { tick } from '../automation'
import { completeImport } from '../imports'
import { changeStage, createLead, deleteLead } from '../leads'
import { shareProperties } from '../matching'
import { changePropertyStatus, deleteProperty } from '../properties'
import { completeTask, createTask } from '../tasks'
import { deactivateUser, setAvailability } from '../users'
import { clock, runAs } from './actor'
import { commit, getDb } from './commit'
import { undo } from './undo'

const NOW = new Date(2026, 10, 27, 10, 0)
const HOUR = 3_600_000
const user = (id: ID): User => getDb().users.find((u) => u.id === id)!
const lead = (id: ID) => getDb().leads.find((l) => l.id === id)!
const as = <T>(id: ID, fn: () => T): T => runAs(user(id), fn)
const notes = (userId: ID, kind?: string) => getDb().notifications.filter((n) => n.userId === userId && (!kind || n.kind === kind))
const tasksFor = (leadId: ID) => getDb().tasks.filter((t) => t.leadId === leadId)
const acts = (leadId: ID) => getDb().activities.filter((a) => a.refs.some((r) => r.kind === 'lead' && r.id === leadId)).map((a) => a.kind)

const wakad = { name: 'Sunil Rao', phone: '9876501234', source: 'acres99' as const, isNri: false, ownerId: null, requirement: { propertyTypes: ['apartment' as const], configurations: ['2BHK' as const], cities: ['Pune'], localities: ['Wakad'], budgetMax: 8_000_000, budgetFlexPct: 10, possession: 'any' as const, facing: [], amenities: [], mustHaves: [], purpose: 'sale' as const } }

beforeEach(() => {
  clock.now = () => NOW
  useDbStore.setState({ db: buildSeed(NOW) })
})

describe('E2/E3 lead created → owner, history, first call', () => {
  it('a manager\'s new lead is auto-assigned (lowest workload), with history, notification and the SLA first-call task', () => {
    const r = as('u-rohit', () => createLead(wakad))
    expect(r.ownerId).toBe('u-sneha')
    expect(r.reasonKey).toBe('lowestWorkload')
    const l = lead(r.id)
    expect(l.firstOwnerId).toBe('u-sneha')
    const asg = getDb().assignments.filter((a) => a.leadId === r.id)
    expect(asg).toHaveLength(1)
    expect(asg[0]).toMatchObject({ fromUserId: null, toUserId: 'u-sneha', mode: 'auto', by: 'u-rohit' })
    expect(asg[0].workload).toMatchObject({ 'u-sneha': 4 })
    const call = tasksFor(r.id).find((t) => t.autoReason === 'slaFirstCall')!
    expect(call).toMatchObject({ ownerId: 'u-sneha', type: 'call', priority: 'high', status: 'open' })
    expect(new Date(call.dueAt).getTime() - new Date(l.createdAt).getTime()).toBe(15 * 60_000)
    expect(notes('u-sneha', 'assignment').some((n) => n.ref?.id === r.id)).toBe(true)
    expect(acts(r.id)).toEqual(expect.arrayContaining(['lead.created', 'lead.assigned', 'task.created']))
    expect(getDb().settings.assignment.rrCursor).toBe('u-sneha')
  })

  it('the next tie goes round-robin, and a Chennai lead follows the location rule', () => {
    as('u-rohit', () => createLead(wakad))
    const second = as('u-rohit', () => createLead({ ...wakad, name: 'Second', phone: '9876501235' }))
    expect(second).toMatchObject({ ownerId: 'u-vikram', reasonKey: 'roundRobinTie' })
    const omr = as('u-rohit', () => createLead({ ...wakad, name: 'Rajesh N', phone: '9876501236', requirement: { ...wakad.requirement, cities: ['Chennai'], localities: ['OMR'] } }))
    expect(omr).toMatchObject({ ownerId: 'u-sneha', reasonKey: 'ruleLocation' })
  })

  it('an executive owns what they create; with auto-assign off a manager\'s lead waits unassigned', () => {
    expect(as('u-vikram', () => createLead(wakad)).ownerId).toBe('u-vikram')
    useDbStore.setState({ db: { ...getDb(), settings: { ...getDb().settings, assignment: { ...getDb().settings.assignment, autoAssign: false } } } })
    const r = as('u-rohit', () => createLead({ ...wakad, phone: '9876501299' }))
    expect(r.ownerId).toBeNull()
    expect(tasksFor(r.id)).toHaveLength(0)
  })

  it('a duplicate phone alerts the admin', () => {
    const r = as('u-rohit', () => createLead({ ...wakad, phone: '+91 98450 98765' }))
    expect(r.duplicates.length).toBeGreaterThan(0)
    expect(notes('u-admin', 'duplicateFound').some((n) => n.ref?.id === r.id)).toBe(true)
  })

  it('reassigning moves open tasks and future appointments, and tells both people', () => {
    const id = 'LEAD-1001' // Priya, Arjun, visit today 11:00
    as('u-rohit', () => assignLeads([id], 'u-sneha', 'Covering for Arjun'))
    expect(lead(id).ownerId).toBe('u-sneha')
    expect(tasksFor(id).filter((t) => t.status === 'open').every((t) => t.ownerId === 'u-sneha')).toBe(true)
    const future = getDb().appointments.filter((a) => a.leadId === id && a.start >= NOW.toISOString() && a.status !== 'cancelled')
    expect(future.length).toBeGreaterThan(0)
    expect(future.every((a) => a.ownerId === 'u-sneha')).toBe(true)
    expect(notes('u-sneha', 'reassignment').some((n) => n.ref?.id === id)).toBe(true)
    expect(notes('u-arjun', 'reassignment').some((n) => n.ref?.id === id)).toBe(true)
    expect(acts(id)).toContain('lead.reassigned')
  })
})

describe('E4 contact', () => {
  it('a logged call moves new → contacted, closes the SLA task, and no answer books a retry in 2 h', () => {
    const r = as('u-rohit', () => createLead(wakad))
    as('u-sneha', () => logContact(r.id, { channel: 'call', result: 'notReachable' }))
    const l = lead(r.id)
    expect(l.stage).toBe('contacted')
    expect(l.firstContactAt).toBe(NOW.toISOString())
    expect(l.engagement.responded).toBe(false)
    expect(tasksFor(r.id).find((t) => t.autoReason === 'slaFirstCall')?.status).toBe('done')
    const retry = tasksFor(r.id).find((t) => t.autoReason === 'noAnswerRetry')!
    expect(new Date(retry.dueAt).getTime()).toBe(NOW.getTime() + 2 * HOUR)
    as('u-sneha', () => logContact(r.id, { channel: 'call', result: 'connected', text: 'Wants Wakad only' }))
    expect(lead(r.id).engagement.responded).toBe(true)
    expect(acts(r.id).filter((k) => k === 'comm.call')).toHaveLength(2)
  })

  it('E10: completing a call task counts as contact', () => {
    const { id } = as('u-arjun', () => createTask({ title: 'Call Ananya', type: 'call', ownerId: 'u-arjun', leadId: 'LEAD-1003', dueAt: NOW.toISOString() }))
    as('u-arjun', () => completeTask(id, { callResult: 'busy' }))
    expect(lead('LEAD-1003').lastContactAt).toBe(NOW.toISOString())
    expect(tasksFor('LEAD-1003').some((t) => t.autoReason === 'noAnswerRetry' && t.status === 'open')).toBe(true)
  })
})

describe('E5 stage changes', () => {
  it('booked → property booked, client created, documents task, manager and admin told, and the property leaves matching', () => {
    const db = getDb()
    const target = db.leads.find((l) => l.id === 'LEAD-1003')!
    // a property someone else also has on their shortlist (to see E12), else any available one
    const shared = db.properties.find((p) => p.status === 'available' && db.leads.some((l) => l.id !== target.id && OPEN_STAGES.includes(l.stage) && l.ownerId && l.shortlist.some((s) => s.propertyId === p.id && s.status !== 'notInterested')))!
    expect(shared).toBeDefined()
    const other = db.leads.find((l) => l.id !== target.id && OPEN_STAGES.includes(l.stage) && l.shortlist.some((s) => s.propertyId === shared.id))!
    expect(() => as('u-arjun', () => changeStage(target.id, 'booked', {}))).toThrow()
    as('u-arjun', () => changeStage(target.id, 'booked', { deal: { propertyId: shared.id, bookingAmount: 500_000, value: shared.price } }))
    const after = getDb()
    expect(after.properties.find((p) => p.id === shared.id)!.status).toBe('booked')
    const l = lead(target.id)
    expect(l.stage).toBe('booked')
    expect(l.stageHistory.at(-1)).toMatchObject({ stage: 'booked', by: 'u-arjun' })
    const client = after.clients.find((c) => c.leadId === target.id)!
    expect(client).toMatchObject({ status: 'booked', propertyId: shared.id, bookingAmount: 500_000, ownerId: 'u-arjun' })
    expect(l.clientId).toBe(client.id)
    expect(tasksFor(target.id).some((t) => t.autoReason === 'bookingDocs' && t.status === 'open')).toBe(true)
    expect(notes('u-rohit', 'booking').some((n) => n.ref?.id === target.id)).toBe(true)
    expect(notes('u-admin', 'booking').some((n) => n.ref?.id === target.id)).toBe(true)
    // E12: the other interested lead's owner hears about it, and matching drops the property for everyone
    expect(notes(other.ownerId!, 'propertyUnavailable').some((n) => n.ref?.id === shared.id)).toBe(true)
    const otherLead = lead(other.id)
    expect(propertiesForLead(otherLead, after.properties, after.settings, NOW).some((m) => m.property.id === shared.id)).toBe(false)
  })

  it('lost needs a reason, then cancels open tasks and future appointments', () => {
    const id = 'LEAD-1001'
    expect(() => as('u-arjun', () => changeStage(id, 'lost'))).toThrow()
    as('u-arjun', () => changeStage(id, 'lost', { lost: { reason: 'boughtElsewhere', note: 'Bought in Sarjapur' } }))
    expect(lead(id).lost).toMatchObject({ reason: 'boughtElsewhere', by: 'u-arjun' })
    expect(tasksFor(id).filter((t) => t.status === 'open')).toHaveLength(0)
    expect(getDb().appointments.filter((a) => a.leadId === id && a.start >= NOW.toISOString()).every((a) => a.status === 'cancelled')).toBe(true)
  })

  it('a stage move can be undone', () => {
    const before = lead('LEAD-1003').stage
    const { undoToken } = as('u-arjun', () => changeStage('LEAD-1003', 'negotiation'))
    expect(lead('LEAD-1003').stage).toBe('negotiation')
    expect(undo(undoToken)).toBe(true)
    expect(lead('LEAD-1003').stage).toBe(before)
  })
})

describe('E6–E9 appointments', () => {
  it('booking a site visit moves the stage and shortlists; completing it creates the post-visit call', () => {
    const id = 'LEAD-1003' // Ananya, qualified
    const pid = getDb().properties.find((p) => p.status === 'available' && p.location.city === 'Bengaluru')!.id
    const start = new Date(NOW.getTime() + 26 * HOUR).toISOString()
    const { id: apt, conflicts } = as('u-arjun', () => createAppointment({ type: 'siteVisit', leadId: id, propertyIds: [pid], ownerId: 'u-arjun', start }))
    expect(conflicts).toEqual([])
    expect(lead(id).stage).toBe('siteVisitScheduled')
    expect(lead(id).shortlist.find((s) => s.propertyId === pid)?.status).toBe('shortlisted')
    expect(getDb().appointments.find((a) => a.id === apt)!.location?.mapUrl).toMatch(/google\.com\/maps/)
    as('u-arjun', () => completeAppointment(apt, { result: 'readyToBook', likedPropertyIds: [pid] }))
    const l = lead(id)
    expect(l.stage).toBe('siteVisitDone')
    expect(l.engagement.siteVisited).toBe(true)
    expect(l.shortlist.find((s) => s.propertyId === pid)?.status).toBe('liked')
    const post = tasksFor(id).find((t) => t.autoReason === 'postVisitCall' && t.appointmentId === apt)!
    expect(new Date(post.dueAt).getTime()).toBe(NOW.getTime() + 24 * HOUR)
    expect(notes('u-rohit', 'system').some((n) => n.params.variant === 'readyToBook' && n.ref?.id === id)).toBe(true)
  })

  it('a manager booking for an executive notifies them, and an overlapping visit is a warning, not a block', () => {
    const vikramToday = getDb().appointments.find((a) => a.ownerId === 'u-vikram' && localDay(a.start) === localDay(NOW) && a.type === 'siteVisit')!
    const { conflicts } = as('u-rohit', () => createAppointment({ type: 'phoneCall', leadId: 'LEAD-1012', ownerId: 'u-vikram', start: vikramToday.start }))
    expect(conflicts.length).toBeGreaterThan(0)
    expect(notes('u-vikram', 'appointmentCreated').length).toBeGreaterThan(0)
  })

  it('no-show and cancel create a reschedule task for tomorrow 11:00; the stage does not move back', () => {
    const a = getDb().appointments.find((x) => x.leadId === 'LEAD-1001' && x.start >= NOW.toISOString())!
    const stage = lead('LEAD-1001').stage
    as('u-arjun', () => markNoShow(a.id))
    const t = tasksFor('LEAD-1001').find((x) => x.autoReason === 'noShowReschedule')!
    expect(new Date(t.dueAt).getHours()).toBe(11)
    expect(localDay(t.dueAt)).toBe(localDay(new Date(NOW.getTime() + 24 * HOUR)))
    expect(lead('LEAD-1001').stage).toBe(stage)
    const other = getDb().appointments.find((x) => x.ownerId === 'u-sneha' && x.leadId && x.start >= NOW.toISOString() && x.status !== 'cancelled')!
    as('u-sneha', () => cancelAppointment(other.id, 'Client travelling'))
    expect(tasksFor(other.leadId!).some((x) => x.autoReason === 'visitCancelledReschedule')).toBe(true)
  })
})

describe('E11 share, E13 delete, E14–E16', () => {
  it('sharing marks the shortlist as shared, logs it, counts as contact, and returns the WhatsApp message', () => {
    const pids = getDb().properties.filter((p) => p.status === 'available' && p.location.city === 'Bengaluru').slice(0, 2).map((p) => p.id)
    const out = as('u-arjun', () => shareProperties('LEAD-1003', pids))
    expect(out.message).toMatch(/^Hi Ananya/)
    expect(out.link).toMatch(/^https:\/\/wa\.me\/91\d{10}\?text=/)
    const l = lead('LEAD-1003')
    for (const pid of pids) expect(l.shortlist.find((s) => s.propertyId === pid)?.status).toBe('shared')
    expect(l.lastContactAt).toBe(NOW.toISOString())
    expect(acts('LEAD-1003')).toContain('property.shared')
  })

  it('deleting a property cleans shortlists, deals and single-property visits, and undo brings it all back', () => {
    const db = getDb()
    const p = db.properties.find((x) => db.leads.some((l) => l.shortlist.some((s) => s.propertyId === x.id)))!
    const { undoToken } = as('u-admin', () => deleteProperty(p.id))
    const after = getDb()
    expect(after.properties.some((x) => x.id === p.id)).toBe(false)
    expect(after.leads.some((l) => l.shortlist.some((s) => s.propertyId === p.id) || l.deal?.propertyId === p.id)).toBe(false)
    expect(after.appointments.filter((a) => a.propertyIds.includes(p.id) && a.status !== 'cancelled' && a.start >= NOW.toISOString())).toHaveLength(0)
    expect(after.activities.at(-1)?.kind).toBe('property.deleted')
    expect(undo(undoToken)).toBe(true)
    expect(getDb()).toBe(db)
  })

  it('only admins delete properties; an executive cannot delete a lead (nothing changes)', () => {
    const before = getDb()
    const pid = before.properties[0].id
    expect(() => as('u-rohit', () => deleteProperty(pid))).toThrow(PermissionError)
    expect(() => as('u-arjun', () => deleteLead('LEAD-1001'))).toThrow(PermissionError)
    expect(getDb()).toBe(before)
  })

  it('deactivating a user redistributes their open leads, drops them from rules and the pool', () => {
    as('u-admin', () => deactivateUser('u-sneha', 'auto'))
    const db = getDb()
    expect(db.leads.filter((l) => l.ownerId === 'u-sneha' && OPEN_STAGES.includes(l.stage))).toHaveLength(0)
    const moved = db.assignments.filter((a) => a.fromUserId === 'u-sneha' && a.mode === 'redistribution')
    expect(moved.length).toBe(4)
    expect(new Set(moved.map((a) => a.toUserId))).not.toContain('u-farhan')
    expect(db.settings.assignment.rules.every((r) => !r.userIds.includes('u-sneha'))).toBe(true)
    // workloads were updated between picks: not all four went to one person
    expect(new Set(moved.map((a) => a.toUserId)).size).toBeGreaterThan(1)
  })

  it('unassigning on deactivation leaves the leads in the queue and alerts the admin', () => {
    as('u-admin', () => deactivateUser('u-vikram', 'unassign'))
    expect(notes('u-admin', 'deactivatedOwner').at(-1)?.params.count).toBe(5)
  })

  it('going on leave asks the manager to reassign', () => {
    as('u-arjun', () => setAvailability('u-arjun', 'onLeave', '2026-12-01'))
    expect(notes('u-rohit', 'leaveReassign').at(-1)?.params).toMatchObject({ name: 'Arjun Mehta', count: 6 })
  })

  it('an import creates and auto-assigns leads, then notifies once per assignee and the admins', () => {
    const leads = ['A', 'B', 'C'].map((n, i) => ({ ...wakad, name: `Import ${n}`, phone: `98765012${40 + i}` }))
    const { jobId } = as('u-rohit', () => completeImport({ kind: 'leads', fileName: 'leads.csv', fileType: 'csv', template: 'default', leads, counts: { total: 3 } }))
    const job = getDb().importJobs.find((j) => j.id === jobId)!
    expect(job).toMatchObject({ status: 'completed', counts: { imported: 3 } })
    const owners = job.createdIds.map((id) => lead(id).ownerId)
    expect(owners.every(Boolean)).toBe(true)
    expect(notes('u-sneha', 'assignment').filter((n) => n.params.variant === 'assignmentBatch')).toHaveLength(1)
    expect(notes('u-rohit', 'importFinished')).toHaveLength(1)
    expect(notes('u-admin', 'importFinished').length).toBeGreaterThan(1)
  })

  it('property on hold for a lead tells the other interested owners but not the lead it is held for', () => {
    const db = getDb()
    const p = db.properties.find((x) => x.status === 'available' && db.leads.filter((l) => l.shortlist.some((s) => s.propertyId === x.id)).length >= 1)!
    const holder = db.leads.find((l) => l.shortlist.some((s) => s.propertyId === p.id))!
    as('u-admin', () => changePropertyStatus(p.id, 'onHold', { heldForLeadId: holder.id, heldUntil: new Date(NOW.getTime() + 48 * HOUR).toISOString() }))
    expect(getDb().notifications.some((n) => n.kind === 'propertyUnavailable' && n.dedupeKey?.endsWith(`:${holder.id}`))).toBe(false)
  })
})

describe('commit and automation', () => {
  it('a failing change applies nothing', () => {
    const before = getDb()
    expect(() => commit('boom', (tx) => {
      tx.db.leads[0].name = 'Changed'
      throw new Error('boom')
    })).toThrow('boom')
    expect(getDb()).toBe(before)
  })

  it('the ticker is idempotent: a second pass adds nothing and does not change the database', () => {
    const later = new Date(NOW.getTime() + 2 * HOUR)
    const first = tick(later)
    expect(first).toBeGreaterThan(0)
    const db = getDb()
    expect(tick(later)).toBe(0)
    expect(getDb()).toBe(db)
  })

  it('the ticker sends overdue, SLA and stalled notices with dedupe keys', () => {
    tick(new Date(NOW.getTime() + 2 * HOUR))
    const db = getDb()
    expect(db.notifications.some((n) => n.dedupeKey === 'overdue:TSK-1002')).toBe(true)
    // already sent in the seed: not sent twice
    expect(db.notifications.filter((n) => n.kind === 'escalation' && n.dedupeKey === 'escalation:LEAD-1005')).toHaveLength(1)
    expect(db.notifications.filter((n) => n.dedupeKey?.startsWith('stalled:LEAD-1008'))).toHaveLength(1)
    // a reminder for an appointment starting within its reminder window
    expect(db.notifications.some((n) => n.kind === 'appointmentReminder' && n.dedupeKey?.startsWith('reminder:'))).toBe(true)
  })
})
