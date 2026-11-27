/**
 * Area trend (DESIGN_SYSTEM §10): 2 px lines with a vertical gradient fill 24% → 0% of the same token, horizontal
 * dashed grid, ₹-short or count ticks, a 1 px `--border-strong` cursor line, legend toggles, hover dims the others.
 */
import { useId } from 'react'
import { Area, AreaChart as RAreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { ChartContainer } from './chart-container'
import { ChartTooltipContent } from './chart-parts'
import { AXIS_PROPS, formatValue, GRID_PROPS, seriesColor, type ChartSeries, type ValueFormat } from './chart-style'
import { useSeriesToggle } from './use-series'

export function AreaTrendChart<T extends Record<string, unknown>>({ data, xKey, series, height = 240, format = 'count', xFormat, label, loading, onPointClick, stacked }: {
  data: T[]
  xKey: keyof T & string
  series: ChartSeries[]
  height?: number
  format?: ValueFormat
  xFormat?: (v: unknown) => string
  label: string
  loading?: boolean
  onPointClick?: (row: T) => void
  stacked?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const reduced = useReducedMotion()
  const s = useSeriesToggle()
  const colored = series.map((x, i) => ({ ...x, color: x.color ?? seriesColor(i) }))
  const empty = !data.length || data.every((row) => series.every((x) => !Number(row[x.key])))
  return (
    <ChartContainer
      height={height} label={label} loading={loading} empty={empty}
      legend={series.length > 1 ? { items: colored, hidden: s.hidden, onToggle: s.toggle, onHover: s.setHovered } : undefined}
    >
      <RAreaChart
        data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        onClick={onPointClick ? (e) => { const i = Number(e?.activeTooltipIndex); if (Number.isFinite(i) && data[i]) onPointClick(data[i]) } : undefined}
        accessibilityLayer
      >
        <defs>
          {colored.map((x) => (
            <linearGradient key={x.key} id={`area-${id}-${x.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={x.color} stopOpacity={0.24} />
              <stop offset="100%" stopColor={x.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey as string} {...AXIS_PROPS} tickFormatter={xFormat} minTickGap={16} />
        <YAxis {...AXIS_PROPS} width={52} tickCount={5} tickFormatter={(v) => formatValue(v, format)} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
          content={(p) => <ChartTooltipContent active={p.active} payload={p.payload} label={p.label} format={format} labelFormat={xFormat} names={Object.fromEntries(colored.map((x) => [x.key, x.label]))} />}
        />
        {colored.map((x) => (
          <Area
            key={x.key} type="monotone" dataKey={x.key} name={x.label} stroke={x.color} strokeWidth={2} fill={`url(#area-${id}-${x.key})`}
            hide={s.hidden.has(x.key)} strokeOpacity={s.opacity(x.key)} fillOpacity={s.opacity(x.key)} stackId={stacked ? 'a' : undefined}
            isAnimationActive={!reduced} animationDuration={420} activeDot={{ r: 3.5, strokeWidth: 0 }}
            cursor={onPointClick ? 'pointer' : undefined}
          />
        ))}
      </RAreaChart>
    </ChartContainer>
  )
}
