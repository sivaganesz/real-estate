/**
 * The module assistants of master prompt §12.2, as one registry: each is the same shared <ModuleAssistant module=…>
 * (components/ai/module-assistant) configured per module. `needs` says which record it works on; `relevantAssistants`
 * picks the ones that fit a page (the global panel's "Tools" tab shows them).
 */
import type { EntityRef } from '@/domain/types'
import type { Action } from '@/lib/permissions'

export type ModuleAssistantKey =
  | 'leadCreate' | 'leadEdit' | 'leadQualify' | 'propertyCreate' | 'propertyEdit' | 'propertyMatch'
  | 'appointmentCreate' | 'followUp' | 'import' | 'insights'

export type ModuleAssistantDef = {
  key: ModuleAssistantKey
  /** The record it needs: a lead, a property, a lead or a property, or none. */
  needs: 'lead' | 'property' | 'leadOrProperty' | 'none'
  /** The permission to show it at all (the proposals it makes are re-checked when they run). */
  permission: Action
}

export const MODULE_ASSISTANTS: Record<ModuleAssistantKey, ModuleAssistantDef> = {
  leadCreate: { key: 'leadCreate', needs: 'none', permission: 'lead.create' },
  leadEdit: { key: 'leadEdit', needs: 'lead', permission: 'lead.edit' },
  leadQualify: { key: 'leadQualify', needs: 'lead', permission: 'lead.view' },
  propertyCreate: { key: 'propertyCreate', needs: 'none', permission: 'property.create' },
  propertyEdit: { key: 'propertyEdit', needs: 'property', permission: 'property.edit' },
  propertyMatch: { key: 'propertyMatch', needs: 'leadOrProperty', permission: 'matching.run' },
  appointmentCreate: { key: 'appointmentCreate', needs: 'none', permission: 'appointment.manage' },
  followUp: { key: 'followUp', needs: 'lead', permission: 'lead.view' },
  import: { key: 'import', needs: 'none', permission: 'import.document' },
  insights: { key: 'insights', needs: 'none', permission: 'ai.use' },
}

export const MODULE_ASSISTANT_KEYS = Object.keys(MODULE_ASSISTANTS) as ModuleAssistantKey[]

/** The assistants that fit the page and the open record, most specific first. */
export function relevantAssistants(route: string, selection: EntityRef | undefined): ModuleAssistantKey[] {
  if (selection?.kind === 'lead' || selection?.kind === 'client') return ['followUp', 'leadQualify', 'propertyMatch', 'leadEdit', 'appointmentCreate']
  if (selection?.kind === 'property') return ['propertyMatch', 'propertyEdit']
  if (selection?.kind === 'appointment') return ['followUp', 'appointmentCreate']
  if (route.startsWith('/leads') || route.startsWith('/clients')) return ['leadCreate', 'insights', 'appointmentCreate']
  if (route.startsWith('/properties') || route.startsWith('/matching')) return ['propertyCreate', 'insights']
  if (route.startsWith('/appointments') || route.startsWith('/tasks')) return ['appointmentCreate', 'insights']
  if (route.startsWith('/import')) return ['import', 'leadCreate', 'propertyCreate']
  return ['insights', 'leadCreate', 'appointmentCreate', 'propertyCreate', 'import']
}
