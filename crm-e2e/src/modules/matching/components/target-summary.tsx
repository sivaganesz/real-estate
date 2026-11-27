/** The chosen lead's requirement (budget, places, configuration, possession…) or the chosen property, as a compact summary card. */
import { Building2, ExternalLink, IndianRupee, KeyRound, MapPin, Ruler } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { paths } from '@/app/paths'
import { AvailabilityPill, SpecChip } from '@/components/domain/property-pills'
import { ToneBadge } from '@/components/shared/badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import type { Lead, Property } from '@/domain/types'
import { inrRange, inrShort, num } from '@/lib/format'
import { configLabel } from '@/lib/matching'
import { coverPhoto, primaryAreaSqft } from '@/lib/property'
import { stageTone } from '@/lib/tones'

export function LeadSummary({ lead }: { lead: Lead }) {
  const { t } = useTranslation(['matching', 'catalogue'])
  const r = lead.requirement
  const budget = inrRange(r.budgetMin, r.budgetMax, { upTo: t('matching:summaryCard.upTo'), from: t('matching:summaryCard.from') })
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-card" data-testid="lead-summary">
      <div className="flex items-center gap-3">
        <UserAvatar name={lead.name} size="lg" />
        <div className="min-w-0 flex-1">
          <Link to={paths.lead(lead.id)} className="inline-flex items-center gap-1 text-base font-semibold hover:underline">{lead.name}<ExternalLink className="size-3.5 opacity-60" aria-hidden="true" /></Link>
          <p className="flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
            <ToneBadge classes={stageTone[lead.stage]} variant="dot">{t(`catalogue:stage.${lead.stage}`)}</ToneBadge>
            <span>{lead.id}</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <SpecChip icon={IndianRupee}>{budget || t('matching:summaryCard.noBudget')}{r.budgetFlexPct ? ` · ±${r.budgetFlexPct}%` : ''}</SpecChip>
        {(r.localities.length || r.cities.length) > 0 && <SpecChip icon={MapPin}>{(r.localities.length ? r.localities : r.cities).join(', ')}</SpecChip>}
        {r.configurations.length > 0 && <SpecChip>{r.configurations.map(configLabel).join(' / ')}</SpecChip>}
        {r.propertyTypes.length > 0 && <SpecChip icon={Building2}>{r.propertyTypes.map((x) => t(`catalogue:propertyType.${x}`)).join(', ')}</SpecChip>}
        {!!r.areaMinSqft && <SpecChip icon={Ruler}>{t('matching:summaryCard.area', { area: num(r.areaMinSqft) })}</SpecChip>}
        {r.possession !== 'any' && <SpecChip icon={KeyRound}>{t(`catalogue:possession.${r.possession}`)}</SpecChip>}
        {r.facing.length > 0 && <SpecChip>{r.facing.map((f) => t(`catalogue:facing.${f}`)).join(', ')}</SpecChip>}
        {r.amenities.slice(0, 3).map((a) => <SpecChip key={a}>{t(`catalogue:amenity.${a}`)}</SpecChip>)}
        {r.mustHaves.map((m) => <SpecChip key={m}>{m}</SpecChip>)}
      </div>
    </div>
  )
}

export function PropertySummary({ property: p }: { property: Property }) {
  const { t } = useTranslation(['matching', 'catalogue', 'domain'])
  const cover = coverPhoto(p)
  const area = primaryAreaSqft(p)
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-3 shadow-card" data-testid="property-summary">
      {cover ? <img src={cover.url} alt="" className="size-20 shrink-0 rounded-md object-cover" /> : <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary"><Building2 className="size-6" /></span>}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link to={paths.property(p.id)} className="inline-flex items-center gap-1 truncate text-base font-semibold hover:underline">{p.title}<ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden="true" /></Link>
        <p className="text-meta text-muted-foreground">{p.location.locality} · {p.location.city}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <AvailabilityPill status={p.status} />
          <SpecChip icon={IndianRupee}>{p.price ? inrShort(p.price) : t('domain:property.onRequest')}</SpecChip>
          {p.configuration && <SpecChip>{configLabel(p.configuration)}</SpecChip>}
          {area > 0 && <SpecChip icon={Ruler}>{t('domain:property.area', { area: num(area) })}</SpecChip>}
          <SpecChip icon={KeyRound}>{t(`catalogue:possession.${p.possession.status}`)}</SpecChip>
        </div>
      </div>
    </div>
  )
}
