/**
 * Everything you can do with an appointment (master prompt §16): confirm, log the outcome, reschedule, cancel (reason),
 * no-show, edit, delete. Shown as a button bar on the detail page and as a compact menu on list cards. Buttons follow
 * the permission map: hidden when the role can never manage appointments, disabled with the reason when it is someone
 * else's. Destructive actions confirm and offer Undo.
 */
import { useState } from 'react'
import { CalendarClock, Check, ClipboardCheck, MoreHorizontal, Pencil, Trash2, UserX, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AppointmentFormDialog } from '@/components/domain/appointment-form-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Appointment } from '@/domain/types'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { cn } from '@/lib/utils'
import { confirmAppointment, deleteAppointment, markNoShow } from '@/services/appointments'
import { appointmentState } from '../lib/calendar'
import { OutcomeDialog } from './outcome-dialog'
import { CancelDialog, RescheduleDialog } from './status-dialogs'

type Dlg = 'outcome' | 'reschedule' | 'cancel' | 'noShow' | 'delete' | 'edit' | null

export function AppointmentActions({ appointment: a, variant = 'bar', onDeleted, className }: {
  appointment: Appointment
  variant?: 'bar' | 'menu'
  onDeleted?: () => void
  className?: string
}) {
  const { t } = useTranslation(['appointments', 'common'])
  const now = useNow()
  const { can, scope, explain } = usePermission()
  const [dlg, setDlg] = useState<Dlg>(null)
  if (scope('appointment.manage') === false) return null
  const allowed = can('appointment.manage', a)
  const denied = allowed ? undefined : explain('appointment.manage')
  const s = appointmentState(a, now)
  const close = (o: boolean) => { if (!o) setDlg(null) }

  const confirm = () => {
    try {
      confirmAppointment(a.id)
      toast.success(t('actions.confirmed'))
    } catch (e) {
      toastError(e)
    }
  }
  const noShow = () => {
    try {
      const r = markNoShow(a.id)
      toastUndo(t('actions.noShowDone'), r.undoToken, { description: t('cancel.taskNote') })
    } catch (e) {
      toastError(e)
    }
  }
  const remove = () => {
    try {
      const r = deleteAppointment(a.id)
      toastUndo(t('actions.deleted'), r.undoToken)
      onDeleted?.()
    } catch (e) {
      toastError(e)
    }
  }

  const dialogs = (
    <>
      {dlg === 'outcome' && <OutcomeDialog appointment={a} open onOpenChange={close} />}
      <RescheduleDialog appointment={a} open={dlg === 'reschedule'} onOpenChange={close} />
      <CancelDialog appointment={a} open={dlg === 'cancel'} onOpenChange={close} />
      <AppointmentFormDialog appointment={a} open={dlg === 'edit'} onOpenChange={close} />
      <ConfirmDialog open={dlg === 'noShow'} onOpenChange={close} title={t('actions.noShowTitle')} description={t('actions.noShowBody')} confirmLabel={t('actions.noShow')} tone="danger" onConfirm={noShow} />
      <ConfirmDialog open={dlg === 'delete'} onOpenChange={close} title={t('actions.deleteTitle')} description={t('actions.deleteBody')} confirmLabel={t('actions.delete')} tone="danger" onConfirm={remove} />
    </>
  )

  const items: { key: Exclude<Dlg, null> | 'confirm'; icon: typeof Check; label: string; show: boolean; danger?: boolean }[] = [
    { key: 'confirm', icon: Check, label: t('actions.confirm'), show: s.canConfirm },
    { key: 'outcome', icon: ClipboardCheck, label: t('actions.logOutcome'), show: s.canComplete },
    { key: 'reschedule', icon: CalendarClock, label: s.upcoming ? t('actions.reschedule') : t('actions.rebook'), show: a.status !== 'completed' },
    { key: 'edit', icon: Pencil, label: t('actions.edit'), show: s.upcoming },
    { key: 'noShow', icon: UserX, label: t('actions.noShow'), show: s.canNoShow, danger: true },
    { key: 'cancel', icon: XCircle, label: t('actions.cancel'), show: s.upcoming, danger: true },
    { key: 'delete', icon: Trash2, label: t('actions.delete'), show: true, danger: true },
  ]
  const run = (k: (typeof items)[number]['key']) => (k === 'confirm' ? confirm() : setDlg(k))
  const visible = items.filter((i) => i.show)

  if (!allowed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex', className)} tabIndex={0}>
            <Button variant={variant === 'menu' ? 'ghost' : 'secondary'} size={variant === 'menu' ? 'icon-sm' : 'sm'} disabled aria-label={t('actions.more')}>
              <MoreHorizontal />{variant === 'bar' && t('actions.more')}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{denied ? t(denied.reasonKey, denied.params) : ''}</TooltipContent>
      </Tooltip>
    )
  }

  if (variant === 'menu') {
    const primary = visible.find((i) => i.key === 'outcome' || i.key === 'confirm')
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {primary && (
          <Button size="xs" variant={primary.key === 'outcome' ? 'default' : 'secondary'} onClick={() => run(primary.key)} data-testid={`appt-${primary.key}`}>
            <primary.icon />{primary.label}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={t('actions.more')} data-testid="appt-menu"><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {visible.filter((i) => i !== primary).map((i, idx, arr) => (
              <span key={i.key} className="contents">
                {i.danger && !arr[idx - 1]?.danger && <DropdownMenuSeparator />}
                <DropdownMenuItem onSelect={() => run(i.key)} className={cn(i.danger && 'text-danger focus:text-danger')}>
                  <i.icon />{i.label}
                </DropdownMenuItem>
              </span>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {dialogs}
      </div>
    )
  }

  const main = visible.filter((i) => !i.danger)
  const danger = visible.filter((i) => i.danger)
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} data-testid="appointment-actions">
      {main.map((i, idx) => (
        <Button key={i.key} size="sm" variant={idx === 0 ? 'default' : 'secondary'} onClick={() => run(i.key)} data-testid={`appt-${i.key}`}>
          <i.icon />{i.label}
        </Button>
      ))}
      {danger.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={t('actions.more')} data-testid="appt-more"><MoreHorizontal />{t('actions.more')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {danger.map((i) => (
              <DropdownMenuItem key={i.key} onSelect={() => run(i.key)} className="text-danger focus:text-danger" data-testid={`appt-${i.key}`}>
                <i.icon />{i.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {dialogs}
    </div>
  )
}
