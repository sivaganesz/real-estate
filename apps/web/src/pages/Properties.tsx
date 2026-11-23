import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Building2, LayoutGrid, List, Plus, Search, Sparkles, Upload, X } from 'lucide-react';
import { AVAILABILITY, PROPERTY_TYPES, PROPERTY_TYPE_LABEL, formatINR, type Availability, type PropertyType } from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AVAILABILITY_TONE, availabilityLabel, keyFacts, priceLabel, useProjects, type Property } from '../lib/property';
import { PageHeader } from '../components/Layout';
import { Badge, Button, Card, EmptyState, PageLoader, Segmented } from '../components/ui';
import { PropertyCard, PropertyCover } from '../components/PropertyCard';
import { AddProperty } from '../components/AddProperty';
import { NewProject } from '../components/NewProject';
import { useAssistantPage } from '../ai/assistant';

export function Properties() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'units' | 'projects') ?? 'units';
  const [adding, setAdding] = useState(params.get('add') === '1');
  const [newProject, setNewProject] = useState(false);

  useAssistantPage({
    page: 'Properties',
    suggestions: can('property.create')
      ? ['Which projects are moving slowly?', 'Add a draft: 3 BHK villa in Medavakkam, 1.2 Cr, 2400 sq.ft land', 'Which properties get the most enquiries?']
      : ['Find 2 BHK apartments under 70 lakhs in Chennai', 'Show available plots in Sunrise Enclave', 'Which ready-to-move homes are under 1 crore?'],
  });

  return (
    <>
      <PageHeader
        title="Properties"
        subtitle="Everything you can offer, with projects and their units."
        actions={
          can('property.create') && (
            <>
              <Link to="/properties/import">
                <Button icon={<Upload className="h-4 w-4" />}>Import</Button>
              </Link>
              {tab === 'projects' ? (
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setNewProject(true)}>
                  New project
                </Button>
              ) : (
                <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
                  Add property
                </Button>
              )}
            </>
          )
        }
      />
      <Segmented
        className="mb-4"
        value={tab}
        onChange={(v) => setParams(v === 'units' ? {} : { tab: v })}
        options={[
          { value: 'units', label: 'All properties' },
          { value: 'projects', label: 'Projects' },
        ]}
      />
      {tab === 'units' ? <Units /> : <Projects />}
      <AddProperty open={adding} onClose={() => setAdding(false)} />
      <NewProject open={newProject} onClose={() => setNewProject(false)} />
    </>
  );
}

