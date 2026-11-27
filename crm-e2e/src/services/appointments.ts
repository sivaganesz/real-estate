/**
 * Appointments: book, confirm, reschedule, cancel, no-show, complete with an outcome, delete.
 * A conflict (same executive, overlapping time) is returned as a warning and never blocks (foundation-plan E6).
 * Site visits move the lead's stage and shortlist (E6); completing one creates the post-visit call (E7).
 */
import type { Appointment, AppointmentInput, DB, ID, Origin, PipelineStageKey, VisitOutcome } from '@/domain/types'
import { DEFAULT_DURATION_MIN, STAGE_RANK, UPCOMING_APPOINTMENT_STATUSES } from '@/domain/catalogue'
import { assertValid, validateAppointment } from '@/lib/validation'
import { mapsLink, propertyAddress } from '@/lib/whatsapp'
import { assertActorCan } from './core/actor'
import { commit, getDb, must } from './core/commit'
import { moveStage } from './core/effects'

const endOf = (a: Pick<Appointment, 'start' | 'durationMin'>) => new Date(a.start).getTime() + a.durationMin * 60_000

/** The owner's other booked appointments that overlap this time. Pure. */
export function findConflicts(db: Pick<DB, 'appointments'>, a: Pick<Appointment, 'ownerId' | 'start' | 'durationMin'> & { id?: ID }): Appointment[] {
  const start = new Date(a.start).getTime()
  const end = start + a.durationMin * 60_000
  return db.appointments.filter((o) =>
    o.id !== a.id && o.ownerId === a.ownerId && UPCOMING_APPOINTMENT_STATUSES.includes(o.status) &&
    new Date(o.start).getTime() < end && endOf(o) > start)
}

export type NewAppointment = Omit<AppointmentInput, 'durationMin' | 'reminderMins' | 'propertyIds'> & Partial<Pick<AppointmentInput, 'durationMin' | 'reminderMins' | 'propertyIds'>>

export function createAppointment(input: NewAppointment, opts: { via?: Origin } = {}): { id: ID; conflicts: Appointment[] } {
  const full = { ...input, propertyIds: input.propertyIds ?? [], durationMin: input.durationMin ?? DEFAULT_DURATION_MIN[input.type], reminderMins: input.reminderMins ?? 60 }
  assertValid(validateAppointment(full))
  const conflicts = findConflicts(getDb(), full)
  const { result: id } = commit('appointment.create', (tx) => {
    assertActorCan(tx.actor, 'appointment.manage', { ownerId: full.ownerId }, tx.db)
    const id = tx.id('APT')
    let location = full.location
    if (!location && full.type === 'siteVisit') {
      const p = tx.db.properties.find((x) => x.id === full.propertyIds[0])
      if (p) location = { text: propertyAddress(p), mapUrl: mapsLink(propertyAddress(p)) }
    }
    tx.db.appointments.push({
      ...full, id, status: full.status ?? 'scheduled', location,
      createdBy: tx.actor.id, createdAt: tx.now, updatedAt: tx.now,
    })
    tx.emit({ type: 'appointment.created', id })
    return id
  }, opts)
  return { id, conflicts }
}

export type AppointmentPatch = Partial<Pick<Appointment, 'type' | 'propertyIds' | 'ownerId' | 'durationMin' | 'location' | 'reminderMins' | 'notes' | 'leadId' | 'clientId'>>

export function updateAppointment(id: ID, patch: AppointmentPatch, opts: { via?: Origin } = {}) {
  return commit('appointment.update', (tx) => {
    const a = must(tx.db.appointments, id, 'appointment')
    assertActorCan(tx.actor, 'appointment.manage', a, tx.db)
    if (patch.ownerId && patch.ownerId !== a.ownerId) assertActorCan(tx.actor, 'appointment.manage', { ownerId: patch.ownerId }, tx.db)
    Object.assign(a, patch)
    a.updatedAt = tx.now
  }, opts)
}

