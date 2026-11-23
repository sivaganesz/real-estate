import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Plus, Sparkles, X } from 'lucide-react';
import { AMENITIES, AREA_UNITS, AREA_UNIT_LABEL, PROPERTY_TYPES, PROPERTY_TYPE_LABEL, TYPE_DETAILS, propertyReadiness, type AreaUnit, type PropertyType, type Purpose } from '@estate/shared';
import { Field, Input, Select, Textarea } from './ui';
import { usePlaces } from '../lib/property';

export type FormState = {
  type: PropertyType;
  purpose: Purpose;
  title: string;
  price: string;
  priceNegotiable: boolean;
  area: string;
  areaUnit: AreaUnit;
  city: string;
  locality: string;
  address: string;
  pincode: string;
  details: Record<string, string | number | boolean | null>;
  amenities: string[];
  description: string;
  highlights: string[];
  extras: { label: string; value: string; internal?: boolean }[];
  approvals: { name: string; documentUrl?: string | null }[];
};

export const emptyForm = (): FormState => ({
  type: 'apartment',
  purpose: 'sale',
  title: '',
  price: '',
  priceNegotiable: false,
  area: '',
  areaUnit: 'sqft',
  city: '',
  locality: '',
  address: '',
  pincode: '',
  details: {},
  amenities: [],
  description: '',
  highlights: [],
  extras: [],
  approvals: [],
});

export function toPayload(f: FormState) {
  const n = (s: string) => (s.trim() === '' ? null : Number(s.replace(/,/g, '')));
  const details = Object.fromEntries(Object.entries(f.details).filter(([, v]) => v !== '' && v !== null && v !== undefined));
  return {
    type: f.type,
    purpose: f.purpose,
    title: f.title.trim() || undefined,
    price: n(f.price),
    priceNegotiable: f.priceNegotiable,
    area: n(f.area),
    areaUnit: f.areaUnit,
    city: f.city.trim() || null,
    locality: f.locality.trim() || null,
    address: f.address.trim() || null,
    pincode: f.pincode.trim() || null,
    details,
    amenities: f.amenities,
    description: f.description.trim() || null,
    highlights: f.highlights.filter(Boolean),
    extras: f.extras.filter((e) => e.label.trim() && e.value.trim()),
    approvals: f.approvals,
  };
}

export function formReadiness(f: FormState) {
  const p = toPayload(f);
  return propertyReadiness({ ...p, title: p.title ?? 'x' });
}

/**
 * The short form. Fields the AI filled are tinted, and hovering shows the words
 * they came from. Required fields still missing are outlined in amber.
 */
