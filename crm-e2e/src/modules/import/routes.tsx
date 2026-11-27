/**
 * Routes owned by the import module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk (SheetJS,
 * pdf.js and tesseract.js load later still, only when a file is read).
 *
 * Bulk import (the history, sheet wizards) is for admins and managers; managers import leads only (§8.3 M5). The hub is
 * open to everyone: executives get its limited form (documents and their drafts), so the sidebar's Import link never
 * lands on NoAccess.
 * A single document (/import/document) and the Drafts list are for everyone: executives extract one record at a time.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'
import type { Action } from '@/lib/permissions'

const PROPERTY_IMPORT_KINDS = ['apartments', 'villas', 'plots', 'commercial', 'properties']
const importPermission = (kind: string | undefined): Action => {
  if (kind === 'leads') return 'import.leads'
  if (kind && PROPERTY_IMPORT_KINDS.includes(kind)) return 'import.properties'
  return 'import.document'
}

export const routes: AppRoute[] = [
  { path: '/import', permission: 'import.document', Component: lazy(() => import('./pages/import-page')), titleKey: 'import:title' },
  { path: '/import/history', permission: 'import.leads', Component: lazy(() => import('./pages/import-history-page')), titleKey: 'import:history.title', parent: '/import' },
  { path: '/import/drafts', permission: 'import.document', Component: lazy(() => import('./pages/drafts-page')), titleKey: 'import:drafts.title', parent: '/import' },
  { path: '/import/drafts/:id', permission: 'import.document', Component: lazy(() => import('./pages/draft-page')), titleKey: 'import:draft.title', parent: '/import/drafts' },
  { path: '/import/:kind', permission: (params) => importPermission(params.kind), Component: lazy(() => import('./pages/import-wizard-page')), titleKey: 'import:wizard.title', parent: '/import' },
]
