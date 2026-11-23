import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, Building2, Check, FileUp, Home, LandPlot, Plus, Sparkles, Store, X } from 'lucide-react';
import {
  AMENITIES,
  DEFAULT_FLAT_AREA,
  FLAT_TYPES,
  PROJECT_APPROVALS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  formatINR,
  layoutKind,
  plannedUnits,
  projectCompletion,
  type ProjectLayout,
  type ProjectStatus,
  type PropertyType,
} from '@estate/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePlaces, type Project, type Property } from '../lib/property';
import { Badge, Button, Card, ErrorNote, Field, Input, PageLoader, SectionTitle, Segmented, Textarea } from '../components/ui';
import { SiteGrid, TowerGrid, Legend, type DrawUnit, type UnitState } from '../components/ProjectViews';
import { useToast } from '../components/toast';
import { useAssistantPage } from '../ai/assistant';

type Basics = { name: string; type: PropertyType | ''; status: ProjectStatus | ''; developer: string; city: string; locality: string; landAcres: string; possessionDate: string; address: string; reraNumber: string; description: string };
const TYPES: { t: PropertyType; title: string; desc: string; icon: React.ReactNode }[] = [
  { t: 'apartment', title: 'Apartments', desc: 'Towers with floors of flats', icon: <Building2 className="h-5 w-5" /> },
  { t: 'plot', title: 'Plotted layout', desc: 'Blocks of plots (DTCP / CMDA)', icon: <LandPlot className="h-5 w-5" /> },
  { t: 'villa', title: 'Villa community', desc: 'Rows of villas on their own land', icon: <Home className="h-5 w-5" /> },
  { t: 'commercial', title: 'Commercial', desc: 'Shops and offices in a building', icon: <Store className="h-5 w-5" /> },
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const uniform = (n: number, w: number, l: number) => Array.from({ length: n }, () => ({ w, l }));

/**
 * Add or edit a project in three steps — basics, layout, extras — with the
 * building or site plan drawn live as you type. Booked and sold units are
 * protected: the server refuses a layout that would remove them.
 */
export function ProjectWizard() {
  const { id } = useParams();
  const editing = !!id;
  const existing = useQuery({ queryKey: ['project', id], queryFn: () => api.get<{ project: Project; units: Property[] }>(`/projects/${id}`), enabled: editing });
  if (editing && existing.isLoading) return <PageLoader />;
  return <Wizard key={id ?? 'new'} project={existing.data?.project} units={existing.data?.units ?? []} />;
}

function Wizard({ project, units }: { project?: Project; units: Property[] }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const places = usePlaces();
  const mapRef = useRef<HTMLInputElement>(null);
  useAssistantPage({ page: project ? 'Edit project' : 'Add project', entity: project ? 'project' : undefined, entityId: project?.id, label: project?.name });

  const [step, setStep] = useState(project && !(project.towers?.length || project.plotBlocks?.length) ? 2 : 1);
  const [b, setB] = useState<Basics>({
    name: project?.name ?? '',
    type: project?.type ?? '',
    status: project?.status ?? '',
    developer: project?.developer ?? '',
    city: project?.city ?? '',
    locality: project?.locality ?? '',
    landAcres: project?.landAcres ? String(project.landAcres) : '',
    possessionDate: project?.possessionDate?.slice(0, 10) ?? '',
    address: project?.address ?? '',
    reraNumber: project?.reraNumber ?? '',
    description: project?.description ?? '',
  });
  const [layout, setLayout] = useState<ProjectLayout>({
    flatTypes: project?.flatTypes?.length ? project.flatTypes : [{ type: '2 BHK', area: 1150 }, { type: '3 BHK', area: 1450 }],
    towers: project?.towers ?? [],
    plotBlocks: (project?.plotBlocks ?? []).map((x) => ({ ...x, bedrooms: x.bedrooms ?? undefined, builtUp: x.builtUp ?? undefined })),
    pricing: { rate: project?.pricing?.rate ?? undefined, floorRise: project?.pricing?.floorRise ?? 0, cornerPct: project?.pricing?.cornerPct ?? 5 },
  });
  const [amenities, setAmenities] = useState<string[]>(project?.amenities ?? []);
  const [approvals, setApprovals] = useState<string[]>(project?.approvalBadges?.map((a) => a.name) ?? []);
  const [mapNotes, setMapNotes] = useState<string[] | null>(null);
  const [lost, setLost] = useState<string[]>([]);
  const [pvTower, setPvTower] = useState(0);

  const type = b.type || 'apartment';
  const kind = layoutKind(type);
  const planned = useMemo(() => (b.type ? plannedUnits(type, layout) : []), [b.type, type, layout]);
  const statusOf = useMemo(() => new Map(units.map((u) => [`${u.block}|${u.unitNumber}`, u.listing === 'draft' ? ('draft' as UnitState) : (u.availability as UnitState)])), [units]);
  const draw: DrawUnit[] = planned.map((u) => ({ ...u, state: statusOf.get(`${u.block}|${u.unitNumber}`) ?? (project ? 'new' : 'available') }));
  const protectedCount = units.filter((u) => u.availability !== 'available').length;
  const completion = projectCompletion({
    type: b.type || null,
    name: b.name,
    city: b.city,
    locality: b.locality,
    status: b.status,
    developer: b.developer,
    possessionDate: b.possessionDate,
    landAcres: Number(b.landAcres) || null,
    description: b.description,
    amenities,
    approvalBadges: approvals.map((name) => ({ name, documentUrl: project?.approvalBadges?.find((a) => a.name === name)?.documentUrl })),
    pricing: layout.pricing,
    unitCount: planned.length,
  });
  const set = (k: keyof Basics, v: string) => setB((s) => ({ ...s, [k]: v }));
  const prices = planned.map((u) => u.price).filter((p): p is number => !!p);

  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      setLost([]);
      const body = {
        name: b.name,
        type,
        status: b.status || 'under_construction',
        developer: b.developer || null,
        city: b.city,
        locality: b.locality,
        landAcres: Number(b.landAcres) || null,
        possessionDate: b.possessionDate || null,
        address: b.address || null,
        reraNumber: b.reraNumber || null,
        description: b.description || null,
        amenities,
        approvals,
      };
      const pid = project ? (await api.patch<{ project: { _id: string } }>(`/projects/${project.id}`, body), project.id) : (await api.post<{ project: { _id: string } }>('/projects', body)).project._id;
      if (planned.length || project?.towers?.length || project?.plotBlocks?.length) await api.put(`/projects/${pid}/layout`, layout);
      if (publish && !project?.published) await api.post(`/projects/${pid}/publish`, { published: true });
      return { pid, publish };
    },
    onSuccess: ({ pid, publish }) => {
      for (const k of ['projects', 'project', 'properties', 'movement']) void qc.invalidateQueries({ queryKey: [k] });
      toast(publish ? (project?.published ? 'Saved' : 'Project published') : 'Saved as draft');
      navigate(`/projects/${pid}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) setLost((e.details as { lost: string[] }).lost);
    },
  });

  const readMap = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.upload<{ plotBlocks: ProjectLayout['plotBlocks']; plotCount: number; notes: string[] }>('/projects/layout-from-map', fd);
    },
    onSuccess: (r) => {
      setLayout((l) => ({ ...l, plotBlocks: r.plotBlocks }));
      setMapNotes([`Read ${r.plotCount} plots in ${r.plotBlocks.length} blocks. Check the sizes below before saving.`, ...r.notes]);
    },
  });

  const basicsOk = !!(b.type && b.name.trim() && b.city.trim() && b.locality.trim() && b.status);
  const ready = completion.missing.length === 0 && !lost.length;
  const statusLabels = PROJECT_STATUS_LABELS[kind];

  // --- layout editing helpers
  const setTower = (i: number, patch: Partial<ProjectLayout['towers'][number]>) => setLayout((l) => ({ ...l, towers: l.towers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  const setBlock = (i: number, patch: Partial<ProjectLayout['plotBlocks'][number]>) => setLayout((l) => ({ ...l, plotBlocks: l.plotBlocks.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const types = layout.flatTypes.map((f) => f.type);
  const addTower = () =>
    setLayout((l) => {
      const last = l.towers.at(-1);
      const n = l.towers.length;
      return { ...l, towers: [...l.towers, { name: `Tower ${LETTERS[n % 26]}`, code: LETTERS[n % 26], floors: last?.floors ?? 8, plan: last?.plan.slice() ?? [types[0] ?? '2 BHK', types[0] ?? '2 BHK', types[0] ?? '2 BHK', types[0] ?? '2 BHK'] }] };
    });
  const addBlock = () =>
    setLayout((l) => {
      const last = l.plotBlocks.at(-1);
      const n = l.plotBlocks.length;
      const p0 = last?.plots[1] ?? last?.plots[0] ?? { w: type === 'villa' ? 40 : 30, l: type === 'villa' ? 40 : 40 };
      return { ...l, plotBlocks: [...l.plotBlocks, { name: type === 'villa' ? `Row ${n + 1}` : `Block ${LETTERS[n % 26]}`, code: LETTERS[n % 26], plots: uniform(last?.plots.length ?? 10, p0.w, p0.l), bedrooms: last?.bedrooms ?? (type === 'villa' ? 3 : undefined), builtUp: last?.builtUp ?? (type === 'villa' ? 1800 : undefined) }] };
    });
  const pvTowers = [...new Set(draw.map((u) => u.blockIndex))];
  const pvIndex = Math.min(pvTower, Math.max(0, pvTowers.length - 1));

  return (
    <>
      <Link to={project ? `/projects/${project.id}` : '/properties?tab=projects'} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {project ? project.name : 'Projects'}
      </Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project ? `Edit ${project.name}` : 'Add a project'}</h1>
        <div className="flex gap-2">
          {!project?.published && (
            <Button loading={save.isPending && !save.variables} disabled={!b.name.trim() || !b.city.trim() || !b.locality.trim() || !b.type} onClick={() => save.mutate(false)}>
              Save draft
            </Button>
          )}
          <Button variant="primary" disabled={!ready || !can('property.publish')} loading={save.isPending && !!save.variables} onClick={() => save.mutate(true)} title={ready ? undefined : `Still needed: ${completion.missing.join(', ')}`}>
            {project?.published ? 'Save changes' : ready ? 'Publish project' : `Publish · ${completion.missing.length} needed`}
          </Button>
        </div>
      </div>

      {/* Completion */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-slate-600">{completion.missing.length ? `Needed to publish: ${completion.missing.join(', ')}` : 'Ready to publish'}</span>
          <b className="text-slate-900">{completion.pct}% complete</b>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${completion.pct}%` }} />
        </div>
        {completion.next.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {completion.next.map((n) => (
              <span key={n.label} className="chip bg-slate-100 text-slate-600">
                {n.label} <b className="text-brand-700">+{n.gain}%</b>
              </span>
            ))}
          </div>
        )}
      </Card>

      <Segmented
        className="mb-4"
        value={String(step)}
        onChange={(v) => setStep(Number(v))}
        options={[
          { value: '1', label: `1 · Basics${basicsOk ? ' ✓' : ''}` },
          { value: '2', label: `2 · ${kind === 'towers' ? 'Towers & units' : type === 'villa' ? 'Rows & villas' : 'Blocks & plots'}${planned.length ? ' ✓' : ''}` },
          { value: '3', label: '3 · Amenities & approvals' },
        ]}
      />

      {step === 1 && (
        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle>What are you building? *</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {TYPES.map((o) => {
                const locked = !!project && units.length > 0 && o.t !== project.type;
                return (
                  <button
                    key={o.t}
                    disabled={locked}
                    onClick={() => setB((s) => ({ ...s, type: o.t, status: '' }))}
                    className={clsx('flex items-start gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-40', b.type === o.t ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300')}
                  >
                    <span className="rounded-xl bg-white p-2 text-brand-700 shadow-sm">{o.icon}</span>
                    <span>
                      <b className="block text-sm text-slate-900">{o.title}</b>
                      <span className="text-xs text-slate-500">{o.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {project && units.length > 0 && <p className="mt-2 text-xs text-slate-400">The type is fixed once a project has units.</p>}
          </Card>
          <Card className="p-5">
            <SectionTitle>Basic details</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project name *">
                <Input value={b.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Green Meadows" />
              </Field>
              <Field label="Developer / builder">
                <Input value={b.developer} onChange={(e) => set('developer', e.target.value)} />
              </Field>
              <Field label="City *">
                <Input list="pw-cities" value={b.city} onChange={(e) => set('city', e.target.value)} />
              </Field>
              <Field label="Locality *">
                <Input list="pw-localities" value={b.locality} onChange={(e) => set('locality', e.target.value)} />
              </Field>
              <datalist id="pw-cities">{places.data?.cities.map((c) => <option key={c} value={c} />)}</datalist>
              <datalist id="pw-localities">{places.data?.localities.map((c) => <option key={c} value={c} />)}</datalist>
              <Field label="Land area (acres)">
                <Input inputMode="decimal" value={b.landAcres} onChange={(e) => set('landAcres', e.target.value)} />
              </Field>
              <Field label="Address">
                <Input value={b.address} onChange={(e) => set('address', e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <span className="label">Construction status *</span>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_STATUSES.map((s) => (
                  <button key={s} onClick={() => set('status', s)} className={clsx('rounded-full border px-3 py-1.5 text-sm', b.status === s ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                    {statusLabels[s]}
                  </button>
                ))}
              </div>
            </div>
            {b.status && b.status !== 'ready' && (
              <Field label="Expected possession" className="mt-3 max-w-xs">
                <Input type="date" value={b.possessionDate} onChange={(e) => set('possessionDate', e.target.value)} />
              </Field>
            )}
          </Card>
        </div>
      )}

      {step === 2 && !b.type && (
        <Card className="p-6 text-center">
          <p className="font-medium">Pick a project type first</p>
          <p className="text-sm text-slate-500">The layout depends on it: towers and floors, or blocks of plots.</p>
          <Button className="mt-3" onClick={() => setStep(1)}>
            Go to basics
          </Button>
        </Card>
      )}

      {step === 2 && b.type && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            {kind === 'towers' ? (
              <>
                <Card className="p-5">
                  <SectionTitle>{type === 'commercial' ? 'Unit types' : 'Flat types'} in this project</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {FLAT_TYPES.filter((t) => (type === 'commercial' ? ['Shop', 'Office'].includes(t) : !['Shop', 'Office'].includes(t))).map((t) => {
                      const on = types.includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() =>
                            setLayout((l) => ({
                              ...l,
                              flatTypes: on ? l.flatTypes.filter((f) => f.type !== t) : [...l.flatTypes, { type: t, area: DEFAULT_FLAT_AREA[t] ?? 1000 }],
                              towers: on ? l.towers.map((tw) => ({ ...tw, plan: tw.plan.map((p) => (p === t ? (l.flatTypes.find((f) => f.type !== t)?.type ?? p) : p)) })) : l.towers,
                            }))
                          }
                          className={clsx('rounded-full border px-3 py-1 text-sm', on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600')}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {layout.flatTypes.map((f) => (
                      <Field key={f.type} label={`${f.type} area (sq.ft)`}>
                        <Input inputMode="numeric" value={f.area} onChange={(e) => setLayout((l) => ({ ...l, flatTypes: l.flatTypes.map((x) => (x.type === f.type ? { ...x, area: Number(e.target.value) || 0 } : x)) }))} />
                      </Field>
                    ))}
                  </div>
                </Card>
                <Card className="p-5">
                  <SectionTitle action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addTower}>Add tower</Button>}>Towers *</SectionTitle>
                  {!layout.towers.length && <p className="text-sm text-slate-500">Add a tower: its floors and the flats on each floor.</p>}
                  <div className="space-y-4">
                    {layout.towers.map((t, i) => (
                      <div key={i} className="rounded-2xl border border-slate-200 p-3">
                        <div className="grid grid-cols-[1fr_70px_80px_90px_auto] items-end gap-2">
                          <Field label="Name">
                            <Input value={t.name} onChange={(e) => setTower(i, { name: e.target.value })} />
                          </Field>
                          <Field label="Code">
                            <Input value={t.code} maxLength={4} onChange={(e) => setTower(i, { code: e.target.value.toUpperCase() })} />
                          </Field>
                          <Field label="Floors">
                            <Input inputMode="numeric" value={t.floors} onChange={(e) => setTower(i, { floors: Math.min(80, Math.max(1, Number(e.target.value) || 1)) })} />
                          </Field>
                          <Field label="Flats / floor">
                            <Input
                              inputMode="numeric"
                              value={t.plan.length}
                              onChange={(e) => {
                                const n = Math.min(20, Math.max(1, Number(e.target.value) || 1));
                                setTower(i, { plan: Array.from({ length: n }, (_, k) => t.plan[k] ?? t.plan.at(-1) ?? types[0] ?? '2 BHK') });
                              }}
                            />
                          </Field>
                          <button onClick={() => setLayout((l) => ({ ...l, towers: l.towers.filter((_, j) => j !== i) }))} className="mb-2 text-slate-400 hover:text-rose-600" aria-label={`Remove ${t.name}`}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mb-1.5 mt-3 text-xs text-slate-500">Every floor repeats this plan. Pick the type at each position:</p>
                        <div className="flex flex-wrap gap-2">
                          {t.plan.map((p, k) => (
                            <div key={k} className="rounded-xl bg-slate-50 p-2">
                              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
                                Flat {String(k + 1).padStart(2, '0')} · {k === 0 ? 'East' : k === t.plan.length - 1 ? 'West' : k % 2 ? 'North' : 'South'}
                              </p>
                              <div className="flex gap-1">
                                {types.map((ty) => (
                                  <button key={ty} onClick={() => setTower(i, { plan: t.plan.map((x, j) => (j === k ? ty : x)) })} className={clsx('rounded-md px-1.5 py-0.5 text-[11px]', p === ty ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>
                                    {ty.replace(' BHK', 'B')}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">= {t.floors * t.plan.length} units</p>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            ) : (
              <>
                {type === 'plot' && (
                  <Card className="border-ai-100 bg-gradient-to-br from-ai-50 to-white p-5">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <Sparkles className="h-4 w-4 text-ai-600" /> Have the approved layout drawing?
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">Upload the DTCP / CMDA layout PDF or a photo. The AI reads the blocks, plot numbers and sizes; you check them.</p>
                    <input ref={mapRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && readMap.mutate(e.target.files[0])} />
                    <Button size="sm" variant="ai" className="mt-3" icon={<FileUp className="h-3.5 w-3.5" />} loading={readMap.isPending} onClick={() => mapRef.current?.click()}>
                      Upload layout map
                    </Button>
                    {mapNotes && (
                      <ul className="mt-3 space-y-1 text-xs text-slate-700">
                        {mapNotes.map((n) => (
                          <li key={n}>• {n}</li>
                        ))}
                      </ul>
                    )}
                    <ErrorNote error={readMap.error} />
                  </Card>
                )}
                <Card className="p-5">
                  <SectionTitle action={<Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addBlock}>{type === 'villa' ? 'Add row' : 'Add block'}</Button>}>{type === 'villa' ? 'Rows of villas *' : 'Blocks *'}</SectionTitle>
                  {!layout.plotBlocks.length && <p className="text-sm text-slate-500">Add a block: how many plots and their size. Corner plots are the first and last in each block.</p>}
                  <div className="space-y-3">
                    {layout.plotBlocks.map((x, i) => {
                      const same = x.plots.every((p) => p.w === x.plots[0].w && p.l === x.plots[0].l);
                      const ref = x.plots[1] ?? x.plots[0];
                      return (
                        <div key={i} className="rounded-2xl border border-slate-200 p-3">
                          <div className="grid grid-cols-[1fr_64px_80px_72px_72px_auto] items-end gap-2">
                            <Field label="Name">
                              <Input value={x.name} onChange={(e) => setBlock(i, { name: e.target.value })} />
                            </Field>
                            <Field label="Code">
                              <Input value={x.code} maxLength={4} onChange={(e) => setBlock(i, { code: e.target.value.toUpperCase() })} />
                            </Field>
                            <Field label={type === 'villa' ? 'Villas' : 'Plots'}>
                              <Input inputMode="numeric" value={x.plots.length} onChange={(e) => setBlock(i, { plots: uniform(Math.min(300, Math.max(1, Number(e.target.value) || 1)), ref.w, ref.l) })} />
                            </Field>
                            <Field label="Width (ft)">
                              <Input inputMode="decimal" value={ref.w} onChange={(e) => setBlock(i, { plots: uniform(x.plots.length, Number(e.target.value) || 1, ref.l) })} />
                            </Field>
                            <Field label="Length (ft)">
                              <Input inputMode="decimal" value={ref.l} onChange={(e) => setBlock(i, { plots: uniform(x.plots.length, ref.w, Number(e.target.value) || 1) })} />
                            </Field>
                            <button onClick={() => setLayout((l) => ({ ...l, plotBlocks: l.plotBlocks.filter((_, j) => j !== i) }))} className="mb-2 text-slate-400 hover:text-rose-600" aria-label={`Remove ${x.name}`}>
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {type === 'villa' && (
                            <div className="mt-2 grid grid-cols-2 gap-2 sm:w-72">
                              <Field label="Bedrooms">
                                <Input inputMode="numeric" value={x.bedrooms ?? ''} onChange={(e) => setBlock(i, { bedrooms: Number(e.target.value) || undefined })} />
                              </Field>
                              <Field label="Built-up (sq.ft)">
                                <Input inputMode="numeric" value={x.builtUp ?? ''} onChange={(e) => setBlock(i, { builtUp: Number(e.target.value) || undefined })} />
                              </Field>
                            </div>
                          )}
                          <p className="mt-2 text-xs text-slate-500">
                            {same ? `${x.plots.length} × ${ref.w}×${ref.l} ft (${(ref.w * ref.l).toLocaleString('en-IN')} sq.ft each)` : `${x.plots.length} plots of mixed sizes (e.g. larger corner plots) — editing the size above makes them all the same.`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )}
            <Card className="p-5">
              <SectionTitle>
                Pricing <span className="font-normal text-slate-400">· optional</span>
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Base rate (₹ per sq.ft)">
                  <Input inputMode="numeric" value={layout.pricing.rate ?? ''} onChange={(e) => setLayout((l) => ({ ...l, pricing: { ...l.pricing, rate: Number(e.target.value) || undefined } }))} placeholder={kind === 'towers' ? 'e.g. 6300' : 'e.g. 3000'} />
                </Field>
                {kind === 'towers' ? (
                  <Field label="Floor rise (₹/sq.ft per floor)">
                    <Input inputMode="numeric" value={layout.pricing.floorRise ?? 0} onChange={(e) => setLayout((l) => ({ ...l, pricing: { ...l.pricing, floorRise: Number(e.target.value) || 0 } }))} />
                  </Field>
                ) : (
                  <Field label="Corner premium (%)">
                    <Input inputMode="numeric" value={layout.pricing.cornerPct ?? 5} onChange={(e) => setLayout((l) => ({ ...l, pricing: { ...l.pricing, cornerPct: Number(e.target.value) || 0 } }))} />
                  </Field>
                )}
              </div>
              {prices.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Every {kind === 'towers' ? 'flat' : type === 'villa' ? 'villa' : 'plot'}: {formatINR(Math.min(...prices))}
                  {Math.min(...prices) !== Math.max(...prices) && ` – ${formatINR(Math.max(...prices))}`}. Sold and booked units keep their price.
                </p>
              )}
            </Card>
          </div>

          <Card className="p-5 xl:sticky xl:top-20 xl:self-start">
            <SectionTitle action={kind === 'towers' && pvTowers.length > 1 && <Segmented value={String(pvIndex)} onChange={(v) => setPvTower(Number(v))} options={pvTowers.map((t) => ({ value: String(t), label: layout.towers[t]?.name ?? '' }))} />}>
              {kind === 'towers' ? 'Building preview' : 'Site plan preview'}
            </SectionTitle>
            {!planned.length ? (
              <p className="py-10 text-center text-sm text-slate-500">{kind === 'towers' ? 'Add a tower to see the building.' : 'Add a block to see the site plan.'}</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-600">
                  <b>{planned.length}</b> {kind === 'towers' ? 'units' : type === 'villa' ? 'villas' : 'plots'}
                  {project ? ' · new ones are marked' : ' · all start Available'}
                </p>
                {kind === 'towers' ? <TowerGrid units={draw.filter((u) => u.blockIndex === pvIndex)} compact /> : <SiteGrid units={draw} compact />}
                <div className="mt-3">
                  <Legend states={project ? ['available', 'held', 'booked', 'sold', 'draft', 'new'] : ['available']} />
                </div>
              </>
            )}
            {protectedCount > 0 && <p className="mt-3 text-xs text-slate-500">{protectedCount} units are held, booked or sold. They're protected: removing them is refused.</p>}
            {lost.length > 0 && (
              <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                Can't save: {lost.length} unit{lost.length > 1 ? 's' : ''} with a buyer would be removed ({lost.slice(0, 6).join(', ')}{lost.length > 6 ? '…' : ''}). Keep them in the layout, or release them first.
              </p>
            )}
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle>Amenities <span className="font-normal text-slate-400">· every unit inherits them</span></SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {AMENITIES.map((a) => {
                const on = amenities.includes(a);
                return (
                  <button key={a} onClick={() => setAmenities(on ? amenities.filter((x) => x !== a) : [...amenities, a])} className={clsx('rounded-full border px-2.5 py-1 text-xs', on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600')}>
                    {a}
                  </button>
                );
              })}
            </div>
          </Card>
          <Card className="p-5">
            <SectionTitle>About the project</SectionTitle>
            <Textarea rows={3} value={b.description} onChange={(e) => set('description', e.target.value)} placeholder="Two or three lines a salesperson would say: location, highlights, possession." />
          </Card>
          <Card className="p-5">
            <SectionTitle>Approvals <span className="font-normal text-slate-400">· badge now, documents on the project page</span></SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROJECT_APPROVALS.map((a) => {
                const on = approvals.includes(a.name);
                const doc = project?.approvalBadges?.find((x) => x.name === a.name)?.documentUrl;
                return (
                  <button key={a.name} onClick={() => setApprovals(on ? approvals.filter((x) => x !== a.name) : [...approvals, a.name])} className={clsx('flex items-center gap-3 rounded-xl border p-3 text-left', on ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200')}>
                    <span className={clsx('flex h-5 w-5 items-center justify-center rounded-md border', on ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-300')}>{on && <Check className="h-3.5 w-3.5" />}</span>
                    <span className="flex-1">
                      <b className="block text-sm">{a.name}</b>
                      <span className="text-xs text-slate-500">{a.desc}</span>
                    </span>
                    {on && (doc ? <Badge tone="green">Document ✓</Badge> : <Badge tone="amber">Document pending</Badge>)}
                  </button>
                );
              })}
            </div>
            {approvals.includes('RERA') && (
              <Field label="RERA registration number" className="mt-3 max-w-md">
                <Input value={b.reraNumber} onChange={(e) => set('reraNumber', e.target.value)} placeholder="e.g. TN/29/Building/0418/2025" />
              </Field>
            )}
          </Card>
        </div>
      )}

      <div className="mt-5 flex justify-between">
        {step > 1 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>← Back</Button> : <span />}
        {step < 3 && (
          <Button variant="primary" onClick={() => setStep(step + 1)}>
            Next: {step === 1 ? (kind === 'towers' ? 'towers & units' : 'blocks & plots') : 'amenities & approvals'} →
          </Button>
        )}
      </div>
      <div className="mt-3">
        <ErrorNote error={save.error && !(save.error instanceof ApiError && save.error.status === 409) ? save.error : null} />
      </div>
    </>
  );
}
