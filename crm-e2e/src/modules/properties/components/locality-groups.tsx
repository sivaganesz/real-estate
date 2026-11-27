/** "By locality" view: one band per locality with its count, price range, average ₹/sq ft and a status split bar, then its cards. */
import { MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PropertyCard } from '@/components/domain/property-card'
import { PROPERTY_STATUSES } from '@/domain/catalogue'
import { inrRange, num } from '@/lib/format'
import { propertyStatusTone } from '@/lib/tones'
import { cn } from '@/lib/utils'
import type { LocalityGroup } from '../lib/list'

export function LocalityGroups({ groups, selected, onToggle }: { groups: LocalityGroup[]; selected: ReadonlySet<string>; onToggle: (id: string, on: boolean) => void }) {
  const { t } = useTranslation(['properties', 'catalogue'])
  return (
    <div className="flex flex-col gap-6" data-testid="locality-groups">
      {groups.map((g) => {
        const total = g.properties.length
        return (
          <section key={g.key} aria-labelledby={`loc-${g.key}`} className="flex flex-col gap-3">
            <header className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3 shadow-card">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary"><MapPin className="size-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <h2 id={`loc-${g.key}`} className="text-base font-semibold">{g.locality} <span className="font-normal text-muted-foreground">· {g.city}</span></h2>
                <p className="text-meta text-muted-foreground tabular-nums">
                  {t('properties:group.summary', { count: total, range: inrRange(g.minPrice, g.maxPrice) || t('domain:property.onRequest') })}
                  {g.avgPricePerSqft ? ` · ${t('properties:group.avgPpsf', { price: num(g.avgPricePerSqft) })}` : ''}
                </p>
              </div>
              <div className="flex w-full flex-col gap-1 sm:w-56">
                <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={PROPERTY_STATUSES.filter((s) => g.byStatus[s]).map((s) => `${t(`catalogue:propertyStatus.${s}`)} ${g.byStatus[s]}`).join(', ')}>
                  {PROPERTY_STATUSES.map((s) => g.byStatus[s] ? <span key={s} className={cn('h-full', propertyStatusTone[s].solid)} style={{ width: `${(g.byStatus[s] / total) * 100}%` }} /> : null)}
                </div>
                <p className="flex flex-wrap gap-x-2 text-micro text-muted-foreground">
                  {PROPERTY_STATUSES.filter((s) => g.byStatus[s]).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1"><span aria-hidden="true" className={cn('size-1.5 rounded-full', propertyStatusTone[s].solid)} />{t(`catalogue:propertyStatus.${s}`)} {g.byStatus[s]}</span>
                  ))}
                </p>
              </div>
            </header>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {g.properties.map((p) => <PropertyCard key={p.id} property={p} selected={selected.has(p.id)} onSelectedChange={(on) => onToggle(p.id, on)} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}
