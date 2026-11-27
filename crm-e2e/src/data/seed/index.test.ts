import { describe, expect, it } from 'vitest'
import type { DB, EntityRef, Lead } from '@/domain/types'
import { OPEN_STAGES, PROPERTY_TYPES, LEAD_SOURCES } from '@/domain/catalogue'
import { localDay } from '@/lib/dates'
import { isValidIndianMobile } from '@/lib/phone'
import { shiftDb } from '@/store/rebase'
import { CALLS_TODAY } from './activities'
import { INTENDED_TEMPERATURE, SWITCHABLE_EXECUTIVES, buildSeed } from './index'

// A fixed morning in IST-like local time; the seed must hold for any `now`.
const NOW = new Date(2026, 10, 27, 10, 30)
const db = buildSeed(NOW)
const today = localDay(NOW)

const within = (actual: number, expected: number, pct = 0.1) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.ceil(expected * pct))

function resolves(db: DB, ref: EntityRef): boolean {
  const lists: Partial<Record<EntityRef['kind'], { id: string }[]>> = {
    lead: db.leads, client: db.clients, property: db.properties, appointment: db.appointments, task: db.tasks,
    user: db.users, importJob: db.importJobs, draft: db.drafts,
  }
  return ref.kind === 'settings' || !!lists[ref.kind]?.some((x) => x.id === ref.id)
}

describe('seed volumes (plan §6.4)', () => {
  it('has the planned counts', () => {
    expect(db.users).toHaveLength(7)
    const open = db.leads.filter((l) => OPEN_STAGES.includes(l.stage))
    expect(open).toHaveLength(23)
    expect(db.leads.filter((l) => l.stage === 'converted')).toHaveLength(15)
    expect(db.leads.filter((l) => l.stage === 'lost')).toHaveLength(5)
    expect(db.clients).toHaveLength(16)
    expect(db.properties).toHaveLength(20)
    expect(db.drafts).toHaveLength(3)
    expect(db.appointments).toHaveLength(22)
    expect(db.tasks).toHaveLength(28)
    expect(db.notifications).toHaveLength(24)
    expect(db.importJobs).toHaveLength(3)
    // 3 executives × (Hot, Overdue) + manager (Unassigned, Stalled)
    expect(db.savedViews).toHaveLength(8)
    within(db.assignments.length, 50)
    within(db.activities.length, 150, 0.25)
  })

  it('has the property status mix 12 / 2 / 3 / 3', () => {
    const by = (s: string) => db.properties.filter((p) => p.status === s).length
    expect([by('available'), by('onHold'), by('booked'), by('sold')]).toEqual([12, 2, 3, 3])
    for (const p of db.properties) expect(p.category).toBe(PROPERTY_TYPES[p.type].category)
  })

  it('has the planned workloads (auto-assign demo)', () => {
    const open = (owner: string | null) => db.leads.filter((l) => OPEN_STAGES.includes(l.stage) && l.ownerId === owner).length
    expect(open('u-arjun')).toBe(6)
    expect(open('u-vikram')).toBe(5)
    expect(open('u-sneha')).toBe(4)
    expect(open('u-farhan')).toBe(2)
    expect(open('u-kavya')).toBe(1)
    expect(open(null)).toBeGreaterThanOrEqual(3)
    expect(db.settings.assignment.rrCursor).toBe('u-arjun')
  })

  it('uses every lead source at least once', () => {
    for (const s of LEAD_SOURCES) expect(db.leads.some((l) => l.source === s), s).toBe(true)
  })

  it('has about 60% unread notifications', () => {
    const unread = db.notifications.filter((n) => !n.readAt).length / db.notifications.length
    expect(unread).toBeGreaterThan(0.5)
    expect(unread).toBeLessThan(0.7)
  })

  it('logs today\'s calls per executive', () => {
    for (const [userId, n] of Object.entries(CALLS_TODAY)) {
      const calls = db.activities.filter((a) => a.kind === 'comm.call' && a.actorId === userId && localDay(a.at) === today)
      expect(calls.length).toBeGreaterThanOrEqual(n)
    }
  })

  it('marks at least 3 leads with AI-filled fields', () => {
    expect(db.leads.filter((l) => Object.values(l.fieldMeta ?? {}).some((m) => m.origin === 'ai')).length).toBeGreaterThanOrEqual(3)
  })
})

describe('each switchable executive has a demo-worthy day', () => {
  for (const userId of SWITCHABLE_EXECUTIVES) {
    it(userId, () => {
      const mine = db.leads.filter((l) => l.ownerId === userId && OPEN_STAGES.includes(l.stage))
      expect(mine.some((l) => INTENDED_TEMPERATURE[l.id] === 'hot')).toBe(true)
      expect(db.appointments.some((a) => a.ownerId === userId && localDay(a.start) === today && a.type === 'siteVisit')).toBe(true)
      expect(db.tasks.some((t) => t.ownerId === userId && t.status === 'open' && t.dueAt < NOW.toISOString() && localDay(t.dueAt) < today)).toBe(true)
    })
  }

  it('Vikram has a clash today (12:30 and 12:45)', () => {
    const vikram = db.appointments.filter((a) => a.ownerId === 'u-vikram' && localDay(a.start) === today && a.type === 'siteVisit')
    expect(vikram.length).toBe(2)
  })
})

