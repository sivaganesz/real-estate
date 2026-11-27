/** Choose one or more live properties (shortlisted ones first) as removable chips plus a searchable checklist. */
import { useMemo, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SearchInput } from '@/components/shared/search-input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ID } from '@/domain/types'
import { useDb } from '@/hooks/use-db'
import { inrShort } from '@/lib/format'
import { isMatchable } from '@/lib/property'
import { cn } from '@/lib/utils'

export function PropertyMultiSelect({ value, onChange, preferred = [], id, invalid }: {
  value: ID[]
  onChange: (ids: ID[]) => void
  /** Shown first (the lead's shortlist). */
  preferred?: ID[]
  id?: string
  invalid?: boolean
}) {
  const { t } = useTranslation('domain')
  const properties = useDb((db) => db.properties)
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return properties
      .filter((p) => isMatchable(p) || value.includes(p.id))
      .filter((p) => !s || `${p.title} ${p.location.locality} ${p.projectName ?? ''}`.toLowerCase().includes(s))
      .sort((a, b) => Number(preferred.includes(b.id)) - Number(preferred.includes(a.id)))
      .slice(0, 40)
  }, [properties, q, preferred, value])
  const toggle = (pid: ID) => onChange(value.includes(pid) ? value.filter((x) => x !== pid) : [...value, pid])
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((pid) => {
        const p = properties.find((x) => x.id === pid)
        return (
          <span key={pid} className="inline-flex h-7 max-w-64 items-center gap-1 rounded-full border bg-card pr-1 pl-2.5 text-ui">
            <span className="truncate">{p?.title ?? pid}</span>
            <button type="button" onClick={() => toggle(pid)} aria-label={t('form.removeProperty', { title: p?.title ?? pid })} className="flex size-5 items-center justify-center rounded-full hover:bg-muted"><X className="size-3" aria-hidden="true" /></button>
          </span>
        )
      })}
      <Popover>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="secondary" size="sm" aria-invalid={invalid || undefined}><Plus />{t('form.addProperty')}</Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <SearchInput value={q} onChange={setQ} label={t('form.searchProperties')} placeholder={t('form.searchProperties')} />
          <ul className="mt-2 max-h-64 overflow-y-auto">
            {list.map((p) => {
              const on = value.includes(p.id)
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => toggle(p.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                    <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-[4px] border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card')}>{on && <Check className="size-3" aria-hidden="true" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{p.title}</span>
                      <span className="block truncate text-meta text-muted-foreground">{p.location.locality} · {inrShort(p.price)}{preferred.includes(p.id) ? ` · ${t('form.shortlisted')}` : ''}</span>
                    </span>
                  </button>
                </li>
              )
            })}
            {!list.length && <li className="px-2 py-3 text-center text-meta text-muted-foreground">{t('form.noProperties')}</li>}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}
