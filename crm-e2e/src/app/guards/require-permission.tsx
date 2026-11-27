/**
 * Route guard: renders the page when the current profile may open it, else the NoAccess page.
 * The router wraps every registry route with it, using the route's declared permission.
 */
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { useCurrentUser } from '@/hooks/use-current-user'
import { can } from '@/lib/permissions'
import type { RoutePermission } from '../route-types'
import { resolvePermission } from '../routes'
import { NoAccessPage } from './no-access-page'

export function RequirePermission({ permission, children }: { permission: RoutePermission; children: ReactNode }) {
  const user = useCurrentUser()
  const params = useParams()
  const action = resolvePermission(permission, params)
  if (action !== 'any' && !can(user, action)) return <NoAccessPage action={action} />
  return <>{children}</>
}
