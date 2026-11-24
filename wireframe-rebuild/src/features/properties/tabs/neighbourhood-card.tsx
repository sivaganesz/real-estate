/**
 * Explore the neighbourhood — one card for the whole location, as in spec-system-wireframe (neighbourhoodCard):
 * the map with the property and the places around it, the places grouped by kind, whether each may be advertised,
 * and what the customer will see. Google is simulated: "Set / Change location" = Places Autocomplete + geocoding,
 * "Find more places" = Nearby Search + route distances. The map is a schematic preview (distances to scale, approx.).
 */
import { useState, type FormEvent } from 'react'
import {
  Bus, ChevronDown, ChevronUp, Construction, Crosshair, ExternalLink, Eye, GraduationCap, Hospital, Link2, MapPin, Milestone, Pencil, Plane, Plus,
  RefreshCw, School, Search, ShoppingBasket, TrainFront, TrainTrack, type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Segmented } from '@/components/app/segmented'
import { SectionCard } from '@/components/app/section-card'
import { StatusChip } from '@/components/app/status-chip'
import { fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCan, useStore, userName } from '@/store/db'
import type { InfraStatus, NearbyPlace, PlaceCategory, Property } from '@/data/types'

const ICONS: Record<string, LucideIcon> = {
  bus: Bus, 'train-front': TrainFront, 'train-track': TrainTrack, plane: Plane, milestone: Milestone, school: School,
  'graduation-cap': GraduationCap, hospital: Hospital, 'shopping-basket': ShoppingBasket, 'map-pin': MapPin,
}
const GROUPS: PlaceCategory['group'][] = ['commute', 'schools', 'health', 'shop', 'other']
const INFRA: InfraStatus[] = ['existing', 'underConstruction', 'planned', 'proposed']
const ROUTE_HOW = ['driven', 'walked', 'bus'] as const

/** A stable number from text: where a place sits around the property on the map, and mock suggestions. */
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7)
/** Distance → radius in % of the map's width: 1 / 3 / 10 km rings on a log scale, as in the current wireframe. */
const radius = (km: number) => Math.min(40, 6 + Math.log10(1 + (km || 0) * 3) * 18)

