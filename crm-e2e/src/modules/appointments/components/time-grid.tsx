/**
 * Day and week time grid (DESIGN_SYSTEM §11.6): an hour gutter, one column per day, events positioned by time with
 * overlapping ones side by side, the current-time line (2 px danger with a dot) in today's column, today's date in a
 * filled Peacock circle, and click-a-slot-to-book (30-minute slots; also keyboard: each hour row is a button).
 */
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { Appointment, ID, ISODate } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { localDay, parseLocalDay } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { atMinutes, layoutDay, nowOffset, slotAt } from '../lib/calendar'
import { EventBlock } from './event'
import type { EventInfo } from './use-event-info'

const PX_PER_MIN = 0.9

export function TimeGrid({ days, items, hours, now, clashes, info, onSlot, onOpenDay }: {
  days: ISODate[]
  /** Already filtered to the visible days. */
  items: Appointment[]
  hours: [number, number]
  now: Date
  clashes: Set<ID>
  info: Map<ID, EventInfo>
  onSlot: (startIso: string) => void
  onOpenDay?: (day: ISODate) => void
}) {
  const { t, i18n } = useTranslation('appointments')
  const { can } = usePermission()
  const mayBook = can('appointment.manage')
  const [h0, h1] = hours
  const height = (h1 - h0) * 60 * PX_PER_MIN
  const today = localDay(now)
  const line = nowOffset(now, h0, h1)
  const locale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN'

  // Start scrolled near the working morning (or the current time) instead of at the top of the grid. The scroller is
  // keyed by the visible days, so this runs once per page of the calendar and the minute tick never yanks it.
  const daysKey = days.join(',')
  const target = line != null && days.includes(today) ? line - 90 : (9 - h0) * 60
  const initScroll = (el: HTMLDivElement | null) => {
    if (el && !el.dataset.scrolled) {
      el.scrollTop = Math.max(0, target * PX_PER_MIN)
      el.dataset.scrolled = '1'
    }
  }

  const hourLabels = Array.from({ length: h1 - h0 }, (_, i) => {
    const d = new Date(2000, 0, 1, h0 + i)
    return d.toLocaleTimeString(locale, { hour: 'numeric' })
  })

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-card" data-testid="time-grid">
      {/* day headers */}
      <div className="grid border-b bg-card" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div aria-hidden="true" />
        {days.map((d) => {
          const date = parseLocalDay(d)
          const isToday = d === today
          const label = (
            <>
              <span className="text-caption font-medium tracking-[0.06em] text-muted-foreground uppercase [:lang(ta)_&]:normal-case">
                {date.toLocaleDateString(locale, { weekday: 'short' })}
              </span>
              <span className={cn('flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums', isToday && 'bg-primary text-primary-foreground')}>
                {date.getDate()}
              </span>
            </>
          )
          return onOpenDay ? (
            <button key={d} type="button" onClick={() => onOpenDay(d)} aria-label={t('grid.openDay', { date: date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' }) })}
              className="flex flex-col items-center gap-0.5 border-l py-2 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none">
              {label}
            </button>
          ) : (
            <div key={d} className="flex flex-col items-center gap-0.5 border-l py-2">{label}</div>
          )
        })}
      </div>
      <div key={daysKey} ref={initScroll} className="max-h-[min(70svh,720px)] overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`, height }}>
          {/* hour gutter */}
          <div className="relative">
            {hourLabels.map((h, i) => (
              <span key={h + i} className="absolute right-2 -translate-y-1/2 text-micro text-subtle-foreground tabular-nums" style={{ top: i * 60 * PX_PER_MIN }}>
                {i === 0 ? '' : h}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const dayItems = items.filter((a) => localDay(a.start) === d)
            const placed = layoutDay(dayItems, h0)
            const isToday = d === today
            return (
              <div key={d} className={cn('relative border-l', isToday && 'bg-primary-soft/25')}
                onClick={(e) => {
                  if (!mayBook) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  onSlot(atMinutes(d, slotAt((e.clientY - rect.top) / PX_PER_MIN, h0)))
                }}>
                {Array.from({ length: h1 - h0 }, (_, i) => (
                  <Fragment key={i}>
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: i * 60 * PX_PER_MIN }} />
                    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/40" style={{ top: (i * 60 + 30) * PX_PER_MIN }} />
                    {mayBook && (
                      <button
                        type="button"
                        className="absolute inset-x-0 z-[1] cursor-cell opacity-0 hover:bg-primary-soft/40 hover:opacity-100 focus-visible:bg-primary-soft/60 focus-visible:opacity-100 focus-visible:outline-none"
                        style={{ top: i * 60 * PX_PER_MIN, height: 30 * PX_PER_MIN }}
                        aria-label={t('grid.bookAt', { time: new Date(2000, 0, 1, h0 + i).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }), date: parseLocalDay(d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' }) })}
                        onClick={(e) => { e.stopPropagation(); onSlot(atMinutes(d, (h0 + i) * 60)) }}
                      >
                        <span className="pointer-events-none px-1.5 text-micro font-semibold text-primary">+ {t('grid.book')}</span>
                      </button>
                    )}
                  </Fragment>
                ))}
                {placed.map((p) => (
                  <EventBlock
                    key={p.a.id}
                    a={p.a}
                    info={info.get(p.a.id)}
                    clash={clashes.has(p.a.id)}
                    compact={p.height * PX_PER_MIN < 44}
                    style={{
                      top: p.top * PX_PER_MIN + 1,
                      height: Math.max(p.height * PX_PER_MIN - 2, 18),
                      left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                      width: `calc(${100 / p.lanes}% - 4px)`,
                    }}
                  />
                ))}
                {isToday && line != null && (
                  <div data-testid="now-line" aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-[4] h-0.5 bg-danger" style={{ top: line * PX_PER_MIN }}>
                    <span className="absolute -top-[5px] -left-[5px] size-3 rounded-full bg-danger" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
