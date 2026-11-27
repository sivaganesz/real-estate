/**
 * /tasks (master prompt §17, plan §8.3 M4 "Tasks"): KPI strip, quick add (manual or ✦ plain words), tabs Overdue /
 * Today / Upcoming / Done with counts, search + executive / type / priority filters, group by due date or by lead,
 * rows with complete (call result → automatic retry, E4), reschedule chips, Call / WhatsApp, and bulk complete /
 * reschedule with Undo. The ✦ Follow-up Assistant suggests timing and drafts the message.
 */
import { useMemo, useState } from 'react'
import { AlarmClock, CalendarClock, CalendarDays, CheckCheck, CircleCheckBig, Plus, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { StagePill } from '@/components/domain/lead-pills'
import { TaskFormDialog } from '@/components/domain/task-form-dialog'
import { TaskRow } from '@/components/domain/task-row'
import { EmptyTasks } from '@/components/illustrations'
import { BulkBar } from '@/components/shared/bulk-bar'
import { CountBadge } from '@/components/shared/badges'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterBar } from '@/components/shared/filter-bar'
import { FilterPill } from '@/components/shared/filter-pill'
import { FilteredEmpty } from '@/components/shared/filtered-empty'
import { KpiCard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { Segmented } from '@/components/shared/segmented'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PRIORITIES, TASK_TYPES } from '@/domain/catalogue'
import type { ID, Priority, Task, TaskType } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useIsPhone } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { parseLocalDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { visible } from '@/services/queries/visibility'
import { completeTasks, rescheduleTasks } from '@/services/tasks'
import { QuickAdd } from '../components/quick-add'
import { FollowUpAssistant } from '../components/follow-up-assistant'
import {
  bucketTasks, completionsByDay, dayLabelKind, dueByDay, EMPTY_TASK_FILTERS, filterTasks, groupTasks, moveDue, TASK_TABS,
  taskFilterCount, type GroupBy, type TaskFilters, type TaskTab,
} from '../lib/task-lists'

const TAB_ICON = { overdue: AlarmClock, today: CalendarClock, upcoming: CalendarDays, done: CircleCheckBig } as const

export default function TasksPage() {
  const { t, i18n } = useTranslation(['tasks', 'catalogue', 'domain'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  const phone = useIsPhone()
  const { can, scope } = usePermission()
  const mine = useMemo(() => visible.tasks(db, user), [db, user])
  const buckets = useMemo(() => bucketTasks(mine, now), [mine, now])
  const [tab, setTab] = useState<TaskTab>(() => (buckets.overdue.length ? 'overdue' : 'today'))
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS)
  const [groupBy, setGroupBy] = useState<GroupBy>('due')
  const [selected, setSelected] = useState<Set<ID>>(new Set())
  const [assistant, setAssistant] = useState<{ open: boolean; focusId?: string }>({ open: false })
  const [adding, setAdding] = useState(false)
  const mayManage = scope('task.manage') !== false
  const teamScope = scope('task.view') !== 'own'
  const locale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN'

  const leadName = (id: ID | undefined) => (id ? db.leads.find((l) => l.id === id)?.name : undefined)
  const list = useMemo(() => filterTasks(buckets[tab], filters, (id) => (id ? db.leads.find((l) => l.id === id)?.name : undefined)), [buckets, tab, filters, db.leads])
  const groups = useMemo(() => groupTasks(list, groupBy), [list, groupBy])
  const openForAssistant = useMemo(() => [...buckets.overdue, ...buckets.today, ...buckets.upcoming].filter((x) => can('task.manage', x)), [buckets, can])
  const selectable = tab !== 'done'
  const selectedOpen = [...selected].filter((id) => list.some((x) => x.id === id && x.status === 'open'))

  const toggle = (id: ID, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
  const changeTab = (v: TaskTab) => { setTab(v); setSelected(new Set()) }
  const bulkComplete = () => {
    try {
      const r = completeTasks(selectedOpen)
      toastUndo(t('bulk.completed', { count: r.result }), r.undoToken)
      setSelected(new Set())
    } catch (e) {
      toastError(e)
    }
  }
  const bulkMove = (days: number) => {
    try {
      const r = rescheduleTasks(selectedOpen, (x: Task) => moveDue(x.dueAt, now, days))
      toastUndo(t('bulk.moved', { count: r.result }), r.undoToken)
      setSelected(new Set())
    } catch (e) {
      toastError(e)
    }
  }

  const owners = useMemo(() => db.users.filter((u) => mine.some((x) => x.ownerId === u.id)), [db.users, mine])
  const doneWeek = completionsByDay(mine, now, 7)
  const groupTitle = (key: string) => {
    if (groupBy === 'lead') {
      if (!key) return <span>{t('group.noLead')}</span>
      const lead = db.leads.find((l) => l.id === key)
      return lead ? (
        <span className="flex min-w-0 items-center gap-2">
          <Link to={paths.lead(lead.id)} className="truncate hover:underline">{lead.name}</Link>
          <StagePill stage={lead.stage} short />
        </span>
      ) : <span>{key}</span>
    }
    const kind = dayLabelKind(key, now)
    const date = parseLocalDay(key).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
    return <span>{kind === 'date' ? date : `${t(`group.${kind}`)} · ${date}`}</span>
  }

  const allEmpty = mine.filter((x) => x.status !== 'cancelled').length === 0
  const filtered = taskFilterCount(filters) > 0 || filters.search.trim() !== ''

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 pb-20" data-testid="tasks-page">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            {mayManage && (
              <Button variant="ai-outline" onClick={() => setAssistant({ open: true })} data-testid="open-assistant">
                <Sparkles />{t('assistant.open')}
              </Button>
            )}
            {mayManage && <Button onClick={() => setAdding(true)} data-testid="add-task"><Plus />{t('page.add')}</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label={t('tab.overdue')} value={buckets.overdue.length} icon={AlarmClock} tone={buckets.overdue.length ? 'danger' : 'success'}
          hint={buckets.overdue.length ? t('kpi.overdueHint', { count: buckets.overdue.filter((x) => x.priority === 'high').length }) : t('kpi.noneOverdue')} onClick={() => changeTab('overdue')} />
        <KpiCard label={t('tab.today')} value={buckets.today.length} icon={CalendarClock} tone="primary"
          hint={t('kpi.todayHint', { count: buckets.today.filter((x) => x.type === 'call').length })} onClick={() => changeTab('today')} />
        <KpiCard label={t('kpi.next7')} value={dueByDay(mine, now, 7).reduce((a, b) => a + b, 0)} icon={CalendarDays} tone="info" spark={phone ? undefined : dueByDay(mine, now, 7)}
          hint={t('kpi.next7Hint')} onClick={() => changeTab('upcoming')} />
        <KpiCard label={t('kpi.doneWeek')} value={doneWeek.reduce((a, b) => a + b, 0)} icon={CheckCheck} tone="success" spark={phone ? undefined : doneWeek}
          hint={t('kpi.doneToday', { count: doneWeek[doneWeek.length - 1] })} onClick={() => changeTab('done')} />
      </div>

      <QuickAdd />

      <section className="flex flex-col gap-3" aria-label={t('list')}>
        <Segmented value={tab} onChange={changeTab} label={t('tabs')}
          segments={TASK_TABS.map((v) => {
            const Icon = TAB_ICON[v]
            return {
              value: v, label: t(`tab.${v}`), icon: <Icon aria-hidden="true" />,
              badge: <span className={cn('rounded-full px-1.5 text-meta tabular-nums', v === 'overdue' && buckets.overdue.length ? 'bg-danger-soft text-danger' : tab === v ? 'bg-primary-soft text-primary' : 'bg-muted')} data-testid={`tab-count-${v}`}>{buckets[v].length}</span>,
            }
          })} />

        <FilterBar
          search={filters.search} onSearch={(v) => setFilters((f) => ({ ...f, search: v }))} searchLabel={t('filter.search')} placeholder={t('filter.searchPlaceholder')}
          activeCount={taskFilterCount(filters)} onClearAll={() => setFilters((f) => ({ ...EMPTY_TASK_FILTERS, search: f.search }))}
          filters={
            <>
              {teamScope && owners.length > 1 && (
                <FilterPill label={t('filter.owner')} selected={filters.ownerIds} onChange={(v) => setFilters((f) => ({ ...f, ownerIds: v as ID[] }))}
                  options={owners.map((u) => ({ value: u.id, label: u.name, count: buckets[tab].filter((x) => x.ownerId === u.id).length }))} />
              )}
              <FilterPill label={t('filter.type')} selected={filters.types} onChange={(v) => setFilters((f) => ({ ...f, types: v as TaskType[] }))}
                options={TASK_TYPES.map((v) => ({ value: v, label: t(`catalogue:taskType.${v}`), count: buckets[tab].filter((x) => x.type === v).length }))} />
              <FilterPill label={t('filter.priority')} selected={filters.priorities} onChange={(v) => setFilters((f) => ({ ...f, priorities: v as Priority[] }))}
                options={PRIORITIES.map((v) => ({ value: v, label: t(`catalogue:priority.${v}`), count: buckets[tab].filter((x) => x.priority === v).length }))} />
            </>
          }
          end={<Segmented variant="pill" value={groupBy} onChange={setGroupBy} label={t('group.label')}
            segments={[{ value: 'due', label: t('group.byDue') }, { value: 'lead', label: t('group.byLead') }]} />}
        />

        {allEmpty ? (
          <EmptyState illustration={EmptyTasks} title={t('empty.title')} body={t('empty.body')}
            primary={mayManage && <Button onClick={() => setAdding(true)}><Plus />{t('page.add')}</Button>} />
        ) : list.length === 0 ? (
          filtered ? (
            <FilteredEmpty title={t('empty.filtered')} onClear={() => setFilters(EMPTY_TASK_FILTERS)} />
          ) : (
            <EmptyState compact illustration={EmptyTasks} title={t(`empty.tab.${tab}.title`)} body={t(`empty.tab.${tab}.body`)}
              primary={tab !== 'done' && mayManage ? <Button variant="secondary" onClick={() => setAdding(true)}><Plus />{t('page.add')}</Button> : undefined} />
          )
        ) : (
          <div className="flex flex-col gap-5" data-testid="task-groups">
            {selectable && mayManage && list.length > 1 && (
              <label className="flex items-center gap-2 self-start text-meta text-muted-foreground">
                <Checkbox data-testid="select-all"
                  checked={list.every((x) => selected.has(x.id))}
                  onCheckedChange={(v) => setSelected(v === true ? new Set(list.filter((x) => can('task.manage', x)).map((x) => x.id)) : new Set())} />
                {t('bulk.selectAll', { count: list.length })}
              </label>
            )}
            {groups.map((g) => (
              <section key={g.key || 'none'} aria-label={groupBy === 'lead' ? leadName(g.key) ?? t('group.noLead') : g.key}>
                <h3 className="mb-2 flex items-center gap-2 text-ui font-semibold">{groupTitle(g.key)}<CountBadge count={g.items.length} /></h3>
                <div className="flex flex-col gap-2">
                  {g.items.map((x) => (
                    <TaskRow key={x.id} task={x} showLead={groupBy !== 'lead'}
                      selected={selected.has(x.id)} selecting={selectedOpen.length > 0} onSelectedChange={selectable && can('task.manage', x) ? (on) => toggle(x.id, on) : undefined}
                      onAssist={mayManage ? (task) => setAssistant({ open: true, focusId: task.id }) : undefined} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <BulkBar count={selectedOpen.length} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="ghost" onClick={bulkComplete} data-testid="bulk-complete"><CheckCheck />{t('bulk.complete')}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" data-testid="bulk-reschedule"><CalendarClock />{t('bulk.reschedule')}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem onSelect={() => bulkMove(1)}>{t('domain:task.tomorrow')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => bulkMove(3)}>{t('domain:task.inThreeDays')}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => bulkMove(7)}>{t('domain:task.nextWeek')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </BulkBar>

      <FollowUpAssistant open={assistant.open} onOpenChange={(o) => setAssistant((s) => ({ ...s, open: o }))} tasks={openForAssistant} focusId={assistant.focusId} />
      <TaskFormDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
