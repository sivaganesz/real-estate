/**
 * Routes owned by the properties module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'

export const routes: AppRoute[] = [
  { path: '/properties', permission: 'property.view', Component: lazy(() => import('./pages/properties-page')), titleKey: 'properties:title' },
  { path: '/properties/new', permission: 'property.create', Component: lazy(() => import('./pages/property-new-page')), titleKey: 'properties:crumb.new', parent: '/properties' },
  { path: '/properties/:id', permission: 'property.view', Component: lazy(() => import('./pages/property-page')), titleKey: 'properties:crumb.detail', parent: '/properties' },
  { path: '/properties/:id/edit', permission: 'property.edit', Component: lazy(() => import('./pages/property-edit-page')), titleKey: 'properties:crumb.edit', parent: '/properties/:id' },
]
