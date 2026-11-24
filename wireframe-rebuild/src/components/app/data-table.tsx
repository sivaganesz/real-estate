import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
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
  /** The header becomes a button that sorts by this column (needs `sort` and `onSort` on the table). */
  sortable?: boolean
}

export type TableSort = { key: string; dir: 'asc' | 'desc' }

/**
 * A typed table for lists (properties, leads, appointments). Rows open on click or Enter when `onRowClick` is set.
 * Scrolls sideways inside its own box on small screens; the page never does.
 * Sortable columns: click a header to sort, again to reverse. The table only shows the arrow; the page sorts the rows.
 */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, className, label, sort, onSort }: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  empty?: ReactNode
  className?: string
  /** Accessible name of the table. */
  label: string
  /** The column the rows are sorted by, if it's one of the sortable ones. */
  sort?: TableSort | null
  onSort?: (key: string) => void
}) {
  if (!rows.length && empty) return <>{empty}</>
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-card', className)}>
      <Table aria-label={label}>
        <TableHeader className="bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))]">
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => {
              const dir = sort?.key === c.key ? sort.dir : null
              const Arrow = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
              return (
                <TableHead key={c.key} aria-sort={c.sortable && onSort ? (dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none') : undefined}
                  className={cn('h-auto px-3 py-[9px] text-label font-semibold tracking-[.04em] text-muted-foreground uppercase', c.align === 'right' && 'text-right', c.hideOnPhone && 'max-md:hidden', c.className)}>
                  {c.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(c.key)}
                      className={cn('group/sort inline-flex items-center gap-1 uppercase hover:text-foreground', dir && 'text-foreground')}>
                      {c.header}
                      <Arrow aria-hidden className={cn('size-3 shrink-0', !dir && 'opacity-40 group-hover/sort:opacity-80')} />
                    </button>
                  ) : c.header}
                </TableHead>
              )
            })}
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
                <TableCell key={c.key} className={cn('px-3 py-[9px] align-top', c.align === 'right' && 'text-right tabular-nums', c.hideOnPhone && 'max-md:hidden', c.className)}>
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
