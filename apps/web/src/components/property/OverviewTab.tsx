import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Camera, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Images, Ruler, Sparkles, TrendingUp, X } from 'lucide-react';
import { TYPE_DETAILS, propertyCompletion } from '@estate/shared';
import { TEMP_DOT } from '../../lib/leads';
import { areaLabel, type Property } from '../../lib/property';
import { Badge, Card } from '../ui';
import { PropertyCover } from '../PropertyCard';
import { FIT, Reasons } from '../../features/matching';
import { slots } from '../../slots';
import { DETAIL_ICON, RangeBar, Ring, amenityIcon } from './visuals';
import { VERDICT, canMatch, perSqft, useBuyers, useComparables } from './data';

type Tab = 'overview' | 'legal' | 'price' | 'matching' | 'history';

const show = (v: unknown, unit?: string) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : `${v}${unit ? ` ${unit}` : ''}`);
const filled = (v: unknown) => v !== null && v !== undefined && v !== '';

export function OverviewTab({ p, canEdit, onEdit, onAddPhotos, uploading, goTab }: { p: Property; canEdit: boolean; onEdit: () => void; onAddPhotos: () => void; uploading: boolean; goTab: (t: Tab) => void }) {
  const fields = TYPE_DETAILS[p.type];
  const known = fields.filter((f) => filled(p.details[f.key]));
  // The first facts become icon tiles; the rest are listed underneath.
  const tiles = known.slice(0, 6);
  const rest = known.slice(6);
  const rate = p.price && p.areaSqft && p.purpose === 'sale' ? Math.round(p.price / p.areaSqft) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <Gallery p={p} canEdit={canEdit} onAdd={onAddPhotos} uploading={uploading} />

        {/* At a glance */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile icon={Ruler} label="Area" value={areaLabel(p) ?? '—'} hint={rate ? `${perSqft(rate)}/sq.ft` : undefined} />
          {tiles.map((f) => (
            <Tile key={f.key} icon={DETAIL_ICON[f.key] ?? CheckCircle2} label={f.label} value={show(p.details[f.key], f.unit)} source={p.sources?.[`details.${f.key}`]} />
          ))}
          {canEdit && known.length < fields.length && (
            <button type="button" onClick={onEdit} className="flex min-h-[84px] flex-col items-start justify-center rounded-2xl border border-dashed border-slate-300 p-3 text-left text-xs text-slate-500 transition hover:border-brand-400 hover:text-brand-700">
              <span className="text-lg leading-none">＋</span>
              Add {fields.length - known.length} more {fields.length - known.length === 1 ? 'detail' : 'details'}
            </button>
          )}
        </div>

        {(p.description || p.highlights.length > 0 || rest.length > 0 || p.address || p.unitNumber) && (
          <Card className="rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">About this property</h2>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {known.length} of {fields.length} details
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${fields.length ? (known.length / fields.length) * 100 : 100}%` }} />
                </span>
              </span>
            </div>
            {p.description && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{p.description}</p>}
            {p.highlights.length > 0 && (
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {h}
                  </li>
                ))}
              </ul>
            )}
            {(rest.length > 0 || p.address || p.unitNumber) && (
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                {rest.map((f) => (
                  <div key={f.key}>
                    <dt className="text-xs text-slate-500">{f.label}</dt>
                    <dd className="text-sm font-medium text-slate-800">{show(p.details[f.key], f.unit)}</dd>
                  </div>
                ))}
                {p.unitNumber && (
                  <div>
                    <dt className="text-xs text-slate-500">Unit</dt>
                    <dd className="text-sm font-medium text-slate-800">{`${p.block ? `${p.block}-` : ''}${p.unitNumber}`}</dd>
                  </div>
                )}
                {p.address && (
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="text-xs text-slate-500">Address</dt>
                    <dd className="text-sm font-medium text-slate-800">{`${p.address}${p.pincode ? ` – ${p.pincode}` : ''}`}</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>
        )}

        {p.amenities.length > 0 && (
          <Card className="rounded-3xl p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Amenities · {p.amenities.length}</h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {p.amenities.map((a) => {
                const Icon = amenityIcon(a);
                return (
                  <li key={a} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {a}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {p.extras.length > 0 && (
          <Card className="rounded-3xl p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Other details</h2>
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {p.extras.map((e) => (
                <div key={e.label + e.value} className="rounded-xl bg-slate-50 px-3 py-2">
                  <dt className="flex items-center gap-1 text-xs text-slate-500">
                    {e.label} {e.internal && <Badge tone="amber">Internal</Badge>}
                  </dt>
                  <dd className="text-sm text-slate-800">{e.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}

        {slots.propertyTop.map((S, i) => (
          <S key={i} property={p} />
        ))}
      </div>

      <aside className="space-y-4">
        <PriceCheck p={p} onMore={() => goTab('price')} />
        {canMatch(p) && <TopBuyers p={p} onMore={() => goTab('matching')} />}
        {canEdit && <ToDo p={p} onEdit={onEdit} onAddPhotos={onAddPhotos} />}
        {slots.propertySide.map((S, i) => (
          <S key={i} property={p} />
        ))}
      </aside>
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint, source }: { icon: typeof Ruler; label: string; value: ReactNode; hint?: string; source?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-card">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
        {label}
        {source && (
          <span title={`Read from: “${source}”`}>
            <Sparkles className="h-3 w-3 text-ai-500" />
          </span>
        )}
      </p>
      <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

/** One big photo and up to four small ones; any of them opens the viewer. */
function Gallery({ p, canEdit, onAdd, uploading }: { p: Property; canEdit: boolean; onAdd: () => void; uploading: boolean }) {
  const photos = p.media.filter((m) => m.kind === 'photo');
  const [view, setView] = useState<number | null>(null);
  const add = canEdit && (
    <button type="button" onClick={onAdd} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow hover:bg-white">
      <Camera className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Add photos'}
    </button>
  );
  if (!photos.length)
    return (
      <div className="relative overflow-hidden rounded-3xl">
        <PropertyCover property={p} className="h-60 w-full sm:h-72" iconSize="h-16 w-16" />
        {add}
      </div>
    );
  const small = photos.slice(1, 5);
  return (
    <>
      <div className={clsx('relative grid h-60 gap-2 overflow-hidden rounded-3xl sm:h-80', small.length ? 'grid-cols-4 grid-rows-2' : 'grid-cols-1')}>
        <button type="button" onClick={() => setView(0)} className={clsx('overflow-hidden', small.length && 'col-span-4 row-span-2 sm:col-span-2')} aria-label="Open photo 1">
          <img src={photos[0].url} alt={p.title} className="h-full w-full object-cover transition hover:scale-[1.02]" />
        </button>
        {small.map((m, i) => (
          <button key={m.url} type="button" onClick={() => setView(i + 1)} className="relative hidden overflow-hidden sm:block" aria-label={`Open photo ${i + 2}`}>
            <img src={m.url} alt="" className="h-full w-full object-cover transition hover:scale-[1.04]" />
            {i === small.length - 1 && photos.length > 5 && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-semibold text-white">+{photos.length - 5}</span>}
          </button>
        ))}
        <button type="button" onClick={() => setView(0)} className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow">
          <Images className="h-3.5 w-3.5" /> {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
        </button>
        {add}
      </div>
      {view !== null && <Viewer photos={photos.map((m) => m.url)} at={view} onAt={setView} onClose={() => setView(null)} />}
    </>
  );
}

function Viewer({ photos, at, onAt, onClose }: { photos: string[]; at: number; onAt: (i: number) => void; onClose: () => void }) {
  const go = (d: number) => onAt((at + d + photos.length) % photos.length);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photos"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 outline-none"
    >
      <img src={photos[at]} alt={`Photo ${at + 1} of ${photos.length}`} className="max-h-[85vh] max-w-full rounded-2xl object-contain" />
      <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close">
        <X className="h-5 w-5" />
      </button>
      {photos.length > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Previous photo">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => go(1)} className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Next photo">
            <ChevronRight className="h-6 w-6" />
          </button>
          <span className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            {at + 1} / {photos.length}
          </span>
        </>
      )}
    </div>
  );
}

function PriceCheck({ p, onMore }: { p: Property; onMore: () => void }) {
  const c = useComparables(p.id);
  if (p.purpose !== 'sale') return null;
  const d = c.data;
  return (
    <Card className="rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <TrendingUp className="h-4 w-4 text-brand-600" /> Price check
        </h2>
        <button type="button" onClick={onMore} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
          Details <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {d?.rate && <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{perSqft(d.rate)}<span className="text-sm font-normal text-slate-400">/sq.ft</span></p>}
      {!d ? (
        <p className="mt-2 text-sm text-slate-400">Checking similar properties…</p>
      ) : d.stats ? (
        <>
          {d.verdict && <span className={clsx('mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', VERDICT[d.verdict].tone)}>{VERDICT[d.verdict].label}</span>}
          <RangeBar min={d.stats.min} max={d.stats.max} value={d.rate} format={perSqft} className="mt-2" />
          <p className="mt-1 text-[11px] text-slate-400">Range of {d.stats.count} similar {d.stats.count === 1 ? 'property' : 'properties'} in our records, per sq.ft.</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No similar properties in our records yet to compare with.</p>
      )}
    </Card>
  );
}

function TopBuyers({ p, onMore }: { p: Property; onMore: () => void }) {
  const q = useBuyers(p);
  const items = q.data ?? [];
  const n = (f: 'strong' | 'good' | 'partial') => items.filter((b) => b.fit === f).length;
  return (
    <Card className="rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Buyers who fit · {q.data ? items.length : '…'}</h2>
        {items.length > 0 && (
          <button type="button" onClick={onMore} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
            See all <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>
      {items.length > 0 && (
        <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-label={`${n('strong')} strong, ${n('good')} good, ${n('partial')} partial`}>
          {n('strong') > 0 && <span className="bg-emerald-500" style={{ flex: n('strong') }} />}
          {n('good') > 0 && <span className="bg-brand-400" style={{ flex: n('good') }} />}
          {n('partial') > 0 && <span className="bg-amber-300" style={{ flex: n('partial') }} />}
        </div>
      )}
      {q.data && !items.length && <p className="mt-2 text-sm text-slate-500">No open customer fits this one right now.</p>}
      <ul className="mt-3 space-y-2.5">
        {items.slice(0, 3).map((b) => (
          <li key={b.lead.id} className="flex items-start gap-2.5">
            <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {b.lead.name.charAt(0)}
              <span className={clsx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', TEMP_DOT[b.lead.temperature])} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <Link to={`/leads/${b.lead.id}`} className="truncate text-sm font-medium text-slate-800 hover:text-brand-800">
                  {b.lead.name}
                </Link>
                <Badge tone={FIT[b.fit].tone}>{FIT[b.fit].label}</Badge>
              </span>
              <Reasons reasons={b.reasons} max={1} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ToDo({ p, onEdit, onAddPhotos }: { p: Property; onEdit: () => void; onAddPhotos: () => void }) {
  const r = p.readiness;
  const pct = propertyCompletion(p);
  const pending = p.projectId ? [] : p.approvals.filter((a) => !a.documentUrl);
  const items: { text: string; required?: boolean; go: () => void }[] = [
    ...r.missing.map((m) => ({ text: `Add ${m.label.toLowerCase()}`, required: true, go: onEdit })),
    ...(!p.media.length ? [{ text: 'Add photos', go: onAddPhotos }] : []),
    ...pending.map((a) => ({ text: `Upload the ${a.name} document`, go: onEdit })),
    ...r.suggestions.filter((s) => s.key !== 'media' && s.key !== 'approvals').slice(0, 4).map((s) => ({ text: s.label.startsWith('Add') ? s.label : `Add ${s.label.toLowerCase()}`, go: onEdit })),
  ];
  return (
    <Card className="rounded-3xl p-5">
      <div className="flex items-center gap-3">
        <Ring value={pct} />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{pct >= 100 ? 'Listing complete' : 'Make it complete'}</h2>
          <p className="text-xs text-slate-500">{r.ready ? 'Ready to go live' : `${r.missing.length} needed to go live`}</p>
        </div>
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-1">
          {items.slice(0, 6).map((t) => (
            <li key={t.text}>
              <button type="button" onClick={t.go} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                <CircleAlert className={clsx('h-4 w-4 shrink-0', t.required ? 'text-rose-500' : 'text-amber-500')} />
                <span className="flex-1">{t.text}</span>
                {t.required && <span className="text-[10px] font-semibold uppercase text-rose-600">Needed</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
