import { useState, type ReactNode } from 'react'
import {
  BadgeCheck, Bus, Camera, Check, Crosshair, FileText, GraduationCap, Hospital, Link2, Lock, MapPin, Milestone, Plane, Plus,
  School, Search, ShoppingBasket, Sparkles, TrainFront, TrainTrack, TriangleAlert, Upload, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FactDialog } from '@/components/property/fact-dialog'
import { PropertyPhoto } from '@/components/property/property-photo'
import { AMENITIES, PROPERTY_TYPES, type FactDef } from '@/data/catalogue'
import { fmtDate, inr, inrShort, num } from '@/lib/format'
import { useLabels } from '@/lib/labels'
import { isApproxDistance, placesFor, priceCheck, type PlaceView } from '@/lib/property'
import { cn } from '@/lib/utils'
import { useCan, useStore, userName } from '@/store/db'
import type { Property } from '@/data/types'

export const SECTION_IDS = ['overview', 'details', 'location', 'photos', 'documents', 'price', 'history'] as const
export type SectionId = (typeof SECTION_IDS)[number]

function Section({ id, title, action, children }: { id: SectionId; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32 rounded-xl border bg-card p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/* ---------- Overview ---------- */

export function OverviewSection({ p }: { p: Property }) {
  const { t } = useTranslation()
  const L = useLabels()
  const can = useCan()
  const { updateProperty } = useStore()
  const manager = can('property.manage')
  const [editAmenities, setEditAmenities] = useState(false)

  const writeWithAi = () => {
    const facts = L.keyFacts(p).join(', ')
    const text = `${L.type(p.type)} ${t('ai.descFor', { purpose: L.purpose(p.purpose).toLowerCase() })} ${p.location.locality}, ${p.location.city}: ${facts}.` +
      (p.amenities.length ? ` ${t('ai.descAmenities', { list: p.amenities.join(', ') })}` : '')
    updateProperty(p.id, (x) => { x.description = text }, t('history.descriptionAi'))
    toast.success(t('ai.descDone'), { description: t('ai.descCheck') })
  }
  const toggleAmenity = (a: string) =>
    updateProperty(p.id, (x) => { x.amenities = x.amenities.includes(a) ? x.amenities.filter((y) => y !== a) : [...x.amenities, a] }, t('history.amenities'))

  return (
    <Section id="overview" title={t('section.overview')}>
      {p.description ? (
        <p className="leading-relaxed text-pretty">{p.description}</p>
      ) : manager ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t('overview.noDescription')}
          <Button size="sm" variant="outline" onClick={writeWithAi}><Sparkles /> {t('overview.writeWithAi')}</Button>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{t('overview.amenities')}</h3>
          {manager && <Button variant="link" size="sm" className="ml-auto h-auto px-0" onClick={() => setEditAmenities(!editAmenities)}>{editAmenities ? t('action.done') : t('action.edit')}</Button>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(editAmenities ? AMENITIES : p.amenities).map((a) => {
            const on = p.amenities.includes(a)
            return editAmenities ? (
              <button key={a} type="button" aria-pressed={on} onClick={() => toggleAmenity(a)}
                className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm', on ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}>
                {on ? <Check className="size-3.5" /> : <Plus className="size-3.5" />} {t(`amenity.${a}`, { defaultValue: a })}
              </button>
            ) : (
              <Badge key={a} variant="secondary" className="h-7 px-2.5 text-sm">{t(`amenity.${a}`, { defaultValue: a })}</Badge>
            )
          })}
          {!editAmenities && !p.amenities.length && <span className="text-sm text-muted-foreground">{t('overview.noAmenities')}</span>}
        </div>
      </div>
    </Section>
  )
}

/* ---------- Details ---------- */

export function DetailsSection({ p }: { p: Property }) {
  const { t } = useTranslation()
  const L = useLabels()
  const can = useCan()
  const manager = can('property.manage')
  const [adding, setAdding] = useState<FactDef | null>(null)
  const def = PROPERTY_TYPES[p.type]
  const required = new Set<string>(def.required)
  const filled = def.facts.filter((f) => p.specs[f.key] !== undefined && p.specs[f.key] !== '' && (manager || !f.internal))
  const missing = def.facts.filter((f) => p.specs[f.key] === undefined || p.specs[f.key] === '')

  const common: { label: string; value: string }[] = [
    { label: t('fact.purpose'), value: L.purpose(p.purpose) },
    { label: t('fact.type'), value: L.type(p.type) },
    { label: t(`fact.area_${def.areaBasis}`), value: `${num(p.areaSqft)} sq.ft.` },
    ...(p.facing ? [{ label: t('fact.facing'), value: L.facing(p.facing) }] : []),
  ]

  return (
    <Section id="details" title={t('section.details')}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {common.map((c) => (
          <div key={c.label}><dt className="text-xs text-muted-foreground">{c.label}</dt><dd className="font-medium">{c.value}</dd></div>
        ))}
        {filled.map((f) => (
          <div key={f.key}>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              {L.fact(f.key, f.label)}
              {f.internal && <span title={t('details.internal')}><Lock className="size-3" aria-label={t('details.internal')} /></span>}
            </dt>
            <dd className="font-medium">{L.factValue(f, p.specs[f.key])}</dd>
          </div>
        ))}
      </dl>
      {manager && missing.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs text-muted-foreground">{t('details.addMore')}</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((f) => (
              <Button key={f.key} size="sm" variant={required.has(f.key) ? 'default' : 'outline'} className="rounded-full" onClick={() => setAdding(f)}>
                <Plus /> {L.fact(f.key, f.label)}{required.has(f.key) ? ` · ${t('details.required')}` : ''}
              </Button>
            ))}
          </div>
        </div>
      )}
      <FactDialog property={p} fact={adding} onClose={() => setAdding(null)} />
    </Section>
  )
}

