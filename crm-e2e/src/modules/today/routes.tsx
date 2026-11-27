/**
 * Routes owned by the today module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'

export const routes: AppRoute[] = [
  { path: '/today', permission: 'any', Component: lazy(() => import('./pages/today-page')), titleKey: 'today:title' },
]
