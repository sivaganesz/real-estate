/**
 * Filter pill (DESIGN_SYSTEM §11.7): a dashed border when empty ("+ Stage"); filled `bg-primary-soft text-primary`
 * with the chosen count when active. Opens a checklist popover of options with counts; "Clear" inside.
 */
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type FilterOption = { value: string; label: string; count?: number }

export function FilterPill({ label, options, selected, onChange, single }: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Only one value at a time. */
  single?: boolean
}) {
  const { t } = useTranslation('ui')
  const active = selected.length > 0
  const shown = active ? (selected.length === 1 ? options.find((o) => o.value === selected[0])?.label ?? selected[0] : null) : null
  const toggle = (v: string) => {
    if (single) onChange(selected[0] === v ? [] : [v])
    else onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  }
  return (
    <Popover>
      <span className={cn('inline-flex h-8 items-center rounded-full border text-ui transition-colors', active ? 'border-primary/30 bg-primary-soft text-primary' : 'border-dashed border-border-strong text-muted-foreground hover:bg-muted hover:text-foreground')}>
        <PopoverTrigger className="inline-flex h-full items-center gap-1.5 rounded-full pr-2 pl-3 font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={active ? t('filter.pillActive', { label, count: selected.length }) : label}>
          {!active && <Plus className="size-3.5" aria-hidden="true" />}
          {label}
          {active && (shown
            ? <span className="max-w-28 truncate font-normal">: {shown}</span>
            : <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-micro font-semibold text-primary-foreground tabular-nums">{selected.length}</span>)}
          <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
        </PopoverTrigger>
        {active && (
          <button type="button" onClick={() => onChange([])} aria-label={t('filter.clearOne', { label })} className="mr-1 flex size-5 items-center justify-center rounded-full hover:bg-primary/10">
            <X className="size-3" aria-hidden="true" />
          </button>
        )}
      </span>
      <PopoverContent align="start" className="w-60 p-1">
        <ul role="listbox" aria-multiselectable={!single} aria-label={label} className="max-h-72 overflow-y-auto">
          {options.map((o) => {
            const on = selected.includes(o.value)
            return (
              <li key={o.value} role="option" aria-selected={on}>
                <button type="button" onClick={() => toggle(o.value)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                  <span className={cn('flex size-4 items-center justify-center rounded-[4px] border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card')}>
                    {on && <Check className="size-3" aria-hidden="true" />}
                  </span>
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.count != null && <span className="text-meta text-muted-foreground tabular-nums">{o.count}</span>}
                </button>
              </li>
            )
          })}
        </ul>
        {active && (
          <button type="button" onClick={() => onChange([])} className="mt-1 w-full rounded-md border-t px-2 py-1.5 text-left text-meta text-muted-foreground hover:bg-muted">
            {t('filter.clear')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
