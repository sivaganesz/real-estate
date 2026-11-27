/**
 * Sparkline (DESIGN_SYSTEM §11.2): a recharts AreaChart without axes, 1.75 px stroke in the card's tone, a 20% → 0%
 * vertical gradient fill and a dot on the last point. 48 px tall by default. On the highlight card it draws in white.
 */
import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import type { Tone } from '@/lib/tones'

export function Sparkline({ data, tone = 'primary', height = 48, onDark, label }: {
  data: number[]
  tone?: Tone
  height?: number
  onDark?: boolean
  label?: string
}) {
  const id = useId().replace(/:/g, '')
  const reduced = useReducedMotion()
  const color = onDark ? 'var(--primary-foreground)' : `var(--${tone})`
  const points = data.map((v, i) => ({ i, v }))
  const last = points.length - 1
  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={onDark ? 0.35 : 0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area
            type="monotone" dataKey="v" stroke={color} strokeOpacity={onDark ? 0.8 : 1} strokeWidth={1.75} fill={`url(#spark-${id})`}
            isAnimationActive={!reduced} animationDuration={420}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === last && p.cx != null && p.cy != null ? <circle key="last" cx={p.cx} cy={p.cy} r={2.5} fill={color} /> : <g key={p.index} />}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
