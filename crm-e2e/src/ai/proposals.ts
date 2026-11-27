/**
 * Payload shapes of the assistant's action proposals. The provider builds them; services/commands.executeProposal runs
 * them after the user confirms (and may edit them first). Type-only imports, so the AI layer stays free of writes.
 */
import type { ID, LostReason, PipelineStageKey, Task } from '@/domain/types'
import type { NewAppointment } from '@/services/appointments'
import type { NewLead } from '@/services/leads'
import type { NewTask } from '@/services/tasks'
import type { ActionProposal, ProposalKind } from './types'

export type ProposalPayloads = {
  createLead: { input: NewLead }
  updateLead: { leadId: ID; patch: Record<string, unknown> }
  assignLead: { leadId: ID; to: ID | 'auto' }
  moveStage: { leadId: ID; to: PipelineStageKey; lostReason?: LostReason }
  createAppointment: { input: NewAppointment }
  rescheduleAppointment: { appointmentId: ID; start: string }
  createTask: { input: NewTask }
  completeTask: { taskId: ID; outcome?: string; callResult?: Task['callResult'] }
  shortlistProperty: { leadId: ID; propertyId: ID }
  shareProperties: { leadId: ID; propertyIds: ID[] }
  logActivity: { leadId: ID; channel: 'call' | 'whatsapp' | 'email' | 'sms' | 'note'; text?: string }
  createProperty: { input: Record<string, unknown> }
  updateProperty: { propertyId: ID; patch: Record<string, unknown> }
}

export type TypedProposal<K extends ProposalKind = ProposalKind> = ActionProposal & { kind: K; payload: ProposalPayloads[K] }

let seq = 0
/** A proposal id that is unique within the session. */
export const proposalId = () => `prop-${Date.now().toString(36)}-${(seq++).toString(36)}`

export function propose<K extends ProposalKind>(p: Omit<TypedProposal<K>, 'id'>): TypedProposal<K> {
  return { ...p, id: proposalId() } as TypedProposal<K>
}
