/** A controlled search box with a clear button (ported from the rebuild's FilterBar search). */
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function SearchInput({ value, onChange, label, placeholder, className, size = 'default', autoFocus }: {
  value: string
  onChange: (v: string) => void
  /** Accessible name. */
  label: string
  placeholder?: string
  className?: string
  size?: 'default' | 'lg'
  autoFocus?: boolean
}) {
  const { t } = useTranslation('common')
  return (
    <div role="search" className={cn('relative min-w-0', className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} autoFocus={autoFocus}
        className={cn('bg-card pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden', size === 'lg' && 'h-11 rounded-xl text-base md:text-sm')}
      />
      {value && (
        <button
          type="button" onClick={() => onChange('')} aria-label={t('actions.clear')}
          className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
