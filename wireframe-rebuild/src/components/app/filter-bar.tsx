import type { ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Search box + filters + right-hand controls (sort, view switch) in one row that wraps on small screens.
 * The search is controlled: pass `value` and `onChange`.
 */
export function FilterBar({ value, onChange, placeholder, label, filters, end, className, size = 'default' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Accessible name of the search box. */
  label: string
  filters?: ReactNode
  end?: ReactNode
  className?: string
  size?: 'default' | 'lg'
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-center', className)}>
      <div role="search" className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
          className={cn('bg-card pr-9 pl-9', size === 'lg' && 'h-11 rounded-xl text-base md:text-sm')} />
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label={t('action.clear')}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
      {end && <div className="flex items-center gap-2 lg:ml-auto">{end}</div>}
    </div>
  )
}
