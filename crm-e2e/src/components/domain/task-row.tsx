/**
 * Task / follow-up row: a done checkbox, the title, the lead link, the due time (danger when overdue), priority (icon +
 * word), an ✦ for AI- or automation-created tasks, and the reschedule chips (Tomorrow / In 3 days / Next week, from the
 * rebuild's reschedule button). Completing toasts with Undo.
 */
import { CalendarClock, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { ToneBadge } from '@/components/shared/badges'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Task } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { addDaysToDay, isSameLocalDay, localDay } from '@/lib/dates'
import { fmtDate, fmtTime } from '@/lib/format'
import { priorityTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { completeTask, rescheduleTask } from '@/services/tasks'

export function TaskRow({ task, showLead = true, className }: { task: Task; showLead?: boolean; className?: string }) {
  const { t, i18n } = useTranslation(['domain', 'catalogue'])
  const now = useNow()
  const { can } = usePermission()
  const lead = useDb((db) => db.leads.find((l) => l.id === task.leadId))
  const done = task.status === 'done'
  const overdue = !done && task.dueAt < now.toISOString()
  const mayEdit = can('task.manage', task)
  const p = priorityTone[task.priority]
  const due = isSameLocalDay(task.dueAt, now) ? t('domain:task.todayAt', { time: fmtTime(task.dueAt, i18n.language) }) : `${fmtDate(task.dueAt, i18n.language)} · ${fmtTime(task.dueAt, i18n.language)}`

  const complete = () => {
    try {
      const r = completeTask(task.id)
      toastUndo(t('domain:task.completed', { title: task.title }), r.undoToken)
    } catch (e) {
      toastError(e)
    }
  }
  const moveTo = (days: number) => {
    const d = new Date(task.dueAt)
    const day = addDaysToDay(localDay(now), days)
    const [y, m, dd] = day.split('-').map(Number)
    try {
      const iso = new Date(y, m - 1, dd, d.getHours(), d.getMinutes()).toISOString()
      rescheduleTask(task.id, iso)
      toastUndo(t('domain:task.rescheduled', { date: fmtDate(iso, i18n.language) }), undefined)
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div data-testid="task-row" className={cn('group flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 shadow-xs', overdue && 'border-danger/40', done && 'opacity-60', className)}>
      <Checkbox checked={done} disabled={done || !mayEdit} onCheckedChange={(v) => v === true && complete()} aria-label={t('domain:task.markDone', { title: task.title })} />
      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 truncate text-sm font-medium', done && 'line-through')}>
          {task.origin !== 'manual' && <Sparkles className="size-3.5 shrink-0 text-ai" aria-label={t(task.origin === 'ai' ? 'domain:task.byAi' : 'domain:task.byAutomation')} />}
          <span className="truncate">{task.title}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-meta text-muted-foreground">
          <span className={cn('inline-flex items-center gap-1 tabular-nums', overdue && 'font-medium text-danger')}>
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {overdue ? t('domain:task.overdue', { due }) : due}
          </span>
          {showLead && lead && <Link to={paths.lead(lead.id)} className="truncate text-primary hover:underline">{lead.name}</Link>}
          {task.autoReason && <span className="truncate">{t(`catalogue:autoTaskReason.${task.autoReason}`)}</span>}
        </p>
      </div>
      <ToneBadge classes={p} icon={p.icon} className="max-sm:hidden">{t(`catalogue:priority.${task.priority}`)}</ToneBadge>
      {!done && mayEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 pointer-coarse:opacity-100">{t('domain:task.reschedule')}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => moveTo(1)}>{t('domain:task.tomorrow')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => moveTo(3)}>{t('domain:task.inThreeDays')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => moveTo(7)}>{t('domain:task.nextWeek')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
