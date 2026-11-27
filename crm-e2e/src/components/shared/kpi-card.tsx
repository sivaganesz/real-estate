/**
 * KPI card (DESIGN_SYSTEM §11.2): icon tile + uppercase label, the number in `text-kpi` tabular, a delta chip whose
 * colour depends on whether up is good for this metric, and one of: a sparkline, a progress ring, or a target bar.
 * `highlight` is the one gradient card per dashboard. Clickable cards lift on hover and open the filtered list.
 */
import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Tone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import { IconTile } from './icon-tile'
import { Meter } from './meter'
import { ProgressRing } from './progress-ring'
import { Sparkline } from './sparkline'

export type KpiDelta = {
  /** Change in percent (12 = +12%) or in units when `unit` is set. */
  value: number
  /** 'up' when a rise is good (bookings), 'down' when a fall is good (overdue tasks). */
  goodWhen?: 'up' | 'down'
  /** "vs last month" (already translated). */
  caption?: ReactNode
  unit?: string
}

export function DeltaChip({ delta, onDark }: { delta: KpiDelta; onDark?: boolean }) {
  const { t } = useTranslation('ui')
  const flat = Math.round(delta.value * 10) === 0
  const good = flat ? null : (delta.value > 0) === ((delta.goodWhen ?? 'up') === 'up')
  const Icon = flat ? ArrowRight : delta.value > 0 ? ArrowUpRight : ArrowDownRight
  const text = `${delta.value > 0 ? '+' : ''}${Math.round(delta.value * 10) / 10}${delta.unit ?? '%'}`
  return (
    <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
      <span
        aria-label={t(good === null ? 'kpi.deltaFlat' : good ? 'kpi.deltaGood' : 'kpi.deltaBad', { value: text })}
        className={cn(
          'inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 font-medium tabular-nums',
          onDark ? 'bg-[color-mix(in_oklch,var(--primary-foreground)_18%,transparent)] text-primary-foreground'
            : good === null ? 'bg-neutral-soft text-neutral' : good ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
        )}
      >
        <Icon className="size-3" aria-hidden="true" strokeWidth={2.25} />
        {text}
      </span>
      {delta.caption && <span className={cn(onDark && 'text-primary-foreground/80')}>{delta.caption}</span>}
    </span>
  )
}

export function KpiCard({ label, value, icon, tone = 'primary', delta, spark, ring, progress, highlight, to, onClick, hint, loading, className }: {
  label: ReactNode
  value: ReactNode
  icon?: LucideIcon
  tone?: Tone
  delta?: KpiDelta
  spark?: number[]
  ring?: { value: number; targetMet?: boolean; label?: string }
  progress?: { value: number; max: number; caption: ReactNode }
  highlight?: boolean
  to?: string
  onClick?: () => void
  hint?: ReactNode
  loading?: boolean
  className?: string
}) {
  if (loading) return <KpiCardSkeleton className={className} />
  const pct = progress && progress.max > 0 ? Math.min(100, Math.round((progress.value / progress.max) * 100)) : 0
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (highlight
            ? <HighlightIcon icon={icon} />
            : <IconTile icon={icon} tone={tone} />)}
          <span className={cn('line-clamp-2 text-label font-semibold tracking-[0.04em] uppercase [:lang(ta)_&]:tracking-normal [:lang(ta)_&]:normal-case', highlight ? 'text-primary-foreground/85' : 'text-muted-foreground')}>{label}</span>
        </div>
        {ring && <ProgressRing value={ring.value} targetMet={ring.targetMet} tone={tone} label={ring.label} onDark={highlight} />}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-kpi font-[650] tracking-[-0.02em] tabular-nums">{value}</span>
        {delta && <DeltaChip delta={delta} onDark={highlight} />}
      </div>
      {hint && <p className={cn('mt-1 text-meta', highlight ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{hint}</p>}
      {spark && spark.length > 1 && <div className="mt-2 -mx-1"><Sparkline data={spark} tone={tone} onDark={highlight} /></div>}
      {progress && (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className={cn('flex items-center justify-between text-meta', highlight ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
            <span>{progress.caption}</span>
            <span className="font-semibold tabular-nums">{pct}%</span>
          </div>
          <Meter value={pct} tone={tone} targetMet={progress.value >= progress.max && progress.max > 0} />
        </div>
      )}
    </>
  )
  const cls = cn(
    'block rounded-lg border p-4 text-left shadow-card md:p-5',
    highlight ? 'border-transparent bg-[linear-gradient(135deg,var(--primary),var(--primary-strong))] text-primary-foreground' : 'bg-card text-card-foreground',
    (to || onClick) && 'transition-[transform,box-shadow] duration-(--dur-fast) hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
    className,
  )
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cn(cls, 'w-full')}>{body}</button>
  return <div className={cls}>{body}</div>
}

function HighlightIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--primary-foreground)_18%,transparent)]">
      <Icon className="size-4" strokeWidth={1.75} />
    </span>
  )
}

export function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('rounded-lg border bg-card p-4 shadow-card md:p-5', className)}>
      <div className="flex items-center gap-2.5"><div className="skeleton size-8 rounded-md" /><div className="skeleton h-3 w-24" /></div>
      <div className="skeleton mt-4 h-7 w-20" />
      <div className="skeleton mt-3 h-10 w-full rounded-md" />
    </div>
  )
}
