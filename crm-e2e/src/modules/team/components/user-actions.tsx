/**
 * The "…" menu on a person (admin only: `user.manage`): edit, deactivate (with the redistribute dialog) or activate.
 * Hidden entirely for roles without the permission; the admin cannot deactivate themselves (disabled with a reason).
 */
import { useState } from 'react'
import { MoreHorizontal, Pencil, UserCheck, UserRound, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { paths } from '@/app/paths'
import { toastError } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { User } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { activateUser } from '@/services/users'
import { RedistributeDialog } from './redistribute-dialog'
import { UserFormDrawer } from './user-form-drawer'

export function UserActions({ user, showProfile = true }: { user: User; showProfile?: boolean }) {
  const { t } = useTranslation(['team', 'common'])
  const { can, user: me } = usePermission()
  const [editing, setEditing] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const manage = can('user.manage')
  if (!manage && !showProfile) return null
  const self = me.id === user.id

  const activate = () => {
    try {
      activateUser(user.id)
      toast.success(t('team:actions.activated', { name: user.name }), { description: t('team:actions.activatedHint') })
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('team:actions.menu', { name: user.name })} data-testid={`user-actions-${user.id}`}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {showProfile && (
            <DropdownMenuItem asChild>
              <Link to={paths.teamMember(user.id)}><UserRound aria-hidden="true" />{t('team:actions.profile')}</Link>
            </DropdownMenuItem>
          )}
          {manage && (
            <>
              <DropdownMenuItem onSelect={() => setEditing(true)}><Pencil aria-hidden="true" />{t('team:actions.edit')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              {user.status === 'active' ? (
                <DropdownMenuItem
                  disabled={self} onSelect={() => setDeactivating(true)} className="text-danger focus:text-danger"
                  title={self ? t('team:actions.notSelf') : undefined} data-testid={`deactivate-${user.id}`}
                >
                  <UserX aria-hidden="true" />{self ? t('team:actions.notSelf') : t('team:actions.deactivate')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={activate} data-testid={`activate-${user.id}`}><UserCheck aria-hidden="true" />{t('team:actions.activate')}</DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {manage && editing && <UserFormDrawer open={editing} onOpenChange={setEditing} editing={user} />}
      {manage && deactivating && <RedistributeDialog user={user} open={deactivating} onOpenChange={setDeactivating} />}
    </>
  )
}
