import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, LayoutGrid, List, MoreHorizontal, Search, Sparkles, Users, X } from 'lucide-react';
import { PROPERTY_TYPES, PROPERTY_TYPE_LABEL, formatINR, propertyCompletion, type Availability, type PropertyType } from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AVAILABILITY_TONE, areaLabel, availabilityLabel, priceLabel, usePlaces, type Property } from '../lib/property';
import { Badge, Button, Card, EmptyState, PageLoader, Segmented } from '../components/ui';
import { PropertyCard, PropertyCover } from '../components/PropertyCard';
import { Popover } from '../components/Popover';
import { useConfirm } from '../components/confirm';
import { useToast } from '../components/toast';

type Row = Property & { fitCount?: number };
type Status = 'all' | Availability | 'draft' | 'archived';
type Counts = Record<Status, number>;
type Sort = 'newest' | 'price_asc' | 'price_desc' | 'updated' | 'least_complete' | 'most_leads';

const STATUS_TABS: { key: Status; label: string; editors?: boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'held', label: 'On hold' },
  { key: 'booked', label: 'Booked' },
  { key: 'sold', label: 'Sold' },
  { key: 'draft', label: 'Drafts', editors: true },
  { key: 'archived', label: 'Archived', editors: true },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'updated', label: 'Recently updated' },
  { key: 'least_complete', label: 'Least complete' },
  { key: 'most_leads', label: 'Most leads' },
];

const EXAMPLES = ['2 BHK under 70 L in Porur', 'Plot in Guduvanchery', 'Villa above 1 Cr', 'Commercial in OMR'];
const PER_PAGE = [10, 25, 50] as const;
const LAKH = 100_000;

/** ₹/sq.ft., when both are known. */
const rate = (p: Property) => (p.price && p.areaSqft ? Math.round(p.price / p.areaSqft) : null);

