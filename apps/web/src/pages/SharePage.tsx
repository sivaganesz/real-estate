import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MapPin, ShieldCheck } from 'lucide-react';
import { AREA_UNIT_LABEL, PLACE_CATEGORIES, PLACE_CATEGORY_LABEL, PLACE_KIND_CATEGORY, TYPE_DETAILS, buyerTotal, detailValue, formatINR, type AreaUnit, type PlaceKind, type PropertyType } from '@estate/shared';
import { KIND_ICON } from '../components/property/placeIcons';
import { api } from '../lib/api';
import { PageLoader } from '../components/ui';
import { PropertyCover } from '../components/PropertyCard';

type PublicProperty = {
  title: string;
  type: PropertyType;
  typeLabel: string;
  purpose: string;
  price?: number;
  priceNegotiable?: boolean;
  area?: number;
  areaUnit: AreaUnit;
  city?: string;
  locality?: string;
  details: Record<string, string | number | boolean | null>;
  extras: { label: string; value: string }[];
  amenities: string[];
  description?: string;
  highlights: string[];
  media: { url: string; kind: string }[];
  approvals: { name: string; verified: boolean }[];
  availability: 'available' | 'unavailable';
  /** Only places the team marked OK to advertise, nearest first. */
  nearby: { name: string; kind: PlaceKind; distanceKm: number; minutes: number }[];
};

/** What the buyer opens from WhatsApp. No sign-in, no internal data. */
export function SharePage() {
  const { token = '' } = useParams();
  const q = useQuery({ queryKey: ['public', token], queryFn: () => api.get<{ property: PublicProperty }>(`/public/properties/${token}`), select: (d) => d.property, retry: false });
  if (q.isLoading) return <PageLoader />;
  const p = q.data;
  if (!p)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-semibold">This listing is no longer available</p>
          <p className="mt-1 text-sm text-slate-500">Please ask your contact for current options.</p>
        </div>
      </div>
    );
  const photos = p.media.filter((m) => m.kind === 'photo');
  const total = p.purpose === 'sale' && p.price ? buyerTotal(p.price).total : null;
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl">
        {photos.length ? <img src={photos[0].url} className="h-72 w-full object-cover sm:rounded-b-3xl" alt={p.title} /> : <PropertyCover property={{ ...p, media: [] }} className="h-56 w-full sm:rounded-b-3xl" iconSize="h-16 w-16" />}
        <div className="px-5 py-6">
          {p.availability !== 'available' && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">This one may no longer be available. Ask about similar options.</p>}
          <p className="text-3xl font-semibold tracking-tight">{p.price ? (p.purpose === 'sale' ? formatINR(p.price) : `${formatINR(p.price, { short: false })}/month`) : 'Price on request'}</p>
          {p.priceNegotiable && <p className="text-sm text-slate-500">Negotiable</p>}
          <h1 className="mt-1 text-xl font-medium">{p.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-slate-500">
            <MapPin className="h-4 w-4" /> {[p.locality, p.city].filter(Boolean).join(', ')}
          </p>
          {p.approvals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {p.approvals.map((a) => (
                <span key={a.name} className="chip bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" /> {a.name} {a.verified ? 'verified' : 'approved'}
                </span>
              ))}
            </div>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">Type</dt>
              <dd className="font-medium">{p.typeLabel}</dd>
            </div>
            {p.area && (
              <div>
                <dt className="text-xs text-slate-500">Area</dt>
                <dd className="font-medium">
                  {p.area.toLocaleString('en-IN')} {AREA_UNIT_LABEL[p.areaUnit]}
                </dd>
              </div>
            )}
            {TYPE_DETAILS[p.type].map((f) => {
              const v = p.details[f.key];
              if (v === null || v === undefined || v === '') return null;
              return (
                <div key={f.key}>
                  <dt className="text-xs text-slate-500">{f.label}</dt>
                  <dd className="font-medium">{detailValue(f, v)}</dd>
                </div>
              );
            })}
            {p.extras.map((e) => (
              <div key={e.label}>
                <dt className="text-xs text-slate-500">{e.label}</dt>
                <dd className="font-medium">{e.value}</dd>
              </div>
            ))}
          </dl>
          {total && (
            <p className="mt-3 text-xs text-slate-500">
              Approximate total with stamp duty and registration (about 9% in Tamil Nadu): <b>{formatINR(total)}</b>. Final charges depend on the guideline value.
            </p>
          )}
          {p.description && <p className="mt-6 whitespace-pre-line leading-relaxed text-slate-700">{p.description}</p>}
          {p.highlights.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-600" /> {h}
                </li>
              ))}
            </ul>
          )}
          {p.amenities.length > 0 && (
            <>
              <h2 className="mt-6 font-semibold">Amenities</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {p.amenities.map((a) => (
                  <span key={a} className="chip bg-slate-100 text-slate-700">
                    {a}
                  </span>
                ))}
              </div>
            </>
          )}
          {p.nearby.length > 0 && (
            <>
              <h2 className="mt-6 font-semibold">Nearby</h2>
              <div className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {PLACE_CATEGORIES.map((c) => {
                  const items = p.nearby.filter((n) => PLACE_KIND_CATEGORY[n.kind] === c);
                  if (!items.length) return null;
                  return (
                    <div key={c}>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{PLACE_CATEGORY_LABEL[c]}</p>
                      <ul className="mt-1 space-y-1.5">
                        {items.map((n) => {
                          const Icon = KIND_ICON[n.kind];
                          return (
                            <li key={n.name} className="flex items-center gap-2 text-sm text-slate-700">
                              <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
                              <span className="flex-1">{n.name}</span>
                              <span className="whitespace-nowrap text-xs text-slate-500">
                                {n.distanceKm.toLocaleString('en-IN', { maximumFractionDigits: 1 })} km · {n.minutes} min
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {photos.length > 1 && (
            <div className="mt-6 grid grid-cols-2 gap-2">
              {photos.slice(1).map((m) => (
                <img key={m.url} src={m.url} className="h-40 w-full rounded-xl object-cover" alt="" />
              ))}
            </div>
          )}
          <p className="mt-10 text-center text-xs text-slate-400">Shared via EstateOS · details as provided by the seller</p>
        </div>
      </div>
    </div>
  );
}
