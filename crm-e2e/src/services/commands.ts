/**
 * Runs an assistant proposal after the user confirmed it (master prompt §12.0: AI never changes data without
 * confirmation). Each kind calls the same service a form would, with `via: 'ai'`, so the activity log shows ✦ and
 * every side effect (auto-assign, tasks, notifications) happens exactly as for a manual change. The permission is
 * re-checked here (role level) and again by the service (record level). Every applied change can be undone for 10 s
 * (plan §8.3 M7): the database is remembered just before the change. Returns links to the changed records.
 */
import type { EntityRef, PropertyInput } from '@/domain/types'
import { isKind } from '@/ai/proposals'
import type { ActionProposal } from '@/ai/types'
import { PermissionError, can, explainDenied } from '@/lib/permissions'
import { ValidationError } from '@/lib/validation'
import { addNote, logContact } from './activities'
import { createAppointment, rescheduleAppointment } from './appointments'
import { assignLead, assignLeads } from './assignments'
import { currentActor, isSystem } from './core/actor'
import { getDb } from './core/commit'
import { canUndo, remember } from './core/undo'
import { changeStage, createLead, requestReassign, updateLead, type LeadPatch } from './leads'
import { setShortlistStatus, shareProperties } from './matching'
import { createProperty, updateProperty, type PropertyPatch } from './properties'
import { completeTask, createTask, updateTask } from './tasks'

export type ProposalOutcome = {
  links: EntityRef[]
  undoToken?: string
  /** A ready message (share) and its wa.me link; the panel opens it on the user's click. */
  message?: string
  waLink?: string
  /** How many records changed (bulk assignment). */
  count?: number
}

function run(p: ActionProposal): Omit<ProposalOutcome, 'undoToken'> & { undoToken?: string } {
  const via = { via: 'ai' as const }
  if (isKind(p, 'createLead')) {
    const r = createLead(p.payload.input, via)
    return { links: [{ kind: 'lead', id: r.id }] }
  }
  if (isKind(p, 'updateLead')) {
    const r = updateLead(p.payload.leadId, p.payload.patch as LeadPatch, { via: 'ai', undoable: true, fieldMeta: p.payload.fieldMeta })
    return { links: [{ kind: 'lead', id: p.payload.leadId }], undoToken: r.undoToken }
  }
  if (isKind(p, 'assignLead')) {
    const r = assignLead(p.payload.leadId, p.payload.to, undefined, via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }, ...r.result.filter((x) => x.to).map((x) => ({ kind: 'user' as const, id: x.to! }))], undoToken: r.undoToken }
  }
  if (isKind(p, 'assignLeads')) {
    const r = assignLeads(p.payload.leadIds, p.payload.to, p.payload.note, { via: 'ai' })
    return { links: p.payload.leadIds.slice(0, 6).map((id) => ({ kind: 'lead' as const, id })), undoToken: r.undoToken, count: r.result.filter((x) => x.to).length }
  }
  if (isKind(p, 'requestReassign')) {
    requestReassign(p.payload.leadId, p.payload.note, { via: 'ai' })
    return { links: [{ kind: 'lead', id: p.payload.leadId }] }
  }
  if (isKind(p, 'moveStage')) {
    // Lost needs the reason the user saw on the card; Booked needs the property and amount (the stage dialog) — M6 R1
    if (p.payload.to === 'lost' && !p.payload.lostReason) throw new ValidationError([{ field: 'lostReason', key: 'lostReasonRequired' }])
    if (p.payload.to === 'booked' || p.payload.to === 'converted') throw new ValidationError([{ field: 'deal.propertyId', key: 'bookingPropertyRequired' }])
    const extra = p.payload.to === 'lost' ? { lost: { reason: p.payload.lostReason! } } : {}
    const r = changeStage(p.payload.leadId, p.payload.to, extra, via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }], undoToken: r.undoToken }
  }
  if (isKind(p, 'createAppointment')) {
    const r = createAppointment(p.payload.input, via)
    const links: EntityRef[] = [{ kind: 'appointment', id: r.id }]
    if (p.payload.input.leadId) links.push({ kind: 'lead', id: p.payload.input.leadId })
    return { links }
  }
  if (isKind(p, 'rescheduleAppointment')) {
    rescheduleAppointment(p.payload.appointmentId, p.payload.start, via)
    return { links: [{ kind: 'appointment', id: p.payload.appointmentId }] }
  }
  if (isKind(p, 'createTask')) {
    const r = createTask(p.payload.input, via)
    const links: EntityRef[] = [{ kind: 'task', id: r.id }]
    if (p.payload.input.leadId) links.push({ kind: 'lead', id: p.payload.input.leadId })
    return { links }
  }
  if (isKind(p, 'rescheduleTask')) {
    // same as rescheduleTask(), but logged as an AI change (rescheduleTask has no `via` yet — request R2)
    updateTask(p.payload.taskId, { dueAt: p.payload.dueAt }, via)
    const leadId = getDb().tasks.find((x) => x.id === p.payload.taskId)?.leadId
    return { links: [{ kind: 'task', id: p.payload.taskId }, ...(leadId ? [{ kind: 'lead' as const, id: leadId }] : [])] }
  }
  if (isKind(p, 'completeTask')) {
    const r = completeTask(p.payload.taskId, { outcome: p.payload.outcome, callResult: p.payload.callResult }, via)
    return { links: [{ kind: 'task', id: p.payload.taskId }], undoToken: r.undoToken }
  }
  if (isKind(p, 'shortlistProperty')) {
    setShortlistStatus(p.payload.leadId, p.payload.propertyId, 'shortlisted', via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }, { kind: 'property', id: p.payload.propertyId }] }
  }
  if (isKind(p, 'shareProperties')) {
    const r = shareProperties(p.payload.leadId, p.payload.propertyIds, via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }, ...p.payload.propertyIds.map((id) => ({ kind: 'property' as const, id }))], message: r.message, waLink: r.link }
  }
  if (isKind(p, 'logActivity')) {
    if (p.payload.channel === 'note') addNote(p.payload.leadId, p.payload.text ?? '', via)
    else logContact(p.payload.leadId, { channel: p.payload.channel, text: p.payload.text, result: p.payload.result }, via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }] }
  }
  if (isKind(p, 'createProperty')) {
    const r = createProperty(p.payload.input as unknown as PropertyInput, via)
    return { links: [{ kind: 'property', id: r.id }] }
  }
  if (isKind(p, 'updateProperty')) {
    const r = updateProperty(p.payload.propertyId, p.payload.patch as PropertyPatch, { via: 'ai', undoable: true, fieldMeta: p.payload.fieldMeta })
    return { links: [{ kind: 'property', id: p.payload.propertyId }], undoToken: r.undoToken }
  }
  throw new Error(`Unknown proposal kind: ${p.kind}`)
}

export function executeProposal(p: ActionProposal): ProposalOutcome {
  const db = getDb()
  const actor = currentActor(db)
  if (!isSystem(actor) && !can(actor, p.permission)) throw new PermissionError(p.permission, explainDenied(actor, p.permission))
  // one level of undo for every AI change: the database as it was just before
  const mine = remember(db, `ai.${p.kind}`)
  const out = run(p)
  const undoToken = out.undoToken && canUndo(out.undoToken) ? out.undoToken : canUndo(mine) ? mine : undefined
  return { ...out, undoToken }
}
