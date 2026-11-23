import type { ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** Hide on narrow screens (below md). */
  hideOnPhone?: boolean
  className?: string
}

/**
 * A typed table for lists (properties, leads, appointments). Rows open on click or Enter when `onRowClick` is set.
 * Scrolls sideways inside its own box on small screens; the page never does.
 */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, className, label }: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  className?: string
  /** Accessible name of the table. */
  label: string
}) {
  if (!rows.length && empty) return <>{empty}</>
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-card', className)}>
      <Table aria-label={label}>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn('h-10 px-3 text-xs font-medium text-muted-foreground', c.align === 'right' && 'text-right', c.hideOnPhone && 'max-md:hidden', c.className)}>
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={rowKey(r)}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter') onRowClick(r) } : undefined}
              className={cn(onRowClick && 'cursor-pointer focus-visible:bg-accent/50 focus-visible:outline-none')}>
              {columns.map((c) => (
                <TableCell key={c.key} className={cn('px-3 py-2.5', c.align === 'right' && 'text-right tabular-nums', c.hideOnPhone && 'max-md:hidden', c.className)}>
                  {c.cell(r)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
