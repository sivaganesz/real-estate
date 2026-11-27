/**
 * Month view (DESIGN_SYSTEM §11.6): Monday-first weeks, today's number in a filled Peacock circle, at most 3 chips a day
 * then "+N more" in a popover. On a phone the chips become coloured dots and the day opens in the day view.
 */
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Appointment, ID, ISODate } from '@/domain/types'
import { useIsPhone } from '@/hooks/use-media-query'
import { usePermission } from '@/hooks/use-permission'
import { localDay, parseLocalDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { atMinutes, itemsOnDay, weekDays } from '../lib/calendar'
import { TYPE_DOT } from '../lib/event-style'
import { EventChip } from './event'
import type { EventInfo } from './use-event-info'

const MAX_CHIPS = 3

export function MonthGrid({ weeks, month, items, now, clashes, info, onOpenDay, onSlot }: {
  weeks: ISODate[][]
  /** 'YYYY-MM' of the month shown. */
  month: string
  items: Appointment[]
  now: Date
  clashes: Set<ID>
  info: Map<ID, EventInfo>
  onOpenDay: (day: ISODate) => void
  onSlot: (startIso: string) => void
}) {
  const { t, i18n } = useTranslation('appointments')
  const phone = useIsPhone()
  const { can } = usePermission()
  const mayBook = can('appointment.manage')
  const locale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN'
  const today = localDay(now)
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-card" data-testid="month-grid">
      <div className="grid grid-cols-7 border-b">
        {weekDays(weeks[0][0]).map((d) => (
          <div key={d} className="py-2 text-center text-caption font-medium tracking-[0.06em] text-muted-foreground uppercase [:lang(ta)_&]:normal-case">
            {parseLocalDay(d).toLocaleDateString(locale, { weekday: phone ? 'narrow' : 'short' })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((d, i) => {
          const list = itemsOnDay(items, d)
          const inMonth = d.startsWith(month)
          const isToday = d === today
          const date = parseLocalDay(d)
          const more = list.length - MAX_CHIPS
          const longDate = date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <div key={d} className={cn('group relative flex min-h-16 flex-col gap-1 border-b p-1 md:min-h-28 md:p-1.5', i % 7 !== 0 && 'border-l', !inMonth && 'bg-muted/40')}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenDay(d)}
                  aria-label={t('grid.openDayCount', { date: longDate, count: list.length })}
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-ui font-semibold tabular-nums hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    isToday && 'bg-primary text-primary-foreground hover:bg-primary-strong',
                    !inMonth && !isToday && 'text-subtle-foreground',
                  )}
                >
                  {date.getDate()}
                </button>
                {mayBook && !phone && (
                  <button
                    type="button"
                    onClick={() => onSlot(atMinutes(d, 11 * 60))}
                    aria-label={t('grid.bookOn', { date: longDate })}
                    className="flex size-6 items-center justify-center rounded-md text-primary opacity-0 group-hover:opacity-100 hover:bg-primary-soft focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:opacity-100"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              {phone ? (
                list.length > 0 && (
                  <button type="button" onClick={() => onOpenDay(d)} className="flex flex-wrap gap-0.5 px-0.5" aria-label={t('grid.openDayCount', { date: longDate, count: list.length })}>
                    {list.slice(0, 6).map((a) => <span key={a.id} aria-hidden="true" className={cn('size-1.5 rounded-full', TYPE_DOT[a.type], a.status === 'cancelled' && 'opacity-40')} />)}
                  </button>
                )
              ) : (
                <>
                  {list.slice(0, MAX_CHIPS).map((a) => <EventChip key={a.id} a={a} info={info.get(a.id)} clash={clashes.has(a.id)} />)}
                  {more > 0 && (
                    <Popover>
                      <PopoverTrigger className="self-start rounded-xs px-1 text-meta font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                        {t('grid.more', { count: more })}
                      </PopoverTrigger>
                      <PopoverContent align="start" className="flex w-64 flex-col gap-1 p-2">
                        <p className="px-1 pb-1 text-meta font-semibold">{longDate}</p>
                        {list.map((a) => <EventChip key={a.id} a={a} info={info.get(a.id)} clash={clashes.has(a.id)} />)}
                      </PopoverContent>
                    </Popover>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
