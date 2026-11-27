/**
 * Notification centre (master prompt §17): everything addressed to the current user, grouped by day, with read-state
 * tabs, category / time / priority filters, bulk mark read / unread / delete (confirm + Undo), and a simulated
 * "Catch me up" digest that names the most urgent item first (Demo AI badge).
 */
import { useMemo, useState } from 'react'
import { AlarmClock, Bell, CheckCheck, Mail, MailOpen, Siren, Sparkles, Trash2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { getAI } from '@/ai'
import { pathFor } from '@/app/paths'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { NotificationItem } from '@/components/domain/notification-item'
import { EmptyNotifications } from '@/components/illustrations'
import { BulkBar } from '@/components/shared/bulk-bar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
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
import { useCurrentUser } from '@/hooks/use-current-user'
import { useDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { addDaysToDay, localDay } from '@/lib/dates'
import { fmtDate } from '@/lib/format'
import { deleteNotifications, markAllRead, markManyUnread, markRead, notificationText } from '@/services/notifications'
import {
  CATEGORIES, DEFAULT_NOTIFICATION_FILTERS, activeNotificationFilters, digest, filterNotifications, groupByDay, notificationCounts,
  notificationsFor, type Category, type NotificationFilters, type ReadFilter, type WhenFilter,
} from '../lib/notification-filters'

export default function NotificationsPage() {
  const { t, i18n } = useTranslation(['notifications', 'common', 'domain'])
  const now = useNow()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const all = useDb((db) => db.notifications)
  const [f, setF] = useState<NotificationFilters>(DEFAULT_NOTIFICATION_FILTERS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null)
  const [showDigest, setShowDigest] = useState(false)

  const today = localDay(now)
  const yesterday = addDaysToDay(today, -1)
  const ctx = useMemo(() => ({ today, dayOf: (iso: string) => localDay(iso), addDays: addDaysToDay }), [today])
  const mine = useMemo(() => notificationsFor(all, user.id), [all, user.id])
  const counts = useMemo(() => notificationCounts(mine), [mine])
  const list = useMemo(() => filterNotifications(mine, f, ctx), [mine, f, ctx])
  const groups = useMemo(() => groupByDay(list, ctx.dayOf), [list, ctx])
  const d = useMemo(() => digest(mine), [mine])
  const mode = getAI().mode
  const todayCount = mine.filter((n) => localDay(n.at) === today).length
  const assignmentsUnread = mine.filter((n) => !n.readAt && (n.kind === 'assignment' || n.kind === 'reassignment')).length
  const scheduleUnread = mine.filter((n) => !n.readAt && (n.kind === 'appointmentReminder' || n.kind === 'taskOverdue' || n.kind === 'appointmentCreated')).length

  const visibleIds = list.map((n) => n.id)
  const selectedIds = visibleIds.filter((id) => selected.has(id))
  const allChecked = visibleIds.length > 0 && selectedIds.length === visibleIds.length
  const set = (patch: Partial<NotificationFilters>) => {
    setF((x) => ({ ...x, ...patch }))
    setSelected(new Set())
  }
  const toggle = (id: string, on: boolean) => setSelected((s) => {
    const next = new Set(s)
    if (on) next.add(id)
    else next.delete(id)
    return next
  })
  const dayLabel = (day: string) => (day === today ? t('domain:timeline.today') : day === yesterday ? t('domain:timeline.yesterday') : fmtDate(day, i18n.language))

  const run = (fn: () => void, message: string) => {
    try {
      fn()
      toast.success(message)
      setSelected(new Set())
    } catch (e) {
      toastError(e)
    }
  }
  const doDelete = (ids: string[]) => {
    try {
      const r = deleteNotifications(ids)
      toastUndo(t('notifications:deleted', { count: r.result }), r.undoToken)
      setSelected(new Set())
    } catch (e) {
      toastError(e)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('notifications:title')} subtitle={t('notifications:subtitle')}
        actions={(
          <>
            {counts.unread > 0 && (
              <Button variant="ai" onClick={() => setShowDigest((v) => !v)} data-testid="notifications-digest" aria-expanded={showDigest}>
                <Sparkles aria-hidden="true" />
                {t('notifications:digest.button')}
              </Button>
            )}
            <Button onClick={() => run(() => markAllRead(), t('notifications:allReadDone', { count: counts.unread }))} disabled={!counts.unread} data-testid="notifications-mark-all">
              <CheckCheck aria-hidden="true" />
              {t('notifications:markAllRead')}
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <KpiCard label={t('notifications:kpi.unread')} value={counts.unread} icon={Bell} tone="primary" hint={t('notifications:kpi.ofTotal', { count: counts.all })} onClick={() => set({ read: 'unread' })} className="flex flex-col justify-start" />
        <KpiCard label={t('notifications:kpi.urgent')} value={counts.high} icon={Siren} tone="danger" hint={t('notifications:kpi.urgentHint')} onClick={() => set({ read: 'unread', highOnly: true })} className="flex flex-col justify-start" />
        <KpiCard label={t('notifications:kpi.assignments')} value={assignmentsUnread} icon={UserPlus} tone="info" hint={t('notifications:kpi.unreadHint')} onClick={() => set({ read: 'unread', categories: ['assignments'] })} className="flex flex-col justify-start" />
        <KpiCard label={t('notifications:kpi.schedule')} value={scheduleUnread} icon={AlarmClock} tone="warning" hint={t('notifications:kpi.today', { count: todayCount })} onClick={() => set({ read: 'unread', categories: ['schedule'] })} className="flex flex-col justify-start" />
      </div>

      {showDigest && (
        <section aria-label={t('notifications:digest.title')} className="flex flex-col gap-3 rounded-xl border border-ai-border bg-ai-soft/30 p-4" data-testid="digest-card">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex size-7 items-center justify-center rounded-md bg-ai-gradient text-ai-foreground"><Sparkles className="size-4" aria-hidden="true" /></span>
            <h2 className="text-sm font-semibold">{t('notifications:digest.title')}</h2>
            <DemoAIBadge mode={mode} />
          </div>
          {d.total === 0 ? <p className="text-sm text-muted-foreground">{t('notifications:digest.none')}</p> : (
            <>
              <p className="text-sm">{t('notifications:digest.summary', { count: d.total })} {d.high > 0 && t('notifications:digest.urgent', { count: d.high })}</p>
              <ul className="flex flex-wrap gap-2">
                {d.parts.map((p) => (
                  <li key={p.kind} className="inline-flex h-6 items-center rounded-full border bg-card px-2.5 text-meta font-medium">
                    {t(`notifications:digest.kind.${p.kind}`, { count: p.count })}
                  </li>
                ))}
              </ul>
              {d.first && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-card p-3 text-sm">
                  <span className="text-muted-foreground">{t('notifications:digest.first')}</span>
                  <span className="font-medium">{notificationText(t, d.first)}</span>
                  {d.first.ref && (
                    <Button size="sm" variant="secondary" className="ml-auto" onClick={() => {
                      const first = d.first
                      if (!first?.ref) return
                      try {
                        markRead([first.id])
                      } catch (e) {
                        toastError(e)
                      }
                      navigate(pathFor(first.ref))
                    }}>
                      {t('notifications:openRecord')}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <div className="flex flex-col gap-3">
        <Segmented<ReadFilter>
          value={f.read} onChange={(read) => set({ read })} label={t('notifications:tabs.label')}
          segments={[
            { value: 'all', label: t('notifications:tabs.all'), count: counts.all },
            { value: 'unread', label: t('notifications:tabs.unread'), count: counts.unread },
            { value: 'read', label: t('notifications:tabs.read'), count: counts.all - counts.unread },
          ]}
        />
        <FilterBar
          activeCount={activeNotificationFilters(f)}
          onClearAll={() => set({ categories: [], highOnly: false, when: 'all' })}
          filters={(
            <>
              <FilterPill
                label={t('notifications:filter.category')} selected={f.categories} onChange={(v) => set({ categories: v as Category[] })}
                options={CATEGORIES.map((c) => ({ value: c, label: t(`notifications:category.${c}`), count: counts.byCategory[c] }))}
              />
              <FilterPill
                single label={t('notifications:filter.when')} selected={f.when === 'all' ? [] : [f.when]} onChange={(v) => set({ when: (v[0] as WhenFilter | undefined) ?? 'all' })}
                options={(['today', '7d'] as const).map((w) => ({ value: w, label: t(`notifications:when.${w}`) }))}
              />
              <FilterPill
                single label={t('notifications:filter.priority')} selected={f.highOnly ? ['high'] : []} onChange={(v) => set({ highOnly: v.includes('high') })}
                options={[{ value: 'high', label: t('notifications:filter.highOnly'), count: mine.filter((n) => n.priority === 'high').length }]}
              />
            </>
          )}
          end={list.length > 0 && (
            <label className="flex items-center gap-2 text-ui text-muted-foreground">
              <Checkbox checked={allChecked} onCheckedChange={(v) => setSelected(v === true ? new Set(visibleIds) : new Set())} aria-label={t('notifications:selectAll')} />
              {t('notifications:selectAll')}
            </label>
          )}
        />
      </div>

      <section className="rounded-lg border bg-card shadow-card" aria-label={t('notifications:listLabel')}>
        {mine.length === 0 ? (
          <EmptyState illustration={EmptyNotifications} title={t('notifications:empty.title')} body={t('notifications:empty.body')} />
        ) : list.length === 0 ? (
          <FilteredEmpty
            title={t('notifications:empty.filteredTitle')} body={t('notifications:empty.filteredBody')}
            onClear={() => set(DEFAULT_NOTIFICATION_FILTERS)}
          />
        ) : (
          <div className="flex flex-col gap-2 p-2 md:p-3">
            {groups.map((g) => (
              <section key={g.day} aria-label={dayLabel(g.day)}>
                <h3 className="px-3 pt-2 pb-1 text-caption font-semibold tracking-[0.06em] text-subtle-foreground uppercase [:lang(ta)_&]:tracking-normal [:lang(ta)_&]:normal-case">{dayLabel(g.day)}</h3>
                <ul className="flex flex-col">
                  {g.items.map((n) => (
                    <li key={n.id}>
                      <NotificationItem
                        n={n} now={now} selectable selected={selected.has(n.id)} onSelect={(on) => toggle(n.id, on)}
                        onDelete={() => setConfirmDelete([n.id])}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <BulkBar count={selectedIds.length} onClear={() => setSelected(new Set())}>
        <Button variant="ghost" size="sm" onClick={() => run(() => markRead(selectedIds), t('notifications:markedRead', { count: selectedIds.length }))}>
          <MailOpen aria-hidden="true" />{t('notifications:markRead')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => run(() => markManyUnread(selectedIds), t('notifications:markedUnread', { count: selectedIds.length }))}>
          <Mail aria-hidden="true" />{t('notifications:markUnread')}
        </Button>
        <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(selectedIds)}>
          <Trash2 aria-hidden="true" />{t('notifications:delete')}
        </Button>
      </BulkBar>

      <ConfirmDialog
        open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)} tone="danger"
        title={t('notifications:confirmDelete.title', { count: confirmDelete?.length ?? 0 })}
        description={t('notifications:confirmDelete.body')}
        confirmLabel={t('notifications:confirmDelete.confirm', { count: confirmDelete?.length ?? 0 })}
        onConfirm={() => {
          if (confirmDelete) doDelete(confirmDelete)
          setConfirmDelete(null)
        }}
      />
    </div>
  )
}
