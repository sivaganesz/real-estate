/**
 * Routes owned by the appointments module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'

export const routes: AppRoute[] = [
  { path: '/appointments', permission: 'appointment.view', Component: lazy(() => import('./pages/appointments-page')), titleKey: 'appointments:title' },
  { path: '/appointments/:id', permission: 'appointment.view', Component: lazy(() => import('./pages/appointment-page')), titleKey: 'appointments:stub.detail.title', parent: '/appointments' },
]
