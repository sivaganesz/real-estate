import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Tone, toneSoft } from './tone'

/** A KPI tile: label, big number, one line of context. Clickable when `to` is given. */
export function StatCard({ label, value, sub, icon: Icon, tone = 'primary', to, className }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; tone?: Tone; to?: string; className?: string
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && <span className={cn('flex size-8 items-center justify-center rounded-lg', toneSoft[tone])}><Icon className="size-4" /></span>}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </>
  )
  const cls = cn('block rounded-xl border bg-card p-4 shadow-card', to && 'transition-colors hover:border-primary/40 hover:bg-accent/40', className)
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
