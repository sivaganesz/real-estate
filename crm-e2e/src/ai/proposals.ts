/**
 * Payload shapes of the assistant's action proposals. The provider builds them; services/commands.executeProposal runs
 * them after the user confirms (and may edit them first). Type-only imports, so the AI layer stays free of writes.
 */
import type { FieldMetaMap, ID, LostReason, PipelineStageKey, Task } from '@/domain/types'
import type { NewAppointment } from '@/services/appointments'
import type { NewLead } from '@/services/leads'
import type { NewTask } from '@/services/tasks'
import type { ActionProposal, ProposalKind } from './types'

export type ProposalPayloads = {
  createLead: { input: NewLead }
  updateLead: { leadId: ID; patch: Record<string, unknown>; fieldMeta?: FieldMetaMap }
  assignLead: { leadId: ID; to: ID | 'auto' }
  assignLeads: { leadIds: ID[]; to: ID | 'auto'; note?: string }
  requestReassign: { leadId: ID; note?: string }
  moveStage: { leadId: ID; to: PipelineStageKey; lostReason?: LostReason }
  createAppointment: { input: NewAppointment }
  rescheduleAppointment: { appointmentId: ID; start: string }
  createTask: { input: NewTask }
  rescheduleTask: { taskId: ID; dueAt: string }
  completeTask: { taskId: ID; outcome?: string; callResult?: Task['callResult'] }
  shortlistProperty: { leadId: ID; propertyId: ID }
  shareProperties: { leadId: ID; propertyIds: ID[] }
  logActivity: { leadId: ID; channel: 'call' | 'whatsapp' | 'email' | 'sms' | 'note'; text?: string; result?: Task['callResult'] }
  createProperty: { input: Record<string, unknown> }
  updateProperty: { propertyId: ID; patch: Record<string, unknown>; fieldMeta?: FieldMetaMap }
}

export type TypedProposal<K extends ProposalKind = ProposalKind> = ActionProposal & { kind: K; payload: ProposalPayloads[K] }

let seq = 0
/** A proposal id that is unique within the session. */
export const proposalId = () => `prop-${Date.now().toString(36)}-${(seq++).toString(36)}`

export function propose<K extends ProposalKind>(p: Omit<TypedProposal<K>, 'id'>): TypedProposal<K> {
  return { ...p, id: proposalId() } as TypedProposal<K>
}

export const isKind = <K extends ProposalKind>(p: ActionProposal, kind: K): p is TypedProposal<K> => p.kind === kind

/** Field paths of a patch ("requirement.budgetMax"), marked as AI-filled with a confidence. */
export function aiMeta(patch: Record<string, unknown>, confidence = 0.85): FieldMetaMap {
  const meta: FieldMetaMap = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && (k === 'requirement' || k === 'qualification')) {
      for (const f of Object.keys(v)) meta[`${k}.${f}`] = { origin: 'ai', confidence }
    } else meta[k] = { origin: 'ai', confidence }
  }
  return meta
}
