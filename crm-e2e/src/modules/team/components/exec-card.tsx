/**
 * One executive on the Team page: avatar with availability, name → profile, availability control, the active-load
 * bar (hot / warm / cold), pending follow-ups (overdue in danger), today's appointments, a conversion ring and this
 * month's target bars (calls, site visits, bookings).
 */
import { CalendarDays, ListTodo, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { Meter } from '@/components/shared/meter'
import { ProgressRing } from '@/components/shared/progress-ring'
import { UserAvatar } from '@/components/shared/user-avatar'
import type { User } from '@/domain/types'
import type { AssigneeStats } from '@/lib/assignment'
import { temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import type { targetProgress } from '@/services/queries/stats'
import { AvailabilityControl } from './availability-control'
import { UserActions } from './user-actions'

type Progress = ReturnType<typeof targetProgress>

export function ExecCard({ user, stats, progress, top }: { user: User; stats: AssigneeStats; progress: Progress; top: number }) {
  const { t } = useTranslation(['team', 'common', 'catalogue'])
  const seg = (n: number) => `${(n / Math.max(1, top)) * 100}%`
  const conv = stats.conversionPct
  return (
    <article className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-card md:p-5" data-testid={`exec-card-${user.id}`}>
      <header className="flex items-start gap-3">
        <UserAvatar name={user.name} size="lg" role={user.role} availability={user.availability} />
        <div className="min-w-0 flex-1">
          <Link to={paths.teamMember(user.id)} className="block truncate text-base font-semibold hover:text-primary hover:underline">{user.name}</Link>
          <p className="flex items-center gap-1 truncate text-meta text-muted-foreground">
            <MapPin className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{user.cities.join(', ') || t('common:roles.executive')}</span>
          </p>
          <div className="mt-1.5"><AvailabilityControl user={user} /></div>
        </div>
        <UserActions user={user} />
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-label font-semibold tracking-[0.04em] text-muted-foreground uppercase [:lang(ta)_&]:tracking-normal [:lang(ta)_&]:normal-case">{t('team:card.load')}</span>
          <span className="text-sm font-semibold tabular-nums">{t('team:card.active', { count: stats.active })}</span>
        </div>
        <span role="img" aria-label={t('team:workloadAria', { total: stats.active, hot: stats.hot, warm: stats.warm, cold: stats.cold })} className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <span className={temperatureTone.hot.solid} style={{ width: seg(stats.hot) }} />
          <span className={temperatureTone.warm.solid} style={{ width: seg(stats.warm) }} />
          <span className={temperatureTone.cold.solid} style={{ width: seg(stats.cold) }} />
        </span>
        <span className="flex gap-3 text-meta text-muted-foreground">
          {(['hot', 'warm', 'cold'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', temperatureTone[k].solid)} />
              {t(`catalogue:temperature.${k}`)} <span className="tabular-nums">{stats[k]}</span>
            </span>
          ))}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2.5">
        <div className="flex flex-col items-start gap-0.5">
          <dt className="inline-flex items-center gap-1 text-meta text-muted-foreground"><ListTodo className="size-3" aria-hidden="true" />{t('team:card.followUps')}</dt>
          <dd className="text-base font-semibold tabular-nums">
            {stats.pendingFollowUps}
            {stats.overdue > 0 && <span className="ml-1 text-meta font-medium text-danger">{t('team:card.overdueShort', { count: stats.overdue })}</span>}
          </dd>
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <dt className="inline-flex items-center gap-1 text-meta text-muted-foreground"><CalendarDays className="size-3" aria-hidden="true" />{t('team:card.today')}</dt>
          <dd className="text-base font-semibold tabular-nums">{stats.todayAppointments}</dd>
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex flex-col gap-0.5">
            <dt className="text-meta text-muted-foreground">{t('team:card.conversion')}</dt>
            <dd className="sr-only">{conv === null ? t('team:conversionNone') : t('team:conversionPct', { pct: conv })}</dd>
          </div>
          <ProgressRing value={conv ?? 0} size={40} tone="success" label={t('team:card.conversion')}>{conv === null ? '–' : `${conv}%`}</ProgressRing>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <span className="text-label font-semibold tracking-[0.04em] text-muted-foreground uppercase [:lang(ta)_&]:tracking-normal [:lang(ta)_&]:normal-case">{t('team:card.targets')}</span>
        {user.targets ? (['calls', 'siteVisits', 'bookings'] as const).map((k) => (
          <div key={k} className="grid grid-cols-[minmax(5rem,7rem)_1fr_auto] items-center gap-2 text-meta">
            <span className="truncate text-muted-foreground">{t(`team:target.${k}`)}</span>
            <Meter value={progress[k].pct} tone="primary" targetMet={progress[k].target > 0 && progress[k].done >= progress[k].target} label={t(`team:target.${k}`)} />
            <span className="tabular-nums">{progress[k].done}/{progress[k].target}</span>
          </div>
        )) : <p className="text-meta text-muted-foreground">{t('team:card.noTargets')}</p>}
      </div>
    </article>
  )
}
