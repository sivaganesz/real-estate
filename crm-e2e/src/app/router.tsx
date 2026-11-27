/**
 * The router, built from the route registry. Every registry route is wrapped in <RequirePermission> with its declared
 * permission; unknown URLs show NotFound inside the shell; "/" goes to Today.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { RequirePermission } from './guards/require-permission'
import { HOME_PATH, ROUTES } from './routes'
import { AppShell } from './shell/app-shell'
import { RootError } from './root-error'

const children: RouteObject[] = [
  { index: true, element: <Navigate to={HOME_PATH} replace /> },
  ...ROUTES.map(
    ({ path, permission, Component }): RouteObject => ({
      path,
      element: (
        <RequirePermission permission={permission}>
          <Component />
        </RequirePermission>
      ),
    }),
  ),
  { path: '*', hydrateFallbackElement: <span hidden />, lazy: async () => ({ Component: (await import('./not-found-page')).default }) },
]

export const router = createBrowserRouter([{ path: '/', element: <AppShell />, errorElement: <RootError />, children }])
