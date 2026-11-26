import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowUpRight, Crosshair, MapPin, Maximize2, Navigation, Pencil } from 'lucide-react';
import { mapPoint } from '@estate/shared';
import { api } from '../../lib/api';
import type { Property } from '../../lib/property';
import { Button, Card, ErrorNote, Input, Modal } from '../ui';
import { useToast } from '../toast';
import { Neighbourhood } from './Neighbourhood';

/** How much of the map to show around the point: close for an exact spot, wider for an area. */
const SPAN = { exact: 0.006, locality: 0.025, city: 0.12 } as const;

const googleMaps = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const directions = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/**
 * Reads coordinates from what people usually paste: a Google Maps link
 * ("…/@13.03,80.15,17z", "?q=13.03,80.15", "!3d13.03!4d80.15") or "13.03, 80.15".
 */
export function parseLocation(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  const pairs = [/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/];
  for (const rx of pairs) {
    const m = t.match(rx);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

/** A map of where the property is, with links to Google Maps; managers can set the exact spot. */
export function LocationCard({ p, canEdit, className }: { p: Property; canEdit: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [exploring, setExploring] = useState(false);
  const advertised = p.nearby.filter((n) => n.advertise).length;
  const point = mapPoint(p);
  const address = [p.address, p.locality, p.city, p.pincode].filter(Boolean).join(', ');

  return (
    <Card className={clsx('flex flex-col overflow-hidden rounded-3xl', className)}>
      <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-brand-600" /> Location
            {point && <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-medium', point.level === 'exact' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>{point.level === 'exact' ? 'Exact' : 'Approximate'}</span>}
          </h2>
          <p className="truncate text-xs text-slate-500" title={address}>
            {address || 'No address yet'}
          </p>
          {point && point.level !== 'exact' && <p className="text-[11px] text-amber-700">Pin is the centre of {point.level === 'locality' ? p.locality : p.city}.</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Pencil className="h-3 w-3" /> {p.location ? 'Change' : 'Set exact spot'}
            </button>
          )}
          <button type="button" onClick={() => setExploring(true)} title="Explore the neighbourhood" aria-label="Explore the neighbourhood" className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {point ? (
        <>
          <div className="relative min-h-[260px] flex-1 bg-slate-100">
            <iframe
              title={`Map of ${p.title}`}
              loading="lazy"
              className="absolute inset-0 h-full w-full border-0"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${point.lng - SPAN[point.level]},${point.lat - SPAN[point.level] * 0.7},${point.lng + SPAN[point.level]},${point.lat + SPAN[point.level] * 0.7}&layer=mapnik&marker=${point.lat},${point.lng}`}
            />
          </div>
          <button type="button" onClick={() => setExploring(true)} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 text-left text-xs text-slate-600 hover:bg-slate-50">
            <span>
              {p.nearby.length ? (
                <>
                  <b className="font-semibold text-slate-900">{p.nearby.length}</b> place{p.nearby.length === 1 ? '' : 's'} nearby{canEdit ? ` · ${advertised} OK to advertise` : ''}
                </>
              ) : (
                'Schools, hospitals, shops and transport nearby'
              )}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-brand-700">
              Explore <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </button>
          <div className="flex gap-2 p-3">
            <a href={googleMaps(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-full border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open in Google Maps <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
            <a href={directions(point.lat, point.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-full bg-slate-900 text-xs font-medium text-white hover:bg-slate-800">
              <Navigation className="h-3.5 w-3.5" /> Directions
            </a>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-slate-500">
          <MapPin className="h-6 w-6 text-slate-300" />
          We don't know where this is yet.
          {canEdit && (
            <Button size="sm" onClick={() => setEditing(true)}>
              Set the location
            </Button>
          )}
        </div>
      )}
      {editing && <SetLocation p={p} onClose={() => setEditing(false)} />}
      {exploring && (
        <Neighbourhood
          p={p}
          canEdit={canEdit}
          open
          onClose={() => setExploring(false)}
          onChangeLocation={() => {
            setExploring(false);
            setEditing(true);
          }}
        />
      )}
    </Card>
  );
}

function SetLocation({ p, onClose }: { p: Property; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState(p.location ? `${p.location.lat}, ${p.location.lng}` : '');
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const parsed = parseLocation(text);
  const save = useMutation({
    mutationFn: (location: { lat: number; lng: number } | null) => api.patch(`/properties/${p.id}`, { location }),
    onSuccess: (_r, location) => {
      void qc.invalidateQueries({ queryKey: ['property', p.id] });
      toast(location ? 'Location saved' : 'Exact location removed');
      onClose();
    },
  });
  const short = /maps\.app\.goo\.gl|goo\.gl\/maps/.test(text);

  return (
    <Modal
      open
      onClose={onClose}
      title="Set the exact spot"
      footer={
        <>
          {p.location && (
            <Button variant="ghost" className="mr-auto text-rose-600" loading={save.isPending && save.variables === null} onClick={() => save.mutate(null)}>
              Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!parsed} loading={save.isPending && save.variables !== null} onClick={() => parsed && save.mutate(parsed)}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm text-slate-700">
          Paste a Google Maps link, or the coordinates
          <Input className="mt-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="https://www.google.com/maps/@13.0382,80.1565,17z  or  13.0382, 80.1565" />
        </label>
        {short ? (
          <p className="text-xs text-amber-700">Short links can't be read. Open the link, then copy the full address from the browser, or paste the coordinates.</p>
        ) : text && !parsed ? (
          <p className="text-xs text-amber-700">Couldn't find coordinates in that. In Google Maps, right-click the spot and click the numbers to copy them.</p>
        ) : parsed ? (
          <p className="text-xs text-emerald-700">
            Found {parsed.lat.toFixed(5)}, {parsed.lng.toFixed(5)}.{' '}
            <a href={googleMaps(parsed.lat, parsed.lng)} target="_blank" rel="noopener noreferrer" className="link">
              Check it on the map
            </a>
          </p>
        ) : null}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-100" /> or <span className="h-px flex-1 bg-slate-100" />
        </div>
        <Button
          className="w-full"
          icon={<Crosshair className="h-4 w-4" />}
          loading={locating}
          onClick={() => {
            if (!navigator.geolocation) return setGeoError('This browser can’t share its location.');
            setLocating(true);
            setGeoError('');
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setLocating(false);
                setText(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
              },
              () => {
                setLocating(false);
                setGeoError('Couldn’t get your location. Allow location access, or paste a link instead.');
              },
              { enableHighAccuracy: true, timeout: 10_000 },
            );
          }}
        >
          Use my current location (when you're at the property)
        </Button>
        {geoError && <p className="text-xs text-rose-600">{geoError}</p>}
        <ErrorNote error={save.error} />
      </div>
    </Modal>
  );
}
