/**
 * Shared recharts styling (DESIGN_SYSTEM §10): no chart border or background, horizontal dashed grid only, no axis
 * lines or tick lines, 11 px tabular ticks in `--chart-axis`. Series colours come from tokens, never hex.
 */
import { inrShort } from '@/lib/format'

export const CHART_HEIGHT = { standard: 240, compact: 160, spark: 48 } as const

/** chart-1 … chart-8 in order. */
export const SERIES_COLORS = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`)
export const seriesColor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length]

export const GRID_PROPS = { stroke: 'var(--chart-grid)', strokeDasharray: '3 3', vertical: false } as const
export const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 11, style: { fontVariantNumeric: 'tabular-nums' } } as const
export const AXIS_PROPS = { axisLine: false, tickLine: false, tick: AXIS_TICK, tickMargin: 8 } as const

export type ValueFormat = 'count' | 'inr' | 'pct'
export function formatValue(v: unknown, f: ValueFormat = 'count'): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  if (f === 'inr') return inrShort(n)
  if (f === 'pct') return `${Math.round(n)}%`
  return new Intl.NumberFormat('en-IN').format(n)
}

/** A series the chart draws: the data key, its translated label and its token colour. */
export type ChartSeries = { key: string; label: string; color?: string }
