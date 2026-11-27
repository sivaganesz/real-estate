/**
 * Bar chart (DESIGN_SYSTEM §10): 4 px top radius, maxBarSize 28, 4 px gaps, a `--muted` cursor band, grouped or stacked,
 * vertical (default) or horizontal (`layout="vertical"` for ranked lists such as sources). Per-bar colours (stage or
 * appointment tokens) come through `colorOf`. Clicking a bar calls `onBarClick` (navigate to the filtered list).
 */
import { Bar, BarChart as RBarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { ChartContainer } from './chart-container'
import { ChartTooltipContent } from './chart-parts'
import { AXIS_PROPS, formatValue, GRID_PROPS, seriesColor, type ChartSeries, type ValueFormat } from './chart-style'
import { useSeriesToggle } from './use-series'

export function BarSeriesChart<T extends Record<string, unknown>>({ data, xKey, series, height = 240, format = 'count', xFormat, label, loading, stacked, horizontal, colorOf, onBarClick }: {
  data: T[]
  xKey: keyof T & string
  series: ChartSeries[]
  height?: number
  format?: ValueFormat
  xFormat?: (v: unknown) => string
  label: string
  loading?: boolean
  stacked?: boolean
  horizontal?: boolean
  /** A colour per row for single-series charts (e.g. `var(--stage-negotiation)`). */
  colorOf?: (row: T) => string
  onBarClick?: (row: T) => void
}) {
  const reduced = useReducedMotion()
  const s = useSeriesToggle()
  const colored = series.map((x, i) => ({ ...x, color: x.color ?? seriesColor(i) }))
  const empty = !data.length || data.every((row) => series.every((x) => !Number(row[x.key])))
  const names = Object.fromEntries(colored.map((x) => [x.key, x.label]))
  const last = colored.length - 1
  return (
    <ChartContainer
      height={height} label={label} loading={loading} empty={empty}
      legend={series.length > 1 ? { items: colored, hidden: s.hidden, onToggle: s.toggle, onHover: s.setHovered } : undefined}
    >
      <RBarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%" barGap={4} accessibilityLayer>
        <CartesianGrid {...GRID_PROPS} vertical={!!horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS_PROPS} tickFormatter={(v) => formatValue(v, format)} allowDecimals={false} />
            <YAxis type="category" dataKey={xKey as string} {...AXIS_PROPS} width={110} tickFormatter={xFormat} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey as string} {...AXIS_PROPS} tickFormatter={xFormat} interval="preserveStartEnd" minTickGap={8} />
            <YAxis {...AXIS_PROPS} width={52} tickCount={5} tickFormatter={(v) => formatValue(v, format)} allowDecimals={false} />
          </>
        )}
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          content={(p) => <ChartTooltipContent active={p.active} payload={p.payload} label={p.label} format={format} labelFormat={xFormat} names={names} />}
        />
        {colored.map((x, i) => (
          <Bar
            key={x.key} dataKey={x.key} name={x.label} fill={x.color} maxBarSize={28} hide={s.hidden.has(x.key)} fillOpacity={s.opacity(x.key)}
            stackId={stacked ? 'a' : undefined} isAnimationActive={!reduced} animationDuration={420}
            radius={!stacked || i === last ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0}
            cursor={onBarClick ? 'pointer' : undefined}
            onClick={onBarClick ? (_, index) => { const row = data[index]; if (row) onBarClick(row) } : undefined}
          >
            {colorOf && series.length === 1 && data.map((row, j) => <Cell key={j} fill={colorOf(row)} />)}
          </Bar>
        ))}
      </RBarChart>
    </ChartContainer>
  )
}
