/**
 * Filter bar (DESIGN_SYSTEM §11.7 toolbar). Ported from wireframe-rebuild/src/components/app/filter-bar.tsx:
 * the search box, the filter pills, a "Clear all" link when any filter is on, and right-hand controls (saved views,
 * density, columns, view switch). Wraps on small screens; the page never scrolls sideways.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { SearchInput } from './search-input'

export function FilterBar({ search, onSearch, searchLabel, placeholder, filters, activeCount = 0, onClearAll, end, className }: {
  search?: string
  onSearch?: (v: string) => void
  searchLabel?: string
  placeholder?: string
  /** FilterPill elements. */
  filters?: ReactNode
  /** How many filters are on (shows "Clear all"). */
  activeCount?: number
  onClearAll?: () => void
  end?: ReactNode
  className?: string
}) {
  const { t } = useTranslation('ui')
  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center', className)}>
      {onSearch && <SearchInput value={search ?? ''} onChange={onSearch} label={searchLabel ?? t('filter.search')} placeholder={placeholder} className="lg:w-72" />}
      {(filters || activeCount > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {filters}
          {activeCount > 0 && onClearAll && (
            <button type="button" onClick={onClearAll} className="rounded-sm px-1 text-ui font-medium text-primary hover:underline">
              {t('filter.clearAll', { count: activeCount })}
            </button>
          )}
        </div>
      )}
      {end && <div className="flex items-center gap-2 lg:ml-auto">{end}</div>}
    </div>
  )
}
