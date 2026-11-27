/**
 * A thin progress bar (listing completeness, readiness, target progress). Ported from
 * wireframe-rebuild/src/components/app/meter.tsx and restyled; `value` is 0–100.
 */
import { TONE, type Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'

export function Meter({ value, tone = 'primary', label, className, size = 'sm', targetMet }: {
  value: number
  tone?: Tone
  label?: string
  className?: string
  size?: 'xs' | 'sm' | 'md'
  targetMet?: boolean
}) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-muted', size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-(--dur-slower) ease-out', targetMet ? 'bg-highlight' : TONE[tone].solid)} style={{ width: `${v}%` }} />
    </div>
  )
}
