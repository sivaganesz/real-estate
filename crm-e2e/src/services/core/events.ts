/**
 * Domain events (foundation-plan §5.2). Services emit them inside commit(); services/core/effects.ts turns each one
 * into an Activity (E1) and the side effects of master prompt §7 (E2–E18), all in the same draft.
 * `via` overrides the commit's origin for the activity (for example 'automation' for an auto-created task).
 */
import type {
  AssignmentMode, AssignmentReasonKey, ID, Lead, Origin, PipelineStageKey, Property, PropertyStatus, ShortlistStatus, Task, Availability,
} from '@/domain/types'

export type ContactChannel = 'call' | 'whatsapp' | 'email' | 'sms'
export type Redistribute = 'auto' | 'unassign' | { toUserId: ID }

type Ev =
  | { type: 'lead.created'; leadId: ID; via: Origin }
  | { type: 'lead.updated'; leadId: ID; fields: string[] }
  | { type: 'lead.stageChanged'; leadId: ID; from: PipelineStageKey; to: PipelineStageKey }
  | {
    type: 'lead.assigned'; leadId: ID; from: ID | null; to: ID | null; mode: AssignmentMode; reasonKey: AssignmentReasonKey
    reasonParams?: Record<string, string | number>; workload?: Record<ID, number>; note?: string
  }
  | { type: 'lead.deleted'; lead: Lead }
  | { type: 'lead.contacted'; leadId: ID; channel: ContactChannel; result?: Task['callResult']; text?: string; silent?: boolean }
  | { type: 'lead.shortlisted'; leadId: ID; propertyId: ID; status: ShortlistStatus }
  | { type: 'lead.shared'; leadId: ID; propertyIds: ID[]; channel: ContactChannel }
  | { type: 'lead.noted'; leadId: ID; text: string }
  | { type: 'appointment.created'; id: ID }
  | { type: 'appointment.rescheduled'; id: ID; from: string }
  | { type: 'appointment.completed'; id: ID }
  | { type: 'appointment.cancelled'; id: ID }
  | { type: 'appointment.noShow'; id: ID }
  | { type: 'task.created'; id: ID }
  | { type: 'task.completed'; id: ID }
  | { type: 'task.cancelled'; id: ID }
  | { type: 'property.created'; id: ID }
  | { type: 'property.updated'; id: ID; fields: string[] }
  | { type: 'property.statusChanged'; id: ID; from: PropertyStatus; to: PropertyStatus }
  | { type: 'property.deleted'; property: Property }
  | { type: 'client.created'; id: ID }
  | { type: 'client.updated'; id: ID; fields: string[] }
  | { type: 'import.completed'; jobId: ID }
  | { type: 'draft.saved'; id: ID }
  | { type: 'user.created'; id: ID }
  | { type: 'user.updated'; id: ID; fields: string[] }
  | { type: 'user.deactivated'; id: ID; redistribute: Redistribute }
  | { type: 'user.activated'; id: ID }
  | { type: 'user.availabilityChanged'; id: ID; from: Availability; to: Availability }
  | { type: 'settings.changed'; section: string }

export type DomainEvent = Ev & { via?: Origin }
export type DomainEventType = DomainEvent['type']
export type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>
