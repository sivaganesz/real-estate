/**
 * Data table (DESIGN_SYSTEM §11.7). Ported from wireframe-rebuild/src/components/app/data-table.tsx (typed columns,
 * sortable headers, selection across pages, responsive column hiding) and extended:
 *  - sticky header (`bg-card/95 backdrop-blur`) that gains a shadow once the body scrolls;
 *  - comfortable 52 px or compact 40 px rows (`density`);
 *  - a right-anchored row hover action cluster that fades in over a gradient and never pushes layout;
 *  - empty / loading / error states rendered inside the table body.
 * The page owns sorting, filtering and paging; the table only displays.
 */
import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export type Breakpoint = 'md' | 'lg' | 'xl' | '2xl'
const HIDE_BELOW: Record<Breakpoint, string> = { md: 'max-md:hidden', lg: 'max-lg:hidden', xl: 'max-xl:hidden', '2xl': 'max-2xl:hidden' }

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** Hide below this width so the most useful columns fit smaller screens. */
  hideBelow?: Breakpoint
  sortable?: boolean
  className?: string
  /** Width hint, e.g. 'w-40'. */
  width?: string
}
export type TableSort = { key: string; dir: 'asc' | 'desc' }
export type Density = 'comfortable' | 'compact'

export function DataTable<T>({
  rows, columns, rowKey, label, onRowClick, sort, onSort, selected, onSelectedChange, rowLabel, density = 'comfortable',
  rowActions, empty, loading, error, maxHeight, className, footer, hiddenColumns,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  /** Accessible name of the table. */
  label: string
  onRowClick?: (row: T) => void
  sort?: TableSort | null
  onSort?: (key: string) => void
  selected?: ReadonlySet<string>
  onSelectedChange?: (next: Set<string>) => void
  rowLabel?: (row: T) => string
  density?: Density
  /** The hover action cluster (Call, WhatsApp, Schedule, More). */
  rowActions?: (row: T) => ReactNode
  /** Shown inside the body when there are no rows. */
  empty?: ReactNode
  loading?: boolean
  error?: ReactNode
  /** Scroll inside the card (sticky header) instead of the page. */
  maxHeight?: string
  className?: string
  /** Pagination or totals, inside the card. */
  footer?: ReactNode
  /** Column keys the user hid (column visibility menu). */
  hiddenColumns?: ReadonlySet<string>
}) {
  const { t } = useTranslation('ui')
  const [scrolled, setScrolled] = useState(false)
  const cols = hiddenColumns ? columns.filter((c) => !hiddenColumns.has(c.key)) : columns
  const selectable = !!(selected && onSelectedChange)
  const keys = rows.map(rowKey)
  const onPage = keys.filter((k) => selected?.has(k)).length
  const toggle = (k: string, on: boolean) => {
    const next = new Set(selected)
    if (on) next.add(k)
    else next.delete(k)
    onSelectedChange?.(next)
  }
  const toggleAll = (on: boolean) => {
    const next = new Set(selected)
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)))
    onSelectedChange?.(next)
  }
  const span = cols.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)
  const cellPad = density === 'compact' ? 'h-10 py-1.5' : 'h-[52px] py-2.5'

  let body: ReactNode
  if (loading) {
    body = Array.from({ length: 6 }, (_, i) => (
      <tr key={`sk${i}`} className="[&>td]:border-b [&>td]:border-border/70">
        {selectable && <td className="w-10 pl-4"><div className="skeleton size-4 rounded-[4px]" /></td>}
        {cols.map((c, ci) => (
          <td key={c.key} className={cn('px-3', cellPad, c.hideBelow && HIDE_BELOW[c.hideBelow])}>
            <div className="skeleton h-3" style={{ width: `${[60, 40, 30, 20][ci % 4]}%` }} />
          </td>
        ))}
        {rowActions && <td />}
      </tr>
    ))
  } else if (error) {
    body = <tr><td colSpan={span} className="p-0">{error}</td></tr>
  } else if (!rows.length) {
    body = <tr><td colSpan={span} className="p-0">{empty ?? <p className="py-10 text-center text-sm text-muted-foreground">{t('table.empty')}</p>}</td></tr>
  } else {
    body = rows.map((r) => {
      const k = rowKey(r)
      const on = !!selected?.has(k)
      return (
        <tr
          key={k}
          data-state={on ? 'selected' : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={onRowClick ? () => onRowClick(r) : undefined}
          onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(r) } : undefined}
          className={cn(
            'group/row relative transition-colors duration-(--dur-fast) hover:bg-muted/60 [&>td]:border-b [&>td]:border-border/70 last:[&>td]:border-b-0',
            onRowClick && 'cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none',
            on && 'bg-primary-soft/60 shadow-[inset_2px_0_0_var(--primary)] hover:bg-primary-soft/80',
          )}
        >
          {selectable && (
            <td className={cn('w-10 pr-0 pl-4', cellPad)} onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={on} onCheckedChange={(v) => toggle(k, v === true)} aria-label={t('table.selectRow', { name: rowLabel?.(r) ?? k })} />
            </td>
          )}
          {cols.map((c) => (
            <td key={c.key} className={cn('px-3 align-middle text-sm', cellPad, c.align === 'right' && 'text-right tabular-nums', c.hideBelow && HIDE_BELOW[c.hideBelow], c.className)}>
              {c.cell(r)}
            </td>
          ))}
          {rowActions && (
            <td className="sticky right-0 w-0 p-0" onClick={(e) => e.stopPropagation()}>
              <div
                className={cn(
                  'absolute inset-y-0 right-0 flex items-center gap-1 pr-3 pl-10',
                  'bg-[linear-gradient(to_right,transparent,var(--card)_2.5rem)] group-hover/row:bg-[linear-gradient(to_right,transparent,color-mix(in_oklch,var(--muted)_60%,var(--card))_2.5rem)]',
                  'opacity-0 transition-opacity duration-(--dur-fast) group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100',
                )}
              >
                {rowActions(r)}
              </div>
            </td>
          )}
        </tr>
      )
    })
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card shadow-card', className)}>
      <div className="relative overflow-auto" style={maxHeight ? { maxHeight } : undefined} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}>
        <table aria-label={label} aria-busy={loading || undefined} className="w-full caption-bottom border-separate border-spacing-0 text-sm">
          <thead
            className={cn(
              'sticky top-0 z-[2] bg-card/95 backdrop-blur transition-shadow duration-(--dur-fast)',
              scrolled ? 'shadow-md' : 'shadow-[0_1px_0_var(--border)]',
            )}
          >
            <tr>
              {selectable && (
                <th className="h-10 w-10 pr-0 pl-4 text-left">
                  <Checkbox
                    aria-label={t('table.selectAll')}
                    checked={onPage === keys.length && onPage > 0 ? true : onPage ? 'indeterminate' : false}
                    onCheckedChange={() => toggleAll(onPage < keys.length)}
                    disabled={!keys.length}
                  />
                </th>
              )}
              {cols.map((c) => {
                const dir = sort?.key === c.key ? sort.dir : null
                const Arrow = dir === 'asc' ? ArrowUp : dir === 'desc' ? ArrowDown : ArrowUpDown
                return (
                  <th
                    key={c.key} scope="col"
                    aria-sort={c.sortable && onSort ? (dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none') : undefined}
                    className={cn('h-10 px-3 text-left text-label font-semibold tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase [:lang(ta)_&]:normal-case [:lang(ta)_&]:tracking-normal', c.align === 'right' && 'text-right', c.hideBelow && HIDE_BELOW[c.hideBelow], c.width)}
                  >
                    {c.sortable && onSort ? (
                      <button type="button" onClick={() => onSort(c.key)} className={cn('group/sort inline-flex items-center gap-1 uppercase hover:text-foreground [:lang(ta)_&]:normal-case', dir && 'text-foreground')}>
                        {c.header}
                        <Arrow aria-hidden="true" className={cn('size-3 shrink-0', !dir && 'opacity-0 group-hover/sort:opacity-70 group-focus-visible/sort:opacity-70')} />
                      </button>
                    ) : c.header}
                  </th>
                )
              })}
              {rowActions && <th className="w-0 p-0"><span className="sr-only">{t('table.actions')}</span></th>}
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
      {footer && <div className="border-t px-4 py-2.5">{footer}</div>}
    </div>
  )
}
