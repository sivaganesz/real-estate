/** Key facts as icon tiles (DESIGN_SYSTEM §8): only facts the record has, chosen by family; then the family specs and amenities. */
import type { ReactNode } from 'react'
import {
  Armchair, Bath, BedDouble, Building, CalendarClock, Car, Compass, CornerDownRight, Fence, IndianRupee, KeyRound, Layers, Map as MapIcon,
  Ruler, ShieldCheck, Sofa, Sparkles, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SpecChip } from '@/components/domain/property-pills'
import { IconTile } from '@/components/shared/icon-tile'
import { KeyValueGrid } from '@/components/shared/key-value-grid'
import { PROPERTY_TYPES } from '@/domain/catalogue'
import type { Property } from '@/domain/types'
import { fmtDate, inr, num } from '@/lib/format'
import { configLabel } from '@/lib/matching'
import { plotSqft, primaryAreaSqft } from '@/lib/property'
import type { Tone } from '@/lib/tones'

type Fact = { icon: LucideIcon; label: string; value: ReactNode; tone?: Tone }

export function KeyFacts({ p }: { p: Property }) {
  const { t, i18n } = useTranslation(['properties', 'catalogue'])
  const area = primaryAreaSqft(p)
  const plot = plotSqft(p)
  const facts: Fact[] = []
  const add = (cond: unknown, f: Fact) => { if (cond) facts.push(f) }
  add(p.configuration, { icon: BedDouble, label: t('properties:fact.configuration'), value: p.configuration ? configLabel(p.configuration) : '' })
  add(area, { icon: Ruler, label: t(`properties:form.area.${PROPERTY_TYPES[p.type].areaFields.find((k) => p.area[k]) ?? 'carpet'}`), value: t('properties:fact.sqft', { area: num(area) }) })
  add(plot && plot !== area, { icon: MapIcon, label: t('properties:fact.plot'), value: p.area.plot ? `${num(p.area.plot)} ${t(`catalogue:areaUnit.${p.area.plotUnit ?? 'sqft'}`)}` : t('properties:fact.sqft', { area: num(plot) }) })
  add(p.area.plotLengthFt && p.area.plotWidthFt, { icon: Ruler, label: t('properties:fact.dimensions'), value: `${p.area.plotLengthFt} × ${p.area.plotWidthFt} ${t('properties:form.ft')}` })
  add(p.bathrooms, { icon: Bath, label: t('properties:form.bathrooms'), value: p.bathrooms })
  add(p.balconies, { icon: Armchair, label: t('properties:form.balconies'), value: p.balconies })
  add(p.floor != null && p.type !== 'plot', { icon: Layers, label: t('properties:form.floor'), value: p.totalFloors ? t('properties:fact.floorOf', { floor: p.floor === 0 ? t('properties:fact.ground') : p.floor, total: p.totalFloors }) : p.floor })
  add(p.facing, { icon: Compass, label: t('properties:form.facing'), value: p.facing ? t(`catalogue:facing.${p.facing}`) : '' })
  add(p.parking.covered + p.parking.open, { icon: Car, label: t('properties:fact.parking'), value: t('properties:fact.parkingValue', { covered: p.parking.covered, open: p.parking.open }) })
  add(p.furnishing, { icon: Sofa, label: t('properties:form.furnishing'), value: p.furnishing ? t(`catalogue:furnishing.${p.furnishing}`) : '' })
  facts.push({ icon: KeyRound, label: t('properties:form.possession'), value: p.possession.status === 'underConstruction' && p.possession.date ? t('properties:fact.possessionBy', { date: fmtDate(p.possession.date, i18n.language) }) : t(`catalogue:possession.${p.possession.status}`), tone: p.possession.status === 'ready' ? 'success' : 'warning' })
  add(p.roadWidthFt, { icon: Fence, label: t('properties:form.roadWidth'), value: `${p.roadWidthFt} ${t('properties:form.ft')}` })
  add(p.corner, { icon: CornerDownRight, label: t('properties:form.corner'), value: t('properties:fact.yes') })
  add(p.vastuCompliant, { icon: Sparkles, label: t('properties:form.vastu'), value: t('properties:fact.yes'), tone: 'highlight' })
  add(p.gatedCommunity, { icon: ShieldCheck, label: t('properties:form.gated'), value: t('properties:fact.yes') })
  add(p.maintenancePerMonth, { icon: IndianRupee, label: t('properties:form.maintenance'), value: t('properties:fact.perMonth', { amount: inr(p.maintenancePerMonth) }) })
  add(p.transaction, { icon: Building, label: t('properties:form.transaction'), value: t(`catalogue:transaction.${p.transaction}`) })
  add(p.listedAt, { icon: CalendarClock, label: t('properties:fact.listed'), value: fmtDate(p.listedAt, i18n.language) })

  const specs = PROPERTY_TYPES[p.type].specs
    .filter((s) => p.specs[s.key] !== undefined && p.specs[s.key] !== '' && p.specs[s.key] !== false)
    .map((s) => {
      const v = p.specs[s.key]
      const value = s.kind === 'boolean' ? t('properties:fact.yes') : s.kind === 'select' ? t(`catalogue:specOption.${v}`) : s.money ? inr(Number(v)) : typeof v === 'number' && !s.plain ? num(v) : String(v)
      return { key: s.key, label: t(`catalogue:spec.${s.key}`), value, hint: s.internal ? <span className="text-micro text-muted-foreground">· {t('properties:fact.internal')}</span> : undefined }
    })

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="key-facts">
        {facts.map((f) => (
          <li key={f.label} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            <IconTile icon={f.icon} tone={f.tone ?? 'primary'} size="lg" />
            <span className="min-w-0">
              <span className="block truncate text-meta text-muted-foreground">{f.label}</span>
              <span className="block truncate text-sm font-semibold tabular-nums">{f.value}</span>
            </span>
          </li>
        ))}
      </ul>
      {specs.length > 0 && <KeyValueGrid items={specs} columns={3} />}
      {p.amenities.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('properties:form.section.amenities')}</h3>
          <div className="flex flex-wrap gap-1.5">{p.amenities.map((a) => <SpecChip key={a}>{t(`catalogue:amenity.${a}`)}</SpecChip>)}</div>
        </div>
      )}
    </div>
  )
}