/** New time; status becomes "rescheduled" and the old time is kept (E9 tells the owner). Returns new conflicts. */
export function rescheduleAppointment(id: ID, start: string, opts: { via?: Origin; durationMin?: number } = {}): { conflicts: Appointment[] } {
  const a0 = must(getDb().appointments, id, 'appointment')
  const conflicts = findConflicts(getDb(), { id, ownerId: a0.ownerId, start, durationMin: opts.durationMin ?? a0.durationMin })
  commit('appointment.reschedule', (tx) => {
    const a = must(tx.db.appointments, id, 'appointment')
    assertActorCan(tx.actor, 'appointment.manage', a, tx.db)
    const from = a.start
    a.rescheduledFrom = from
    a.start = start
    if (opts.durationMin) a.durationMin = opts.durationMin
    a.status = 'rescheduled'
    a.updatedAt = tx.now
    tx.emit({ type: 'appointment.rescheduled', id, from })
  }, { via: opts.via })
  return { conflicts }
}

export function confirmAppointment(id: ID) {
  return commit('appointment.confirm', (tx) => {
    const a = must(tx.db.appointments, id, 'appointment')
    assertActorCan(tx.actor, 'appointment.manage', a, tx.db)
    a.status = 'confirmed'
    a.updatedAt = tx.now
  })
}

export function cancelAppointment(id: ID, reason?: string, opts: { via?: Origin } = {}) {
  return commit('appointment.cancel', (tx) => {
    const a = must(tx.db.appointments, id, 'appointment')
    assertActorCan(tx.actor, 'appointment.manage', a, tx.db)
    a.status = 'cancelled'
    a.cancelReason = reason?.trim() || undefined
    a.updatedAt = tx.now
    tx.emit({ type: 'appointment.cancelled', id })
  }, { via: opts.via, undoable: true })
}

export function markNoShow(id: ID) {
  return commit('appointment.noShow', (tx) => {
    const a = must(tx.db.appointments, id, 'appointment')
    assertActorCan(tx.actor, 'appointment.manage', a, tx.db)
    a.status = 'noShow'
    a.updatedAt = tx.now
    tx.emit({ type: 'appointment.noShow', id })
  }, { undoable: true })
}

/** Completes with the visit outcome; the stage, shortlist and post-visit call follow (E7). */
export function completeAppointment(id: ID, outcome: Omit<VisitOutcome, 'at' | 'by'>, opts: { via?: Origin } = {}) {
  return commit('appointment.complete', (tx) => {
    const a = must(tx.db.appointments, id, 'appointment')
    assertActorCan(tx.actor, 'appointment.manage', a, tx.db)
    a.status = 'completed'
    a.outcome = { ...outcome, likedPropertyIds: outcome.likedPropertyIds ?? [], at: tx.now, by: tx.actor.id }
    a.updatedAt = tx.now
    tx.emit({ type: 'appointment.completed', id })
  }, { via: opts.via, undoable: true })
}

export function deleteAppointment(id: ID) {
  return commit('appointment.delete', (tx) => {
    const a = must(tx.db.appointments, id, 'appointment')
    assertActorCan(tx.actor, 'appointment.manage', a, tx.db)
    tx.db.appointments = tx.db.appointments.filter((x) => x.id !== id)
  }, { undoable: true })
}

/**
 * M4: completes with the outcome and, in the same commit (one Undo), applies the stage the user accepted from the AI
 * suggestion. Only forward moves to open, detail-free stages; Booked / Lost go through the stage dialog instead.
 */
export function completeAppointmentWithStage(id: ID, outcome: Omit<VisitOutcome, 'at' | 'by'>, stage?: PipelineStageKey, opts: { via?: Origin } = {}) {
  return commit('appointment.complete', (tx) => {
    const a = must(tx.db.appointments, id, 'appointment')
    assertActorCan(tx.actor, 'appointment.manage', a, tx.db)
    a.status = 'completed'
    a.outcome = { ...outcome, likedPropertyIds: outcome.likedPropertyIds ?? [], at: tx.now, by: tx.actor.id }
    a.updatedAt = tx.now
    tx.emit({ type: 'appointment.completed', id })
    const lead = a.leadId ? tx.db.leads.find((l) => l.id === a.leadId) : undefined
    if (lead && stage && !['booked', 'converted', 'lost'].includes(stage) && STAGE_RANK[stage] > STAGE_RANK[lead.stage] && lead.stage !== 'lost' && lead.stage !== 'converted') {
      assertActorCan(tx.actor, 'lead.moveStage', lead, tx.db)
      moveStage(tx, lead, stage)
    }
  }, { via: opts.via, undoable: true })
}
