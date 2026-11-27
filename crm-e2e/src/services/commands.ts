/**
 * Runs an assistant proposal after the user confirmed it (master prompt §12.0: AI never changes data without
 * confirmation). Each kind calls the same service a form would, with `via: 'ai'`, so the activity log shows ✦ and
 * every side effect (auto-assign, tasks, notifications) happens exactly as for a manual change. Returns links to the
 * changed records and the undo token when the change can be undone. First version (M7 deepens it).
 */
import type { EntityRef } from '@/domain/types'
import type { ProposalPayloads, TypedProposal } from '@/ai/proposals'
import type { ActionProposal } from '@/ai/types'
import { addNote, logContact } from './activities'
import { createAppointment, rescheduleAppointment } from './appointments'
import { assignLead } from './assignments'
import { changeStage, createLead, updateLead, type LeadPatch } from './leads'
import { setShortlistStatus, shareProperties } from './matching'
import { createProperty, updateProperty, type PropertyPatch } from './properties'
import { completeTask, createTask } from './tasks'
import type { PropertyInput } from '@/domain/types'

export type ProposalOutcome = { links: EntityRef[]; undoToken?: string; message?: string; waLink?: string }

const is = <K extends keyof ProposalPayloads>(p: ActionProposal, kind: K): p is TypedProposal<K> => p.kind === kind

export function executeProposal(p: ActionProposal): ProposalOutcome {
  const via = { via: 'ai' as const }
  if (is(p, 'createLead')) {
    const r = createLead(p.payload.input, via)
    return { links: [{ kind: 'lead', id: r.id }] }
  }
  if (is(p, 'updateLead')) {
    updateLead(p.payload.leadId, p.payload.patch as LeadPatch, { via: 'ai', undoable: true })
    return { links: [{ kind: 'lead', id: p.payload.leadId }] }
  }
  if (is(p, 'assignLead')) {
    const r = assignLead(p.payload.leadId, p.payload.to)
    return { links: [{ kind: 'lead', id: p.payload.leadId }], undoToken: r.undoToken }
  }
  if (is(p, 'moveStage')) {
    const extra = p.payload.to === 'lost' ? { lost: { reason: p.payload.lostReason ?? 'other' } } : {}
    const r = changeStage(p.payload.leadId, p.payload.to, extra, via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }], undoToken: r.undoToken }
  }
  if (is(p, 'createAppointment')) {
    const r = createAppointment(p.payload.input, via)
    const links: EntityRef[] = [{ kind: 'appointment', id: r.id }]
    if (p.payload.input.leadId) links.push({ kind: 'lead', id: p.payload.input.leadId })
    return { links }
  }
  if (is(p, 'rescheduleAppointment')) {
    rescheduleAppointment(p.payload.appointmentId, p.payload.start, via)
    return { links: [{ kind: 'appointment', id: p.payload.appointmentId }] }
  }
  if (is(p, 'createTask')) {
    const r = createTask(p.payload.input, via)
    const links: EntityRef[] = [{ kind: 'task', id: r.id }]
    if (p.payload.input.leadId) links.push({ kind: 'lead', id: p.payload.input.leadId })
    return { links }
  }
  if (is(p, 'completeTask')) {
    const r = completeTask(p.payload.taskId, { outcome: p.payload.outcome, callResult: p.payload.callResult }, via)
    return { links: [{ kind: 'task', id: p.payload.taskId }], undoToken: r.undoToken }
  }
  if (is(p, 'shortlistProperty')) {
    setShortlistStatus(p.payload.leadId, p.payload.propertyId, 'shortlisted', via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }, { kind: 'property', id: p.payload.propertyId }] }
  }
  if (is(p, 'shareProperties')) {
    const r = shareProperties(p.payload.leadId, p.payload.propertyIds, via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }], message: r.message, waLink: r.link }
  }
  if (is(p, 'logActivity')) {
    if (p.payload.channel === 'note') addNote(p.payload.leadId, p.payload.text ?? '', via)
    else logContact(p.payload.leadId, { channel: p.payload.channel, text: p.payload.text }, via)
    return { links: [{ kind: 'lead', id: p.payload.leadId }] }
  }
  if (is(p, 'createProperty')) {
    const r = createProperty(p.payload.input as unknown as PropertyInput, via)
    return { links: [{ kind: 'property', id: r.id }] }
  }
  if (is(p, 'updateProperty')) {
    updateProperty(p.payload.propertyId, p.payload.patch as PropertyPatch, { via: 'ai', undoable: true })
    return { links: [{ kind: 'property', id: p.payload.propertyId }] }
  }
  throw new Error(`Unknown proposal kind: ${p.kind}`)
}