describe('data quality', () => {
  it('every reference resolves', () => {
    const ids = {
      user: new Set(db.users.map((u) => u.id)), lead: new Set(db.leads.map((l) => l.id)), property: new Set(db.properties.map((p) => p.id)),
      client: new Set(db.clients.map((c) => c.id)), appointment: new Set(db.appointments.map((a) => a.id)), task: new Set(db.tasks.map((t) => t.id)),
    }
    const actor = (id: string) => id === 'system' || ids.user.has(id)
    for (const l of db.leads) {
      if (l.ownerId) expect(ids.user.has(l.ownerId), l.id).toBe(true)
      expect(actor(l.createdBy)).toBe(true)
      for (const s of l.shortlist) expect(ids.property.has(s.propertyId), `${l.id} → ${s.propertyId}`).toBe(true)
      if (l.deal?.propertyId) expect(ids.property.has(l.deal.propertyId)).toBe(true)
      if (l.clientId) expect(ids.client.has(l.clientId)).toBe(true)
    }
    for (const c of db.clients) {
      expect(ids.lead.has(c.leadId)).toBe(true)
      expect(ids.user.has(c.ownerId)).toBe(true)
      if (c.propertyId) expect(ids.property.has(c.propertyId)).toBe(true)
    }
    for (const p of db.properties) {
      expect(actor(p.createdBy)).toBe(true)
      if (p.heldForLeadId) expect(ids.lead.has(p.heldForLeadId)).toBe(true)
    }
    for (const a of db.appointments) {
      expect(ids.user.has(a.ownerId)).toBe(true)
      if (a.leadId) expect(ids.lead.has(a.leadId)).toBe(true)
      if (a.clientId) expect(ids.client.has(a.clientId)).toBe(true)
      for (const p of a.propertyIds) expect(ids.property.has(p)).toBe(true)
    }
    for (const t of db.tasks) {
      expect(ids.user.has(t.ownerId)).toBe(true)
      if (t.leadId) expect(ids.lead.has(t.leadId)).toBe(true)
      if (t.clientId) expect(ids.client.has(t.clientId)).toBe(true)
      if (t.appointmentId) expect(ids.appointment.has(t.appointmentId)).toBe(true)
    }
    for (const a of db.activities) for (const r of a.refs) expect(resolves(db, r), `${a.kind} ${r.kind}:${r.id}`).toBe(true)
    for (const n of db.notifications) {
      expect(ids.user.has(n.userId)).toBe(true)
      if (n.ref) expect(resolves(db, n.ref), `${n.kind} ${n.ref.id}`).toBe(true)
    }
    for (const a of db.assignments) {
      expect(ids.lead.has(a.leadId)).toBe(true)
      if (a.toUserId) expect(ids.user.has(a.toUserId)).toBe(true)
    }
    for (const j of db.importJobs) for (const d of j.draftIds) expect(db.drafts.some((x) => x.id === d)).toBe(true)
    for (const v of db.savedViews) expect(ids.user.has(v.userId)).toBe(true)
    for (const r of db.settings.assignment.rules) for (const u of r.userIds) expect(ids.user.has(u)).toBe(true)
  })

  it('uses unique ids and valid Indian mobiles', () => {
    const all = [db.leads, db.properties, db.appointments, db.tasks, db.clients, db.activities, db.notifications, db.assignments].flat().map((x) => x.id)
    expect(new Set(all).size).toBe(all.length)
    for (const l of db.leads) expect(isValidIndianMobile(l.phone), `${l.name} ${l.phone}`).toBe(true)
    for (const u of db.users) expect(isValidIndianMobile(u.phone)).toBe(true)
  })

  it('has one deliberate duplicate phone (Mohd Irfan)', () => {
    const phones = db.leads.map((l) => l.phone)
    const dupes = phones.filter((p, i) => phones.indexOf(p) !== i)
    expect(dupes).toEqual(['+919845098765'])
  })

  it('never uses a real builder brand', () => {
    const text = JSON.stringify(db.properties).toLowerCase()
    for (const brand of ['prestige', 'sobha', 'godrej', 'dlf', 'brigade', 'lodha', 'hiranandani', 'puravankara', 'mahindra']) {
      expect(text.includes(brand), brand).toBe(false)
    }
  })

  it('stage history ends at the current stage', () => {
    const bad = db.leads.filter((l: Lead) => l.stageHistory[l.stageHistory.length - 1]?.stage !== l.stage)
    expect(bad.map((l) => l.id)).toEqual([])
  })

  it('counters continue after the highest seeded id', () => {
    expect(db.meta.counters.LEAD).toBe(1043)
    expect(db.meta.counters.PRP).toBe(1020)
    expect(db.meta.anchorDate).toBe(today)
  })
})

describe('freshness', () => {
  it('after a +5 day rebase, today\'s items are still on the (new) today', () => {
    const later = new Date(NOW)
    later.setDate(later.getDate() + 5)
    const shifted = shiftDb(db, 5)
    const newToday = localDay(later)
    const todaysBefore = db.appointments.filter((a) => localDay(a.start) === today).map((a) => a.id)
    const todaysAfter = shifted.appointments.filter((a) => localDay(a.start) === newToday).map((a) => a.id)
    expect(todaysAfter).toEqual(todaysBefore)
    expect(shifted.meta.anchorDate).toBe(newToday)
  })
})
