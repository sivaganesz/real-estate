/**
 * Gauge / target ring (DESIGN_SYSTEM §10): a 240° SVG arc. Track `--muted`, fill `--primary`, and the fill turns
 * `--highlight` when the target is met. The value and the label sit in the middle.
 */
import type { ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { cn } from '@/lib/utils'

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}
const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  const s = polar(cx, cy, r, from)
  const e = polar(cx, cy, r, to)
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`
}

export function Gauge({ value, max, size = 160, label, valueLabel, caption, className }: {
  value: number
  max: number
  size?: number
  /** Accessible name and the small line under the value. */
  label: string
  /** What the centre shows; defaults to the percentage. */
  valueLabel?: ReactNode
  caption?: ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const met = max > 0 && value >= max
  const w = Math.max(8, size / 14)
  const r = size / 2 - w
  const c = size / 2
  const START = -120
  const END = 120
  const len = (2 * Math.PI * r * (END - START)) / 360
  return (
    <div role="img" aria-label={`${label}: ${Math.round(pct * 100)}%`} className={cn('relative inline-flex flex-col items-center', className)} style={{ width: size }}>
      <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} aria-hidden="true">
        <path d={arc(c, c, r, START, END)} fill="none" strokeWidth={w} strokeLinecap="round" className="stroke-muted" />
        <path
          d={arc(c, c, r, START, END)} fill="none" strokeWidth={w} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - pct)}
          className={cn(met ? 'stroke-highlight' : 'stroke-primary', !reduced && 'transition-[stroke-dashoffset] duration-(--dur-slower) ease-out')}
        />
      </svg>
      <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: size * 0.3 }}>
        <span className="text-kpi font-[650] tabular-nums">{valueLabel ?? `${Math.round(pct * 100)}%`}</span>
        <span className="text-meta text-muted-foreground">{caption ?? label}</span>
      </div>
    </div>
  )
}
