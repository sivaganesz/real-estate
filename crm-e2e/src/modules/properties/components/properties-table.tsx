/** The Properties table view (DESIGN_SYSTEM §11.7): thumbnail + title, place, type, area, price, ₹/sq ft, status, listing health, row actions. */
import type { ReactNode } from 'react'
import { Building2, Pencil, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { paths } from '@/app/paths'
import { AvailabilityPill } from '@/components/domain/property-pills'
import { DataTable, type Column, type TableSort } from '@/components/shared/data-table'
import { ProgressRing } from '@/components/shared/progress-ring'
import { Button } from '@/components/ui/button'
import type { Property } from '@/domain/types'
import { usePermission } from '@/hooks/use-permission'
import { inrShort, num } from '@/lib/format'
import { configLabel } from '@/lib/matching'
import { coverPhoto, listingScore, pricePerSqft, primaryAreaSqft } from '@/lib/property'
import { scoreTone } from '@/lib/tones'

export function PropertiesTable({ rows, selected, onSelectedChange, sort, onSort, empty }: {
  rows: Property[]
  selected: ReadonlySet<string>
  onSelectedChange: (s: Set<string>) => void
  sort: TableSort | null
  onSort: (key: string) => void
  empty: ReactNode
}) {
  const { t } = useTranslation(['properties', 'catalogue'])
  const navigate = useNavigate()
  const { can, explain } = usePermission()
  const columns: Column<Property>[] = [
    {
      key: 'title', header: t('properties:table.property'), cell: (p) => {
        const cover = coverPhoto(p)
        return (
          <span className="flex min-w-0 items-center gap-3">
            {cover ? <img src={cover.url} alt="" className="size-10 shrink-0 rounded-md object-cover" /> : <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"><Building2 className="size-4" aria-hidden="true" /></span>}
            <span className="min-w-0">
              <Link to={paths.property(p.id)} onClick={(e) => e.stopPropagation()} className="block max-w-72 truncate font-medium hover:underline">{p.title}</Link>
              <span className="block text-meta text-muted-foreground">{p.id}{p.listing !== 'live' ? ` · ${t(`catalogue:listing.${p.listing}`)}` : ''}</span>
            </span>
          </span>
        )
      },
    },
    { key: 'place', header: t('properties:table.place'), hideBelow: 'md', cell: (p) => <span className="block max-w-40 truncate">{p.location.locality}<span className="block text-meta text-muted-foreground">{p.location.city}</span></span> },
    { key: 'type', header: t('properties:table.type'), hideBelow: 'lg', cell: (p) => <span>{p.configuration ? `${configLabel(p.configuration)} · ` : ''}{t(`catalogue:propertyType.${p.type}`)}</span> },
    { key: 'area', header: t('properties:table.area'), align: 'right', sortable: true, hideBelow: 'xl', cell: (p) => <span className="tabular-nums">{primaryAreaSqft(p) ? num(primaryAreaSqft(p)) : ''}</span> },
    { key: 'price', header: t('properties:table.price'), align: 'right', sortable: true, cell: (p) => <span className="font-semibold tabular-nums">{p.price ? inrShort(p.price) : t('domain:property.onRequest')}</span> },
    { key: 'ppsf', header: t('properties:table.ppsf'), align: 'right', hideBelow: 'lg', cell: (p) => <span className="text-muted-foreground tabular-nums">{pricePerSqft(p) ? `₹${num(pricePerSqft(p))}` : ''}</span> },
    { key: 'status', header: t('properties:table.status'), cell: (p) => <AvailabilityPill status={p.status} /> },
    {
      key: 'health', header: t('properties:table.health'), hideBelow: 'xl', cell: (p) => {
        const s = listingScore(p).score
        return <ProgressRing value={s} size={32} tone={scoreTone(s)} label={t('properties:table.healthLabel', { score: s })} />
      },
    },
  ]
  return (
    <DataTable
      rows={rows} columns={columns} rowKey={(p) => p.id} label={t('properties:table.label')} rowLabel={(p) => p.title}
      onRowClick={(p) => navigate(paths.property(p.id))}
      sort={sort} onSort={onSort} selected={selected} onSelectedChange={onSelectedChange}
      empty={empty}
      rowActions={(p) => (
        <span className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm" title={t('properties:actions.findBuyers')}><Link to={paths.matching({ property: p.id })} aria-label={t('properties:actions.findBuyersFor', { title: p.title })} onClick={(e) => e.stopPropagation()}><Target /></Link></Button>
          {can('property.edit', p) ? (
            <Button asChild variant="ghost" size="icon-sm" title={t('properties:actions.edit')}><Link to={paths.editProperty(p.id)} aria-label={t('properties:actions.editTitle', { title: p.title })} onClick={(e) => e.stopPropagation()}><Pencil /></Link></Button>
          ) : can('property.edit') && (
            // the role edits listings, just not this one (CONVENTIONS §6: disable with the reason, don't hide)
            <span title={t(explain('property.edit').reasonKey, explain('property.edit').params)} onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon-sm" disabled aria-label={t('properties:actions.editTitle', { title: p.title })}><Pencil /></Button>
            </span>
          )}
        </span>
      )}
    />
  )
}
