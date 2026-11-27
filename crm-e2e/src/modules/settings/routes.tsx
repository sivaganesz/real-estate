/**
 * Routes owned by the settings module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'
import type { Action } from '@/lib/permissions'
import { SECTIONS, SECTION_ALIASES } from './lib/sections'

/** Each settings section is guarded by the permission that edits it; preferences (and unknown keys) are open to everyone. */
function sectionPermission(section: string | undefined): Action {
  const key = SECTION_ALIASES[section ?? ''] ?? section
  return SECTIONS.find((s) => s.key === key)?.permission ?? 'settings.preferences'
}

export const routes: AppRoute[] = [
  { path: '/settings', permission: 'settings.preferences', Component: lazy(() => import('./pages/settings-page')), titleKey: 'settings:title' },
  { path: '/settings/:section', permission: (params) => sectionPermission(params.section), Component: lazy(() => import('./pages/settings-section-page')), titleKey: 'settings:sectionTitle', parent: '/settings' },
]