export function NeighbourhoodCard({ p }: { p: Property }) {
  const { t, i18n } = useTranslation()
  const { db, user, today, updateProperty } = useStore()
  const can = useCan()
  const manager = can('property.manage')
  const [view, setView] = useState<'team' | 'customer'>('team')
  const [sel, setSel] = useState<string | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'locate' | 'more' | 'add' | { route: NearbyPlace }>(null)
  const cust = view === 'customer'
  const exact = p.location.exact
  const editable = !p.archived

  const cat = (id: string) => db.settings.placeCategories.find((c) => c.id === id)
  const catName = (id: string) => t(`place.${id}`, { defaultValue: cat(id)?.name ?? id })
  const needsCheck = (x: NearbyPlace) => cat(x.categoryId)?.routeCheck !== false
  const ok = (x: NearbyPlace) => x.status === 'existing' && (x.routeChecked || !needsCheck(x))
  const trust = (x: NearbyPlace): { text: string; tone: 'success' | 'warning' | 'neutral' } =>
    x.status !== 'existing' ? { text: t('nb.notAdvertised', { status: t(`infra.${x.status}`) }), tone: 'neutral' }
      : x.routeChecked ? { text: t('nb.routeChecked'), tone: 'success' }
        : !needsCheck(x) ? { text: t('nb.okToAdvertise'), tone: 'success' }
          : { text: x.source === 'google' ? t('nb.fromGoogle') : t('nb.routeNotChecked'), tone: 'warning' }
  const km = (x: NearbyPlace) => {
    const approx = !exact || (cust && !x.routeChecked)
    return `${approx ? '~' : ''}${x.distanceKm} km${x.durationMin ? ` · ${approx ? '~' : ''}${x.durationMin} ${t('location.min')}` : ''}`
  }

  const byKm = (a: NearbyPlace, b: NearbyPlace) => a.distanceKm - b.distanceKm
  const shown = cust ? p.location.nearby.filter(ok) : p.location.nearby
  const groups = GROUPS.map((g) => ({ key: g as string, items: shown.filter((x) => (cat(x.categoryId)?.group ?? 'other') === g).sort(byKm) })).filter((g) => g.items.length)
  if (cust) {
    const future = p.location.nearby.filter((x) => x.status !== 'existing').sort(byKm)
    if (future.length) groups.push({ key: 'future', items: future })
  }
  const all = groups.flatMap((g) => g.items)
  const selGroup = groups.find((g) => g.items.some((x) => x.id === sel))?.key
  const open = selGroup ?? (openGroup && groups.some((g) => g.key === openGroup) ? openGroup : groups[0]?.key)
  const okN = p.location.nearby.filter(ok).length
  const waitN = p.location.nearby.filter((x) => x.status === 'existing' && !x.routeChecked && needsCheck(x)).length
  const selected = all.find((x) => x.id === sel)
  const road = [p.location.roadType, p.location.roadWidthFt ? t('nb.roadFt', { ft: p.location.roadWidthFt }) : ''].filter(Boolean).join(', ')
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${p.location.locality}, ${p.location.city}`)}`

  const save = (id: string, change: (x: NearbyPlace) => void, text: string) => updateProperty(p.id, (prop) => { const x = prop.location.nearby.find((n) => n.id === id); if (x) change(x) }, text)
  const setExact = (how: 'gps' | 'link' | 'search') => {
    updateProperty(p.id, (x) => { x.location.exact = true }, t(`history.exactLocation.${how}`))
    setDialog(null)
    toast.success(t('location.exactSet'), { description: t('location.exactSetHint') })
  }

  return (
    <SectionCard id="location" title={t('nb.title')}
      action={<Segmented variant="pill" label={t('nb.title')} value={view} onChange={(v) => { setView(v); setEditing(null) }}
        segments={[{ value: 'team', label: t('location.teamView') }, { value: 'customer', label: t('location.customerView'), icon: <Eye /> }]} />}>
      {/* address line and actions */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1"><MapPin className="size-4 text-danger" /> <b>{p.location.locality}, {p.location.city}</b>{road && <span className="text-muted-foreground">· {road}</span>}</span>
        {!exact && <StatusChip tone="warning">{t('nb.approximate')}</StatusChip>}
        {!cust && manager && editable && (exact
          ? <button type="button" onClick={() => setDialog('locate')} className="inline-flex items-center gap-1 text-primary hover:underline"><Pencil className="size-3.5" /> {t('nb.changeLocation')}</button>
          : <Button size="sm" variant="outline" onClick={() => setDialog('locate')}><Crosshair /> {t('location.setExact')}</Button>)}
        {!cust && editable && (
          <span className="flex gap-2 sm:ml-auto">
            <Button size="sm" variant="outline" onClick={() => setDialog('more')}><RefreshCw /> {t('location.findMore')}</Button>
            <Button size="sm" variant="outline" onClick={() => setDialog('add')}><Plus /> {t('location.addPlace')}</Button>
          </span>
        )}
      </div>
      <p className="mt-2 mb-3 text-sm">
        {cust ? <>{t('nb.customerSub')}{waitN > 0 && <span className="text-muted-foreground"> {t('nb.hidden', { count: waitN })}</span>}</>
          : <>{t('nb.placesCount', { count: p.location.nearby.length })} · <b className="text-success">{t('nb.okCount', { count: okN })}</b>{waitN > 0 && <> · <span className="text-warning">{t('nb.waiting', { count: waitN })}</span></>}</>}
      </p>

      {/* the map, with the list of places over it (below it on a phone) */}
      <div className="relative overflow-hidden rounded-xl border md:h-[360px]">
        <div className="relative h-64 overflow-hidden bg-[color-mix(in_oklch,var(--success-soft)_55%,var(--card))] [--cx:50%] md:absolute md:inset-0 md:h-auto md:[--cx:64%]"
          style={{ containerType: 'size' }} aria-label={t('nb.mapLabel')} role="img">
          <span className="absolute top-[18%] left-[8%] h-[30%] w-[22%] rounded-[40%_60%_50%_45%] bg-success-soft opacity-80" aria-hidden />
          <span className="absolute right-[10%] bottom-[14%] h-[22%] w-[16%] rounded-[55%_45%_60%_40%] bg-info-soft opacity-90" aria-hidden />
          {[1, 3, 10].map((k) => (
            <span key={k} aria-hidden className="absolute top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed border-primary/30"
              style={{ left: 'var(--cx)', width: `${radius(k) * 2}cqw` }}>
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full rounded bg-card/80 px-1 text-micro text-muted-foreground">{k} km</span>
            </span>
          ))}
          {exact
            ? <MapPin className="absolute top-1/2 size-8 -translate-x-1/2 -translate-y-full fill-danger/20 text-danger" style={{ left: 'var(--cx)' }} aria-hidden />
            : <span className="absolute top-1/2 flex size-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-dashed border-primary/60 bg-primary/10 text-xs text-primary" style={{ left: 'var(--cx)' }}>{p.location.locality}</span>}
          {all.map((x) => {
            const a = (hash(x.name) % 360) * (Math.PI / 180)
            const d = radius(x.distanceKm)
            const Icon = ICONS[cat(x.categoryId)?.icon ?? 'map-pin'] ?? MapPin
            return (
              <button key={x.id} type="button" onClick={() => setSel(x.id === sel ? null : x.id)} title={`${x.name} · ${x.distanceKm} km`} aria-label={x.name}
                className={cn('absolute z-[2] flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card bg-card shadow-md',
                  sel === x.id && 'z-[3] scale-110 border-primary', x.status !== 'existing' && 'border-dashed border-warning')}
                style={{ left: `clamp(18px, calc(var(--cx) + ${(d * Math.cos(a)).toFixed(1)}cqw), calc(100% - 18px))`, top: `clamp(18px, calc(50% + ${(d * Math.sin(a)).toFixed(1)}cqw), calc(100% - 18px))` }}>
                <Icon className="size-4" />
              </button>
            )
          })}
          {selected && <span className="absolute top-3 right-3 z-[4] max-w-[60%] truncate rounded-md bg-card px-2 py-1 text-xs shadow">{selected.name} · {km(selected)}</span>}
          <span className="absolute bottom-3 left-[var(--cx)] z-[4] -translate-x-1/2 rounded bg-card/85 px-2 py-0.5 text-caption whitespace-nowrap text-muted-foreground max-md:hidden">
            {exact ? t('nb.mapNote') : t('nb.mapNoteApprox')}
          </span>
          <Button size="sm" asChild className="absolute right-3 bottom-3 z-[4]">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">{t('nb.viewOnMaps')} <ExternalLink /></a>
          </Button>
        </div>

        <div className="z-[6] overflow-y-auto bg-card p-1.5 md:absolute md:top-3 md:bottom-3 md:left-3 md:w-[300px] md:rounded-xl md:shadow-lg">
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
              {cust ? <><p>{t('nb.nothingToAdvertise')}</p><p className="text-xs">{t('nb.nothingHint')}</p></>
                : <><p>{t('location.noPlaces')}</p>{editable && <Button size="sm" variant="outline" onClick={() => setDialog('more')}><RefreshCw /> {t('nb.findPlaces')}</Button>}</>}
            </div>
          ) : groups.map((g) => {
            const isOpen = g.key === open
            return (
              <div key={g.key} className="border-b last:border-b-0">
                <button type="button" onClick={() => { setOpenGroup(g.key); if (selGroup !== g.key) setSel(null) }} aria-expanded={isOpen}
                  className="flex w-full items-center gap-2 px-2.5 py-2.5 text-left text-sm font-medium hover:bg-muted/60">
                  {g.key === 'future' ? <Construction className="size-4" /> : <GroupIcon group={g.key} />}
                  <span className="flex-1">{t(`nb.group.${g.key}`)}</span>
                  <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{g.items.length}</span>
                  {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <ul className="pb-1.5">
                    {g.items.map((x) => {
                      const tr = trust(x)
                      const on = sel === x.id
                      const Icon = ICONS[cat(x.categoryId)?.icon ?? 'map-pin'] ?? MapPin
                      return (
                        <li key={x.id} className={cn('rounded-lg', on && 'bg-accent/60')}>
                          <button type="button" onClick={() => { setSel(on ? null : x.id); setEditing(null) }} aria-expanded={on}
                            className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted/60">
                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted"><Icon className="size-3.5" /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{x.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                {km(x)}{cust ? (x.status !== 'existing' ? ` · ${t(`infra.${x.status}`)}` : '') : <> · <em className={cn('not-italic', tr.tone === 'success' ? 'text-success' : tr.tone === 'warning' ? 'text-warning' : '')}>{tr.text}</em></>}
                              </span>
                            </span>
                          </button>
                          {on && !cust && (editing === x.id
                            ? <PlaceEditor place={x} catName={catName} onDone={(patch) => { save(x.id, (y) => Object.assign(y, patch), t('history.placeEdited', { place: patch.name ?? x.name })); setEditing(null) }} />
                            : (
                              <div className="flex flex-col gap-1 px-2.5 pb-2.5 pl-12 text-xs text-muted-foreground">
                                <span>{x.source === 'google' ? t('nb.srcGoogle') : t('nb.srcUser', { who: x.added ? userName(db, x.added.by) : t('nb.theTeam') })}{x.added ? ` · ${fmtDate(x.added.at, i18n.language)}` : ''}</span>
                                {x.routeChecked && <span className="text-success">✓ {x.routeCheckedBy ? t('nb.checkedBy', { who: userName(db, x.routeCheckedBy) }) : t('nb.routeChecked').replace(/^✓ /, '')}{x.routeCheckedAt ? ` · ${fmtDate(x.routeCheckedAt, i18n.language)}` : ''}{x.routeCheckHow ? ` — ${t(`location.how.${x.routeCheckHow}`)}` : ''}</span>}
                                {x.status !== 'existing' && <span>{t('nb.neverExisting', { status: t(`infra.${x.status}`) })}</span>}
                                {x.status === 'existing' && !needsCheck(x) && !x.routeChecked && <span>{t('nb.noCheckNeeded', { cat: catName(x.categoryId).toLowerCase() })}</span>}
                                {x.status === 'existing' && needsCheck(x) && !x.routeChecked && !exact && <span className="text-warning">{t('nb.exactFirst')}</span>}
                                {editable && (
                                  <span className="mt-1 flex flex-wrap gap-1.5">
                                    {x.status === 'existing' && needsCheck(x) && !x.routeChecked && exact && <Button size="xs" onClick={() => setDialog({ route: x })}>{t('nb.markChecked')}</Button>}
                                    {x.routeChecked && <Button size="xs" variant="outline" onClick={() => save(x.id, (y) => { y.routeChecked = false; y.routeCheckedBy = undefined; y.routeCheckedAt = undefined; y.routeCheckHow = undefined }, t('history.routeUnchecked', { place: x.name }))}>{t('nb.undoCheck')}</Button>}
                                    <Button size="xs" variant="outline" onClick={() => setEditing(x.id)}><Pencil /> {t('action.edit')}</Button>
                                    <Button size="xs" variant="ghost" className="text-danger" onClick={() => { updateProperty(p.id, (prop) => { prop.location.nearby = prop.location.nearby.filter((n) => n.id !== x.id) }, t('history.placeRemoved', { place: x.name })); setSel(null) }}>{t('nb.remove')}</Button>
                                  </span>
                                )}
                              </div>
                            ))}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* set / change the exact location */}
      <Dialog open={dialog === 'locate'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{exact ? t('nb.changeLocation') : t('location.setExact')}</DialogTitle><DialogDescription>{t('location.setExactHint')}</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-2">
            <Button size="lg" variant="outline" className="justify-start" onClick={() => setExact('gps')}><Crosshair /> {t('location.useGps')}</Button>
            <Button size="lg" variant="outline" className="justify-start" onClick={() => setExact('link')}><Link2 /> {t('location.pasteLink')}</Button>
            <Button size="lg" variant="outline" className="justify-start" onClick={() => setExact('search')}><Search /> {t('location.searchMap')}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {dialog === 'more' && <FindMoreDialog p={p} catName={catName} onClose={() => setDialog(null)} />}
      {dialog === 'add' && <AddPlaceDialog p={p} catName={catName} onClose={() => setDialog(null)} />}
      {dialog && typeof dialog === 'object' && (
        <RouteDialog place={dialog.route} onClose={() => setDialog(null)} onSave={(how, d) => {
          save(dialog.route.id, (y) => { y.routeChecked = true; y.routeCheckedBy = user.id; y.routeCheckedAt = today; y.routeCheckHow = how; y.distanceKm = d; y.durationMin = Math.round(d * 2.6 + 3) },
            t('history.routeCheckedHow', { place: dialog.route.name, how: t(`location.how.${how}`), km: d }))
          toast.success(t('location.routeCheckedToast', { place: dialog.route.name }))
          setDialog(null)
        }} />
      )}
    </SectionCard>
  )
}

function GroupIcon({ group }: { group: string }) {
  const Icon = { commute: Bus, schools: GraduationCap, health: Hospital, shop: ShoppingBasket, other: MapPin }[group] ?? MapPin
  return <Icon className="size-4" />
}

/** Edit a place in the list: name, category, status, distance and time. */
function PlaceEditor({ place, catName, onDone }: { place: NearbyPlace; catName: (id: string) => string; onDone: (patch: Partial<NearbyPlace>) => void }) {
  const { t } = useTranslation()
  const { db } = useStore()
  const [v, setV] = useState({ name: place.name, categoryId: place.categoryId, status: place.status, distanceKm: String(place.distanceKm), durationMin: String(place.durationMin) })
  return (
    <form className="grid gap-2 px-2.5 pb-2.5" onSubmit={(e) => { e.preventDefault(); onDone({ name: v.name.trim() || place.name, categoryId: v.categoryId, status: v.status, distanceKm: Number(v.distanceKm) || place.distanceKm, durationMin: Number(v.durationMin) || place.durationMin }) }}>
      <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label={t('location.placeName')} className="h-8" />
      <div className="grid grid-cols-2 gap-2">
        <Select value={v.categoryId} onValueChange={(x) => setV({ ...v, categoryId: x })}>
          <SelectTrigger size="sm" className="w-full" aria-label={t('location.category')}><SelectValue /></SelectTrigger>
          <SelectContent>{db.settings.placeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{catName(c.id)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={v.status} onValueChange={(x) => setV({ ...v, status: x as InfraStatus })}>
          <SelectTrigger size="sm" className="w-full" aria-label={t('location.infraStatus')}><SelectValue /></SelectTrigger>
          <SelectContent>{INFRA.map((s) => <SelectItem key={s} value={s}>{t(`infra.${s}`)}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" min={0} step="0.1" value={v.distanceKm} onChange={(e) => setV({ ...v, distanceKm: e.target.value })} aria-label={t('location.distanceKm')} className="h-8" />
        <Input type="number" min={0} value={v.durationMin} onChange={(e) => setV({ ...v, durationMin: e.target.value })} aria-label={t('nb.timeMin')} className="h-8" />
      </div>
      <Button size="xs" type="submit" className="justify-self-start">{t('action.done')}</Button>
    </form>
  )
}

/** "Find more places": suggestions from Google (simulated) with tick boxes — the team keeps the ones that matter. */
function FindMoreDialog({ p, onClose, catName }: { p: Property; onClose: () => void; catName: (id: string) => string }) {
  const { t } = useTranslation()
  const { db, user, today, updateProperty } = useStore()
  const have = new Set(p.location.nearby.map((n) => n.categoryId))
  const suggestions: NearbyPlace[] = db.settings.placeCategories
    .filter((c) => c.id !== 'other' && !have.has(c.id))
    .slice(0, 6)
    .map((c) => {
      const d = Math.round((0.4 + (hash(p.id + c.id) % 60) / 10) * 10) / 10
      return { id: `nb-${p.id}-${c.id}`, categoryId: c.id, name: `${p.location.locality} ${c.name.toLowerCase()} (sample)`, distanceKm: d, durationMin: Math.round(d * 2.6 + 3), status: 'existing', routeChecked: false, source: 'google', added: { by: user.id, at: today } }
    })
  const [keep, setKeep] = useState<Set<string>>(() => new Set(suggestions.map((s) => s.id)))
  const save = () => {
    const chosen = suggestions.filter((s) => keep.has(s.id))
    if (chosen.length) updateProperty(p.id, (x) => { x.location.nearby.push(...chosen) }, t('history.placesAdded', { count: chosen.length }))
    toast.success(t('location.placesKept', { count: chosen.length }))
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('location.findMore')}</DialogTitle><DialogDescription>{t('location.findMoreHint')}</DialogDescription></DialogHeader>
        {suggestions.length ? (
          <ul className="flex flex-col gap-1">
            {suggestions.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted">
                  <Checkbox checked={keep.has(s.id)} onCheckedChange={(v) => setKeep((prev) => { const n = new Set(prev); if (v) n.add(s.id); else n.delete(s.id); return n })} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="text-xs text-muted-foreground">{catName(s.categoryId)}</span></span>
                  <span className="text-sm tabular-nums text-muted-foreground">~{s.distanceKm} km</span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{t('location.nothingMore')}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('action.cancel')}</Button>
          <Button onClick={save} disabled={!suggestions.length}>{t('location.keepSelected', { count: keep.size })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Add one place by hand — including one Google doesn't have yet, such as a planned metro station. */
function AddPlaceDialog({ p, onClose, catName }: { p: Property; onClose: () => void; catName: (id: string) => string }) {
  const { t } = useTranslation()
  const { db, user, today, updateProperty } = useStore()
  const [category, setCategory] = useState('school')
  const [name, setName] = useState('')
  const [d, setD] = useState('')
  const [status, setStatus] = useState<InfraStatus>('existing')
  const save = (e: FormEvent) => {
    e.preventDefault()
    const n = Number(d)
    if (!name.trim() || !(n > 0)) return
    const place: NearbyPlace = { id: `nb-${Date.now()}`, categoryId: category, name: name.trim(), distanceKm: n, durationMin: Math.round(n * 2.6 + 3), status, routeChecked: false, source: 'user', added: { by: user.id, at: today } }
    updateProperty(p.id, (x) => { x.location.nearby.push(place) }, t('history.placeAdded', { place: place.name }))
    toast.success(t('location.placeAdded', { place: place.name }))
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader><DialogTitle>{t('location.addPlace')}</DialogTitle><DialogDescription>{t('location.addPlaceHint')}</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label htmlFor="pl-name">{t('location.placeName')}</Label><Input id="pl-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('location.placeNameHint')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>{t('location.category')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full" aria-label={t('location.category')}><SelectValue /></SelectTrigger>
                <SelectContent>{db.settings.placeCategories.map((c) => <SelectItem key={c.id} value={c.id}>{catName(c.id)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label htmlFor="pl-km">{t('location.distanceKm')}</Label><Input id="pl-km" type="number" min={0} step="0.1" value={d} onChange={(e) => setD(e.target.value)} /></div>
          </div>
          <div className="grid gap-1.5"><Label>{t('location.infraStatus')}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as InfraStatus)}>
              <SelectTrigger className="w-full" aria-label={t('location.infraStatus')}><SelectValue /></SelectTrigger>
              <SelectContent>{INFRA.map((s) => <SelectItem key={s} value={s}>{t(`infra.${s}`)}</SelectItem>)}</SelectContent>
            </Select>
            {status !== 'existing' && <p className="text-xs text-warning">{t('location.plannedRule')}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('action.cancel')}</Button>
            <Button type="submit" disabled={!name.trim() || !(Number(d) > 0)}>{t('location.addPlace')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Record a route check: how it was travelled and the measured distance. Who and when are saved. */
function RouteDialog({ place, onClose, onSave }: { place: NearbyPlace; onClose: () => void; onSave: (how: (typeof ROUTE_HOW)[number], km: number) => void }) {
  const { t } = useTranslation()
  const [how, setHow] = useState<(typeof ROUTE_HOW)[number]>('driven')
  const [d, setD] = useState(String(place.distanceKm))
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={(e) => { e.preventDefault(); if (Number(d) > 0) onSave(how, Number(d)) }} className="flex flex-col gap-4">
          <DialogHeader><DialogTitle>{t('location.checkRouteTo', { place: place.name })}</DialogTitle><DialogDescription>{t('location.checkRouteHint')}</DialogDescription></DialogHeader>
          <div className="grid gap-1.5"><Label>{t('location.howChecked')}</Label>
            <Select value={how} onValueChange={(v) => setHow(v as typeof how)}>
              <SelectTrigger className="w-full" aria-label={t('location.howChecked')}><SelectValue /></SelectTrigger>
              <SelectContent>{ROUTE_HOW.map((h) => <SelectItem key={h} value={h}>{t(`location.how.${h}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label htmlFor="rt-km">{t('location.measuredKm')}</Label><Input id="rt-km" type="number" min={0} step="0.1" value={d} onChange={(e) => setD(e.target.value)} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('action.cancel')}</Button>
            <Button type="submit">{t('location.markChecked')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