/** The list page: search, filters, status tabs, a table or cards, and a pager. */
export function PropertyList() {
  const { can } = useAuth();
  const editor = can('property.edit');
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? '';
  const list = (k: string) => get(k).split(',').filter(Boolean);
  const update = (patch: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!keepPage) next.delete('page');
    setParams(next, { replace: true });
  };

  // Older links: ?listing=draft and ?availability=sold still work.
  const status = ((get('status') || (get('listing') === 'draft' ? 'draft' : get('listing') === 'archived' ? 'archived' : get('availability'))) || 'all') as Status;
  const q = get('q');
  const types = list('types') as PropertyType[];
  const city = get('city');
  const localities = list('loc');
  const bmin = Number(get('bmin')) || 0;
  const bmax = Number(get('bmax')) || 0;
  const amin = Number(get('amin')) || 0;
  const amax = Number(get('amax')) || 0;
  const purpose = get('purpose');
  const beds = Number(get('beds')) || 0;
  const sort = (get('sort') || 'newest') as Sort;
  const per = (PER_PAGE as readonly number[]).includes(Number(get('per'))) ? Number(get('per')) : 10;
  const page = Math.max(1, Number(get('page')) || 1);
  // Project flats live under their project; a search or the toggle brings them in.
  const withUnits = get('units') === '1' || !!q;
  const [draft, setDraft] = useState(q);
  const [view, setView] = useState<'table' | 'grid'>(() => {
    try {
      return localStorage.getItem('propView') === 'grid' ? 'grid' : 'table';
    } catch {
      return 'table';
    }
  });

  const filterQuery = {
    q: q || undefined,
    types: types.length ? types : undefined,
    city: city || undefined,
    localities: localities.length ? localities : undefined,
    budgetMin: bmin ? bmin * LAKH : undefined,
    budgetMax: bmax ? bmax * LAKH : undefined,
    areaMin: amin || undefined,
    areaMax: amax || undefined,
    purpose: purpose || undefined,
    bedrooms: beds || undefined,
    standalone: withUnits ? undefined : true,
  };
  const statusQuery =
    status === 'all' ? {} : status === 'draft' || status === 'archived' ? { listing: [status] } : { listing: ['live'], availability: [status] };
  const serverSort = sort === 'least_complete' || sort === 'most_leads' ? 'newest' : sort;
  const res = useQuery({
    queryKey: ['properties', 'list', filterQuery, status, serverSort],
    queryFn: () => api.get<{ items: Row[]; total: number; understood: string[]; counts?: Counts }>(`/properties${qs({ ...filterQuery, ...statusQuery, sort: serverSort, limit: 200, withFit: true, withCounts: true })}`),
  });

  const items = res.data?.items ?? [];
  const shown = useMemo(() => {
    let rows = items;
    if (sort === 'least_complete') rows = [...rows].sort((a, b) => propertyCompletion(a) - propertyCompletion(b));
    if (sort === 'most_leads') rows = [...rows].sort((a, b) => (b.fitCount ?? 0) - (a.fitCount ?? 0));
    return rows;
  }, [items, sort]);
  const pages = Math.max(1, Math.ceil(shown.length / per));
  const at = Math.min(page, pages);
  const pageRows = shown.slice((at - 1) * per, at * per);

  const activeFilters = [types.length, city, localities.length, bmin || bmax, amin || amax, purpose, beds].filter(Boolean).length;
  const clearAll = () => update({ types: null, city: null, loc: null, bmin: null, bmax: null, amin: null, amax: null, purpose: null, beds: null });

  return (
    <>
      {/* Search in plain words; the same reader the assistant uses. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: draft.trim() || null });
        }}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-ai-600" />
        <input
          aria-label="Search properties"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Search in your own words: "3 bhk villa under 1.5 cr in Medavakkam", a code or a locality'
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setDraft('');
              update({ q: null });
            }}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <Button type="submit" size="sm" variant="primary" className="rounded-full">
          Search
        </Button>
      </form>
      {res.data?.understood.length ? (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-ai-600" /> Understood as
          {res.data.understood.map((u) => (
            <Badge key={u} tone="ai">
              {u}
            </Badge>
          ))}
        </p>
      ) : (
        !q && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            Try:
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setDraft(ex);
                  update({ q: ex });
                }}
                className="rounded-full border border-dashed border-ai-200 px-2.5 py-0.5 text-ai-700 hover:bg-ai-50"
              >
                {ex}
              </button>
            ))}
          </p>
        )
      )}

      {/* Filters, sort and view. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Filters types={types} city={city} localities={localities} bmin={bmin} bmax={bmax} amin={amin} amax={amax} purpose={purpose} beds={beds} withUnits={get('units') === '1'} update={update} />
        {activeFilters > 0 && (
          <button type="button" onClick={clearAll} className="text-xs font-medium text-brand-700 hover:underline">
            Clear all
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Popover
            label="Sort"
            align="right"
            buttonClass={() => 'flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-slate-600 hover:bg-slate-100'}
            trigger={() => (
              <>
                Sort: <b className="font-medium text-slate-800">{SORTS.find((s) => s.key === sort)?.label}</b> <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          >
            {(close) => (
              <ul className="-m-1.5">
                {SORTS.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      aria-pressed={s.key === sort}
                      onClick={() => {
                        update({ sort: s.key === 'newest' ? null : s.key });
                        close();
                      }}
                      className={clsx('w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50', s.key === sort ? 'font-semibold text-brand-800' : 'text-slate-700')}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover>
          <Segmented
            value={view}
            onChange={(v) => {
              setView(v);
              try {
                localStorage.setItem('propView', v);
              } catch {
                // Not remembered in this browser: fine.
              }
            }}
            options={[
              { value: 'table', label: <span className="flex items-center gap-1"><List className="h-3.5 w-3.5" /> Table</span> },
              { value: 'grid', label: <span className="flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" /> Grid</span> },
            ]}
          />
        </div>
      </div>

      {/* Status tabs with counts; empty ones are hidden. */}
      <div className="mt-4 flex flex-wrap items-end gap-1 border-b border-slate-200" role="tablist" aria-label="Status">
        {STATUS_TABS.filter((t) => (!t.editors || editor) && (t.key === 'all' || t.key === status || (res.data?.counts?.[t.key] ?? 0) > 0)).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={status === t.key}
            onClick={() => update({ status: t.key === 'all' ? null : t.key, listing: null, availability: null })}
            className={clsx('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition', status === t.key ? 'border-brand-600 font-semibold text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}
          >
            {t.label}
            <span className={clsx('rounded-full px-1.5 text-[11px]', status === t.key ? 'bg-brand-50 text-brand-800' : 'bg-slate-100 text-slate-500')}>{res.data?.counts?.[t.key] ?? '–'}</span>
          </button>
        ))}
      </div>

      <div className="mt-3">
        {res.isLoading ? (
          <PageLoader />
        ) : res.isError ? (
          <EmptyState title="Couldn't load properties" body="Check your connection and try again." action={<Button onClick={() => res.refetch()}>Try again</Button>} />
        ) : !shown.length ? (
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title="Nothing matches"
            body={activeFilters || q ? 'Try a wider budget, another locality, or fewer filters.' : 'No properties here yet. Add one or import a sheet.'}
            action={activeFilters > 0 && <Button onClick={clearAll}>Clear filters</Button>}
          />
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {`${res.data!.total} ${res.data!.total === 1 ? 'property' : 'properties'}`}
              {!withUnits && (
                <>
                  {' · project units are under '}
                  <button type="button" onClick={() => update({ tab: 'projects' })} className="link">
                    Projects
                  </button>
                </>
              )}
            </p>
            {view === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pageRows.map((p) => (
                  <PropertyCard key={p.id} p={p} footer={<CardFooter p={p} />} />
                ))}
              </div>
            ) : (
              <PropertyTable rows={pageRows} />
            )}
            <Pager total={shown.length} at={at} pages={pages} per={per} onPage={(n) => update({ page: n > 1 ? String(n) : null }, true)} onPer={(n) => update({ per: n === 10 ? null : String(n) })} />
          </>
        )}
      </div>
    </>
  );
}

