/**
 * Routes owned by the reports module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'

export const routes: AppRoute[] = [
  { path: '/reports', permission: 'report.view', Component: lazy(() => import('./pages/reports-page')), titleKey: 'reports:title' },
  { path: '/reports/:tab', permission: 'report.view', Component: lazy(() => import('./pages/report-tab-page')), titleKey: 'reports:stub.tab.title', parent: '/reports' },
]
