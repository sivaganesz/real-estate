/**
 * Assign leads (master prompt §10, used everywhere). Each executive the user may assign to is listed with their open
 * leads (a stacked hot / warm / cold workload bar), pending follow-ups, today's appointments, conversion rate and
 * availability; people on leave are shown but cannot be picked. "Recommended (auto)" runs the same engine as
 * auto-assignment and explains its pick (lowest workload, rule, or round-robin on a tie), with a per-lead preview
 * for several leads. Works for one or many leads, takes an optional note for the history, and toasts who got the
 * lead(s) and why (with Undo for several). Nothing changes until Assign is pressed.
 */
import { useMemo, useState } from 'react'
import { CalendarDays, ListTodo, Sparkles, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAI } from '@/ai'
import { DemoAIBadge } from '@/components/ai/demo-ai-badge'
import { EmptyTeam } from '@/components/illustrations'
import { EmptyState } from '@/components/shared/empty-state'
import { toastError, toastUndo } from '@/components/shared/undo-toast'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import type { ID, User } from '@/domain/types'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { usePermission } from '@/hooks/use-permission'
import { fmtDate } from '@/lib/format'
import { assigneeStatsFromDb, previewTotals, type AssigneeStats } from '@/lib/assignment'
import { availabilityTone, temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { assignableUsers, assignLeads, previewAuto } from '@/services/assignments'

export function AssignDialog({ open, onOpenChange, leadIds, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; leadIds: ID[]; onDone?: () => void }) {
  const { t } = useTranslation(['team', 'common', 'catalogue'])
  const db = useWholeDb()
  const user = useCurrentUser()
  const { scope } = usePermission()
  const teamOnly = scope('lead.assign') === 'team'
  const now = useNow()
  const [target, setTarget] = useState<string>('auto')
  const [note, setNote] = useState('')

  // start fresh every time it opens (callers may keep it mounted)
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setTarget('auto')
      setNote('')
    }
  }

  // the dialog lists the whole team incl. people on leave (shown, not pickable), never deactivated users
  const people = useMemo(() => {
    const pool = new Set(assignableUsers(db, user).map((u) => u.id))
    return db.users
      .filter((u) => u.role === 'executive' && u.status === 'active' && (pool.has(u.id) || (u.availability === 'onLeave' && (!teamOnly || u.managerId === user.id))))
      .sort((a, b) => Number(a.availability === 'onLeave') - Number(b.availability === 'onLeave') || a.name.localeCompare(b.name))
  }, [db, user, teamOnly])
  const stats = useMemo(() => (open ? assigneeStatsFromDb(db, people.map((u) => u.id), now) : {}), [open, db, people, now])
  const preview = useMemo(() => (open ? previewAuto(db, leadIds, user) : []), [open, db, leadIds, user])
  const top = Math.max(1, ...Object.values(stats).map((s) => s.active))
  const nameOf = (id: ID | null) => (id ? db.users.find((u) => u.id === id)?.name : undefined) ?? t('team:assign.nobody')
  const leadName = (id: ID) => db.leads.find((l) => l.id === id)?.name ?? id
  const single = leadIds.length === 1
  const currentOwner = single ? db.leads.find((l) => l.id === leadIds[0])?.ownerId ?? null : null
  const first = preview[0]
  const mode = getAI().mode

  const submit = () => {
    try {
      const r = assignLeads(leadIds, target === 'auto' ? 'auto' : target, note.trim() || undefined)
      const done = r.result.filter((x) => x.to)
      if (!done.length) {
        toastUndo(t('team:assign.nothingChanged'), undefined)
      } else if (target !== 'auto') {
        toastUndo(t('team:assign.doneManual', { count: done.length, name: nameOf(target) }), r.undoToken, { description: t('team:assign.whyManual') })
      } else if (done.length === 1) {
        toastUndo(t('team:assign.doneAutoOne', { name: nameOf(done[0].to) }), r.undoToken, { description: t(`catalogue:assignmentReason.${done[0].reasonKey}`) })
      } else {
        const split = previewTotals(done).map((x) => `${nameOf(x.to)} ${x.count}`).join(' · ')
        toastUndo(t('team:assign.doneAutoMany', { count: done.length }), r.undoToken, { description: split })
      }
      onOpenChange(false)
      onDone?.()
    } catch (e) {
      toastError(e)
    }
  }

  const confirmLabel = target === 'auto'
    ? t('team:assign.confirmAuto', { count: leadIds.length })
    : t('team:assign.confirmTo', { name: nameOf(target) })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] gap-3 overflow-y-auto sm:max-w-2xl" data-testid="assign-dialog">
        <DialogHeader>
          <DialogTitle>{single ? t('team:assign.titleOne', { name: leadName(leadIds[0]) }) : t('team:assign.titleMany', { count: leadIds.length })}</DialogTitle>
          <DialogDescription>{t('team:assign.body')}</DialogDescription>
        </DialogHeader>

        {people.length === 0 ? (
          <EmptyState compact illustration={EmptyTeam} title={t('team:assign.noPeopleTitle')} body={t('team:assign.noPeopleBody')} />
        ) : (
          <RadioGroup value={target} onValueChange={setTarget} className="gap-2" aria-label={t('team:assign.choose')}>
            <label
              className={cn('flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors', target === 'auto' ? 'border-ai-border bg-ai-soft/40' : 'hover:bg-muted/50')}
              data-testid="assign-auto"
            >
              <span className="flex items-center gap-3">
                <RadioGroupItem value="auto" aria-label={t('team:assign.auto')} />
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ai-gradient text-ai-foreground"><Sparkles className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {t('team:assign.auto')}
                    <DemoAIBadge mode={mode} />
                  </span>
                  <span className="block text-meta text-muted-foreground">{t('team:assign.autoHint')}</span>
                </span>
              </span>
              {single && first && (
                <span className="ml-11 rounded-md bg-card px-3 py-2 text-sm" data-testid="assign-recommendation">
                  {first.to
                    ? <>{t('team:assign.recommendOne', { name: nameOf(first.to) })} <span className="text-muted-foreground">· {t(`team:assign.reason.${first.reasonKey}`, { count: stats[first.to]?.active ?? 0 })}</span></>
                    : t('team:assign.recommendNone')}
                  {first.to && first.to === currentOwner && <span className="mt-1 block text-meta text-muted-foreground">{t('team:assign.alreadyOwner')}</span>}
                </span>
              )}
              {!single && preview.length > 0 && (
                <span className="ml-11 flex flex-col gap-1.5 rounded-md bg-card p-2.5 text-meta" data-testid="assign-preview">
                  <span className="font-medium text-foreground">{t('team:assign.preview')}: {previewTotals(preview).map((x) => `${nameOf(x.to)} ${x.count}`).join(' · ')}</span>
                  <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                    {preview.map((p) => (
                      <li key={p.leadId} className="flex items-center justify-between gap-2">
                        <span className="truncate">{leadName(p.leadId)} → <strong>{nameOf(p.to)}</strong></span>
                        <span className="shrink-0 text-muted-foreground">{t(`catalogue:assignmentReason.${p.reasonKey}`)}</span>
                      </li>
                    ))}
                  </ul>
                </span>
              )}
            </label>

            {people.map((u) => (
              <PersonOption key={u.id} user={u} stats={stats[u.id]} top={top} on={target === u.id} current={u.id === currentOwner} recommended={single && first?.to === u.id} />
            ))}
          </RadioGroup>
        )}

        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('team:assign.notePlaceholder')} aria-label={t('team:assign.note')} rows={2} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common:actions.cancel')}</Button>
          <Button onClick={submit} disabled={!leadIds.length || !people.length} data-testid="assign-confirm">{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PersonOption({ user, stats, top, on, current, recommended }: { user: User; stats?: AssigneeStats; top: number; on: boolean; current: boolean; recommended: boolean }) {
  const { t, i18n } = useTranslation(['team', 'common', 'catalogue'])
  const off = user.availability === 'onLeave'
  const s = stats ?? { active: 0, hot: 0, warm: 0, cold: 0, pendingFollowUps: 0, overdue: 0, todayAppointments: 0, conversionPct: null }
  const seg = (n: number) => `${(n / top) * 100}%`
  return (
    <label
      className={cn(
        'grid cursor-pointer grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-2 rounded-lg border p-3 transition-colors sm:grid-cols-[auto_auto_minmax(8rem,1fr)_minmax(9rem,12rem)]',
        on ? 'border-primary/40 bg-primary-soft/50' : 'hover:bg-muted/50',
        off && 'cursor-not-allowed opacity-60 hover:bg-transparent',
      )}
      data-testid={`assign-person-${user.id}`}
    >
      <RadioGroupItem value={user.id} disabled={off} aria-label={user.name} />
      <UserAvatar name={user.name} size="sm" availability={user.availability} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{user.name}</span>
          {current && <span className="rounded-full bg-muted px-1.5 text-micro font-semibold text-muted-foreground">{t('team:assign.current')}</span>}
          {recommended && <span className="rounded-full bg-ai-soft px-1.5 text-micro font-semibold text-ai">{t('team:assign.recommended')}</span>}
        </span>
        <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
          <span aria-hidden="true" className={cn('size-1.5 rounded-full', availabilityTone[user.availability].solid)} />
          {off && user.leaveUntil ? t('team:availabilityUntil', { until: fmtDate(user.leaveUntil, i18n.language) }) : t(`common:availability.${user.availability}`)}
        </span>
      </span>
      <span className="col-span-3 flex flex-col gap-1.5 sm:col-span-1">
        <span className="flex items-center justify-between text-meta">
          <span className="text-muted-foreground">{t('team:assign.activeLeads', { count: s.active })}</span>
          <span className="tabular-nums text-muted-foreground">{s.conversionPct === null ? t('team:conversionNone') : t('team:conversionPct', { pct: s.conversionPct })}</span>
        </span>
        <span role="img" aria-label={t('team:workloadAria', { total: s.active, hot: s.hot, warm: s.warm, cold: s.cold })} className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          <span className={temperatureTone.hot.solid} style={{ width: seg(s.hot) }} />
          <span className={temperatureTone.warm.solid} style={{ width: seg(s.warm) }} />
          <span className={temperatureTone.cold.solid} style={{ width: seg(s.cold) }} />
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-meta text-muted-foreground">
          <span className="inline-flex items-center gap-1"><ListTodo className="size-3" aria-hidden="true" />{t('team:followUps', { count: s.pendingFollowUps })}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" aria-hidden="true" />{t('team:todayAppointments', { count: s.todayAppointments })}</span>
          {s.overdue > 0 && <span className="inline-flex items-center gap-1 text-danger"><Target className="size-3" aria-hidden="true" />{t('team:overdue', { count: s.overdue })}</span>}
        </span>
      </span>
    </label>
  )
}