/* ---------- Location & nearby places ---------- */

const PLACE_ICON: Record<string, LucideIcon> = {
  bus: Bus, 'train-front': TrainFront, 'train-track': TrainTrack, plane: Plane, milestone: Milestone, school: School,
  'graduation-cap': GraduationCap, hospital: Hospital, 'shopping-basket': ShoppingBasket, 'map-pin': MapPin,
}

export function LocationSection({ p }: { p: Property }) {
  const { t } = useTranslation()
  const { db, user, updateProperty } = useStore()
  const can = useCan()
  const manager = can('property.manage')
  const [view, setView] = useState<PlaceView>('team')
  const [setting, setSetting] = useState(false)
  const places = placesFor(p, db.settings, view)

  const setExact = (how: 'gps' | 'link' | 'search') => {
    updateProperty(p.id, (x) => {
      x.location.exact = true
      x.location.lat ??= 0
      x.location.lng ??= 0
    }, t(`history.exactLocation.${how}`))
    setSetting(false)
    toast.success(t('location.exactSet'), { description: t('location.exactSetHint') })
  }
  const checkRoute = (placeId: string, name: string) => {
    updateProperty(p.id, (x) => {
      const pl = x.location.nearby.find((n) => n.id === placeId)
      if (pl) { pl.routeChecked = true; pl.routeCheckedBy = user.id }
    }, t('history.routeChecked', { place: name }))
    toast.success(t('location.routeCheckedToast', { place: name }))
  }

  return (
    <Section id="location" title={t('section.location')}
      action={p.location.exact
        ? <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800"><Crosshair /> {t('location.exact')}</Badge>
        : <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">{t('location.approximate')}</Badge>}>
      {/* map placeholder — Google Maps in the product */}
      <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg bg-[repeating-linear-gradient(45deg,var(--muted)_0_12px,transparent_12px_24px)] md:h-52">
        {p.location.exact
          ? <MapPin className="size-9 fill-primary/20 text-primary" />
          : <span className="size-28 rounded-full border-2 border-dashed border-primary/60 bg-primary/10" aria-hidden />}
        <span className="absolute bottom-2 left-2 rounded-md bg-background/90 px-2 py-1 text-xs">
          {p.location.locality}, {p.location.city}, {p.location.state}
        </span>
      </div>
      {!p.location.exact && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {t('location.approxHint')}
          {manager && <Button size="sm" variant="outline" onClick={() => setSetting(true)}><Crosshair /> {t('location.setExact')}</Button>}
        </div>
      )}
      {(p.location.roadType || p.location.roadWidthFt) && (
        <p className="mt-3 text-sm"><span className="text-muted-foreground">{t('location.road')}:</span> {[p.location.roadType, p.location.roadWidthFt && `${p.location.roadWidthFt} ft`].filter(Boolean).join(', ')}</p>
      )}

      <div className="mt-5 mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{t('location.nearby')}</h3>
        <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as PlaceView)} className="ml-auto">
          <ToggleGroupItem value="team">{t('location.teamView')}</ToggleGroupItem>
          <ToggleGroupItem value="customer">{t('location.customerView')}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {view === 'customer' && <p className="mb-2 text-xs text-muted-foreground">{t('location.customerViewHint')}</p>}
      {places.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('location.noPlaces')}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {places.map((pl) => {
            const cat = db.settings.placeCategories.find((c) => c.id === pl.categoryId)
            const Icon = PLACE_ICON[cat?.icon ?? 'map-pin'] ?? MapPin
            const approx = isApproxDistance(p, pl)
            return (
              <li key={pl.id} className="flex items-center gap-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{pl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`place.${pl.categoryId}`, { defaultValue: cat?.name })}
                    {pl.status !== 'existing' && <> · <span className="text-amber-700">{t(`infra.${pl.status}`)}</span></>}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium">{approx ? '~' : ''}{pl.distanceKm} km</p>
                  <p className="text-xs text-muted-foreground">{approx ? '~' : ''}{pl.durationMin} {t('location.min')}</p>
                </div>
                {view === 'team' && cat?.routeCheck && pl.status === 'existing' && (
                  pl.routeChecked
                    ? <span title={t('location.routeChecked')} className="text-emerald-600"><BadgeCheck className="size-4" aria-label={t('location.routeChecked')} /></span>
                    : <Button size="xs" variant="outline" disabled={!p.location.exact} title={p.location.exact ? undefined : t('location.needsExact')}
                        onClick={() => checkRoute(pl.id, pl.name)}>{t('location.checkRoute')}</Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={setting} onOpenChange={setSetting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('location.setExact')}</DialogTitle>
            <DialogDescription>{t('location.setExactHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button size="lg" variant="outline" className="justify-start" onClick={() => setExact('gps')}><Crosshair /> {t('location.useGps')}</Button>
            <Button size="lg" variant="outline" className="justify-start" onClick={() => setExact('link')}><Link2 /> {t('location.pasteLink')}</Button>
            <Button size="lg" variant="outline" className="justify-start" onClick={() => setExact('search')}><Search /> {t('location.searchMap')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  )
}

/* ---------- Photos ---------- */

export function PhotosSection({ p }: { p: Property }) {
  const { t } = useTranslation()
  const can = useCan()
  const { updateProperty } = useStore()
  const photos = p.media.filter((m) => m.kind === 'photo')
  const upload = () => {
    updateProperty(p.id, (x) => {
      const n = x.media.length
      x.media.push(...[1, 2, 3].map((i) => ({ id: `${x.id}-ph${n + i}`, kind: 'photo' as const, url: '', isCover: n === 0 && i === 1 })))
    }, t('history.photos', { count: 3 }))
    toast.success(t('photos.uploaded', { count: 3 }))
  }
  return (
    <Section id="photos" title={t('section.photos', { count: photos.length })}
      action={can('property.manage') && <Button size="sm" variant="outline" onClick={upload}><Upload /> {t('photos.upload')}</Button>}>
      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
          <Camera className="size-6" /> {t('photos.none')}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((m, i) => (
            <div key={m.id} className="relative">
              <PropertyPhoto type={p.type} media={m} alt={t('photos.alt', { n: i + 1, title: p.title })} className="aspect-square w-full rounded-lg" iconClassName="size-6" />
              {m.isCover && <Badge className="absolute top-1.5 left-1.5">{t('photos.cover')}</Badge>}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

/* ---------- Legal & documents ---------- */

export function DocumentsSection({ p }: { p: Property }) {
  const { t } = useTranslation()
  const { db, user, today, updateProperty } = useStore()
  const can = useCan()
  const manager = can('property.manage')
  const upload = (approvalId: string, label: string) => {
    updateProperty(p.id, (x) => {
      const a = x.approvals.find((y) => y.approvalId === approvalId)
      if (a) { a.status = 'uploaded'; a.file = `${approvalId}-approval.pdf`; a.uploaded = { by: user.id, at: today } }
    }, t('history.approvalUploaded', { approval: label }))
    toast.success(t('documents.uploadedToast', { approval: label }))
  }
  return (
    <Section id="documents" title={t('section.documents')}>
      {p.approvals.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {p.approvals.map((a) => {
            const type = db.settings.approvalTypes.find((x) => x.id === a.approvalId)
            const label = t(`approval.${a.approvalId}`, { defaultValue: type?.label })
            return (
              <li key={a.approvalId} className={cn('flex flex-wrap items-center gap-3 rounded-lg border p-3', a.status === 'pending' && 'border-amber-300 bg-amber-50/60')}>
                {a.status === 'pending' ? <TriangleAlert className="size-5 text-amber-600" /> : <BadgeCheck className="size-5 text-emerald-600" />}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.status === 'pending' ? t('documents.pendingHint') : a.status === 'verified' ? t('documents.verified') : t('documents.uploaded')}
                  </p>
                </div>
                {a.status === 'pending' && manager && <Button size="sm" onClick={() => upload(a.approvalId, label)}><Upload /> {t('documents.upload')}</Button>}
              </li>
            )
          })}
        </ul>
      )}
      {p.documents.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {p.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-2.5 rounded-lg border p-2.5 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{t(`doc.${d.kind}`, { defaultValue: d.name })}</span>
              {d.verified && <span title={t('documents.verified')}><BadgeCheck className="size-4 text-emerald-600" aria-label={t('documents.verified')} /></span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('documents.none')}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">{t('documents.privacy')}</p>
    </Section>
  )
}

/* ---------- Price check ---------- */

export function PriceSection({ p }: { p: Property }) {
  const { t, i18n } = useTranslation()
  const { db } = useStore()
  const pc = priceCheck(p, db.settings)
  const range = pc.min != null && pc.max != null && pc.pricePerSqft != null
    ? { lo: Math.min(pc.min, pc.pricePerSqft), hi: Math.max(pc.max, pc.pricePerSqft) } : null
  const pos = (v: number) => (range ? ((v - range.lo) / Math.max(1, range.hi - range.lo)) * 100 : 0)

  return (
    <Section id="price" title={t('section.price')}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><p className="text-xs text-muted-foreground">{t('price.asking')}</p><p className="text-xl font-semibold">{inrShort(p.price)}</p></div>
        <div><p className="text-xs text-muted-foreground">{t('price.perSqft')}</p><p className="text-xl font-semibold">{pc.pricePerSqft ? inr(pc.pricePerSqft) : ''}</p></div>
        <div>
          <p className="text-xs text-muted-foreground">{t('price.allIn', { pct: pc.buyerCostsPct })}</p>
          <p className="text-xl font-semibold">~{inrShort(pc.allIn)}</p>
        </div>
      </div>

      {range && pc.position ? (
        <div className="mt-5">
          <p className="mb-6 text-sm">{t(`price.position.${pc.position}`, { count: pc.count })}</p>
          <div className="relative h-2 rounded-full bg-muted">
            <span className="absolute inset-y-0 rounded-full bg-primary/25" style={{ left: `${pos(pc.min!)}%`, right: `${100 - pos(pc.max!)}%` }} />
            <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow" style={{ left: `${pos(pc.pricePerSqft!)}%` }} />
            {/* keep the label inside the bar at either end */}
            <span className={cn('absolute -top-6 text-xs font-medium whitespace-nowrap',
              pos(pc.pricePerSqft!) < 15 ? 'translate-x-[-0.5rem]' : pos(pc.pricePerSqft!) > 85 ? 'translate-x-[calc(-100%+0.5rem)]' : '-translate-x-1/2')}
              style={{ left: `${pos(pc.pricePerSqft!)}%` }}>{t('price.this')}</span>
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{inr(range.lo)}</span><span>{inr(range.hi)}{t('price.perSqftShort')}</span></div>
          <ul className="mt-4 flex flex-col divide-y text-sm">
            {p.comparables.map((c) => (
              <li key={c.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[1fr_auto_7rem_6rem] sm:items-center">
                <span className="min-w-0">
                  {c.locality} · {num(c.areaSqft)} sq.ft.
                  <span className="block text-xs text-muted-foreground">{c.differences}</span>
                </span>
                <span className="text-right font-medium sm:order-3">{inr(c.pricePerSqft)}{t('price.perSqftShort')}</span>
                <span className="sm:order-2"><Badge variant="outline">{t(`price.kind.${c.kind}`)}</Badge></span>
                <span className="text-right text-xs text-muted-foreground sm:order-4">{fmtDate(c.date, i18n.language)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{t('price.noComparables')}</p>
      )}
    </Section>
  )
}

/* ---------- History ---------- */

export function HistorySection({ p }: { p: Property }) {
  const { t, i18n } = useTranslation()
  const { db } = useStore()
  return (
    <Section id="history" title={t('section.history')}>
      <ol className="relative flex flex-col gap-3 border-l pl-4">
        {p.history.map((h) => (
          <li key={h.id} className="text-sm">
            <span className="absolute -left-1 mt-1.5 size-2 rounded-full bg-muted-foreground/50" aria-hidden />
            <p>{h.text}</p>
            <p className="text-xs text-muted-foreground">{userName(db, h.by) || t('history.you')} · {fmtDate(h.at, i18n.language)}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
