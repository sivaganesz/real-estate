import { useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, ExternalLink, Grid3x3, Handshake, Map as MapIcon, Pencil, ShieldCheck, Upload, X } from 'lucide-react';
import { DEAL_STATUS_LABEL, PROJECT_STATUS_LABELS, PROPERTY_TYPE_LABEL, formatINR, layoutKind, type DealStatus } from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Lead } from '../lib/leads';
import { type Project, type Property } from '../lib/property';
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Modal, PageLoader, Segmented } from '../components/ui';
import { BuildingArt, Legend, STATE_STYLE, SiteGrid, SitePlanArt, TowerGrid, type DrawUnit, type UnitState } from '../components/ProjectViews';
import { DealDrawer } from '../components/DealDrawer';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/confirm';
import { useAssistantPage } from '../ai/assistant';

type UnitDeal = { id: string; status: DealStatus; leadId: string | null; customer: string; price: number; paid: number };
type Data = { project: Project; units: Property[]; deals: Record<string, UnitDeal> };
type Filter = 'all' | 'available' | 'held' | 'booked' | 'sold';

/** Turns the project's units into drawable cells, whatever layout they came from. */
function toDraw(units: Property[], project: Project): (DrawUnit & { property: Property })[] {
  const kind = layoutKind(project.type);
  const order = [...(project.towers ?? []).map((t) => t.code), ...(project.plotBlocks ?? []).map((b) => b.code)];
  const blocks = [...new Set(units.map((u) => u.block ?? ''))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b));
  return units.map((u) => {
    const d = u.details ?? {};
    const num = String(u.unitNumber ?? '');
    const pos = kind === 'towers' ? Number(num.slice(-2)) - 1 : Number(num.split('-').pop()) - 1;
    const state: UnitState = u.listing === 'draft' ? 'draft' : u.availability;
    const w = Number(d.width) || undefined;
    const l = Number(d.length) || undefined;
    const name = project.towers?.find((t) => t.code === u.block)?.name ?? project.plotBlocks?.find((b) => b.code === u.block)?.name ?? (u.block ? `Block ${u.block}` : 'Units');
    return {
      property: u,
      id: u.id,
      block: u.block ?? '',
      blockName: name,
      blockIndex: blocks.indexOf(u.block ?? ''),
      unitNumber: num,
      floor: d.floor != null ? Number(d.floor) : null,
      pos: Number.isFinite(pos) && pos >= 0 ? pos : 0,
      kindLabel: project.type === 'plot' ? (w && l ? `${w}×${l} ft` : `${u.area} sq.ft`) : d.bedrooms ? `${d.bedrooms} BHK` : String(d.usage ?? PROPERTY_TYPE_LABEL[u.type]),
      area: u.area ?? 0,
      facing: String(d.facing ?? ''),
      corner: !!d.cornerPlot,
      w,
      l,
      bedrooms: d.bedrooms ? Number(d.bedrooms) : null,
      price: u.price ?? null,
      state,
    };
  });
}

