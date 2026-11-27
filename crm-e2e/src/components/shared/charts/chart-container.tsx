/**
 * The frame every chart sits in (shadcn-style ChartContainer): optional legend top-right, the responsive area at the
 * DS height, and the loading / empty states in the same footprint so cards never jump.
 */
import type { ReactElement, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'
import { ChartEmpty, ChartLegend, ChartSkeleton } from './chart-parts'

export function ChartContainer({ height = 240, legend, empty, emptyMessage, emptyAction, loading, label, className, children }: {
  height?: number
  legend?: Parameters<typeof ChartLegend>[0]
  empty?: boolean
  emptyMessage?: ReactNode
  emptyAction?: ReactNode
  loading?: boolean
  /** Accessible name of the chart. */
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <figure className={cn('flex w-full flex-col gap-2', className)} aria-label={label}>
      {legend && !empty && !loading && <ChartLegend {...legend} />}
      {loading ? (
        <ChartSkeleton height={height} />
      ) : empty ? (
        <ChartEmpty height={height} message={emptyMessage} action={emptyAction} />
      ) : (
        <div style={{ height }} className="w-full [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
          <ResponsiveContainer width="100%" height="100%">
            {children as ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}
