import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, Grid3x3, Percent, Plus, Send } from 'lucide-react';
import { PROJECT_STATUS_LABEL, PROPERTY_TYPE_LABEL, formatINR } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { type Project, type Property } from '../lib/property';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Input, Modal, PageLoader, Stat } from '../components/ui';
import { useToast } from '../components/toast';
import { useAssistantPage } from '../ai/assistant';

const CELL: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100',
  held: 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100',
  booked: 'bg-sky-50 text-sky-800 ring-sky-200 hover:bg-sky-100',
  sold: 'bg-slate-100 text-slate-400 ring-slate-200',
  draft: 'bg-white text-slate-500 ring-dashed ring-slate-300 hover:bg-slate-50',
};

export function ProjectDetail() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [gen, setGen] = useState(params.get('units') === '1');
  const [revise, setRevise] = useState(false);
  const q = useQuery({ queryKey: ['project', id], queryFn: () => api.get<{ project: Project; units: Property[] }>(`/projects/${id}`) });
  useAssistantPage({
    page: 'Project',
    entity: 'project',
    entityId: id,
    label: q.data?.project.name,
    suggestions: ['Show available units here', 'How is this project selling?', 'Which leads fit this project?'],
  });
  const publish = useMutation({
    mutationFn: () => api.post<{ published: number; notReady: string[] }>(`/projects/${id}/publish-ready`),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['project', id] });
      toast(`Published ${r.published} units${r.notReady.length ? `; ${r.notReady.length} still need details` : ''}`);
    },
  });

  const blocks = useMemo(() => {
    const units = q.data?.units ?? [];
    const byBlock = new Map<string, Property[]>();
    for (const u of units) {
      const k = u.block ?? '';
      byBlock.set(k, [...(byBlock.get(k) ?? []), u]);
    }
    return [...byBlock.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [q.data]);

  if (q.isLoading) return <PageLoader />;
  if (!q.data) return <EmptyState title="Project not found" />;
  const { project, units } = q.data;
  const count = (pred: (u: Property) => boolean) => units.filter(pred).length;
  const live = (u: Property) => u.listing === 'live';
  const drafts = count((u) => u.listing === 'draft');
  const isPlot = project.type === 'plot' || project.type === 'villa';

  return (
    <>
      <Link to="/properties?tab=projects" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
          <p className="text-sm text-slate-500">
            {PROPERTY_TYPE_LABEL[project.type]} · {project.locality}, {project.city} · {PROJECT_STATUS_LABEL[project.status]}
            {project.possessionDate && ` · possession ${new Date(project.possessionDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`}
          </p>
          {project.reraNumber && <p className="mt-0.5 text-xs text-slate-400">RERA {project.reraNumber}</p>}
        </div>
        {can('project.manage') && (
          <div className="flex flex-wrap gap-2">
            <Button icon={<Percent className="h-4 w-4" />} onClick={() => setRevise(true)}>
              Revise prices
            </Button>
            {drafts > 0 && (
              <Button icon={<Send className="h-4 w-4" />} loading={publish.isPending} onClick={() => publish.mutate()}>
                Publish {drafts} drafts
              </Button>
            )}
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setGen(true)}>
              Add units
            </Button>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Available" value={count((u) => live(u) && u.availability === 'available')} tone="green" />
        <Stat label="On hold" value={count((u) => u.availability === 'held')} tone="amber" />
        <Stat label="Booked" value={count((u) => u.availability === 'booked')} />
        <Stat label="Sold" value={count((u) => u.availability === 'sold')} hint={`of ${units.length} units`} />
      </div>

      {!units.length ? (
        <EmptyState
          icon={<Grid3x3 className="h-5 w-5" />}
          title="No units yet"
          body="Add a block's units in one go: floors, units per floor, size and base price."
          action={can('project.manage') && <Button variant="primary" onClick={() => setGen(true)}>Add units</Button>}
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            {[
              ['available', 'Available'],
              ['held', 'On hold'],
              ['booked', 'Booked'],
              ['sold', 'Sold'],
              ['draft', 'Draft'],
            ].map(([k, l]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={clsx('h-3 w-3 rounded ring-1', CELL[k])} /> {l}
              </span>
            ))}
          </div>
          {blocks.map(([block, list]) => (
            <Card key={block} className="overflow-x-auto p-4">
              <p className="mb-3 text-sm font-semibold text-slate-800">
                {block ? `Block ${block}` : isPlot ? 'Layout' : 'Units'} <span className="font-normal text-slate-400">· {list.length} units</span>
              </p>
              {isPlot ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-1.5">
                  {list
                    .slice()
                    .sort((a, b) => Number((a.unitNumber ?? '').replace(/\D/g, '')) - Number((b.unitNumber ?? '').replace(/\D/g, '')))
                    .map((u) => (
                      <UnitCell key={u.id} u={u} />
                    ))}
                </div>
              ) : (
                <FloorGrid units={list} />
              )}
            </Card>
          ))}
        </div>
      )}
      {gen && <GenerateUnits project={project} onClose={() => setGen(false)} />}
      {revise && <RevisePrices project={project} onClose={() => setRevise(false)} />}
    </>
  );
}

function FloorGrid({ units }: { units: Property[] }) {
  const floors = [...new Set(units.map((u) => Number(u.details.floor ?? 0)))].sort((a, b) => b - a);
  return (
    <table className="border-separate border-spacing-1.5">
      <tbody>
        {floors.map((f) => (
          <tr key={f}>
            <td className="pr-2 text-right text-xs text-slate-400">{f === 0 ? 'G' : `F${f}`}</td>
            {units
              .filter((u) => Number(u.details.floor ?? 0) === f)
              .sort((a, b) => (a.unitNumber ?? '').localeCompare(b.unitNumber ?? ''))
              .map((u) => (
                <td key={u.id}>
                  <UnitCell u={u} />
                </td>
              ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UnitCell({ u }: { u: Property }) {
  const state = u.listing === 'draft' ? 'draft' : u.availability;
  return (
    <Link
      to={`/properties/${u.id}`}
      title={`${u.title} · ${formatINR(u.price)} · ${state}`}
      className={clsx('flex h-14 w-[76px] flex-col items-center justify-center rounded-lg text-center ring-1 transition', CELL[state])}
    >
      <span className="text-xs font-semibold">{u.unitNumber}</span>
      <span className="text-[10px] opacity-80">{state === 'sold' ? 'Sold' : formatINR(u.price)}</span>
    </Link>
  );
}

function GenerateUnits({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const isPlot = project.type === 'plot';
  const isVilla = project.type === 'villa';
  const flat = !isPlot && !isVilla;
  const [f, setF] = useState({ block: flat ? 'A' : '', floorFrom: '1', floorTo: flat ? '5' : '1', unitsPerFloor: isPlot ? '20' : '4', bedrooms: '2', area: isPlot ? '1200' : '1100', price: '', floorRise: '0', facing: '', plotLength: '40', plotWidth: '30', landArea: '1500' });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const total = (Number(f.floorTo) - Number(f.floorFrom) + 1) * Number(f.unitsPerFloor || 0);
  const run = useMutation({
    mutationFn: () =>
      api.post<{ created: number; skipped: number }>(`/projects/${project.id}/units`, {
        block: f.block,
        floorFrom: Number(f.floorFrom),
        floorTo: Number(f.floorTo),
        unitsPerFloor: Number(f.unitsPerFloor),
        bedrooms: isPlot ? null : Number(f.bedrooms),
        area: Number(f.area),
        price: Number(f.price) * 100_000,
        floorRise: Number(f.floorRise) * 1000,
        facing: f.facing || null,
        plotLength: isPlot ? Number(f.plotLength) : null,
        plotWidth: isPlot ? Number(f.plotWidth) : null,
        landArea: isVilla ? Number(f.landArea) : null,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['project', project.id] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
      toast(`Added ${r.created} units as drafts${r.skipped ? ` (${r.skipped} already existed)` : ''}`);
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Add units to ${project.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!Number(f.price) || total < 1} loading={run.isPending} onClick={() => run.mutate()}>
            Create {total > 0 ? total : ''} units
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">Units are created as drafts with the project's location, amenities and RERA number. Review, then publish them together.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={isPlot ? 'Phase (optional)' : 'Block / tower'}>
          <Input value={f.block} onChange={(e) => set('block', e.target.value)} />
        </Field>
        {flat && (
          <>
            <Field label="From floor">
              <Input type="number" value={f.floorFrom} onChange={(e) => set('floorFrom', e.target.value)} />
            </Field>
            <Field label="To floor">
              <Input type="number" value={f.floorTo} onChange={(e) => set('floorTo', e.target.value)} />
            </Field>
          </>
        )}
        <Field label={flat ? 'Units per floor' : isPlot ? 'Number of plots' : 'Number of villas'}>
          <Input type="number" value={f.unitsPerFloor} onChange={(e) => set('unitsPerFloor', e.target.value)} />
        </Field>
        {!isPlot && (
          <Field label="Bedrooms (BHK)">
            <Input type="number" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
          </Field>
        )}
        <Field label={isPlot ? 'Plot area (sq.ft)' : 'Built-up area (sq.ft)'}>
          <Input type="number" value={f.area} onChange={(e) => set('area', e.target.value)} />
        </Field>
        {isPlot && (
          <>
            <Field label="Width (ft)">
              <Input type="number" value={f.plotWidth} onChange={(e) => set('plotWidth', e.target.value)} />
            </Field>
            <Field label="Length (ft)">
              <Input type="number" value={f.plotLength} onChange={(e) => set('plotLength', e.target.value)} />
            </Field>
          </>
        )}
        {isVilla && (
          <Field label="Land area (sq.ft)">
            <Input type="number" value={f.landArea} onChange={(e) => set('landArea', e.target.value)} />
          </Field>
        )}
        <Field label="Base price (lakhs)">
          <Input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="e.g. 68" />
        </Field>
        {flat && (
          <Field label="Floor rise (₹ thousand / floor)">
            <Input type="number" value={f.floorRise} onChange={(e) => set('floorRise', e.target.value)} />
          </Field>
        )}
        <Field label="Facing (optional)">
          <Input value={f.facing} onChange={(e) => set('facing', e.target.value)} />
        </Field>
      </div>
      {flat && Number(f.price) > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Unit numbers like {f.block}
          {f.floorFrom}01 … {f.block}
          {f.floorTo}
          {String(f.unitsPerFloor).padStart(2, '0')}; top floor priced at {formatINR(Number(f.price) * 100_000 + Number(f.floorRise) * 1000 * (Number(f.floorTo) - Number(f.floorFrom)))}.
        </p>
      )}
      <div className="mt-3">
        <ErrorNote error={run.error} />
      </div>
    </Modal>
  );
}

function RevisePrices({ project, onClose }: { project: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [pct, setPct] = useState('');
  const run = useMutation({
    mutationFn: () => api.post<{ updated: number }>(`/projects/${project.id}/revise-prices`, { percent: Number(pct) }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['project', project.id] });
      toast(`Updated ${r.updated} unsold units`);
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Revise prices"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!Number(pct)} loading={run.isPending} onClick={() => run.mutate()}>
            Apply to unsold units
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">Applies to available and held units only. Booked and sold units keep their agreed price.</p>
      <Field label="Change by (%)" hint="Use a negative number for a reduction, e.g. -2">
        <Input type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
      </Field>
      <ErrorNote error={run.error} />
      <Badge tone="amber" className="mt-3">Every change is recorded in each unit's history</Badge>
    </Modal>
  );
}
