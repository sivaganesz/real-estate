/**
 * Task / follow-up row (master prompt §17): a done checkbox, the title, the lead link, the due time (danger and a red
 * edge when overdue), priority (icon + word), an ✦ for AI- or automation-created tasks, quick Call / WhatsApp for lead
 * tasks, and the reschedule chips (Tomorrow / In 3 days / Next week / pick a time; from the rebuild's reschedule
 * button). Completing a call task asks how the call went: "Not reachable" or "Busy" makes the automatic retry task (E4).
 * Completing and rescheduling toast with Undo. Optional selection checkbox for bulk actions, and an ✦ assistant button.
 */
import { useState } from 'react'
import { CalendarClock, Check, MessageCircle, Phone, PhoneOff, PhoneMissed, RotateCcw, Sparkles, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { DateTimeField } from '@/components/shared/date-time-field'
import { ToneBadge } from '@/components/shared/badges'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Task } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { addDaysToDay, isSameLocalDay, localDay, retrySlot } from '@/lib/dates'
import { fmtDate, fmtDateTime, fmtTime } from '@/lib/format'
import { priorityTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { telLink, waLink } from '@/lib/whatsapp'
import { completeTask, reopenTask, rescheduleTasks } from '@/services/tasks'

type CallResult = NonNullable<Task['callResult']>
const CALL_RESULTS: { key: CallResult; icon: typeof Check; cls: string }[] = [
  { key: 'connected', icon: Phone, cls: 'text-success' },
  { key: 'notReachable', icon: PhoneMissed, cls: 'text-warning' },
  { key: 'busy', icon: PhoneOff, cls: 'text-warning' },
  { key: 'wrongNumber', icon: UserX, cls: 'text-danger' },
]

/** A due time `days` from today keeping the task's wall-clock time. */
const moveDue = (dueAt: string, now: Date, days: number) => {
  const d = new Date(dueAt)
  const [y, m, dd] = addDaysToDay(localDay(now), days).split('-').map(Number)
  return new Date(y, m - 1, dd, d.getHours(), d.getMinutes()).toISOString()
}

export function TaskRow({ task, showLead = true, className, selected, onSelectedChange, selecting, onAssist, compact }: {
  task: Task
  showLead?: boolean
  className?: string
  /** Narrow places (a side column): no priority badge or quick contact, icon-only buttons. */
  compact?: boolean
  /** Some rows are selected: keep every selection box visible (otherwise they show on hover / focus). */
  selecting?: boolean
  /** Bulk selection (shown only when onSelectedChange is given). */
  selected?: boolean
  onSelectedChange?: (on: boolean) => void
  /** Opens the follow-up assistant for this task. */
  onAssist?: (task: Task) => void
}) {
  const { t, i18n } = useTranslation(['domain', 'tasks', 'catalogue'])
  const now = useNow()
  const { can, explain } = usePermission()
  const lead = useDb((db) => db.leads.find((l) => l.id === task.leadId))
  // automatic tasks are stored with an English title; show them in the UI language (M4 review #5)
  const title = task.autoReason && lead ? t(`domain:task.autoTitle.${task.autoReason}`, { name: lead.name }) : task.title
  const owner = useDb((db) => db.users.find((u) => u.id === task.ownerId))
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<string | undefined>()
  const done = task.status === 'done'
  const cancelled = task.status === 'cancelled'
  const open = task.status === 'open'
  const overdue = open && task.dueAt < now.toISOString()
  const mayEdit = can('task.manage', task)
  const denied = mayEdit ? undefined : explain('task.manage')
  const p = priorityTone[task.priority]
  const due = isSameLocalDay(task.dueAt, now) ? t('domain:task.todayAt', { time: fmtTime(task.dueAt, i18n.language) }) : `${fmtDate(task.dueAt, i18n.language)} · ${fmtTime(task.dueAt, i18n.language)}`
  const asksResult = task.type === 'call' && !!task.leadId

  const complete = (callResult?: CallResult) => {
    try {
      const r = completeTask(task.id, { callResult, outcome: note.trim() || undefined })
      const retry = callResult === 'notReachable' || callResult === 'busy'
      toastUndo(t('domain:task.completed', { title: task.title }), r.undoToken, {
        description: retry ? t('tasks:row.retryCreated', { when: fmtDateTime(retrySlot(now), i18n.language) }) : undefined,
      })
      setAsking(false)
      setNote('')
    } catch (e) {
      toastError(e)
    }
  }
  const moveTo = (iso: string) => {
    try {
      const r = rescheduleTasks([task.id], iso)
      toastUndo(t('domain:task.rescheduled', { date: fmtDateTime(iso, i18n.language) }), r.undoToken)
      setPicking(false)
    } catch (e) {
      toastError(e)
    }
  }
  const reopen = () => {
    try {
      reopenTask(task.id)
      toastUndo(t('tasks:row.reopened', { title: task.title }), undefined)
    } catch (e) {
      toastError(e)
    }
  }

  const checkbox = (
    <Checkbox
      checked={done}
      disabled={!open || !mayEdit}
      onCheckedChange={(v) => { if (v === true) { if (asksResult) setAsking(true); else complete() } }}
      aria-label={t('domain:task.markDone', { title: task.title })}
      data-testid="task-done"
      className="size-5"
    />
  )

  return (
    <div
      data-testid="task-row"
      data-overdue={overdue || undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 shadow-xs transition-colors',
        overdue && 'border-l-[3px] border-danger/40 border-l-danger bg-danger-soft/25',
        selected && 'bg-primary-soft/60 ring-1 ring-primary/30',
        (done || cancelled) && 'opacity-70',
        className,
      )}
    >
      {onSelectedChange && open && (
        <Checkbox checked={!!selected} onCheckedChange={(v) => onSelectedChange(v === true)} aria-label={t('tasks:row.select', { title: task.title })} data-testid="task-select"
          className={cn('rounded-full transition-opacity', !selecting && !selected && 'max-md:hidden md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100')} />
      )}
      <Popover open={asking} onOpenChange={setAsking}>
        <PopoverAnchor asChild>
          {mayEdit || !open ? checkbox : (
            <Tooltip>
              <TooltipTrigger asChild><span tabIndex={0}>{checkbox}</span></TooltipTrigger>
              <TooltipContent>{denied ? t(denied.reasonKey, denied.params) : ''}</TooltipContent>
            </Tooltip>
          )}
        </PopoverAnchor>
        <PopoverContent align="start" className="w-72 p-3" data-testid="call-result">
          <p className="text-sm font-semibold">{t('tasks:row.howDidItGo')}</p>
          <p className="mb-2 text-meta text-muted-foreground">{t('tasks:row.howHint')}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {CALL_RESULTS.map((r) => (
              <Button key={r.key} variant="secondary" size="sm" className="justify-start" onClick={() => complete(r.key)} data-testid={`call-${r.key}`}>
                <r.icon className={r.cls} />{t(`tasks:callResult.${r.key}`)}
              </Button>
            ))}
          </div>
          <Input className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('tasks:row.notePlaceholder')} aria-label={t('tasks:row.note')} />
          <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => complete()}>{t('tasks:row.justDone')}</Button>
        </PopoverContent>
      </Popover>

      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 text-sm font-medium', (done || cancelled) && 'line-through')}>
          {task.origin !== 'manual' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Sparkles tabIndex={0} className="size-3.5 shrink-0 text-ai" aria-label={t(task.origin === 'ai' ? 'domain:task.byAi' : 'domain:task.byAutomation')} />
              </TooltipTrigger>
              <TooltipContent>{t(task.origin === 'ai' ? 'domain:task.byAi' : 'domain:task.byAutomation')}</TooltipContent>
            </Tooltip>
          )}
          <span className="line-clamp-2 sm:truncate">{title}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-meta text-muted-foreground">
          {done && task.completedAt ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Check className="size-3.5 text-success" aria-hidden="true" />
              {t('tasks:row.doneAt', { when: fmtDateTime(task.completedAt, i18n.language) })}
              {task.callResult && ` · ${t(`tasks:callResult.${task.callResult}`)}`}
            </span>
          ) : (
            <span className={cn('inline-flex items-center gap-1 tabular-nums', overdue && 'font-semibold text-danger')}>
              <CalendarClock className="size-3.5" aria-hidden="true" />
              {overdue ? t('domain:task.overdue', { due }) : due}
            </span>
          )}
          {showLead && lead && <Link to={paths.lead(lead.id)} className="truncate font-medium text-primary hover:underline">{lead.name}</Link>}
          {task.autoReason && <span className="truncate max-sm:hidden">{t(`catalogue:autoTaskReason.${task.autoReason}`)}</span>}
          {owner && onSelectedChange && <span className="truncate max-md:hidden">{owner.name}</span>}
          {task.outcome && done && <span className="truncate italic">“{task.outcome}”</span>}
        </p>
      </div>

      <ToneBadge classes={p} icon={p.icon} className={cn('max-sm:hidden', compact && 'hidden')}>{t(`catalogue:priority.${task.priority}`)}</ToneBadge>

      {open && lead?.phone && !compact && (
        <span className="flex items-center opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100 pointer-coarse:opacity-100">
          <Button asChild variant="ghost" size="icon-sm"><a href={telLink(lead.phone)} aria-label={t('tasks:row.call', { name: lead.name })}><Phone /></a></Button>
          <Button asChild variant="ghost" size="icon-sm" className="text-success hover:text-success max-sm:hidden"><a href={waLink(lead.phone)} target="_blank" rel="noopener noreferrer" aria-label={t('tasks:row.whatsapp', { name: lead.name })}><MessageCircle /></a></Button>
        </span>
      )}
      {open && onAssist && (
        <Button variant="ghost" size="icon-sm" className="text-ai hover:bg-ai-soft hover:text-ai" onClick={() => onAssist(task)} aria-label={t('tasks:row.assist', { title: task.title })} data-testid="task-assist">
          <Sparkles />
        </Button>
      )}
      {open && mayEdit && (
        <Popover open={picking} onOpenChange={setPicking}>
          <DropdownMenu>
            <PopoverAnchor asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={cn('max-sm:px-2', compact && 'px-2')} data-testid="task-reschedule" aria-label={compact ? t('domain:task.reschedule') : undefined}>
                  <CalendarClock className={cn(!compact && 'sm:hidden')} /><span className={cn('max-sm:sr-only', compact && 'sr-only')}>{t('domain:task.reschedule')}</span>
                </Button>
              </DropdownMenuTrigger>
            </PopoverAnchor>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => moveTo(moveDue(task.dueAt, now, 1))}>{t('domain:task.tomorrow')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => moveTo(moveDue(task.dueAt, now, 3))}>{t('domain:task.inThreeDays')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => moveTo(moveDue(task.dueAt, now, 7))}>{t('domain:task.nextWeek')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setPicking(true)}>{t('tasks:row.pickTime')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <PopoverContent align="end" className="w-80 p-3">
            <p className="mb-2 text-sm font-semibold">{t('tasks:row.pickTime')}</p>
            <DateTimeField value={picked ?? task.dueAt} onChange={setPicked} now={now} />
            <Button size="sm" className="mt-3 w-full" disabled={!picked || picked === task.dueAt} onClick={() => picked && moveTo(picked)}>{t('tasks:row.move')}</Button>
          </PopoverContent>
        </Popover>
      )}
      {done && mayEdit && (
        <Button variant="ghost" size="sm" onClick={reopen} className={cn('max-sm:px-2', compact && 'px-2')} data-testid="task-reopen">
          <RotateCcw /><span className={cn('max-sm:sr-only', compact && 'sr-only')}>{t('tasks:row.reopen')}</span>
        </Button>
      )}
    </div>
  )
}
