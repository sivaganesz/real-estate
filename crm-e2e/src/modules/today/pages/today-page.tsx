/**
 * Today (master prompt §6): the first screen, role-specific, with no clicks needed. The view follows the lead scope
 * of the profile (all → admin view, team → manager view, own → executive view) rather than a role name, so the
 * permission map stays the single source of truth.
 */
import { usePermission } from '@/hooks/use-permission'
import { AdminView } from '../components/admin-view'
import { ExecutiveView } from '../components/executive-view'
import { ManagerView } from '../components/manager-view'

export default function TodayPage() {
  const { scope, user } = usePermission()
  const s = scope('lead.view')
  // keyed by user so switching between the three executive accounts resets local UI state (filters, open menus)
  return (
    <div className="mx-auto w-full max-w-[1600px]">
      {s === 'all' ? <AdminView key={user.id} /> : s === 'team' ? <ManagerView key={user.id} /> : <ExecutiveView key={user.id} />}
    </div>
  )
}
