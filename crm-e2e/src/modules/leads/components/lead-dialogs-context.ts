/** The context behind LeadDialogsProvider: any lead view calls `useLeadDialogs().open(...)`. */
import { createContext, useContext } from 'react'
import type { ID, PipelineStageKey } from '@/domain/types'

export type OpenLeadDialog =
  | { kind: 'log'; leadId: ID; channel?: 'call' | 'whatsapp' | 'email' | 'sms' | 'note' }
  | { kind: 'visit'; leadId: ID; propertyIds?: ID[] }
  | { kind: 'task'; leadId: ID }
  | { kind: 'stage'; leadId: ID; to?: PipelineStageKey }
  | { kind: 'assign'; leadIds: ID[] }
  | { kind: 'requestReassign'; leadId: ID }
  | { kind: 'delete'; leadIds: ID[] }

export type LeadDialogsApi = { open: (o: OpenLeadDialog) => void }
export const LeadDialogsContext = createContext<LeadDialogsApi | null>(null)

export function useLeadDialogs(): LeadDialogsApi {
  const api = useContext(LeadDialogsContext)
  if (!api) throw new Error('useLeadDialogs outside LeadDialogsProvider')
  return api
}
