/**
 * The "More" menu for a lead (row hover cluster, card footer, lead page header): open, edit, log, schedule visit,
 * add follow-up, change stage, mark lost, match properties, assign (managers/admins) or request reassignment
 * (executives), delete (with confirm + undo). Hidden when the role cannot do it at all; disabled with the reason when
 * the role can but not on this lead (CONVENTIONS §6).
 */
import {
  ArrowRightLeft, CalendarPlus, ClipboardList, Eye, Hand, ListPlus, MoreHorizontal, Pencil, Target, Trash2, UserPlus, XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Lead } from '@/domain/types'
import { isOpenStage } from '@/domain/catalogue'
import { usePermission } from '@/hooks/use-permission'
import { useLeadDialogs } from './lead-dialogs-context'

export function LeadActionsMenu({ lead, hideOpen, size = 'icon-sm', align = 'end' }: {
  lead: Lead
  hideOpen?: boolean
  size?: 'icon-sm' | 'icon'
  align?: 'start' | 'end'
}) {
  const { t } = useTranslation('leads')
  const navigate = useNavigate()
  const { can, scope } = usePermission()
  const dialogs = useLeadDialogs()
  const edit = can('lead.edit', lead)
  const move = can('lead.moveStage', lead)
  const open = isOpenStage(lead.stage)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size} aria-label={t('actions.moreFor', { name: lead.name })} data-testid="lead-more" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56" onClick={(e) => e.stopPropagation()}>
        {!hideOpen && <DropdownMenuItem onSelect={() => navigate(paths.lead(lead.id))}><Eye />{t('actions.open')}</DropdownMenuItem>}
        {scope('lead.edit') !== false && (
          <DropdownMenuItem disabled={!edit} onSelect={() => navigate(paths.editLead(lead.id))}><Pencil />{t('actions.edit')}</DropdownMenuItem>
        )}
        {scope('lead.edit') !== false && (
          <DropdownMenuItem disabled={!edit} onSelect={() => dialogs.open({ kind: 'log', leadId: lead.id })}><ClipboardList />{t('actions.log')}</DropdownMenuItem>
        )}
        {open && scope('appointment.manage') !== false && (
          <DropdownMenuItem disabled={!edit} onSelect={() => dialogs.open({ kind: 'visit', leadId: lead.id })}><CalendarPlus />{t('actions.scheduleVisit')}</DropdownMenuItem>
        )}
        {open && scope('task.manage') !== false && (
          <DropdownMenuItem disabled={!edit} onSelect={() => dialogs.open({ kind: 'task', leadId: lead.id })}><ListPlus />{t('actions.addFollowUp')}</DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => navigate(paths.matching({ lead: lead.id }))}><Target />{t('actions.match')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {scope('lead.moveStage') !== false && (
          <DropdownMenuItem disabled={!move} onSelect={() => dialogs.open({ kind: 'stage', leadId: lead.id })}><ArrowRightLeft />{t('actions.changeStage')}</DropdownMenuItem>
        )}
        {open && scope('lead.moveStage') !== false && (
          <DropdownMenuItem disabled={!move} onSelect={() => dialogs.open({ kind: 'stage', leadId: lead.id, to: 'lost' })}><XCircle />{t('actions.markLost')}</DropdownMenuItem>
        )}
        {scope('lead.assign') !== false && (
          <DropdownMenuItem disabled={!can('lead.assign', lead)} onSelect={() => dialogs.open({ kind: 'assign', leadIds: [lead.id] })}>
            <UserPlus />{lead.ownerId ? t('actions.reassign') : t('actions.assign')}
          </DropdownMenuItem>
        )}
        {scope('lead.requestReassign') !== false && (
          <DropdownMenuItem disabled={!can('lead.requestReassign', lead)} onSelect={() => dialogs.open({ kind: 'requestReassign', leadId: lead.id })}>
            <Hand />{t('actions.requestReassign')}
          </DropdownMenuItem>
        )}
        {scope('lead.delete') !== false && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={!can('lead.delete', lead)} onSelect={() => dialogs.open({ kind: 'delete', leadIds: [lead.id] })}>
              <Trash2 />{t('actions.delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
