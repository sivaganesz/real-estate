import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
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
 * Selection (with `selected` + `onSelectedChange`): a checkbox per row and a "select all on this page" box in the header.
 * The page keeps the selected keys, so a selection can span pages.
 */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty, className, label, sort, onSort, selected, onSelectedChange, rowLabel }: {
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
  /** The selected row keys; with `onSelectedChange` the table shows checkboxes. */
  selected?: ReadonlySet<string>
  onSelectedChange?: (next: Set<string>) => void
  /** A row's name for its checkbox ("Select Premium residential plot"). */
  rowLabel?: (row: T) => string
}) {
  const { t } = useTranslation()
  if (!rows.length && empty) return <>{empty}</>
  const selectable = !!(selected && onSelectedChange)
  const keys = rows.map(rowKey)
  const onPage = keys.filter((k) => selected?.has(k)).length
  const toggle = (k: string, on: boolean) => { const next = new Set(selected); if (on) next.add(k); else next.delete(k); onSelectedChange?.(next) }
  const toggleAll = (on: boolean) => { const next = new Set(selected); keys.forEach((k) => (on ? next.add(k) : next.delete(k))); onSelectedChange?.(next) }
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-card', className)}>
      <Table aria-label={label}>
        <TableHeader className="bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))]">
          <TableRow className="hover:bg-transparent">
            {selectable && (
              <TableHead className="w-8 py-[9px] pr-0 pl-3">
                <Checkbox aria-label={t('table.selectAll')} checked={onPage === keys.length && onPage > 0 ? true : onPage ? 'indeterminate' : false}
                  onCheckedChange={() => toggleAll(onPage < keys.length)} />
              </TableHead>
            )}
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
          {rows.map((r) => {
            const k = rowKey(r)
            const on = !!selected?.has(k)
            return (
            <TableRow key={k} data-state={on ? 'selected' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              // only Enter on the row itself: Enter on a link or button inside it does that control's job
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(r) } : undefined}
              className={cn(onRowClick && 'cursor-pointer focus-visible:bg-accent/50 focus-visible:outline-none', on && 'bg-accent/60 hover:bg-accent/80')}>
              {selectable && (
                // the cell swallows the click, so ticking a box never opens the row
                <TableCell className="w-8 py-[9px] pr-0 pl-3 align-top" onClick={(e) => e.stopPropagation()}>
                  <Checkbox className="mt-0.5" checked={on} onCheckedChange={(v) => toggle(k, v === true)} aria-label={t('table.selectRow', { name: rowLabel?.(r) ?? k })} />
                </TableCell>
              )}
              {columns.map((c) => (
                <TableCell key={c.key} className={cn('px-3 py-[9px] align-top', c.align === 'right' && 'text-right tabular-nums', c.hideOnPhone && 'max-md:hidden', c.className)}>
                  {c.cell(r)}
                </TableCell>
              ))}
            </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
