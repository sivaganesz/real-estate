/**
 * Date + time field: a button showing "DD MMM YYYY" that opens the mini calendar (with Today / Tomorrow / Next week
 * chips) and a time select in 15-minute steps (h:mm a). Value is an ISO date-time; `dateOnly` keeps it to a day.
 */
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNow } from '@/hooks/use-now'
import { addDaysToDay, localDay } from '@/lib/dates'
import { fmtDate, fmtTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Chip } from './chip'
import { MiniCalendar } from './mini-calendar'

const pad = (n: number) => String(n).padStart(2, '0')
const TIMES = Array.from({ length: (21 - 7) * 4 + 1 }, (_, i) => {
  const m = 7 * 60 + i * 15
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
})
const combine = (day: string, hhmm: string) => {
  const [y, mo, d] = day.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi).toISOString()
}

export function DateTimeField({ value, onChange, now: nowProp, min, dateOnly, id, invalid, describedBy, className }: {
  value?: string
  onChange: (iso: string) => void
  now?: Date
  /** Earliest day allowed ('YYYY-MM-DD'). */
  min?: string
  dateOnly?: boolean
  id?: string
  invalid?: boolean
  describedBy?: string
  className?: string
}) {
  const { t, i18n } = useTranslation('ui')
  const [open, setOpen] = useState(false)
  const ticking = useNow()
  const now = nowProp ?? ticking
  const today = localDay(now)
  const day = value ? localDay(value) : undefined
  const d = value ? new Date(value) : undefined
  const time = d ? `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 15) * 15)}` : '11:00'
  const setDay = (x: string) => {
    onChange(combine(x, dateOnly ? '10:00' : time))
    setOpen(false)
  }
  const lang = i18n.language
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="secondary" aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn('min-w-40 flex-1 justify-start font-normal tabular-nums', !value && 'text-muted-foreground')}>
            <CalendarDays aria-hidden="true" />
            {value ? fmtDate(value, lang) : t('date.pick')}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Chip size="sm" onClick={() => setDay(today)}>{t('date.today')}</Chip>
            <Chip size="sm" onClick={() => setDay(addDaysToDay(today, 1))}>{t('date.tomorrow')}</Chip>
            <Chip size="sm" onClick={() => setDay(addDaysToDay(today, 3))}>{t('date.inThreeDays')}</Chip>
            <Chip size="sm" onClick={() => setDay(addDaysToDay(today, 7))}>{t('date.nextWeek')}</Chip>
          </div>
          <MiniCalendar value={day} today={today} min={min} onSelect={setDay} />
        </PopoverContent>
      </Popover>
      {!dateOnly && (
        <Select value={time} onValueChange={(v) => onChange(combine(day ?? addDaysToDay(today, 1), v))}>
          <SelectTrigger className="w-32 tabular-nums" aria-label={t('date.time')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {TIMES.map((x) => <SelectItem key={x} value={x}>{fmtTime(combine(today, x), lang)}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
