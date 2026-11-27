/** The context behind LeadDialogsProvider: any lead view calls `useLeadDialogs().open(...)`. */
import { createContext, useContext } from 'react'
import type { ID, PipelineStageKey } from '@/domain/types'

export type OpenLeadDialog =
  | { kind: 'log'; leadId: ID; channel?: 'call' | 'whatsapp' | 'email' | 'sms' | 'note' }
  | { kind: 'visit'; leadId: ID; propertyIds?: ID[] }
  | { kind: 'task'; leadId: ID }
  | { kind: 'stage'; leadId: ID; to?: PipelineStageKey }
  /** onDone runs after the assign succeeds (the list clears its bulk selection). */
  | { kind: 'assign'; leadIds: ID[]; onDone?: () => void }
  | { kind: 'requestReassign'; leadId: ID }
  | { kind: 'delete'; leadIds: ID[] }

export type LeadDialogsApi = { open: (o: OpenLeadDialog) => void }
export const LeadDialogsContext = createContext<LeadDialogsApi | null>(null)

export function useLeadDialogs(): LeadDialogsApi {
  const api = useContext(LeadDialogsContext)
  if (!api) throw new Error('useLeadDialogs outside LeadDialogsProvider')
  return api
}
