/**
 * Overview — the first tab, as in spec-system-wireframe (propOverview):
 * main: photos, property details (main information + the type's specifications + amenities), the neighbourhood;
 * side: price check, one "To do" list and the best-matching buyers — or, once it's sold / reserved / on hold, the deal.
 */
import { useState } from 'react'
import { Chip } from '@/components/app/chip'
import { Link } from 'react-router'
import { Check, MapPin, Plus, Sparkles, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { KeyValueGrid } from '@/components/app/key-value-grid'
import { SectionCard } from '@/components/app/section-card'
import { StatusChip } from '@/components/app/status-chip'
import { UserAvatar } from '@/components/app/user-avatar'
import { amenityList, PROPERTY_TYPES, type FactDef, typeFacts } from '@/data/catalogue'
import { DEMO_TODAY } from '@/data/seed'
import { fmtDate, inr, inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import type { Match } from '@/lib/matching'
import { attentionFor, listingScore, priceCheck, type ScoreItem } from '@/lib/property'
import { cn } from '@/lib/utils'
import { useCan, useStore, userName } from '@/store/db'
import type { Property } from '@/data/types'
import { CompletionRing, MATCH_TONE, PropertyStatusChip } from '../components/property-bits'
import { FactDialog } from '../components/fact-dialog'
import { NeighbourhoodCard } from './neighbourhood-card'
import { PhotoGallery, usePhotoUpload } from '../components/photo-gallery'

export function OverviewTab({ p, matches }: { p: Property; matches: Match[] }) {
  const live = p.status === 'available' && !p.archived
  return (
    // phone: photos, then the side cards (matching on top), then the details; desktop: two columns
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21.25rem] lg:grid-rows-[auto_1fr]">
      <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1"><PhotoGallery p={p} /></div>
      <div className="order-3 flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2">
        <DetailsCard p={p} />
        <NeighbourhoodCard p={p} />
      </div>
      <aside className="order-2 flex flex-col gap-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {live ? <PriceSummary p={p} /> : <DealCard p={p} />}
        <TodoCard p={p} />
        {live && <BuyersCard p={p} matches={matches} />}
      </aside>
    </div>
  )
}

/* ---------- property details ---------- */

function DetailsCard({ p }: { p: Property }) {
  const { t, i18n } = useTranslation()
  const L = useLabels()
  const can = useCan()
  const { db, updateProperty } = useStore()
  const manager = can('property.manage')
  const [adding, setAdding] = useState<FactDef | null>(null)
  const [editAmen, setEditAmen] = useState(false)
  const def = PROPERTY_TYPES[p.type]
  const facts = typeFacts(p.type, db.settings)
  const filled = facts.filter((f) => p.specs[f.key] !== undefined && p.specs[f.key] !== '')
  const empty = facts.filter((f) => p.specs[f.key] === undefined || p.specs[f.key] === '')
  const ppsf = p.areaSqft ? Math.round(p.price / p.areaSqft) : 0
  const editable = manager && !p.archived
  const toggleAmenity = (a: string) =>
    updateProperty(p.id, (x) => { x.amenities = x.amenities.includes(a) ? x.amenities.filter((y) => y !== a) : [...x.amenities, a] }, t('history.amenities'))
  const label = (s: string) => <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{s}</p>

  return (
    <SectionCard title={t('props.details')} action={editable && <Button size="sm" variant="outline" asChild><Link to={`/properties/${p.id}/edit`}><Sparkles /> {t('action.editWithAi')}</Link></Button>}>
      {label(t('props.mainInfo'))}
      <KeyValueGrid items={[
        { label: t('props.propertyId'), value: <span className="font-mono text-sm">{p.id}</span> },
        { label: t('fact.type'), value: <>{L.type(p.type)} <span className="text-xs font-normal text-muted-foreground">· {t(`props.category.${def.category}`)}</span></> },
        { label: t('fact.purpose'), value: L.purpose(p.purpose) },
        { label: t('price.asking'), value: inr(p.price) },
        { label: t(`areaLabel.${p.type}`, { defaultValue: def.areaLabel }), value: <>{num(p.areaSqft)} sq.ft. {ppsf > 0 && <span className="text-xs font-normal text-muted-foreground">· {inr(ppsf)}/sq.ft.</span>}</> },
        { label: t('props.location'), value: <span className="whitespace-normal">{p.location.locality}, {p.location.city}, {p.location.state}</span> },
        { label: t('fact.facing'), value: p.facing ? L.facing(p.facing) : '—' },
        { label: t('table.status'), value: <PropertyStatusChip property={p} /> },
        { label: t('props.listed'), value: p.listedAt ? fmtDate(p.listedAt, i18n.language) : '—' },
      ]} />

      <div className="mt-5 flex items-baseline justify-between gap-2 border-t pt-4">
        {label(t('props.typeSpecs', { type: L.type(p.type) }))}
        <span className="text-xs text-muted-foreground">{t('props.filledOf', { n: filled.length, total: facts.length })}</span>
      </div>
      {filled.length || p.extraDetails?.length ? (
        <KeyValueGrid items={[
          ...filled.map((f) => ({ key: f.key, label: L.fact(f.key, f.label), value: <span className="whitespace-normal">{L.factValue(f, p.specs[f.key])}</span> })),
          // details only this property has
          ...(p.extraDetails ?? []).map((x) => ({ key: 'extra-' + x.label, label: x.label, value: <span className="whitespace-normal">{x.value}</span> })),
        ]} />
      ) : <p className="text-sm text-muted-foreground">{t('props.noDetails')}</p>}

      {/* amenities, inline */}
      <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t pt-4">
        <span className="mr-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('overview.amenities')}</span>
        {(editAmen ? [...new Set([...amenityList(db.settings), ...p.amenities])] : p.amenities).map((a) => {
          const on = p.amenities.includes(a)
          return editAmen ? (
            <Chip key={a} pressed={on} onClick={() => toggleAmenity(a)}>
              {on ? <Check /> : <Plus />} {t(`amenity.${a}`, { defaultValue: a })}
            </Chip>
          ) : <StatusChip key={a} tone="neutral" className="h-7 border bg-card px-2.5 text-sm font-normal">{t(`amenity.${a}`, { defaultValue: a })}</StatusChip>
        })}
        {!editAmen && !p.amenities.length && <span className="text-sm text-muted-foreground">{t('props.noAmenitiesPts')}</span>}
        {editable && (
          <Chip dashed onClick={() => setEditAmen(!editAmen)}>
            {editAmen ? <><Check /> {t('action.done')}</> : <><Plus /> {p.amenities.length ? t('props.editAmenities') : t('props.addAmenities')}</>}
          </Chip>
        )}
      </div>

      {editable && p.status === 'available' && empty.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t pt-4">
          <span className="mr-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('props.addRow')}</span>
          {empty.slice(0, 6).map((f) => (
            <Chip key={f.key} dashed onClick={() => setAdding(f)}>
              <Plus /> {L.fact(f.key, f.label).replace(/ \(.*\)$/, '')}
            </Chip>
          ))}
          {empty.length > 6 && <Link to={`/properties/${p.id}/edit`} className="text-sm text-primary hover:underline">{t('props.moreDetails', { count: empty.length - 6 })}</Link>}
        </div>
      )}
      <FactDialog property={p} fact={adding} onClose={() => setAdding(null)} />
    </SectionCard>
  )
}

