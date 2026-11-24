/**
 * The property list's view options, beside the Grid / Table switch: Comfortable or Compact, and (in the table)
 * which columns to show. Remembered per user in this browser, like the Grid / Table choice.
 */
import { useState, useSyncExternalStore } from 'react'
import { Rows3, Rows4, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Segmented } from '@/components/app/segmented'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export type Density = 'comfortable' | 'compact'
export type ListPrefs = { density: Density; hidden: string[] }
const DEFAULT: ListPrefs = { density: 'comfortable', hidden: [] }
const KEY = 'realspec-rebuild-property-prefs'

function readAll(): Record<string, ListPrefs> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, ListPrefs> } catch { return {} }
}

export function useListPrefs(userId: string): [ListPrefs, (change: Partial<ListPrefs>) => void] {
  const [all, setAll] = useState(readAll)
  const prefs = { ...DEFAULT, ...all[userId] }
  const set = (change: Partial<ListPrefs>) => {
    const next = { ...all, [userId]: { ...prefs, ...change } }
    setAll(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage blocked: lasts until reload */ }
  }
  return [prefs, set]
}

/** A table column the user may hide: its key in the table, its name, and the screen width it needs to show at all. */
export type OptionalColumn = { key: string; label: string; minWidth?: number }

const onResize = (cb: () => void) => { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb) }
const useScreenWidth = () => useSyncExternalStore(onResize, () => window.innerWidth, () => 1440)

export function ListOptions({ prefs, onChange, columns, fixedLabel }: {
  prefs: ListPrefs
  onChange: (change: Partial<ListPrefs>) => void
  /** The columns that can be hidden; leave out in the grid. */
  columns?: OptionalColumn[]
  /** The column that always shows ("Property"). */
  fixedLabel?: string
}) {
  const { t } = useTranslation()
  const width = useScreenWidth()
  const hiddenHere = columns ? prefs.hidden.filter((k) => columns.some((c) => c.key === k)).length : 0
  const changed = prefs.density !== DEFAULT.density || hiddenHere > 0
  const toggle = (key: string, show: boolean) => onChange({ hidden: show ? prefs.hidden.filter((k) => k !== key) : [...prefs.hidden, key] })
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t('listView.title')} title={t('listView.title')}
          className={cn('relative inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-sm text-muted-foreground hover:text-foreground data-[state=open]:border-primary data-[state=open]:text-foreground [&_svg]:size-4',
            changed && 'text-foreground')}>
          <SlidersHorizontal aria-hidden /><span className="max-sm:sr-only">{t('listView.button')}</span>
          {/* a dot while anything differs from the default */}
          {changed && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-card" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-xl p-3">
        <p className="mb-1.5 text-caption tracking-[.05em] text-muted-foreground uppercase">{t('listView.density')}</p>
        <Segmented<Density> variant="pill" label={t('listView.density')} value={prefs.density} onChange={(density) => onChange({ density })} className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
          segments={[
            { value: 'comfortable', label: t('listView.comfortable'), icon: <Rows3 aria-hidden /> },
            { value: 'compact', label: t('listView.compact'), icon: <Rows4 aria-hidden /> },
          ]} />
        {columns && (
          <>
            <p className="mt-3.5 mb-1 text-caption tracking-[.05em] text-muted-foreground uppercase">{t('listView.columns')}</p>
            <ul className="flex flex-col">
              {fixedLabel && (
                <li className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground">
                  <Checkbox checked disabled aria-label={fixedLabel} /> {fixedLabel} <span className="ml-auto text-xs">{t('listView.always')}</span>
                </li>
              )}
              {columns.map((c) => {
                const shown = !prefs.hidden.includes(c.key)
                if (c.minWidth && width < c.minWidth) return (
                  <li key={c.key} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground">
                    <Checkbox checked={false} disabled aria-label={c.label} /> {c.label} <span className="ml-auto text-xs">{t('listView.needsWider')}</span>
                  </li>
                )
                return (
                  <li key={c.key}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
                      <Checkbox checked={shown} onCheckedChange={(v) => toggle(c.key, v === true)} /> {c.label}
                    </label>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {changed && (
          <button type="button" onClick={() => onChange(columns ? DEFAULT : { density: DEFAULT.density })}
            className="mt-3 text-ui font-medium text-primary hover:underline">{t('listView.reset')}</button>
        )}
      </PopoverContent>
    </Popover>
  )
}
