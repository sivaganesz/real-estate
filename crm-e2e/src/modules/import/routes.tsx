/**
 * Routes owned by the import module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'
import type { Action } from '@/lib/permissions'

/** Bulk leads: admin + manager; bulk properties: admin only; anything else (a single document): everyone. */
const importPermission = (kind: string | undefined): Action => {
  if (kind === 'leads') return 'import.leads'
  if (kind && PROPERTY_IMPORT_KINDS.includes(kind)) return 'import.properties'
  return 'import.document'
}
const PROPERTY_IMPORT_KINDS = ['apartments', 'villas', 'plots', 'commercial', 'properties']

export const routes: AppRoute[] = [
  { path: '/import', permission: 'import.document', Component: lazy(() => import('./pages/import-page')), titleKey: 'import:title' },
  { path: '/import/history', permission: 'import.document', Component: lazy(() => import('./pages/import-history-page')), titleKey: 'import:stub.history.title', parent: '/import' },
  { path: '/import/drafts', permission: 'import.document', Component: lazy(() => import('./pages/drafts-page')), titleKey: 'import:stub.drafts.title', parent: '/import' },
  { path: '/import/drafts/:id', permission: 'import.document', Component: lazy(() => import('./pages/draft-page')), titleKey: 'import:stub.draft.title', parent: '/import/drafts' },
  { path: '/import/:kind', permission: (params) => importPermission(params.kind), Component: lazy(() => import('./pages/import-wizard-page')), titleKey: 'import:stub.wizard.title', parent: '/import' },
]
