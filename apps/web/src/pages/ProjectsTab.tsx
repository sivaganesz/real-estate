import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Building2, Home, LandPlot, Search, ShieldCheck, Store } from 'lucide-react';
import { PROJECT_STATUS_LABELS, PROPERTY_TYPE_LABEL, formatINR, layoutKind, type PropertyType } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useProjects, type Project } from '../lib/property';
import { Badge, Card, EmptyState, PageLoader, Segmented } from '../components/ui';
import { STATE_STYLE } from '../components/ProjectViews';

const ICON: Partial<Record<PropertyType, React.ReactNode>> = {
  apartment: <Building2 className="h-5 w-5" />,
  plot: <LandPlot className="h-5 w-5" />,
  villa: <Home className="h-5 w-5" />,
  commercial: <Store className="h-5 w-5" />,
};

type Movement = { projects: { id: string; slow: boolean; movedInWindow: number; monthsOfStock: number | null }[] };

/**
 * Projects at a glance: totals across what's on sale, then one card per
 * project with its inventory bar. The counts open the layout filtered.
 */
export function Projects() {
  const { can } = useAuth();
  const projects = useProjects();
  const movement = useQuery({ queryKey: ['movement'], queryFn: () => api.get<Movement>('/insights/movement') });
  const [tab, setTab] = useState<'all' | 'draft' | 'live'>('all');
  const [q, setQ] = useState('');
  if (projects.isLoading) return <PageLoader />;
  const list = projects.data ?? [];
  if (!list.length) return <EmptyState icon={<Building2 className="h-5 w-5" />} title="No projects yet" body="A project groups the units of one development — towers, a plotted layout or a villa community." action={can('project.manage') && <Link to="/projects/new" className="link">Add a project</Link>} />;

  const live = list.filter((p) => p.published);
  const sum = (k: 'total' | 'available' | 'held' | 'booked' | 'sold') => live.reduce((s, p) => s + (p.inventory?.[k] ?? 0), 0);
  const total = sum('total');
  const share = (n: number) => (total ? `${Math.round((n / total) * 100)}% of units` : '');
  const shown = list.filter((p) => (tab === 'all' ? true : tab === 'live' ? p.published : !p.published)).filter((p) => !q || `${p.name} ${p.locality} ${p.city}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total units', n: total, sub: `${live.length} published projects`, dot: '#2a978a' },
          { label: 'Available', n: sum('available'), sub: share(sum('available')), dot: STATE_STYLE.available.stroke },
          { label: 'On hold or booked', n: sum('held') + sum('booked'), sub: share(sum('held') + sum('booked')), dot: STATE_STYLE.booked.stroke },
          { label: 'Sold', n: sum('sold'), sub: share(sum('sold')), dot: STATE_STYLE.sold.stroke },
        ].map((t) => (
          <Card key={t.label} className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ background: t.dot }} /> {t.label}
            </p>
            <p className="text-2xl font-semibold text-slate-900">{t.n.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400">{t.sub}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {can('project.manage') ? (
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: `All ${list.length}` },
              { value: 'draft', label: `Draft ${list.length - live.length}` },
              { value: 'live', label: `Published ${live.length}` },
            ]}
          />
        ) : (
          <span />
        )}
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or locality" className="bg-transparent outline-none" />
        </label>
      </div>

      {!shown.length && <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No projects match.</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {shown.map((p) => (
          <ProjectCard key={p.id} p={p} move={movement.data?.projects.find((m) => m.id === p.id)} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ p, move }: { p: Project; move?: Movement['projects'][number] }) {
  const { can } = useAuth();
  const inv = p.inventory ?? { total: 0, draft: 0, available: 0, held: 0, booked: 0, sold: 0, priceFrom: null, priceTo: null };
  const kind = layoutKind(p.type);
  const word = kind === 'towers' ? 'units' : p.type === 'villa' ? 'villas' : 'plots';
  const pct = (n: number) => (inv.total ? (n / inv.total) * 100 : 0);
  const gone = inv.total ? Math.round(((inv.booked + inv.sold) / inv.total) * 100) : 0;
  const config =
    kind === 'towers'
      ? (p.flatTypes ?? []).map((f) => f.type).join(', ')
      : (() => {
          const areas = (p.plotBlocks ?? []).flatMap((b) => b.plots.map((x) => x.w * x.l));
          if (!areas.length) return '';
          const lo = Math.min(...areas);
          const hi = Math.max(...areas);
          return `${lo.toLocaleString('en-IN')}${lo !== hi ? ` – ${hi.toLocaleString('en-IN')}` : ''} sq.ft`;
        })();
  const pills: { k: 'available' | 'held' | 'booked' | 'sold'; n: number }[] = [
    { k: 'available', n: inv.available },
    { k: 'held', n: inv.held },
    { k: 'booked', n: inv.booked },
    { k: 'sold', n: inv.sold },
  ];
  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700">{ICON[p.type] ?? <Building2 className="h-5 w-5" />}</span>
        <div className="min-w-0 flex-1">
          <Link to={`/projects/${p.id}`} className="block truncate text-base font-semibold text-slate-900 hover:text-brand-800">
            {p.name}
          </Link>
          <p className="truncate text-xs text-slate-500">
            {p.locality}, {p.city}
            {p.developer && ` · ${p.developer}`}
          </p>
        </div>
        <Badge tone={p.published ? 'green' : 'amber'}>{p.published ? 'Published' : 'Draft'}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{PROPERTY_TYPE_LABEL[p.type]}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{PROJECT_STATUS_LABELS[kind][p.status]}</span>
        {(p.approvalBadges ?? []).map((a) => (
          <Badge key={a.name} tone={a.documentUrl ? 'green' : 'slate'} icon={<ShieldCheck className="h-3 w-3" />}>
            {a.name}
          </Badge>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500">Price range</p>
          <p className="font-semibold text-slate-900">{inv.priceFrom ? (inv.priceFrom === inv.priceTo ? formatINR(inv.priceFrom) : `${formatINR(inv.priceFrom)} – ${formatINR(inv.priceTo)}`) : 'Not set'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{kind === 'towers' ? 'Configurations' : 'Sizes'}</p>
          <p className="truncate font-semibold text-slate-900">{config || 'Not set'}</p>
        </div>
      </div>
      {inv.total > 0 ? (
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>
              {inv.total} {word}
            </span>
            <span>{gone}% sold or booked</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
            <div style={{ width: `${pct(inv.available)}%`, background: STATE_STYLE.available.stroke }} />
            <div style={{ width: `${pct(inv.held)}%`, background: STATE_STYLE.held.stroke }} />
            <div style={{ width: `${pct(inv.booked)}%`, background: STATE_STYLE.booked.stroke }} />
            <div style={{ width: `${pct(inv.sold)}%`, background: STATE_STYLE.sold.stroke }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pills
              .filter((x) => x.n || x.k !== 'held')
              .map((x) => (
                <Link
                  key={x.k}
                  to={`/projects/${p.id}?f=${x.k}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition hover:brightness-95"
                  style={{ background: STATE_STYLE[x.k].fill, color: STATE_STYLE[x.k].text }}
                  aria-label={`${x.n} ${STATE_STYLE[x.k].label}: open the layout showing these`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: STATE_STYLE[x.k].stroke }} />
                  {x.n} {STATE_STYLE[x.k].label.toLowerCase()}
                </Link>
              ))}
          </div>
          {move && (
            <p className={clsx('mt-2 text-xs', move.slow ? 'font-medium text-amber-700' : 'text-slate-500')}>
              {move.slow ? '⚠ Slow: ' : ''}
              {move.movedInWindow} sold or booked in 90 days{move.monthsOfStock ? ` · ~${move.monthsOfStock} months of stock at this pace` : ''}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 p-3">
          <div className="flex justify-between text-xs text-amber-900">
            <span>{p.completion?.missing.length ? `Needed: ${p.completion.missing.join(', ')}` : 'Ready to publish'}</span>
            <b>{p.completion?.pct ?? 0}%</b>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-100">
            <div className="h-full bg-amber-500" style={{ width: `${p.completion?.pct ?? 0}%` }} />
          </div>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <Link to={inv.total ? `/projects/${p.id}` : `/projects/${p.id}/edit`} className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800">
            {inv.total ? 'Open layout' : 'Continue setup'}
          </Link>
          {inv.total > 0 && (
            <Link to={`/projects/${p.id}?view=plan`} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Master plan
            </Link>
          )}
          {can('project.manage') && inv.total > 0 && (
            <Link to={`/projects/${p.id}/edit`} className="inline-flex h-9 items-center rounded-xl px-2 text-sm font-medium text-slate-500 hover:text-slate-800">
              Edit
            </Link>
          )}
        </div>
        {can('project.manage') && <span className="text-xs text-slate-400">{p.completion?.pct ?? 0}% complete</span>}
      </div>
    </article>
  );
}
