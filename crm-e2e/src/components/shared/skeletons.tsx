/**
 * Skeletons (DESIGN_SYSTEM §11.10): they match the final layout (card, table rows, chart block) and use the .skeleton
 * shimmer (static under reduced motion). Wrap them in <Delayed> so they appear only after 150 ms.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Delayed({ delay = 150, children }: { delay?: number; children: ReactNode }) {
  const [show, setShow] = useState(delay <= 0)
  useEffect(() => {
    if (delay <= 0) return
    const id = window.setTimeout(() => setShow(true), delay)
    return () => window.clearTimeout(id)
  }, [delay])
  return show ? <>{children}</> : null
}

export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, i) => <div key={i} className="skeleton h-3" style={{ width: `${[90, 70, 50, 80][i % 4]}%` }} />)}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('rounded-lg border bg-card p-4 shadow-card', className)}>
      <div className="flex items-center gap-3">
        <div className="skeleton size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2"><div className="skeleton h-3.5 w-1/2" /><div className="skeleton h-3 w-1/3" /></div>
        <div className="skeleton size-9 rounded-full" />
      </div>
      <div className="mt-4 flex gap-2"><div className="skeleton h-5 w-16 rounded-full" /><div className="skeleton h-5 w-20 rounded-full" /><div className="skeleton h-5 w-24 rounded-full" /></div>
      <div className="skeleton mt-4 h-3 w-3/4" />
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('overflow-hidden rounded-lg border bg-card shadow-card', className)}>
      <div className="flex h-10 items-center gap-6 border-b px-4">{Array.from({ length: columns }, (_, i) => <div key={i} className="skeleton h-2.5 w-16" />)}</div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex h-[52px] items-center gap-6 border-b px-4 last:border-b-0">
          {Array.from({ length: columns }, (_, c) => <div key={c} className="skeleton h-3" style={{ width: `${[60, 40, 30, 20][c % 4]}%` }} />)}
        </div>
      ))}
    </div>
  )
}

export function ChartBlockSkeleton({ height = 240, className }: { height?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('flex items-end gap-3 rounded-lg border bg-card p-5 shadow-card', className)} style={{ height }}>
      {[45, 70, 55, 85, 60].map((h, i) => <div key={i} className="skeleton flex-1 rounded-sm" style={{ height: `${h}%` }} />)}
    </div>
  )
}