function Units() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const q = params.get('q') ?? '';
  const types = (params.get('types')?.split(',').filter(Boolean) ?? []) as PropertyType[];
  const availability = (params.get('availability')?.split(',').filter(Boolean) ?? []) as Availability[];
  const listing = params.get('listing') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const [view, setView] = useState<'grid' | 'table'>(() => (localStorage.getItem('propView') as 'grid' | 'table') ?? 'grid');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };
  const toggle = <T extends string>(key: string, list: T[], v: T) => update({ [key]: (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(',') || null });

  const res = useQuery({
    queryKey: ['properties', { q, types, availability, listing, sort }],
    // Sold units are history, not inventory: hidden unless asked for.
    queryFn: () => api.get<{ items: Property[]; total: number; understood: string[] }>(`/properties${qs({ q, types, availability: availability.length ? availability : ['available', 'held', 'booked'], listing: listing || undefined, sort, limit: 120 })}`),
  });

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: draft.trim() || null });
        }}
        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder='Search in your own words: "3 bhk villa under 1.5 cr in Medavakkam", a code or a locality' className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        {q && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              update({ q: null });
            }}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>
      {!!res.data?.understood.length && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-ai-600" /> Understood as
          {res.data.understood.map((u) => (
            <Badge key={u} tone="ai">
              {u}
            </Badge>
          ))}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {PROPERTY_TYPES.map((t) => (
          <FilterChip key={t} on={types.includes(t)} onClick={() => toggle('types', types, t)}>
            {PROPERTY_TYPE_LABEL[t]}
          </FilterChip>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-200" />
        {AVAILABILITY.map((a) => (
          <FilterChip key={a} on={availability.includes(a)} onClick={() => toggle('availability', availability, a)}>
            {availabilityLabel(a)}
          </FilterChip>
        ))}
        {can('property.edit') && (
          <>
            <span className="mx-1 h-4 w-px bg-slate-200" />
            <FilterChip on={listing === 'draft'} onClick={() => update({ listing: listing === 'draft' ? null : 'draft' })}>
              Drafts
            </FilterChip>
            <FilterChip on={listing === 'archived'} onClick={() => update({ listing: listing === 'archived' ? null : 'archived' })}>
              Archived
            </FilterChip>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="rounded-lg border-0 bg-transparent text-xs text-slate-600 focus:ring-0">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="updated">Recently updated</option>
          </select>
          <Segmented
            value={view}
            onChange={(v) => {
              setView(v);
              localStorage.setItem('propView', v);
            }}
            options={[
              { value: 'grid', label: <LayoutGrid className="h-3.5 w-3.5" /> },
              { value: 'table', label: <List className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>
      </div>

      <div className="mt-4">
        {res.isLoading ? (
          <PageLoader />
        ) : !res.data?.items.length ? (
          <EmptyState icon={<Search className="h-5 w-5" />} title="Nothing matches" body={q ? 'Try a wider budget, another locality, or fewer filters.' : 'No properties yet. Add one or import a sheet.'} />
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              {res.data.total} {res.data.total === 1 ? 'property' : 'properties'}{!availability.length && ' · sold ones hidden'}
            </p>
            {view === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {res.data.items.map((p) => (
                  <PropertyCard key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <PropertyTable items={res.data.items} />
            )}
          </>
        )}
      </div>
    </>
  );
}

export function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={clsx('rounded-full border px-2.5 py-1 text-xs font-medium transition', on ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300')}>
      {children}
    </button>
  );
}

function PropertyTable({ items }: { items: Property[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">Property</th>
            <th className="px-2 py-2.5 font-medium">Price</th>
            <th className="px-2 py-2.5 font-medium">Facts</th>
            <th className="px-2 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Code</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-2">
                <Link to={`/properties/${p.id}`} className="flex items-center gap-3">
                  <PropertyCover property={p} className="h-9 w-12 shrink-0 rounded-lg" iconSize="h-4 w-4" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">{p.title}</span>
                    <span className="block truncate text-xs text-slate-500">{[p.locality, p.city].filter(Boolean).join(', ')}</span>
                  </span>
                </Link>
              </td>
              <td className="px-2 py-2 font-medium">{priceLabel(p)}</td>
              <td className="px-2 py-2 text-xs text-slate-600">{keyFacts(p).join(' · ')}</td>
              <td className="px-2 py-2">
                {p.listing === 'live' ? <Badge tone={AVAILABILITY_TONE[p.availability]}>{availabilityLabel(p.availability)}</Badge> : <Badge tone="amber">{p.listing === 'draft' ? 'Draft' : 'Archived'}</Badge>}
              </td>
              <td className="px-4 py-2 text-xs text-slate-400">{p.code}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Projects() {
  const projects = useProjects();
  const movement = useQuery({ queryKey: ['movement'], queryFn: () => api.get<{ projects: { id: string; slow: boolean; movedInWindow: number; monthsOfStock: number | null; perMonth: number }[] }>('/insights/movement') });
  if (projects.isLoading) return <PageLoader />;
  if (!projects.data?.length) return <EmptyState icon={<Building2 className="h-5 w-5" />} title="No projects yet" body="A project groups the units of one development — towers, a plotted layout or a villa community." />;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {projects.data.map((p) => {
        const inv = p.inventory!;
        const sold = inv.booked + inv.sold;
        const pct = inv.total ? Math.round((sold / inv.total) * 100) : 0;
        return (
          <Link key={p.id} to={`/projects/${p.id}`} className="card flex gap-4 p-4 transition hover:shadow-pop">
            <PropertyCover property={{ type: p.type, media: [], title: p.name }} className="h-24 w-24 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col-reverse items-start justify-between gap-1 sm:flex-row sm:gap-2">
                <div className="min-w-0 max-w-full">
                  <p className="truncate font-semibold text-slate-900">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {PROPERTY_TYPE_LABEL[p.type]} · {p.locality}, {p.city}
                  </p>
                </div>
                <Badge tone={p.status === 'ready' ? 'green' : 'blue'}>{p.status === 'ready' ? 'Ready' : p.status === 'upcoming' ? 'Upcoming' : 'Under construction'}</Badge>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {inv.priceFrom ? (inv.priceFrom === inv.priceTo ? formatINR(inv.priceFrom) : `${formatINR(inv.priceFrom)} – ${formatINR(inv.priceTo)}`) : 'No units on sale'}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                <b className="text-emerald-700">{inv.available}</b> available · {inv.held} on hold · {sold} sold or booked of {inv.total} · {pct}% gone
                {inv.draft > 0 && <span className="text-amber-700"> · {inv.draft} drafts</span>}
              </p>
              {(() => {
                const m = movement.data?.projects.find((x) => x.id === p.id);
                if (!m) return null;
                return (
                  <p className={clsx('mt-1 text-xs', m.slow ? 'font-medium text-amber-700' : 'text-slate-500')}>
                    {m.slow ? '⚠ Slow: ' : ''}
                    {m.movedInWindow} sold or booked in 90 days{m.monthsOfStock ? ` · ~${m.monthsOfStock} months of stock at this pace` : ''}
                  </p>
                );
              })()}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
