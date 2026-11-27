/**
 * THE route registry (foundation-plan §2): every module's routes.tsx is collected here. The router builds from it,
 * crumbs read titles from it, and the profile switcher asks it whether the current page is allowed for a new role.
 */
import { matchPath, type Params } from 'react-router'
import type { User } from '@/domain/types'
import { can } from '@/lib/permissions'
import { routes as activity } from '@/modules/activity/routes'
import { routes as appointments } from '@/modules/appointments/routes'
import { routes as clients } from '@/modules/clients/routes'
import { routes as importRoutes } from '@/modules/import/routes'
import { routes as leads } from '@/modules/leads/routes'
import { routes as matching } from '@/modules/matching/routes'
import { routes as notifications } from '@/modules/notifications/routes'
import { routes as pipeline } from '@/modules/pipeline/routes'
import { routes as properties } from '@/modules/properties/routes'
import { routes as reports } from '@/modules/reports/routes'
import { routes as settings } from '@/modules/settings/routes'
import { routes as tasks } from '@/modules/tasks/routes'
import { routes as team } from '@/modules/team/routes'
import { routes as today } from '@/modules/today/routes'
import type { AppRoute, RoutePermission } from './route-types'

export const ROUTES: AppRoute[] = [
  ...today, ...tasks, ...appointments, ...leads, ...pipeline, ...clients, ...matching, ...properties, ...importRoutes,
  ...reports, ...activity, ...team, ...settings, ...notifications,
]

export const HOME_PATH = '/today'

/** The action a route needs for these URL params ('any' = every profile). */
export function resolvePermission(permission: RoutePermission, params: Params) {
  return typeof permission === 'function' ? permission(params) : permission
}

export function routeAllowed(user: User, route: AppRoute, params: Params): boolean {
  const action = resolvePermission(route.permission, params)
  return action === 'any' || can(user, action)
}

/** The registry entry for a pathname, with its params (most specific match wins: static segments before params). */
export function findRoute(pathname: string): { route: AppRoute; params: Params } | undefined {
  const matches = ROUTES.map((route) => ({ route, m: matchPath({ path: route.path, end: true }, pathname) }))
    .filter((x): x is { route: AppRoute; m: NonNullable<typeof x.m> } => x.m !== null)
    .sort((a, b) => staticWeight(b.route.path) - staticWeight(a.route.path))
  const best = matches[0]
  return best ? { route: best.route, params: best.m.params } : undefined
}

const staticWeight = (path: string) => path.split('/').filter((s) => s && !s.startsWith(':')).length

/** Breadcrumb trail for a pathname: [{ titleKey, to }] from the section root to the page. */
export function crumbsFor(pathname: string): { titleKey: string; to: string }[] {
  const found = findRoute(pathname)
  if (!found) return []
  const trail: { titleKey: string; to: string }[] = []
  let current: AppRoute | undefined = found.route
  let guard = 0
  while (current && guard++ < 5) {
    const to = fillPath(current.path, found.params)
    trail.unshift({ titleKey: titleKeyOf(current, found.params), to })
    const parentPath: string | undefined = current.parent
    current = parentPath ? ROUTES.find((r) => r.path === parentPath) : undefined
  }
  return trail
}

/** The route's title key for these params (titleKeyFor when it knows the value, else the static key). */
export const titleKeyOf = (route: AppRoute, params: Params) => route.titleKeyFor?.(params) ?? route.titleKey

const fillPath = (path: string, params: Params) => path.replace(/:(\w+)/g, (_, k: string) => params[k] ?? k)
