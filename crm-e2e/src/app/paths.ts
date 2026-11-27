/** Typed path builders: modules navigate to each other only through these (never by importing another module). */
import type { EntityRef, ID } from '@/domain/types'

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString()
  return s ? `?${s}` : ''
}

export const paths = {
  today: () => '/today',
  leads: () => '/leads',
  newLead: () => '/leads/new',
  lead: (id: ID) => `/leads/${id}`,
  editLead: (id: ID) => `/leads/${id}/edit`,
  clients: () => '/clients',
  client: (id: ID) => `/clients/${id}`,
  properties: () => '/properties',
  newProperty: () => '/properties/new',
  property: (id: ID) => `/properties/${id}`,
  editProperty: (id: ID) => `/properties/${id}/edit`,
  matching: (opts: { lead?: ID; property?: ID } = {}) => `/matching${q(opts)}`,
  appointments: (opts: { view?: 'day' | 'week' | 'month' | 'list'; date?: string } = {}) => `/appointments${q(opts)}`,
  appointment: (id: ID) => `/appointments/${id}`,
  tasks: () => '/tasks',
  pipeline: (opts: { view?: 'board' | 'list'; owner?: ID } = {}) => `/pipeline${q(opts)}`,
  import: () => '/import',
  importKind: (kind: string) => `/import/${kind}`,
  importHistory: () => '/import/history',
  drafts: () => '/import/drafts',
  draft: (id: ID) => `/import/drafts/${id}`,
  reports: (tab?: string) => (tab ? `/reports/${tab}` : '/reports'),
  team: () => '/team',
  teamMember: (id: ID) => `/team/${id}`,
  settings: (section?: string) => (section ? `/settings/${section}` : '/settings'),
  notifications: () => '/notifications',
  activity: () => '/activity',
}

/** The page that shows a record (assistant links, notifications, timelines). */
export function pathFor(ref: EntityRef): string {
  switch (ref.kind) {
    case 'lead': return paths.lead(ref.id)
    case 'client': return paths.client(ref.id)
    case 'property': return paths.property(ref.id)
    case 'appointment': return paths.appointment(ref.id)
    case 'task': return paths.tasks()
    case 'user': return paths.teamMember(ref.id)
    case 'importJob': return paths.importHistory()
    case 'draft': return paths.draft(ref.id)
    default: return paths.settings()
  }
}
