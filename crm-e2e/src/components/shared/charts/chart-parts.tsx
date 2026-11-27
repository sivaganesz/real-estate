/**
 * Chart building blocks (DESIGN_SYSTEM §10): the tooltip (popover surface, 8 px dots, right-aligned tabular values),
 * the custom legend (top-right dots; click toggles a series, hover highlights it), the empty state (grid kept, a
 * centred "No data for this period") and the loading skeleton (three faint bars at the chart height).
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatValue, type ValueFormat } from './chart-style'

export type TooltipItem = { name?: unknown; value?: unknown; color?: string; dataKey?: unknown; payload?: unknown }

export function ChartTooltipContent({ active, payload, label, format = 'count', labelFormat, names }: {
  active?: boolean
  payload?: readonly TooltipItem[]
  label?: unknown
  format?: ValueFormat
  labelFormat?: (label: unknown) => ReactNode
  /** Data key → translated series name. */
  names?: Record<string, string>
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      {label != null && label !== '' && <p className="mb-1 font-semibold">{labelFormat ? labelFormat(label) : String(label)}</p>}
      <ul className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="flex-1 text-muted-foreground">{names?.[String(p.dataKey)] ?? String(p.name ?? '')}</span>
            <span className="font-medium tabular-nums">{formatValue(p.value, format)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ChartLegend({ items, hidden, onToggle, onHover, className }: {
  items: { key: string; label: string; color: string }[]
  hidden?: ReadonlySet<string>
  onToggle?: (key: string) => void
  onHover?: (key: string | null) => void
  className?: string
}) {
  const { t } = useTranslation('ui')
  return (
    <ul className={cn('flex flex-wrap items-center justify-end gap-x-3 gap-y-1', className)} aria-label={t('chart.legend')}>
      {items.map((it) => {
        const off = hidden?.has(it.key)
        const inner = (
          <>
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: it.color, opacity: off ? 0.35 : 1 }} />
            <span className={cn(off && 'line-through')}>{it.label}</span>
          </>
        )
        return (
          <li key={it.key}>
            {onToggle ? (
              <button
                type="button" aria-pressed={!off} onClick={() => onToggle(it.key)}
                onMouseEnter={() => onHover?.(it.key)} onMouseLeave={() => onHover?.(null)} onFocus={() => onHover?.(it.key)} onBlur={() => onHover?.(null)}
                className="inline-flex items-center gap-1.5 rounded-xs text-meta text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {inner}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">{inner}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ChartEmpty({ height, message, action }: { height: number; message?: ReactNode; action?: ReactNode }) {
  const { t } = useTranslation('ui')
  return (
    <div className="relative w-full" style={{ height }} role="status">
      <div aria-hidden="true" className="absolute inset-0 flex flex-col justify-between py-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-dashed border-[var(--chart-grid)]" />)}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        {message ?? t('chart.empty')}
        {action}
      </div>
    </div>
  )
}

export function ChartSkeleton({ height }: { height: number }) {
  return (
    <div aria-hidden="true" className="flex w-full items-end gap-3 px-2" style={{ height }}>
      {[55, 80, 40].map((h, i) => <div key={i} className="skeleton flex-1 rounded-sm" style={{ height: `${h}%` }} />)}
    </div>
  )
}
