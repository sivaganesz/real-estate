/**
 * Switching profile (foundation-plan §4): update the session (every consumer re-renders, no reload), toast
 * "Now viewing as …", and go to Today when the current page is not allowed for the new profile.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import type { ID, Role } from '@/domain/types'
import { resolveSessionUser } from '@/hooks/use-current-user'
import { useDbStore } from '@/store/db-store'
import { useSessionStore } from '@/store/session-store'
import { HOME_PATH, findRoute, routeAllowed } from '../routes'

export function useSwitchProfile() {
  const { t } = useTranslation(['shell', 'common'])
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return useCallback(
    (role: Role, userId?: ID) => {
      const { users } = useDbStore.getState().db
      const session = useSessionStore.getState()
      const next = resolveSessionUser(users, role, userId ?? '')
      if (session.role === role && session.userId === next.id) return
      session.switchProfile(role, next.id)
      const found = findRoute(pathname)
      if (found && !routeAllowed(next, found.route, found.params)) navigate(HOME_PATH)
      toast.success(t('shell:profile.switched', { name: next.name, role: t(`common:roles.${next.role}`) }), { id: 'profile-switch' })
    },
    [navigate, pathname, t],
  )
}
