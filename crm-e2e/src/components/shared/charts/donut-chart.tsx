/**
 * Donut (DESIGN_SYSTEM §10): inner radius 70%, a 2 px `--card` stroke between slices, the total in the centre in
 * `text-kpi` with a label, and a legend with values beside it. Hovering a slice dims the others; clicking navigates.
 */
import { useState } from 'react'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'
import { ChartContainer } from './chart-container'
import { ChartTooltipContent } from './chart-parts'
import { formatValue, seriesColor, type ValueFormat } from './chart-style'

export type DonutSlice = { key: string; label: string; value: number; color?: string }

export function DonutChart({ data, height = 200, format = 'count', centerLabel, centerValue, label, loading, onSliceClick, className }: {
  data: DonutSlice[]
  height?: number
  format?: ValueFormat
  centerLabel: string
  centerValue?: string
  label: string
  loading?: boolean
  onSliceClick?: (key: string) => void
  className?: string
}) {
  const reduced = useReducedMotion()
  const [active, setActive] = useState<string | null>(null)
  const slices = data.map((d, i) => ({ ...d, color: d.color ?? seriesColor(i) }))
  const total = slices.reduce((n, d) => n + d.value, 0)
  return (
    <div className={cn('grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', className)}>
      <div className="relative">
        <ChartContainer height={height} label={label} loading={loading} empty={total === 0}>
          <PieChart>
            <Tooltip content={(p) => <ChartTooltipContent active={p.active} payload={p.payload} format={format} />} />
            <Pie
              data={slices} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="100%" paddingAngle={0} stroke="var(--card)" strokeWidth={2}
              isAnimationActive={!reduced} animationDuration={420}
              onMouseEnter={(_, i) => setActive(slices[i]?.key ?? null)} onMouseLeave={() => setActive(null)}
              onClick={onSliceClick ? (_, i) => { const k = slices[i]?.key; if (k) onSliceClick(k) } : undefined}
              cursor={onSliceClick ? 'pointer' : undefined}
            >
              {slices.map((d) => <Cell key={d.key} fill={d.color} fillOpacity={active && active !== d.key ? 0.35 : 1} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
        {!loading && total > 0 && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-kpi font-[650] tabular-nums">{centerValue ?? formatValue(total, format)}</span>
            <span className="text-meta text-muted-foreground">{centerLabel}</span>
          </div>
        )}
      </div>
      <ul className="flex flex-col gap-1.5">
        {slices.map((d) => (
          <li key={d.key}>
            <button
              type="button" disabled={!onSliceClick} onClick={() => onSliceClick?.(d.key)}
              onMouseEnter={() => setActive(d.key)} onMouseLeave={() => setActive(null)}
              className="flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-left text-sm enabled:hover:bg-muted/60 disabled:cursor-default"
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.label}</span>
              <span className="font-medium tabular-nums">{formatValue(d.value, format)}</span>
              <span className="w-10 text-right text-meta text-subtle-foreground tabular-nums">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