/* ---------- side: price check, deal, to do, buyers ---------- */

function PriceSummary({ p }: { p: Property }) {
  const { t } = useTranslation()
  const { db } = useStore()
  const pc = priceCheck(p, db)
  return (
    <SectionCard title={t('price.check')} action={<Link to={`/properties/${p.id}/price`} className="text-sm text-primary hover:underline">{t('action.details')} →</Link>}>
      <p className="text-2xl font-semibold tracking-tight">{pc.pricePerSqft ? inr(pc.pricePerSqft) : ''}<span className="text-sm font-normal text-muted-foreground">{t('price.perSqftShort')}</span></p>
      {pc.position ? (
        <p className="mt-1 text-sm">
          <StatusChip tone={pc.position === 'within' ? 'success' : 'warning'}>{t(`price.market.${pc.position}`)}</StatusChip>{' '}
          <span className="text-muted-foreground">{t('price.similarRange', { count: pc.count, range: pc.min === pc.max ? inr(pc.min) : `${inr(pc.min)} – ${inr(pc.max)}` })}</span>
        </p>
      ) : <p className="mt-1 text-sm text-muted-foreground">{t('price.notCompared')}</p>}
      <div className="mt-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground">{t('price.totalBuyer')}</span> <span className="font-semibold">{inr(pc.allIn)}</span>
        <p className="text-xs text-muted-foreground">{t('price.inclCosts')}</p>
      </div>
    </SectionCard>
  )
}

