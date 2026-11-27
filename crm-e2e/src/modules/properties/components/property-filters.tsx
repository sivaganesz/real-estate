/** Filter pills for the Properties list (DESIGN_SYSTEM §11.7): type, city, locality, budget, configuration, possession, furnishing, facing — each with live counts. */
import { useTranslation } from 'react-i18next'
import { FilterPill, type FilterOption } from '@/components/shared/filter-pill'
import { CITIES, CITY_NAMES, CONFIGURATIONS, FACINGS, FURNISHING, PROPERTY_TYPE_ORDER } from '@/domain/catalogue'
import type { Configuration, Facing, Furnishing, Property, PropertyType } from '@/domain/types'
import { configLabel } from '@/lib/matching'
import { BUDGET_BANDS, type BudgetBand, type Pills } from '../lib/list'

export function PropertyFilters({ pills, onChange, all }: { pills: Pills; onChange: (p: Pills) => void; all: Property[] }) {
  const { t } = useTranslation(['properties', 'catalogue'])
  const count = (pred: (p: Property) => boolean) => all.filter(pred).length
  const opt = <V extends string>(values: readonly V[], label: (v: V) => string, pred: (v: V) => (p: Property) => boolean, hideEmpty = true): FilterOption[] =>
    values.map((v) => ({ value: v, label: label(v), count: count(pred(v)) })).filter((o) => !hideEmpty || (o.count ?? 0) > 0)
  const localities = (pills.cities.length ? pills.cities : CITY_NAMES).flatMap((c) => CITIES[c] ?? [])
  const bands = Object.keys(BUDGET_BANDS) as BudgetBand[]

  return (
    <>
      <FilterPill
        label={t('properties:filter.type')} selected={pills.types} onChange={(v) => onChange({ ...pills, types: v as PropertyType[] })}
        options={opt(PROPERTY_TYPE_ORDER, (v) => t(`catalogue:propertyType.${v}`), (v) => (p) => p.type === v)}
      />
      <FilterPill
        label={t('properties:filter.city')} selected={pills.cities} onChange={(v) => onChange({ ...pills, cities: v, localities: pills.localities.filter((l) => !v.length || v.some((c) => CITIES[c]?.includes(l))) })}
        options={opt(CITY_NAMES, (v) => v, (v) => (p) => p.location.city === v)}
      />
      <FilterPill
        label={t('properties:filter.locality')} selected={pills.localities} onChange={(v) => onChange({ ...pills, localities: v })}
        options={opt(localities, (v) => v, (v) => (p) => p.location.locality === v)}
      />
      <FilterPill
        single label={t('properties:filter.budget')} selected={pills.budget ? [pills.budget] : []} onChange={(v) => onChange({ ...pills, budget: (v[0] as BudgetBand) || undefined })}
        options={opt(bands, (v) => t(`properties:budget.${v}`), (v) => (p) => { const b = BUDGET_BANDS[v]; return p.price > 0 && (!b.min || p.price >= b.min) && (!b.max || p.price < b.max) }, false)}
      />
      <FilterPill
        label={t('properties:filter.configuration')} selected={pills.configurations} onChange={(v) => onChange({ ...pills, configurations: v as Configuration[] })}
        options={opt(CONFIGURATIONS, configLabel, (v) => (p) => p.configuration === v)}
      />
      <FilterPill
        single label={t('properties:filter.possession')} selected={pills.possession ? [pills.possession] : []} onChange={(v) => onChange({ ...pills, possession: (v[0] as Pills['possession']) || undefined })}
        options={opt(['ready', 'underConstruction'] as const, (v) => t(`catalogue:possession.${v}`), (v) => (p) => p.possession.status === v, false)}
      />
      <FilterPill
        single label={t('properties:filter.furnishing')} selected={pills.furnishing ? [pills.furnishing] : []} onChange={(v) => onChange({ ...pills, furnishing: (v[0] as Furnishing) || undefined })}
        options={opt(FURNISHING, (v) => t(`catalogue:furnishing.${v}`), (v) => (p) => p.furnishing === v, false)}
      />
      <FilterPill
        label={t('properties:filter.facing')} selected={pills.facing} onChange={(v) => onChange({ ...pills, facing: v as Facing[] })}
        options={opt(FACINGS, (v) => t(`catalogue:facing.${v}`), (v) => (p) => p.facing === v)}
      />
    </>
  )
}
