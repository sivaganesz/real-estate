/**
 * Progress ring (DESIGN_SYSTEM §11.2): an SVG circle, `--muted` track, tone fill with round caps, the percentage in the
 * centre (`text-micro` 600). The fill turns `--highlight` (marigold) when `targetMet`.
 * ScoreRing picks the tone from the value (lead score ≥ 70 success, 40–69 warning, else neutral; match ≥ 80 success,
 * 60–79 primary, 40–59 warning).
 */
import type { ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { matchTone, scoreTone, type Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'

const STROKE: Record<Tone, string> = {
  primary: 'stroke-primary', success: 'stroke-success', warning: 'stroke-warning', danger: 'stroke-danger', info: 'stroke-info',
  violet: 'stroke-violet', neutral: 'stroke-neutral', ai: 'stroke-ai', highlight: 'stroke-highlight', hot: 'stroke-hot', warm: 'stroke-warm', cold: 'stroke-cold',
}

export function ProgressRing({ value, size = 40, stroke, tone = 'primary', targetMet, label, children, className, onDark }: {
  /** 0–100 */
  value: number
  size?: number
  stroke?: number
  tone?: Tone
  targetMet?: boolean
  /** Accessible name ("Calls target"). */
  label?: string
  /** Centre content; defaults to "NN%". */
  children?: ReactNode
  className?: string
  /** On the highlight (gradient) card: white track and fill. */
  onDark?: boolean
}) {
  const reduced = useReducedMotion()
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const w = stroke ?? (size >= 52 ? 5 : 4)
  const r = (size - w) / 2
  const c = 2 * Math.PI * r
  return (
    <span role="img" aria-label={label ? `${label}: ${v}%` : `${v}%`} className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={w} className={onDark ? 'stroke-[color-mix(in_oklch,var(--primary-foreground)_25%,transparent)]' : 'stroke-muted'} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={w} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
          className={cn(onDark ? 'stroke-primary-foreground' : targetMet ? 'stroke-highlight' : STROKE[tone], !reduced && 'transition-[stroke-dashoffset] duration-(--dur-slower) ease-out')}
        />
      </svg>
      <span aria-hidden="true" className={cn('absolute inset-0 flex items-center justify-center font-semibold tabular-nums', size >= 52 ? 'text-meta' : 'text-micro')}>
        {children ?? `${v}%`}
      </span>
    </span>
  )
}

export function ScoreRing({ score, kind = 'score', size = 36, label }: { score: number; kind?: 'score' | 'match'; size?: number; label?: string }) {
  return (
    <ProgressRing value={score} size={size} tone={kind === 'match' ? matchTone(score) : scoreTone(score)} label={label}>
      {kind === 'match' ? `${Math.round(score)}%` : Math.round(score)}
    </ProgressRing>
  )
}
