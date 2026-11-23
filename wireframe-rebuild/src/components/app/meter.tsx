import { cn } from '@/lib/utils'
import { type Tone, toneFill } from './tone'

/** A thin progress bar: listing completeness, readiness, stage counts. `value` is 0–100. */
export function Meter({ value, tone = 'primary', label, className }: { value: number; tone?: Tone; label?: string; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full transition-[width]', toneFill[tone])} style={{ width: `${v}%` }} />
    </div>
  )
}
