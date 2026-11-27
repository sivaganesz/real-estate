/**
 * Effort-saved indicators (master prompt §12.0: show how much manual effort AI saved):
 * - <EffortSaved count={8}/>: "✦ 8 fields auto-filled" on forms (also "leads" and "tasks" variants);
 * - <AutoAssignedToday/>: "✦ 12 leads auto-assigned today" for Manager / Admin Today (plan §8.3 M7);
 * - <EffortStrip/>: today's AI help for the current user as three small tiles (assistant actions, fields filled,
 *   leads auto-assigned) and an "about N min saved" estimate. All counted from real records (ai/effort.ts).
 */
import { useMemo } from 'react'
import { Clock, Sparkles, UserCheck, Wand2, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { effortSaved } from '@/ai/effort'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useWholeDb } from '@/hooks/use-db'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/utils'

export function EffortSaved({ count, kind = 'fields', className }: { count: number; kind?: 'fields' | 'leads' | 'tasks'; className?: string }) {
  const { t } = useTranslation('ai')
  if (!count) return <p className={cn('text-meta text-muted-foreground', className)}>{t('effort.none')}</p>
  return (
    <p className={cn('inline-flex items-center gap-1.5 text-meta font-medium text-ai', className)} data-testid="effort-saved">
      <Sparkles className="size-3.5" aria-hidden="true" />
      {t(`effort.${kind}`, { count })}
    </p>
  )
}

function useEffort() {
  const db = useWholeDb()
  const user = useCurrentUser()
  const now = useNow()
  return useMemo(() => effortSaved(db, user, now), [db, user, now])
}

/** "✦ 12 leads auto-assigned today" (Manager / Admin Today). Hidden when there were none, unless `showZero`. */
export function AutoAssignedToday({ className, showZero }: { className?: string; showZero?: boolean }) {
  const { t } = useTranslation('ai')
  const e = useEffort()
  if (!e.autoAssigned && !showZero) return null
  return (
    <p className={cn('inline-flex items-center gap-1.5 rounded-full bg-ai-soft px-2.5 py-1 text-meta font-medium text-ai', className)} data-testid="auto-assigned-today">
      <Sparkles className="size-3.5" aria-hidden="true" />
      {t('effort.leads', { count: e.autoAssigned })}
    </p>
  )
}

/** Today's AI help for the current user, as tiles. */
export function EffortStrip({ className }: { className?: string }) {
  const { t } = useTranslation('ai')
  const e = useEffort()
  const tiles = [
    { key: 'actions', icon: Zap, value: e.actions, label: t('effort.tile.actions', { count: e.actions }) },
    { key: 'fields', icon: Wand2, value: e.fields, label: t('effort.tile.fields', { count: e.fields }) },
    { key: 'assigned', icon: UserCheck, value: e.autoAssigned + e.autoTasks, label: t('effort.tile.automated', { count: e.autoAssigned + e.autoTasks }) },
  ]
  return (
    <section aria-label={t('effort.title')} className={cn('rounded-xl border bg-card p-3', className)} data-testid="effort-strip">
      <h3 className="mb-2 flex items-center justify-between gap-2 text-caption font-semibold tracking-[0.06em] text-subtle-foreground uppercase [:lang(ta)_&]:normal-case">
        {t('effort.title')}
        {e.minutes > 0 && <span className="inline-flex items-center gap-1 font-medium tracking-normal text-ai normal-case"><Clock className="size-3" aria-hidden="true" />{t('effort.minutes', { count: e.minutes })}</span>}
      </h3>
      <ul className="grid grid-cols-3 gap-2">
        {tiles.map(({ key, icon: Icon, value, label }) => (
          <li key={key} className="flex flex-col items-start gap-1 rounded-lg bg-ai-soft/50 px-2.5 py-2">
            <span className="flex items-center gap-1.5">
              <Icon className="size-3.5 text-ai" aria-hidden="true" />
              <span className="text-lg font-semibold tabular-nums">{value}</span>
            </span>
            <span className="text-micro leading-tight text-muted-foreground">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
