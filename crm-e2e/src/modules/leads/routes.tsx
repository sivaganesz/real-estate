/**
 * Routes owned by the leads module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'

export const routes: AppRoute[] = [
  { path: '/leads', permission: 'lead.view', Component: lazy(() => import('./pages/leads-page')), titleKey: 'leads:title' },
  { path: '/leads/new', permission: 'lead.create', Component: lazy(() => import('./pages/lead-new-page')), titleKey: 'leads:stub.new.title', parent: '/leads' },
  { path: '/leads/:id', permission: 'lead.view', Component: lazy(() => import('./pages/lead-page')), titleKey: 'leads:stub.detail.title', parent: '/leads' },
  { path: '/leads/:id/edit', permission: 'lead.edit', Component: lazy(() => import('./pages/lead-edit-page')), titleKey: 'leads:stub.edit.title', parent: '/leads/:id' },
]