/** One pill per filter: Type, City, Budget, Size, More. */
function Filters({
  types,
  city,
  localities,
  bmin,
  bmax,
  amin,
  amax,
  purpose,
  beds,
  withUnits,
  update,
}: {
  types: PropertyType[];
  city: string;
  localities: string[];
  bmin: number;
  bmax: number;
  amin: number;
  amax: number;
  purpose: string;
  beds: number;
  withUnits: boolean;
  update: (patch: Record<string, string | null>) => void;
}) {
  const places = usePlaces();
  const [locFind, setLocFind] = useState('');
  const range = (lo: number, hi: number, unit: (n: number) => string) => (lo && hi ? `${unit(lo)}–${unit(hi)}` : lo ? `${unit(lo)}+` : hi ? `up to ${unit(hi)}` : '');
  const money = (l: number) => formatINR(l * LAKH);
  const sqft = (n: number) => `${n.toLocaleString('en-IN')} sq.ft`;
  const moreCount = [purpose, beds, withUnits].filter(Boolean).length;
  const locs = (places.data?.localities ?? []).filter((l) => !locFind || l.toLowerCase().includes(locFind.toLowerCase())).slice(0, 24);

  return (
    <>
      <Pill label="Type" value={types.length ? (types.length === 1 ? PROPERTY_TYPE_LABEL[types[0]] : `${types.length} types`) : ''} onClear={() => update({ types: null })}>
        {() => (
          <div className="space-y-1">
            {PROPERTY_TYPES.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={types.includes(t)} onChange={() => update({ types: (types.includes(t) ? types.filter((x) => x !== t) : [...types, t]).join(',') || null })} />
                {PROPERTY_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        )}
      </Pill>

      <Pill label="City" value={[city, localities.length ? `${localities.length} ${localities.length === 1 ? 'area' : 'areas'}` : ''].filter(Boolean).join(' · ')} onClear={() => update({ city: null, loc: null })} wide>
        {() => (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">City</p>
              <div className="flex flex-wrap gap-1.5">
                {(places.data?.cities ?? []).map((c) => (
                  <Choice key={c} on={city === c} onClick={() => update({ city: city === c ? null : c })}>
                    {c}
                  </Choice>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Locality</p>
              <input aria-label="Find a locality" value={locFind} onChange={(e) => setLocFind(e.target.value)} placeholder="Find a locality…" className="input mb-2 py-1.5 text-xs" />
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {locs.map((l) => (
                  <Choice key={l} on={localities.includes(l)} onClick={() => update({ loc: (localities.includes(l) ? localities.filter((x) => x !== l) : [...localities, l]).join(',') || null })}>
                    {l}
                  </Choice>
                ))}
              </div>
            </div>
          </div>
        )}
      </Pill>

      <Pill label="Budget" value={range(bmin, bmax, money)} onClear={() => update({ bmin: null, bmax: null })}>
        {(close) => (
          <RangeForm
            unit="lakhs"
            lo={bmin}
            hi={bmax}
            presets={[
              ['Under 50 L', 0, 50],
              ['50 L – 1 Cr', 50, 100],
              ['1 – 2 Cr', 100, 200],
              ['2 Cr +', 200, 0],
            ]}
            onApply={(lo, hi) => {
              update({ bmin: lo ? String(lo) : null, bmax: hi ? String(hi) : null });
              close();
            }}
          />
        )}
      </Pill>

      <Pill label="Size" value={range(amin, amax, sqft)} onClear={() => update({ amin: null, amax: null })}>
        {(close) => (
          <RangeForm
            unit="sq.ft"
            lo={amin}
            hi={amax}
            presets={[
              ['Under 1,000', 0, 1000],
              ['1,000 – 2,000', 1000, 2000],
              ['2,000 – 5,000', 2000, 5000],
              ['5,000 +', 5000, 0],
            ]}
            onApply={(lo, hi) => {
              update({ amin: lo ? String(lo) : null, amax: hi ? String(hi) : null });
              close();
            }}
          />
        )}
      </Pill>

      <Pill label="More" value={moreCount ? String(moreCount) : ''} onClear={() => update({ purpose: null, beds: null, units: null })}>
        {() => (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">For</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ['sale', 'Sale'],
                  ['rent', 'Rent'],
                  ['lease', 'Lease'],
                ].map(([k, l]) => (
                  <Choice key={k} on={purpose === k} onClick={() => update({ purpose: purpose === k ? null : k })}>
                    {l}
                  </Choice>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Bedrooms</p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <Choice key={n} on={beds === n} onClick={() => update({ beds: beds === n ? null : String(n) })}>
                    {n} BHK
                  </Choice>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={withUnits} onChange={() => update({ units: withUnits ? null : '1' })} />
              Include project units
            </label>
          </div>
        )}
      </Pill>
    </>
  );
}

function Pill({ label, value, onClear, wide, children }: { label: string; value: string; onClear: () => void; wide?: boolean; children: (close: () => void) => React.ReactNode }) {
  return (
    <div className="flex items-center">
      <Popover
        label={`${label} filter`}
        className={wide ? 'w-80' : 'w-64'}
        buttonClass={(open) =>
          clsx(
            'flex h-8 items-center gap-1 border px-3 text-xs transition',
            value ? 'rounded-l-full border-brand-300 bg-brand-50 font-medium text-brand-800' : 'rounded-full border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            open && 'ring-2 ring-brand-100',
          )
        }
        trigger={() => (
          <>
            {label}
            {value && <span className="font-semibold">· {value}</span>}
            <ChevronDown className="h-3.5 w-3.5" />
          </>
        )}
      >
        {children}
      </Popover>
      {value && (
        <button type="button" aria-label={`Clear ${label.toLowerCase()} filter`} onClick={onClear} className="flex h-8 items-center rounded-r-full border border-l-0 border-brand-300 bg-brand-50 pl-1.5 pr-2.5 text-brand-700 hover:bg-brand-100">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={clsx('rounded-full border px-2.5 py-1 text-xs transition', on ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
      {children}
    </button>
  );
}

/** Min and max with a few common ranges. 0 means "no limit". */
function RangeForm({ unit, lo, hi, presets, onApply }: { unit: string; lo: number; hi: number; presets: [string, number, number][]; onApply: (lo: number, hi: number) => void }) {
  const [a, setA] = useState(lo ? String(lo) : '');
  const [b, setB] = useState(hi ? String(hi) : '');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(Number(a) || 0, Number(b) || 0);
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-1.5">
        {presets.map(([label, x, y]) => (
          <Choice key={label} on={lo === x && hi === y} onClick={() => onApply(x, y)}>
            {label}
          </Choice>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">
          Min ({unit})
          <input inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} className="input mt-1 py-1.5" />
        </label>
        <label className="text-xs text-slate-500">
          Max ({unit})
          <input inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} className="input mt-1 py-1.5" />
        </label>
      </div>
      <Button type="submit" size="sm" variant="primary" className="w-full">
        Apply
      </Button>
    </form>
  );
}

function StatusBadge({ p }: { p: Property }) {
  if (p.listing === 'draft') return <Badge tone="amber">Draft</Badge>;
  if (p.listing === 'archived') return <Badge tone="slate">Archived</Badge>;
  return <Badge tone={AVAILABILITY_TONE[p.availability]}>{availabilityLabel(p.availability)}</Badge>;
}

/** Completion as a bar: green when done, amber when there's real work left. */
function Completion({ value, compact }: { value: number; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2" title={`${value}% complete`}>
      {!compact && (
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
          <span className={clsx('block h-full rounded-full', value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${value}%` }} />
        </span>
      )}
      <span className={clsx('text-xs tabular-nums', value >= 80 ? 'text-emerald-700' : value >= 50 ? 'text-amber-700' : 'text-rose-600')}>{value}%</span>
    </span>
  );
}

function FitLink({ p }: { p: Row }) {
  const n = p.fitCount ?? 0;
  if (!n) return <span className="text-xs text-slate-300">—</span>;
  return (
    <Link to={`/properties/${p.id}?tab=matching`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline" title={`${n} open ${n === 1 ? 'customer fits' : 'customers fit'} this property`}>
      <Users className="h-3.5 w-3.5" /> {n}
    </Link>
  );
}

function CardFooter({ p }: { p: Row }) {
  const n = p.fitCount ?? 0;
  return (
    <span className="flex items-center justify-between border-t border-slate-100 pt-2.5">
      <span className={clsx('flex items-center gap-1 text-xs', n ? 'font-medium text-brand-700' : 'text-slate-400')}>
        <Users className="h-3.5 w-3.5" /> {n ? `${n} ${n === 1 ? 'lead fits' : 'leads fit'}` : 'No leads fit yet'}
      </span>
      <Completion value={propertyCompletion(p)} compact />
    </span>
  );
}

function PropertyTable({ rows }: { rows: Row[] }) {
  const navigate = useNavigate();
  return (
    <Card className="overflow-x-auto rounded-3xl">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          <tr>
            <th className="px-4 py-2.5">Property</th>
            <th className="hidden px-2 py-2.5 xl:table-cell">Location</th>
            <th className="hidden px-2 py-2.5 text-right md:table-cell">Area</th>
            <th className="hidden px-2 py-2.5 text-right sm:table-cell">Asking price</th>
            <th className="hidden px-2 py-2.5 sm:table-cell">Status</th>
            <th className="hidden px-2 py-2.5 md:table-cell">Leads</th>
            <th className="hidden px-2 py-2.5 lg:table-cell">Complete</th>
            <th className="w-10 px-2 py-2.5">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((p) => (
            // The title link is the keyboard path; a click anywhere on the row is a mouse shortcut.
            <tr key={p.id} className="cursor-pointer transition hover:bg-slate-50/80" onClick={(e) => !(e.target as HTMLElement).closest('a,button,[role=dialog]') && navigate(`/properties/${p.id}`)}>
              <td className="w-full max-w-0 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <PropertyCover property={p} className="h-11 w-14 shrink-0 rounded-xl" iconSize="h-4 w-4" />
                  <span className="min-w-0">
                    <Link to={`/properties/${p.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-800">
                      {p.title}
                    </Link>
                    <span className="block truncate text-xs text-slate-500">
                      <span className="font-mono text-[11px]">{p.code}</span> · {PROPERTY_TYPE_LABEL[p.type]}
                      {p.purpose !== 'sale' && ` · For ${p.purpose}`}
                      <span className="xl:hidden"> · {p.locality || p.city}</span>
                    </span>
                    {/* Phones: price and status under the title. */}
                    <span className="mt-0.5 flex items-center gap-2 sm:hidden">
                      <b className="text-sm text-slate-900">{priceLabel(p)}</b>
                      <StatusBadge p={p} />
                    </span>
                  </span>
                </div>
              </td>
              <td className="hidden whitespace-nowrap px-2 py-2.5 xl:table-cell">
                <span className="block text-slate-800">{p.locality || '—'}</span>
                <span className="block text-xs text-slate-500">{p.city}</span>
              </td>
              <td className="hidden whitespace-nowrap px-2 py-2.5 text-right text-slate-700 md:table-cell">{areaLabel(p) ?? '—'}</td>
              <td className="hidden whitespace-nowrap px-2 py-2.5 text-right sm:table-cell">
                <span className="block font-semibold text-slate-900">{priceLabel(p)}</span>
                {rate(p) && <span className="block text-[11px] text-slate-400">₹{rate(p)!.toLocaleString('en-IN')}/sq.ft</span>}
              </td>
              <td className="hidden px-2 py-2.5 sm:table-cell">
                <StatusBadge p={p} />
              </td>
              <td className="hidden px-2 py-2.5 md:table-cell">
                <FitLink p={p} />
              </td>
              <td className="hidden px-2 py-2.5 lg:table-cell">
                <Completion value={propertyCompletion(p)} />
              </td>
              <td className="px-2 py-2.5">
                <RowMenu p={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** ⋯ on each row: open, share, archive or restore. */
function RowMenu({ p }: { p: Row }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const ask = useConfirm();
  const toast = useToast();
  const qc = useQueryClient();
  const listing = useMutation({
    mutationFn: (to: 'archived' | 'draft') => api.post(`/properties/${p.id}/listing`, { to }),
    onSuccess: (_r, to) => {
      void qc.invalidateQueries({ queryKey: ['properties'] });
      toast(to === 'archived' ? 'Archived' : 'Restored as a draft');
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not change it', 'error'),
  });
  const item = 'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50';
  return (
    <Popover
      label={`Actions for ${p.title}`}
      align="right"
      className="w-52 p-1.5"
      buttonClass={(open) => clsx('flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700', open && 'bg-slate-100 text-slate-700')}
      trigger={() => (
        <>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions for {p.title}</span>
        </>
      )}
    >
      {(close) => (
        <div>
          <button type="button" className={item} onClick={() => navigate(`/properties/${p.id}`)}>
            Open
          </button>
          {p.listing === 'live' && can('property.share') && (
            <button type="button" className={item} onClick={() => navigate(`/properties/${p.id}?share=1`)}>
              Share with a buyer
            </button>
          )}
          {can('property.edit') && p.listing !== 'archived' && (
            <button
              type="button"
              className={clsx(item, 'text-rose-600')}
              onClick={async () => {
                close();
                if (await ask({ title: `Archive ${p.title}?`, body: 'It will be hidden everywhere but kept on record. You can restore it later.', confirmLabel: 'Archive', danger: true })) listing.mutate('archived');
              }}
            >
              Archive
            </button>
          )}
          {can('property.edit') && p.listing === 'archived' && (
            <button
              type="button"
              className={item}
              onClick={() => {
                close();
                listing.mutate('draft');
              }}
            >
              Restore as draft
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}

function Pager({ total, at, pages, per, onPage, onPer }: { total: number; at: number; pages: number; per: number; onPage: (n: number) => void; onPer: (n: number) => void }) {
  const from = (at - 1) * per + 1;
  const to = Math.min(at * per, total);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        Rows per page
        {PER_PAGE.map((n) => (
          <button key={n} type="button" aria-pressed={per === n} onClick={() => onPer(n)} className={clsx('rounded-full px-2 py-0.5', per === n ? 'bg-slate-900 text-white' : 'hover:bg-slate-100')}>
            {n}
          </button>
        ))}
      </span>
      <span>
        Showing <b className="text-slate-700">{from}–{to}</b> of <b className="text-slate-700">{total}</b>
      </span>
      <span className="flex items-center gap-1">
        <button type="button" disabled={at <= 1} onClick={() => onPage(at - 1)} className="rounded-full px-2.5 py-1 hover:bg-slate-100 disabled:opacity-40">
          ‹ Prev
        </button>
        <span className="px-1">
          Page {at} of {pages}
        </span>
        <button type="button" disabled={at >= pages} onClick={() => onPage(at + 1)} className="rounded-full px-2.5 py-1 hover:bg-slate-100 disabled:opacity-40">
          Next ›
        </button>
      </span>
    </div>
  );
}