export function ProjectDetail() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('f') as Filter) ?? 'all';
  const view = (params.get('view') as 'grid' | 'plan') ?? 'grid';
  const [tower, setTower] = useState(0);
  const [kindFilter, setKindFilter] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [dealOpen, setDealOpen] = useState<string | null>(null);
  const [starting, setStarting] = useState<Property | null>(null);

  const q = useQuery({ queryKey: ['project', id], queryFn: () => api.get<Data>(`/projects/${id}`) });
  useAssistantPage({ page: 'Project', entity: 'project', entityId: id, label: q.data?.project.name, suggestions: ['Show available units here', 'How is this project selling?', 'Which leads fit this project?'] });
  const publish = useMutation({
    mutationFn: (published: boolean) => api.post<{ live: number; notReady: string[] }>(`/projects/${id}/publish`, { published }),
    onSuccess: (r, published) => {
      for (const k of ['project', 'projects', 'properties']) void qc.invalidateQueries({ queryKey: [k] });
      toast(published ? `Published · ${r.live} units on sale${r.notReady.length ? ` · ${r.notReady.length} need details` : ''}` : 'Back to draft — hidden from the sales team');
    },
  });

  const all = useMemo(() => (q.data ? toDraw(q.data.units, q.data.project) : []), [q.data]);
  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <EmptyState title="Project not found" />;
  const { project, deals } = q.data;
  const kind = layoutKind(project.type);
  const unitWord = kind === 'towers' ? 'unit' : project.type === 'villa' ? 'villa' : 'plot';
  const count = (s: Filter) => (s === 'all' ? all.length : all.filter((u) => u.state === s).length);
  const towers = [...new Set(all.map((u) => u.blockIndex))].sort((a, b) => a - b);
  const towerIdx = Math.min(tower, Math.max(0, towers.length - 1));
  const kinds = [...new Set(all.map((u) => u.kindLabel))].sort();
  const sel = all.find((u) => u.id === selId) ?? null;
  const shown = all.map((u) => ({ ...u, dim: (filter !== 'all' && u.state !== filter) || (!!kindFilter && u.kindLabel !== kindFilter), selected: u.id === selId }));
  const inTower = kind === 'towers' ? shown.filter((u) => u.blockIndex === towers[towerIdx]) : shown;
  const live = all.filter((u) => u.state !== 'draft' && u.price);
  const lo = live.length ? Math.min(...live.map((u) => u.price!)) : null;
  const hi = live.length ? Math.max(...live.map((u) => u.price!)) : null;
  const setParam = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };
  const pick = (u: DrawUnit) => setSelId(u.id === selId ? null : u.id ?? null);

  return (
    <>
      <Link to="/properties?tab=projects" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
            {!project.published && <Badge tone="amber">Draft</Badge>}
            {project.approvalBadges.map((a) => (
              <Badge key={a.name} tone={a.documentUrl ? 'green' : 'slate'} icon={<ShieldCheck className="h-3 w-3" />}>
                {a.name}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-slate-500">
            {PROPERTY_TYPE_LABEL[project.type]} · {project.locality}, {project.city} · {PROJECT_STATUS_LABELS[kind][project.status]}
            {project.possessionDate && ` · possession ${new Date(project.possessionDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
            {project.developer && ` · ${project.developer}`}
          </p>
          {lo && <p className="mt-1 text-sm font-medium text-slate-800">{lo === hi ? formatINR(lo) : `${formatINR(lo)} – ${formatINR(hi)}`}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            value={view}
            onChange={(v) => setParam('view', v === 'grid' ? null : v)}
            options={[
              { value: 'grid', label: <span className="flex items-center gap-1"><Grid3x3 className="h-3.5 w-3.5" /> Grid</span> },
              { value: 'plan', label: <span className="flex items-center gap-1"><MapIcon className="h-3.5 w-3.5" /> Master plan</span> },
            ]}
          />
          {can('project.manage') && (
            <Link to={`/projects/${id}/edit`}>
              <Button icon={<Pencil className="h-4 w-4" />}>Edit project</Button>
            </Link>
          )}
          {can('property.publish') && project.published && (
            <Button variant="ghost" loading={publish.isPending} onClick={async () => (await ask({ title: 'Unpublish this project?', body: 'Unsold units go back to draft and the sales team stops seeing them. You can publish again later.', confirmLabel: 'Unpublish', danger: true })) && publish.mutate(false)}>
              Unpublish
            </Button>
          )}
        </div>
      </div>

      {!project.published && (
        <Card className="mb-4 flex flex-wrap items-center gap-4 border-amber-200 bg-amber-50/50 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">Draft — the sales team can't see this project yet.</p>
            <p className="text-xs text-amber-800">{project.completion.missing.length ? `Needed to publish: ${project.completion.missing.join(', ')}` : `${project.completion.pct}% complete · ready to publish`}</p>
          </div>
          {can('property.publish') && (
            <Button variant="primary" disabled={!!project.completion.missing.length} loading={publish.isPending} onClick={() => publish.mutate(true)}>
              Publish project
            </Button>
          )}
        </Card>
      )}

      {!all.length ? (
        <EmptyState icon={<Grid3x3 className="h-5 w-5" />} title={`No ${unitWord}s yet`} body="Describe the towers or blocks in the project setup; every unit is created from it." action={can('project.manage') && <Link to={`/projects/${id}/edit`}><Button variant="primary">Set up the layout</Button></Link>} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(['all', 'available', 'held', 'booked', 'sold'] as Filter[]).map((s) => (
              <button key={s} onClick={() => setParam('f', s === 'all' || s === filter ? null : s)} className={clsx('rounded-2xl border bg-white px-4 py-3 text-left transition', filter === s ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300')}>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  {s !== 'all' && <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATE_STYLE[s].stroke }} />}
                  {s === 'all' ? `All ${unitWord}s` : STATE_STYLE[s].label}
                </span>
                <span className="text-xl font-semibold text-slate-900">{count(s)}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <Card className="min-w-0 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {kind === 'towers' && towers.length > 1 && <Segmented value={String(towerIdx)} onChange={(v) => setTower(Number(v))} options={towers.map((t, i) => ({ value: String(i), label: all.find((u) => u.blockIndex === t)?.blockName ?? '' }))} />}
                {kinds.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    {kinds.map((k) => (
                      <button key={k} onClick={() => setKindFilter(kindFilter === k ? null : k)} className={clsx('rounded-full border px-2.5 py-1 text-xs', kindFilter === k ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                        {k}
                      </button>
                    ))}
                  </div>
                )}
                <div className="ml-auto">
                  <Legend states={['available', 'held', 'booked', 'sold', ...(all.some((u) => u.state === 'draft') ? (['draft'] as UnitState[]) : [])]} />
                </div>
              </div>
              {view === 'plan' ? (
                // On a phone the drawing keeps a readable size and scrolls sideways.
                <div className="-mx-4 overflow-x-auto px-4">
                  <div className="min-w-[640px]">
                    {kind === 'towers' ? <BuildingArt units={inTower} name={inTower[0]?.blockName ?? project.name} onPick={pick} /> : <SitePlanArt units={shown} onPick={pick} />}
                  </div>
                </div>
              ) : kind === 'towers' ? (
                <TowerGrid units={inTower} onPick={pick} />
              ) : (
                <SiteGrid units={shown} onPick={pick} />
              )}
              <p className="mt-3 text-xs text-slate-400">Click any {unitWord} to see who it's with, or to start a deal.</p>
            </Card>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              {sel ? (
                <UnitPanel u={sel} deal={deals[sel.property.id]} onClose={() => setSelId(null)} onDeal={setDealOpen} onStart={() => setStarting(sel.property)} />
              ) : (
                <Card className="p-4">
                  <p className="text-sm font-semibold text-slate-900">Select a {unitWord}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Booked and sold come from deals, so every booking has its price, approval and payments.</p>
                  <table className="mt-3 w-full text-xs">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="pb-1 font-medium">{kind === 'towers' ? 'Type' : 'Size'}</th>
                        <th className="pb-1 text-right font-medium">Avail.</th>
                        <th className="pb-1 text-right font-medium">Booked</th>
                        <th className="pb-1 text-right font-medium">Sold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kinds.map((k) => {
                        const of = all.filter((u) => u.kindLabel === k);
                        return (
                          <tr key={k} className="border-t border-slate-100">
                            <td className="py-1.5 text-slate-700">{k}</td>
                            <td className="text-right text-emerald-700">{of.filter((u) => u.state === 'available').length}</td>
                            <td className="text-right">{of.filter((u) => u.state === 'booked' || u.state === 'held').length}</td>
                            <td className="text-right text-slate-500">{of.filter((u) => u.state === 'sold').length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              )}
              {can('project.manage') && project.approvalBadges.length > 0 && <Approvals project={project} />}
            </aside>
          </div>
        </>
      )}
      {dealOpen && <DealDrawer id={dealOpen} onClose={() => setDealOpen(null)} />}
      {starting && (
        <StartDealFor
          property={starting}
          onClose={() => setStarting(null)}
          onStarted={(dealId) => {
            setStarting(null);
            setDealOpen(dealId);
            void qc.invalidateQueries({ queryKey: ['project', id] });
          }}
        />
      )}
    </>
  );
}

function UnitPanel({ u, deal, onClose, onDeal, onStart }: { u: DrawUnit & { property: Property }; deal?: UnitDeal; onClose: () => void; onDeal: (id: string) => void; onStart: () => void }) {
  const { can } = useAuth();
  const s = STATE_STYLE[u.state];
  const facts: [string, string][] = [
    [u.floor != null ? 'Type' : 'Size', u.kindLabel],
    ['Area', `${u.area.toLocaleString('en-IN')} sq.ft`],
    ...(u.floor != null ? ([['Floor', String(u.floor)]] as [string, string][]) : []),
    ...(u.facing ? ([['Facing', u.facing]] as [string, string][]) : []),
    ...(u.corner ? ([['Corner', 'Yes']] as [string, string][]) : []),
    ['Price', u.price ? formatINR(u.price) : 'Not set'],
  ];
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{u.blockName}</p>
          <p className="text-lg font-semibold text-slate-900">{u.unitNumber}</p>
          <span className="chip mt-1" style={{ background: s.fill, color: s.text }}>
            {s.label}
          </span>
        </div>
        <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close unit details">
          <X className="h-4 w-4" />
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
      {deal && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="text-xs text-slate-500">{deal.status === 'booked' || deal.status === 'registered' ? 'Booked by' : 'In negotiation with'}</p>
          <p className="font-medium text-slate-900">{deal.leadId ? <Link to={`/leads/${deal.leadId}`} className="hover:text-brand-800">{deal.customer}</Link> : deal.customer}</p>
          <p className="text-xs text-slate-500">
            {DEAL_STATUS_LABEL[deal.status]} · {formatINR(deal.price)}
            {deal.paid ? ` · ${formatINR(deal.paid)} received` : ''}
          </p>
          {deal.id && (
            <Button size="sm" className="mt-2 w-full" icon={<Handshake className="h-3.5 w-3.5" />} onClick={() => onDeal(deal.id)}>
              Open the deal
            </Button>
          )}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {u.state === 'available' && can('deal.create') && (
          <Button variant="primary" className="w-full" icon={<Handshake className="h-4 w-4" />} onClick={onStart}>
            Start a deal for a customer
          </Button>
        )}
        {u.state === 'draft' && <p className="text-xs text-amber-700">Draft: {u.property.readiness.missing.map((m) => m.label.toLowerCase()).join(', ') || 'publish the project to put it on sale'}.</p>}
        <Link to={`/properties/${u.property.id}`} className="flex items-center justify-center gap-1.5 text-xs font-medium text-brand-700 hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> Open the unit's page{can('property.availability') ? ' (hold, photos, sold outside the app)' : ''}
        </Link>
      </div>
    </Card>
  );
}

/** Pick which customer the deal is for; executives see their own customers. */
function StartDealFor({ property, onClose, onStarted }: { property: Property; onClose: () => void; onStarted: (dealId: string) => void }) {
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<Lead | null>(null);
  const [offer, setOffer] = useState('');
  const leads = useQuery({ queryKey: ['deal-leads', q], queryFn: () => api.get<{ items: Lead[] }>(`/leads${qs({ q, open: q ? undefined : true, limit: 8 })}`) });
  const start = useMutation({
    mutationFn: () => api.post<{ deal: { id: string } }>('/deals', { leadId: pick!.id, propertyId: property.id, offer: offer ? Math.round(Number(offer) * 100_000) : undefined }),
    onSuccess: (r) => onStarted(r.deal.id),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Start a deal on ${property.unitNumber}`}
      footer={
        <Button variant="primary" disabled={!pick} loading={start.isPending} onClick={() => start.mutate()}>
          Start negotiation
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {property.title} · list {formatINR(property.price)}
        </p>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer name or phone" />
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {leads.data?.items
            .filter((l) => l.stage !== 'lost' && l.stage !== 'booked')
            .map((l) => (
              <button key={l.id} onClick={() => setPick(l)} className={clsx('flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm', pick?.id === l.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
                <span className="truncate">{l.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{l.summary}</span>
              </button>
            ))}
        </div>
        <Input inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Their first offer in lakhs (optional)" />
        <p className="text-xs text-slate-400">The customer moves to Negotiation. Agreeing a price, holding and booking happen in the deal.</p>
        <ErrorNote error={start.error} />
      </div>
    </Modal>
  );
}

function Approvals({ project }: { project: Project }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [which, setWhich] = useState<string | null>(null);
  const up = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload(`/projects/${project.id}/approvals/${encodeURIComponent(which!)}/document`, fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['project', project.id] });
      toast(`${which} document uploaded — every unit shows the badge`);
    },
  });
  return (
    <Card className="p-4">
      <p className="mb-2 text-sm font-semibold text-slate-900">Approvals</p>
      <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && up.mutate(e.target.files[0])} />
      <ul className="space-y-2">
        {project.approvalBadges.map((a) => (
          <li key={a.name} className="flex items-center gap-2 text-sm">
            <ShieldCheck className={a.documentUrl ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-amber-500'} />
            <span className="flex-1">{a.name}</span>
            {a.documentUrl ? (
              <a href={a.documentUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:underline">
                Document
              </a>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={<Upload className="h-3.5 w-3.5" />}
                onClick={() => {
                  setWhich(a.name);
                  ref.current?.click();
                }}
              >
                Upload
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ErrorNote error={up.error} />
    </Card>
  );
}
