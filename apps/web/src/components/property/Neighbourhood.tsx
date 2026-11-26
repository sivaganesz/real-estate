import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, ChevronDown, CircleAlert, ExternalLink, Eye, MapPin, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { PLACE_CATEGORIES, PLACE_CATEGORY_LABEL, PLACE_KINDS, PLACE_KIND_CATEGORY, PLACE_KIND_LABEL, estimateMinutes, mapPoint, type NearbyPlace, type PlaceCategory, type PlaceKind } from '@estate/shared';
import { api } from '../../lib/api';
import type { Property } from '../../lib/property';
import { Button, ErrorNote, Field, Input, Modal, Select } from '../ui';
import { Popover } from '../Popover';
import { useToast } from '../toast';
import { useConfirm } from '../confirm';
import { CATEGORY_ICON, KIND_ICON } from './placeIcons';

const googleMaps = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const km = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} km`;

type View = 'team' | 'customer';
type Editing = { place?: NearbyPlace } | null;

/**
 * The places around a property, by what buyers ask about (commute, schools,
 * hospitals, shopping), on a list and a to-scale sketch. Team view shows the
 * checks and lets editors manage the list; customer view shows what buyers see.
 */
export function Neighbourhood({ p, canEdit, open, onClose, onChangeLocation }: { p: Property; canEdit: boolean; open: boolean; onClose: () => void; onChangeLocation: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState<View>('team');
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const point = mapPoint(p);
  const places = (view === 'customer' ? p.nearby.filter((n) => n.advertise) : p.nearby).slice().sort((a, b) => a.distanceKm - b.distanceKm);
  const advertised = p.nearby.filter((n) => n.advertise).length;
  const manage = canEdit && view === 'team';
  const road = [p.details.roadSurface, p.details.roadWidth ? `${p.details.roadWidth} ft road` : null].filter(Boolean).join(', ');

  const discover = useMutation({
    mutationFn: () => api.post<{ added: number; approximate: boolean }>(`/properties/${p.id}/nearby/discover`),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['property', p.id] });
      toast(r.added ? `Found ${r.added} place${r.added === 1 ? '' : 's'} on OpenStreetMap. Check them before advertising.` : 'No new places found nearby');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Explore the neighbourhood" wide="xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-rose-600" />
            <span className="font-semibold text-slate-900">{[p.locality, p.city].filter(Boolean).join(', ') || 'No location yet'}</span>
            {road && <span className="text-slate-500">· {road}</span>}
            {canEdit && (
              <button type="button" onClick={onChangeLocation} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
                <Pencil className="h-3.5 w-3.5" /> Change location
              </button>
            )}
          </p>
          <div className="inline-flex rounded-xl border border-slate-200 p-0.5" role="group" aria-label="Whose view">
            {(['team', 'customer'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={clsx('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition', view === v ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                {v === 'team' ? <Users className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {v === 'team' ? 'Team view' : 'Customer view'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {places.length} place{places.length === 1 ? '' : 's'}
            {view === 'team' && p.nearby.length > 0 && <span className={clsx('font-semibold', advertised ? 'text-emerald-700' : 'text-slate-400')}> · {advertised} OK to advertise</span>}
            {view === 'customer' && <span className="text-slate-400"> · what buyers see on the share page</span>}
          </p>
          {manage && (
            <div className="flex gap-2">
              <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} loading={discover.isPending} disabled={!point} title={point ? 'Look up schools, hospitals, shops and stations on OpenStreetMap' : 'Set the location first'} onClick={() => discover.mutate()}>
                Find more places
              </Button>
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing({})}>
                Add place
              </Button>
            </div>
          )}
        </div>
        <ErrorNote error={discover.error} />
        {discover.isPending && <p className="text-xs text-slate-500" role="status">Looking up schools, hospitals, shops and stations on OpenStreetMap. This can take up to a minute.</p>}
        {point && point.level !== 'exact' && view === 'team' && (
          <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <CircleAlert className="h-3.5 w-3.5 shrink-0" /> Distances are measured from the centre of {point.level === 'locality' ? p.locality : p.city}. Set the exact spot for accurate distances.
          </p>
        )}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,360px)_1fr]">
          <div className="order-2 rounded-2xl border border-slate-200 bg-white lg:order-none">
            {editing ? (
              <PlaceForm p={p} place={editing.place} onDone={() => setEditing(null)} />
            ) : (
              <PlaceList p={p} places={places} view={view} manage={manage} active={active} onActive={setActive} onEdit={(place) => setEditing({ place })} />
            )}
          </div>
          <Sketch p={p} places={places} active={active} onActive={setActive} />
        </div>
      </div>
    </Modal>
  );
}

function PlaceList({ p, places, view, manage, active, onActive, onEdit }: { p: Property; places: NearbyPlace[]; view: View; manage: boolean; active: string | null; onActive: (id: string | null) => void; onEdit: (place: NearbyPlace) => void }) {
  const groups = PLACE_CATEGORIES.map((c) => ({ c, items: places.filter((n) => PLACE_KIND_CATEGORY[n.kind] === c) })).filter((g) => g.items.length > 0);
  // The first group starts open; the rest open on a click.
  const [open, setOpen] = useState<Set<PlaceCategory>>(() => new Set(groups.slice(0, 1).map((g) => g.c)));
  const toggle = (c: PlaceCategory) => setOpen((s) => (s.has(c) ? new Set([...s].filter((x) => x !== c)) : new Set([...s, c])));

  if (!groups.length) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        {view === 'customer' ? 'No places are marked OK to advertise yet.' : manage ? 'No places yet. “Find more places” looks them up on OpenStreetMap, or add one by hand.' : 'The team hasn’t added nearby places yet.'}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {groups.map(({ c, items }) => {
        const Icon = CATEGORY_ICON[c];
        const isOpen = open.has(c);
        return (
          <li key={c}>
            <button type="button" onClick={() => toggle(c)} aria-expanded={isOpen} className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50">
              <Icon className="h-4 w-4 text-slate-600" />
              <span className="flex-1 text-sm font-medium text-slate-900">{PLACE_CATEGORY_LABEL[c]}</span>
              <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">{items.length}</span>
              <ChevronDown className={clsx('h-4 w-4 text-slate-400 transition', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <ul className="pb-2">
                {items.map((n) => (
                  <PlaceRow key={n.id} p={p} n={n} view={view} manage={manage} active={active === n.id} onActive={onActive} onEdit={() => onEdit(n)} />
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PlaceRow({ p, n, view, manage, active, onActive, onEdit }: { p: Property; n: NearbyPlace; view: View; manage: boolean; active: boolean; onActive: (id: string | null) => void; onEdit: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const Icon = KIND_ICON[n.kind];
  const done = () => void qc.invalidateQueries({ queryKey: ['property', p.id] });
  const patch = useMutation({ mutationFn: (body: Partial<NearbyPlace>) => api.patch(`/properties/${p.id}/nearby/${n.id}`, body), onSuccess: done, onError: (e) => toast(e instanceof Error ? e.message : 'Could not save', 'error') });
  const remove = useMutation({
    mutationFn: () => api.del(`/properties/${p.id}/nearby/${n.id}`),
    onSuccess: () => {
      done();
      toast(`Removed ${n.name}`);
    },
  });
  return (
    <li onMouseEnter={() => onActive(n.id)} onMouseLeave={() => onActive(null)} className={clsx('flex items-start gap-3 px-4 py-2 transition', active && 'bg-brand-50/60')}>
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{n.name}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
          {km(n.distanceKm)} · {n.minutes} min
          {view === 'team' &&
            (n.routeChecked ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-700">
                · <Check className="h-3 w-3" /> Route checked
              </span>
            ) : (
              <span className="text-amber-700">· Route not checked</span>
            ))}
        </p>
        {view === 'team' && <p className={clsx('text-[11px]', n.advertise ? 'text-emerald-700' : 'text-slate-400')}>{n.advertise ? 'OK to advertise' : 'Not shown to buyers'}{n.source === 'osm' ? ' · from OpenStreetMap' : ''}</p>}
      </div>
      {manage && (
        <Popover
          label={`Actions for ${n.name}`}
          align="right"
          className="w-56 p-1.5"
          buttonClass={(o) => clsx('rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700', o && 'bg-slate-100')}
          trigger={() => (
            <>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions for {n.name}</span>
            </>
          )}
        >
          {(close) => (
            <div>
              <Item onClick={() => (close(), patch.mutate({ routeChecked: !n.routeChecked }))}>{n.routeChecked ? 'Mark route not checked' : 'Mark route checked'}</Item>
              <Item onClick={() => (close(), patch.mutate({ advertise: !n.advertise }))}>{n.advertise ? 'Stop showing to buyers' : 'OK to advertise'}</Item>
              <Item onClick={() => (close(), onEdit())}>Edit</Item>
              <Item
                danger
                onClick={async () => {
                  close();
                  if (await ask({ title: `Remove ${n.name}?`, body: 'It disappears from this property’s nearby places and from the share page.', confirmLabel: 'Remove', danger: true })) remove.mutate();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Item>
            </div>
          )}
        </Popover>
      )}
    </li>
  );
}

function Item({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={clsx('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50', danger ? 'text-rose-600' : 'text-slate-700')}>
      {children}
    </button>
  );
}

/** Add or edit one place. Minutes are estimated from the distance unless the team types them. */
function PlaceForm({ p, place, onDone }: { p: Property; place?: NearbyPlace; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(place?.name ?? '');
  const [kind, setKind] = useState<PlaceKind>(place?.kind ?? 'bus');
  const [dist, setDist] = useState(place ? String(place.distanceKm) : '');
  const [mins, setMins] = useState(place ? String(place.minutes) : '');
  const [routeChecked, setRouteChecked] = useState(place?.routeChecked ?? false);
  const [advertise, setAdvertise] = useState(place?.advertise ?? false);
  const distance = Number(dist);
  const valid = name.trim().length >= 2 && dist.trim() !== '' && Number.isFinite(distance) && distance >= 0;
  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), kind, distanceKm: distance, minutes: mins.trim() === '' ? null : Math.round(Number(mins)), routeChecked, advertise };
      return place ? api.patch(`/properties/${p.id}/nearby/${place.id}`, body) : api.post(`/properties/${p.id}/nearby`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['property', p.id] });
      toast(place ? 'Place saved' : `Added ${name.trim()}`);
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !save.isPending) save.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <p className="text-sm font-semibold text-slate-900">{place ? `Edit ${place.name}` : 'Add a place'}</p>
      <Field label="Name">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tambaram railway station" />
      </Field>
      <Field label="Type">
        <Select value={kind} onChange={(e) => setKind(e.target.value as PlaceKind)}>
          {PLACE_CATEGORIES.map((c) => (
            <optgroup key={c} label={PLACE_CATEGORY_LABEL[c]}>
              {PLACE_KINDS.filter((k) => PLACE_KIND_CATEGORY[k] === c).map((k) => (
                <option key={k} value={k}>
                  {PLACE_KIND_LABEL[k]}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Distance (km)">
          <Input inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} placeholder="e.g. 1.2" />
        </Field>
        <Field label="Drive time (min)" hint={!mins && valid ? `Leave empty for about ${estimateMinutes(distance)} min` : undefined}>
          <Input inputMode="numeric" value={mins} onChange={(e) => setMins(e.target.value)} placeholder="Estimated" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={routeChecked} onChange={(e) => setRouteChecked(e.target.checked)} /> Someone has checked the route
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={advertise} onChange={(e) => setAdvertise(e.target.checked)} /> OK to show to buyers
      </label>
      <ErrorNote error={save.error} />
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!valid} loading={save.isPending}>
          {place ? 'Save' : 'Add place'}
        </Button>
      </div>
    </form>
  );
}

/** A to-scale sketch: the property in the middle, rings every kilometre, each place at its distance and direction. */
function Sketch({ p, places, active, onActive }: { p: Property; places: NearbyPlace[]; active: string | null; onActive: (id: string | null) => void }) {
  const point = mapPoint(p);
  // The outer ring is the farthest place, rounded up (1–8 km), so close places don't bunch in the middle.
  const far = Math.max(1, Math.min(8, Math.ceil(Math.max(0, ...places.map((n) => n.distanceKm)))));
  const rings = Array.from({ length: far }, (_, i) => i + 1);
  const R = 46; // % of the box from the centre to the outer ring
  const spots = layout(places, point, far, R);
  return (
    <div className="relative order-1 h-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-emerald-50/50 sm:h-[440px] lg:order-none">
      <div className="absolute left-1/2 top-1/2 aspect-square h-[92%] -translate-x-1/2 -translate-y-1/2">
        {rings.map((k) => (
          <div key={k} className="absolute rounded-full border border-dashed border-brand-300/70" style={{ inset: `${50 - (k / far) * R}%` }} aria-hidden>
            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded bg-emerald-50 px-1 text-[10px] text-slate-500">{k} km</span>
          </div>
        ))}
        <MapPin className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-full fill-rose-100 text-rose-600" aria-label={p.title} />
        {places.map((n) => {
          const Icon = KIND_ICON[n.kind];
          return (
            <button
              key={n.id}
              type="button"
              onMouseEnter={() => onActive(n.id)}
              onMouseLeave={() => onActive(null)}
              onFocus={() => onActive(n.id)}
              onBlur={() => onActive(null)}
              title={`${n.name} · ${km(n.distanceKm)}`}
              aria-label={`${n.name}, ${km(n.distanceKm)}`}
              className={clsx('absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200 transition', active === n.id && 'z-10 scale-125 text-brand-700 ring-2 ring-brand-500')}
              style={{ left: `${spots.get(n.id)!.x}%`, top: `${spots.get(n.id)!.y}%` }}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
      <p className="absolute bottom-2 left-3 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-500">
        Sketch, distances to scale (approx.){places.some((n) => n.source === 'osm') ? ' · Places © OpenStreetMap contributors' : ''}
      </p>
      {point && (
        <a href={googleMaps(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-700 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-brand-800">
          View on Google Maps <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

/**
 * Where each pin goes, in % of the square: its real direction (or a steady one
 * from its name) at its distance. Pins that would overlap are pushed apart a
 * little, so every one stays clickable; the sketch is labelled approximate.
 */
function layout(places: NearbyPlace[], point: { lat: number; lng: number } | null, far: number, R: number) {
  const pts = places.map((n) => {
    let angle: number;
    if (point && n.lat != null && n.lng != null && (n.lat !== point.lat || n.lng !== point.lng)) angle = Math.atan2(-(n.lat - point.lat), (n.lng - point.lng) * Math.cos((point.lat * Math.PI) / 180));
    else angle = ([...n.name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 3600, 7) / 3600) * 2 * Math.PI;
    const r = (Math.min(n.distanceKm, far) / far) * R;
    return { id: n.id, x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle) };
  });
  const MIN = 9; // a pin is about 9% of the sketch wide
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy);
        if (d >= MIN) continue;
        // Same spot: separate sideways; otherwise along the line between them.
        const [ux, uy] = d > 0.01 ? [dx / d, dy / d] : [Math.cos(j), Math.sin(j)];
        const push = (MIN - d) / 2;
        pts[i].x -= ux * push;
        pts[i].y -= uy * push;
        pts[j].x += ux * push;
        pts[j].y += uy * push;
        moved = true;
      }
    }
    // Keep every pin off the property marker (drawn just above the centre), and inside the box.
    const MX = 50;
    const MY = 46;
    const CLEAR = MIN + 2;
    for (const q of pts) {
      const d = Math.hypot(q.x - MX, q.y - MY);
      if (d < CLEAR) {
        const [ux, uy] = d > 0.01 ? [(q.x - MX) / d, (q.y - MY) / d] : [1, 0];
        q.x = MX + ux * CLEAR;
        q.y = MY + uy * CLEAR;
      }
      q.x = Math.min(96, Math.max(4, q.x));
      q.y = Math.min(96, Math.max(4, q.y));
    }
    if (!moved) break;
  }
  return new Map(pts.map((q) => [q.id, q]));
}
