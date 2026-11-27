/**
 * Routes owned by the clients module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'

export const routes: AppRoute[] = [
  { path: '/clients', permission: 'client.view', Component: lazy(() => import('./pages/clients-page')), titleKey: 'clients:title' },
  { path: '/clients/:id', permission: 'client.view', Component: lazy(() => import('./pages/client-page')), titleKey: 'clients:stub.detail.title', parent: '/clients' },
]
