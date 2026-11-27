/**
 * Workload bars (DESIGN_SYSTEM §11.12): one row per executive with an avatar, name, a stacked hot / warm / cold bar on a
 * `--muted` track scaled to the team maximum, the count and an availability dot.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Availability, Role } from '@/domain/types'
import { temperatureTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { UserAvatar } from './user-avatar'

export type WorkloadRow = {
  id: string
  name: string
  role?: Role
  availability?: Availability
  hot: number
  warm: number
  cold: number
  /** Extra text on the right (overdue tasks, visits today). */
  extra?: ReactNode
}

export function WorkloadBars({ rows, max, onSelect, className }: { rows: WorkloadRow[]; max?: number; onSelect?: (id: string) => void; className?: string }) {
  const { t } = useTranslation(['ui', 'common', 'catalogue'])
  const top = Math.max(1, max ?? Math.max(...rows.map((r) => r.hot + r.warm + r.cold), 1))
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {rows.map((r) => {
        const total = r.hot + r.warm + r.cold
        const seg = (n: number) => `${(n / top) * 100}%`
        const Row = onSelect ? 'button' : 'div'
        return (
          <li key={r.id}>
            <Row
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(r.id) } : {})}
              className={cn('grid w-full grid-cols-[auto_minmax(6rem,10rem)_1fr_auto] items-center gap-3 rounded-md text-left', onSelect && 'p-1 -m-1 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}
            >
              <UserAvatar name={r.name} size="sm" availability={r.availability} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{r.name}</span>
                {r.availability && <span className="block truncate text-meta text-muted-foreground">{t(`common:availability.${r.availability}`)}</span>}
              </span>
              <span
                role="img"
                aria-label={t('ui:workload.aria', { name: r.name, total, hot: r.hot, warm: r.warm, cold: r.cold })}
                className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <span className={temperatureTone.hot.solid} style={{ width: seg(r.hot) }} />
                <span className={temperatureTone.warm.solid} style={{ width: seg(r.warm) }} />
                <span className={temperatureTone.cold.solid} style={{ width: seg(r.cold) }} />
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">
                {total}
                {r.extra}
              </span>
            </Row>
          </li>
        )
      })}
    </ul>
  )
}

export function WorkloadLegend() {
  const { t } = useTranslation('catalogue')
  return (
    <div className="flex items-center gap-3 text-meta text-muted-foreground">
      {(['hot', 'warm', 'cold'] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2 rounded-full', temperatureTone[k].solid)} />
          {t(`temperature.${k}`)}
        </span>
      ))}
    </div>
  )
}
