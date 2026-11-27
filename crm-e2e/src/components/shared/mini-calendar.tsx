/**
 * A small month calendar for picking one day (YYYY-MM-DD, local). Ported from
 * wireframe-rebuild/src/components/app/mini-calendar.tsx: month and weekday names come from the browser in the
 * current language; weeks start on Sunday as on Indian calendars; today has a Peacock ring; `marked` days get a dot.
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

export function MiniCalendar({ value, today, min, onSelect, marked }: {
  value?: string
  today: string
  min?: string
  onSelect: (day: string) => void
  marked?: ReadonlySet<string>
}) {
  const { t, i18n } = useTranslation('ui')
  const locale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN'
  const start = (value || today).split('-').map(Number)
  const [view, setView] = useState({ y: start[0], m: start[1] - 1 })
  const first = new Date(view.y, view.m, 1)
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const cells: (number | null)[] = [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const move = (by: number) => setView(({ y, m }) => ({ y: y + Math.floor((m + by) / 12), m: (((m + by) % 12) + 12) % 12 }))
  // weekday initials, Sunday first (4 Jan 2026 is a Sunday)
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 4 + i).toLocaleDateString(locale, { weekday: 'narrow' }))
  const prevDisabled = !!min && iso(view.y, view.m, 1) <= min
  return (
    <div className="w-full min-w-60 select-none">
      <div className="mb-1 flex items-center justify-between">
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(-1)} disabled={prevDisabled} aria-label={t('date.prevMonth')}><ChevronLeft /></Button>
        <span className="text-sm font-semibold" aria-live="polite">{first.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</span>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => move(1)} aria-label={t('date.nextMonth')}><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekdays.map((w, i) => <span key={i} className="py-1 text-caption font-medium text-muted-foreground">{w}</span>)}
        {cells.map((d, i) => {
          if (d === null) return <span key={`x${i}`} />
          const day = iso(view.y, view.m, d)
          const off = !!min && day < min
          const on = day === value
          return (
            <button
              key={day} type="button" disabled={off} onClick={() => onSelect(day)} aria-pressed={on}
              aria-label={new Date(view.y, view.m, d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              className={cn(
                'relative grid aspect-square place-items-center rounded-md text-sm tabular-nums transition-colors duration-(--dur-fast)',
                on ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-muted',
                day === today && !on && 'font-semibold text-primary ring-1 ring-primary/40 ring-inset',
                off && 'pointer-events-none text-muted-foreground/40',
              )}
            >
              {d}
              {marked?.has(day) && <span aria-hidden="true" className={cn('absolute bottom-1 size-1 rounded-full', on ? 'bg-primary-foreground' : 'bg-primary')} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