/** For a property no longer on offer: who it went (or is going) to, the offer against the asking price, and since when. */
function DealCard({ p }: { p: Property }) {
  const { t, i18n } = useTranslation()
  const { db } = useStore()
  const lead = db.leads.find((l) => l.negotiation?.propertyId === p.id)
  const n = lead?.negotiation
  const since = p.history.find((h) => /status|archiv/i.test(h.text))?.at
  const visits = db.leads.reduce((a, l) => a + l.visits.filter((v) => v.propertyId === p.id).length, 0)
  const gap = n?.offered ? Math.round(((n.offered - p.price) / p.price) * 1000) / 10 : null
  return (
    <SectionCard title={p.archived ? t('props.archived') : t(`status.${p.status}`)} action={since && <span className="text-xs text-muted-foreground">{t('props.since', { date: fmtDate(since, i18n.language) })}</span>}>
      {lead && n ? (
        <>
          <Link to={`/leads/${lead.id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-muted">
            <UserAvatar name={lead.name} />
            <span className="min-w-0"><span className="block font-medium">{lead.name}</span><span className="text-xs text-muted-foreground">{t(`stage.${lead.stage}`)} · {userName(db, lead.ownerId)}</span></span>
          </Link>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-sm">
            <div><p className="text-xs text-muted-foreground">{t('props.deal.asking')}</p><p className="font-semibold">{inrShort(p.price)}</p></div>
            <div><p className="text-xs text-muted-foreground">{t('props.deal.offer')}</p><p className="font-semibold">{inrShort(n.offered)} {gap != null && <span className={cn('text-xs font-normal', gap < 0 ? 'text-warning' : 'text-success')}>{gap > 0 ? '+' : ''}{gap}%</span>}</p></div>
            <div><p className="text-xs text-muted-foreground">{t('props.deal.counter')}</p><p className="font-semibold">{inrShort(n.counter)}</p></div>
          </div>
          {n.notes && <p className="mt-3 border-t pt-3 text-sm italic">“{n.notes}”</p>}
        </>
      ) : <p className="text-sm text-muted-foreground">{t(p.status === 'sold' ? 'props.deal.noBuyerSold' : p.status === 'onHold' ? 'props.deal.onHold' : 'props.deal.noBuyer')}</p>}
      <p className="mt-3 text-xs text-muted-foreground">{t('props.deal.visits', { count: visits })} · {t('props.deal.notOfferedWhile', { status: (p.archived ? t('props.archived') : t(`status.${p.status}`)).toLowerCase() })}</p>
    </SectionCard>
  )
}

/** Where each missing score item is fixed: the assistant, the photos, or the Legal tab. */
const FIX: Record<ScoreItem['key'], 'edit' | 'photo' | 'legal'> = {
  purpose: 'edit', type: 'edit', city: 'edit', locality: 'edit', price: 'edit', area: 'edit', keyDetails: 'edit', photos: 'photo', legal: 'legal', amenities: 'edit',
}

/** One "To do" list: what needs attention, then what's missing with the points each adds. */
function TodoCard({ p }: { p: Property }) {
  const { t } = useTranslation()
  const { db } = useStore()
  const can = useCan()
  const upload = usePhotoUpload(p)
  const live = p.status === 'available' && !p.archived
  const sc = listingScore(p)
  const attention = attentionFor(p, db, DEMO_TODAY).filter((a) => a.key !== 'details' && (live || a.key === 'docs'))
  const missing = live ? sc.missing : []
  const exact = live && !p.location.exact
  const n = attention.length + missing.length + (exact ? 1 : 0)
  if (!n) return null
  const fix = (m: ScoreItem) => {
    const k = FIX[m.key]
    if (!can('property.manage') && k !== 'photo') return null
    return k === 'photo' ? <Button size="xs" variant="outline" onClick={upload.pick}>{t('todo.add')}</Button>
      : <Button size="xs" variant="outline" asChild><Link to={k === 'legal' ? `/properties/${p.id}/legal` : `/properties/${p.id}/edit`}>{k === 'legal' ? t('todo.open') : t('todo.add')}</Link></Button>
  }
  return (
    <SectionCard>
      {upload.input}
      <div className="mb-3 flex items-center gap-3">
        {live && <CompletionRing score={sc.score} size={56} />}
        <div>
          <h2 className="font-semibold">{t('todo.titleShort')}</h2>
          <p className="text-xs text-muted-foreground">{t('props.todoCount', { count: n })} · {live ? t('props.listingPct', { pct: sc.score }) : t(`status.${p.status}`).toLowerCase()}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {attention.map((a) => (
          <li key={a.key} className="flex items-start gap-2 rounded-lg bg-warning-soft p-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <span className="flex-1">{a.key === 'docs' ? t('props.docsPendingTitle', { list: p.approvals.filter((x) => x.status === 'pending').map((x) => t(`approval.${x.approvalId}`, { defaultValue: x.approvalId })).join(', ') }) : t(`attn.${a.key}${a.key === 'price' ? '_' + a.values?.dir : ''}`, a.values ?? {})}
              {a.key === 'docs' && <span className="block text-xs text-muted-foreground">{t(live ? 'props.docsHintLive' : 'props.docsHintDone')}</span>}</span>
            <Button size="xs" variant="outline" asChild>
              <Link to={a.key === 'docs' ? `/properties/${p.id}/legal` : a.key === 'price' ? `/properties/${p.id}/price` : `/properties/${p.id}/matching`}>{t(`attn.act.${a.key}`)}</Link>
            </Button>
          </li>
        ))}
        {exact && (
          <li className="flex items-start gap-2 rounded-lg bg-warning-soft p-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-warning" />
            <span className="flex-1">{t('todo.exactLocation')}<span className="block text-xs text-muted-foreground">{t('props.exactHint', { locality: p.location.locality })}</span></span>
            <Button size="xs" variant="outline" onClick={() => document.getElementById('location')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('todo.set')}</Button>
          </li>
        )}
        {missing.map((m) => (
          <li key={m.key} className="flex items-center gap-2 p-2">
            <span className="size-2 shrink-0 rounded-full border-2 border-muted-foreground/50" />
            <span className="flex-1">{t(`score.${m.key}`)}</span>
            <span className="text-xs font-medium text-success tabular-nums">+{m.max - m.points}%</span>
            {fix(m)}
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

function BuyersCard({ p, matches }: { p: Property; matches: Match[] }) {
  const { t } = useTranslation()
  const top = matches.slice(0, 3)
  return (
    <SectionCard title={t('props.bestBuyers')} action={top.length > 0 && <Link to={`/properties/${p.id}/matching`} className="text-sm text-primary hover:underline">{t('props.seeAll')}</Link>}>
      {top.length ? (
        <ul className="flex flex-col divide-y">
          {top.map((m) => (
            <li key={m.lead.id}>
              <Link to={`/leads/${m.lead.id}`} className="flex items-center gap-3 py-2 hover:bg-muted/50">
                <UserAvatar name={m.lead.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.lead.name}</span>
                  <span className="block text-xs text-muted-foreground">{inrShort(m.lead.budget.min)} – {inrShort(m.lead.budget.max)} · {t(`stage.${m.lead.stage}`)}</span>
                </span>
                <StatusChip tone={MATCH_TONE[m.label]}>{t('props.pctFit', { score: m.score })}</StatusChip>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">{t('props.noBuyerYet')}</p>}
    </SectionCard>
  )
}
