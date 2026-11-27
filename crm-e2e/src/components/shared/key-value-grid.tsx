/** Facts as label / value pairs in a responsive grid. Ported from the rebuild; empty values are skipped, never "—" or "0". */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type KeyValue = { label: ReactNode; value: ReactNode; hint?: ReactNode; key?: string }

export function KeyValueGrid({ items, columns = 3, className }: { items: KeyValue[]; columns?: 2 | 3 | 4; className?: string }) {
  const shown = items.filter((i) => i.value !== '' && i.value !== null && i.value !== undefined && i.value !== false)
  return (
    <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-3', columns >= 3 && 'sm:grid-cols-3', columns === 4 && 'lg:grid-cols-4', className)}>
      {shown.map((i, n) => (
        <div key={i.key ?? n} className="min-w-0">
          <dt className="flex items-center gap-1 text-meta text-muted-foreground">{i.label}{i.hint}</dt>
          <dd className="text-sm font-medium break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}