export function PropertyForm({ value, onChange, sources = {}, aiFilled = new Set<string>(), lockType }: { value: FormState; onChange: (f: FormState) => void; sources?: Record<string, string>; aiFilled?: Set<string>; lockType?: boolean }) {
  const places = usePlaces();
  const [more, setMore] = useState(false);
  const f = value;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => onChange({ ...f, [k]: v });
  const setDetail = (k: string, v: string | number | boolean | null) => onChange({ ...f, details: { ...f.details, [k]: v } });
  const missing = new Set(formReadiness(f).missing.map((m) => m.key));
  const fields = TYPE_DETAILS[f.type];

  const wrap = (key: string, label: string, child: ReactNode, className?: string) => (
    <Field
      label={label}
      className={className}
      hint={aiFilled.has(key) && sources[key] ? `From: “${sources[key]}”` : undefined}
    >
      <div className={clsx('relative rounded-xl', aiFilled.has(key) && 'ring-2 ring-ai-200', missing.has(key) && 'ring-2 ring-amber-300')}>
        {child}
        {aiFilled.has(key) && <Sparkles className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-ai-500" />}
      </div>
    </Field>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {wrap(
          'type',
          'Type',
          <Select value={f.type} disabled={lockType} onChange={(e) => onChange({ ...f, type: e.target.value as PropertyType })}>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROPERTY_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>,
        )}
        {wrap(
          'purpose',
          'For',
          <Select value={f.purpose} onChange={(e) => set('purpose', e.target.value as Purpose)}>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
            <option value="lease">Lease</option>
          </Select>,
        )}
      </div>
      {wrap('title', 'Title', <Input value={f.title} placeholder="Suggested from the details if left empty" onChange={(e) => set('title', e.target.value)} />)}
      <div className="grid grid-cols-2 gap-3">
        {wrap('price', f.purpose === 'sale' ? 'Price (₹)' : 'Rent per month (₹)', <Input inputMode="numeric" value={f.price} placeholder="e.g. 6200000" onChange={(e) => set('price', e.target.value)} />)}
        {wrap(
          'area',
          'Area',
          <div className="flex gap-1.5">
            <Input inputMode="decimal" value={f.area} onChange={(e) => set('area', e.target.value)} />
            <Select className="w-24" value={f.areaUnit} onChange={(e) => set('areaUnit', e.target.value as AreaUnit)}>
              {AREA_UNITS.map((u) => (
                <option key={u} value={u}>
                  {AREA_UNIT_LABEL[u]}
                </option>
              ))}
            </Select>
          </div>,
        )}
      </div>
      <label className="-mt-2 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={f.priceNegotiable} onChange={(e) => set('priceNegotiable', e.target.checked)} /> Price is negotiable
      </label>
      {f.price && Number(f.price) > 0 && Number(f.price) < 100000 && f.purpose === 'sale' && <p className="-mt-2 text-xs text-amber-700">That's ₹{Number(f.price).toLocaleString('en-IN')}. Did you mean lakhs?</p>}
      <div className="grid grid-cols-2 gap-3">
        {wrap('city', 'City', <Input list="cities" value={f.city} onChange={(e) => set('city', e.target.value)} />)}
        {wrap('locality', 'Locality', <Input list="localities" value={f.locality} onChange={(e) => set('locality', e.target.value)} />)}
        <datalist id="cities">{places.data?.cities.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="localities">{places.data?.localities.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3">
        <p className="mb-2 text-xs font-medium text-slate-600">{PROPERTY_TYPE_LABEL[f.type]} details</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fields.map((d) => {
            const key = `details.${d.key}`;
            const v = f.details[d.key];
            const label = `${d.label}${d.unit ? ` (${d.unit})` : ''}${d.required ? ' *' : ''}`;
            const input =
              d.kind === 'select' ? (
                <Select value={String(v ?? '')} onChange={(e) => setDetail(d.key, e.target.value || null)}>
                  <option value="">—</option>
                  {d.options!.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              ) : d.kind === 'boolean' ? (
                <Select value={v === true ? 'yes' : v === false ? 'no' : ''} onChange={(e) => setDetail(d.key, e.target.value === '' ? null : e.target.value === 'yes')}>
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              ) : (
                <Input
                  inputMode={d.kind === 'number' ? 'decimal' : undefined}
                  value={v === null || v === undefined ? '' : String(v)}
                  onChange={(e) => setDetail(d.key, d.kind === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                />
              );
            return <div key={d.key}>{wrap(key, label, input)}</div>;
          })}
        </div>
      </div>

      <div>
        <span className="label">Amenities</span>
        <div className="flex flex-wrap gap-1.5">
          {AMENITIES.map((a) => {
            const on = f.amenities.includes(a);
            return (
              <button
                type="button"
                key={a}
                onClick={() => set('amenities', on ? f.amenities.filter((x) => x !== a) : [...f.amenities, a])}
                className={clsx('rounded-full border px-2.5 py-1 text-xs transition', on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:border-slate-300')}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      {!more ? (
        <button type="button" onClick={() => setMore(true)} className="text-sm font-medium text-brand-700 hover:underline">
          + Address, description, approvals and other details
        </button>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {wrap('address', 'Address', <Input value={f.address} onChange={(e) => set('address', e.target.value)} />, 'col-span-2')}
            {wrap('pincode', 'Pincode', <Input inputMode="numeric" maxLength={6} value={f.pincode} onChange={(e) => set('pincode', e.target.value)} />)}
          </div>
          {wrap('description', 'Description', <Textarea value={f.description} onChange={(e) => set('description', e.target.value)} />)}
          <div>
            <span className="label">Approvals claimed</span>
            <div className="flex flex-wrap gap-1.5">
              {['RERA', 'DTCP', 'CMDA', 'Building approval'].map((a) => {
                const on = f.approvals.some((x) => x.name === a);
                return (
                  <button
                    type="button"
                    key={a}
                    onClick={() => set('approvals', on ? f.approvals.filter((x) => x.name !== a) : [...f.approvals, { name: a }])}
                    className={clsx('rounded-full border px-2.5 py-1 text-xs', on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600')}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-400">A claimed approval shows "document pending" until its document is uploaded on the property page.</p>
          </div>
          <div>
            <span className="label">Other details (kept exactly as written)</span>
            <div className="space-y-2">
              {f.extras.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Label" value={e.label} onChange={(ev) => set('extras', f.extras.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} />
                  <Input placeholder="Value" value={e.value} onChange={(ev) => set('extras', f.extras.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))} />
                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500" title="Internal details never reach buyers">
                    <input type="checkbox" checked={!!e.internal} onChange={(ev) => set('extras', f.extras.map((x, j) => (j === i ? { ...x, internal: ev.target.checked } : x)))} /> Internal
                  </label>
                  <button type="button" onClick={() => set('extras', f.extras.filter((_, j) => j !== i))} className="text-slate-400 hover:text-rose-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => set('extras', [...f.extras, { label: '', value: '' }])} className="flex items-center gap-1 text-xs font-medium text-brand-700">
                <Plus className="h-3.5 w-3.5" /> Add a detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function fromProperty(p: {
  type: PropertyType;
  purpose: Purpose;
  title: string;
  price?: number | null;
  priceNegotiable?: boolean;
  area?: number | null;
  areaUnit: AreaUnit;
  city?: string | null;
  locality?: string | null;
  address?: string | null;
  pincode?: string | null;
  details: FormState['details'];
  amenities: string[];
  description?: string | null;
  highlights: string[];
  extras: FormState['extras'];
  approvals: FormState['approvals'];
}): FormState {
  return {
    type: p.type,
    purpose: p.purpose,
    title: p.title ?? '',
    price: p.price ? String(p.price) : '',
    priceNegotiable: !!p.priceNegotiable,
    area: p.area ? String(p.area) : '',
    areaUnit: p.areaUnit ?? 'sqft',
    city: p.city ?? '',
    locality: p.locality ?? '',
    address: p.address ?? '',
    pincode: p.pincode ?? '',
    details: { ...p.details },
    amenities: [...(p.amenities ?? [])],
    description: p.description ?? '',
    highlights: [...(p.highlights ?? [])],
    extras: [...(p.extras ?? [])],
    approvals: (p.approvals ?? []).map((a) => ({ name: a.name, documentUrl: a.documentUrl })),
  };
}
