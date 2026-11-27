/**
 * Routes owned by the matching module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'

export const routes: AppRoute[] = [
  { path: '/matching', permission: 'matching.run', Component: lazy(() => import('./pages/matching-page')), titleKey: 'matching:title' },
]
