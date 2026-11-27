/**
 * Routes owned by the team module (foundation-plan §8.1). Every route declares its permission; the router wraps it
 * in <RequirePermission> and shows NoAccess when it fails. Pages are lazy so each module is its own chunk.
 */
import { lazy } from 'react'
import type { AppRoute } from '@/app/route-types'

export const routes: AppRoute[] = [
  { path: '/team', permission: 'team.view', Component: lazy(() => import('./pages/team-page')), titleKey: 'team:title' },
  { path: '/team/:id', permission: 'team.view', Component: lazy(() => import('./pages/team-member-page')), titleKey: 'team:stub.member.title', parent: '/team' },
]
