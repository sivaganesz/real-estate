/**
 * Routes owned by the settings module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'
import type { Action } from '@/lib/permissions'

/** Each settings section is guarded by the permission that edits it; preferences are open to everyone. */
const SECTION_PERMISSION: Record<string, Action> = {
  pipeline: 'settings.pipeline', templates: 'settings.templates', matching: 'settings.matching', sla: 'settings.matching',
  scoring: 'settings.matching', assignment: 'rules.configure', users: 'user.manage', demo: 'demo.reset',
}

export const routes: AppRoute[] = [
  { path: '/settings', permission: 'settings.preferences', Component: lazy(() => import('./pages/settings-page')), titleKey: 'settings:title' },
  { path: '/settings/:section', permission: (params) => SECTION_PERMISSION[params.section ?? ''] ?? 'settings.preferences', Component: lazy(() => import('./pages/settings-section-page')), titleKey: 'settings:stub.section.title', parent: '/settings' },
]
