/**
 * Heatmap (DESIGN_SYSTEM §10, custom): a rows × columns grid of `rounded-[3px]` cells filled with
 * `color-mix(in oklch, var(--primary) X%, var(--card))`, X in five buckets from 8% to 100%. Each cell has a title.
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { ChartEmpty } from './chart-parts'

// written out in full so Tailwind generates them
const BUCKETS = [
  'bg-muted',
  'bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--primary)_28%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--primary)_52%,var(--card))]',
  'bg-[color-mix(in_oklch,var(--primary)_76%,var(--card))]',
  'bg-primary',
] as const

export function Heatmap({ rows, columns, value, label, cellLabel }: {
  /** Row labels (e.g. weekdays, already translated). */
  rows: string[]
  /** Column labels (e.g. hours); only every few are printed. */
  columns: string[]
  value: (row: number, col: number) => number
  label: string
  cellLabel?: (row: number, col: number, v: number) => string
}) {
  const { t } = useTranslation('ui')
  const values = rows.map((_, r) => columns.map((__, c) => value(r, c)))
  const max = Math.max(0, ...values.flat())
  if (max === 0) return <ChartEmpty height={160} />
  const bucket = (v: number) => (v <= 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)))
  const step = Math.ceil(columns.length / 8)
  return (
    <figure aria-label={label} className="flex flex-col gap-2 overflow-x-auto">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `2.5rem repeat(${columns.length}, minmax(12px, 1fr))` }}>
        <span />
        {columns.map((c, i) => <span key={i} className="text-center text-micro text-subtle-foreground tabular-nums">{i % step === 0 ? c : ''}</span>)}
        {rows.map((r, ri) => (
          <div key={r} className="contents">
            <span className="pr-1 text-micro leading-[14px] text-muted-foreground">{r}</span>
            {columns.map((c, ci) => {
              const v = values[ri][ci]
              return <span key={ci} title={cellLabel?.(ri, ci, v) ?? `${r} ${c}: ${v}`} className={cn('h-3.5 rounded-[3px]', BUCKETS[bucket(v)])} />
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 text-micro text-subtle-foreground">
        {t('chart.less')}
        {BUCKETS.slice(1).map((b) => <span key={b} aria-hidden="true" className={cn('size-3 rounded-[3px]', b)} />)}
        {t('chart.more')}
      </div>
    </figure>
  )
}
