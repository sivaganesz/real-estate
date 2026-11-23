import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import { PROPERTY_TYPES, PROPERTY_TYPE_LABEL, formatINR, relativeDay } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/Layout';
import { Badge, Button, Card, ErrorNote, Field, Input, PageLoader, SectionTitle, Select, type Tone } from '../components/ui';
import { useToast } from '../components/toast';
import { useAssistantPage } from '../ai/assistant';

type Mapping = { column: number; header: string; field: string; how: 'template' | 'saved' | 'rule' | 'ai' | 'none' | 'manual'; confidence: 'high' | 'check'; samples: string[] };
type Row = {
  index: number;
  status: 'ready' | 'draft' | 'duplicate' | 'error' | 'imported' | 'updated' | 'skipped';
  issues: string[];
  values: { title?: string; type?: string; price?: number; area?: number; areaUnit?: string; locality?: string; city?: string; purpose?: string };
  fixes: Record<string, unknown>;
  duplicateOf?: { id: string; title: string };
  propertyId?: string | null;
  source?: string;
};
type Batch = {
  id: string;
  fileName: string;
  sender?: string;
  kind: 'sheet' | 'brochure';
  sheetName?: string;
  mapping: Mapping[];
  defaultType?: string;
  defaultCity?: string;
  status: 'checking' | 'done';
  aiUsed?: boolean;
  counts?: { imported: number; updated: number; skipped: number; failed: number };
  summary: Record<'total' | 'ready' | 'draft' | 'duplicate' | 'error' | 'imported' | 'updated' | 'skipped', number>;
  rows: Row[];
};
type Overview = { items: { id: string; fileName: string; sender?: string; kind: string; status: string; counts?: Batch['counts']; createdAt: string; by: string; aiUsed?: boolean }[]; formats: { id: string; sender: string; columns: number; uses: number }[]; fields: { key: string; label: string }[] };

const STATUS: Record<Row['status'], { label: string; tone: Tone }> = {
  ready: { label: 'Ready', tone: 'green' },
  draft: { label: 'Draft', tone: 'amber' },
  duplicate: { label: 'Already exists', tone: 'blue' },
  error: { label: 'Needs fixing', tone: 'red' },
  imported: { label: 'Imported', tone: 'green' },
  updated: { label: 'Updated', tone: 'blue' },
  skipped: { label: 'Skipped', tone: 'slate' },
};

const HOW: Record<Mapping['how'], { label: string; tone: Tone }> = {
  template: { label: 'Our template', tone: 'green' },
  saved: { label: 'Saved format', tone: 'green' },
  rule: { label: 'Matched', tone: 'brand' },
  ai: { label: 'AI suggestion', tone: 'ai' },
  manual: { label: 'Set by you', tone: 'slate' },
  none: { label: 'Not matched', tone: 'amber' },
};

export function Import() {
  useAssistantPage({ page: 'Import', suggestions: ['How did the last import go?', 'What columns should an owner sheet have?'] });
  const [batch, setBatch] = useState<Batch | null>(null);
  const [step, setStep] = useState<'upload' | 'columns' | 'check' | 'done'>('upload');
  const overview = useQuery({ queryKey: ['imports'], queryFn: () => api.get<Overview>('/imports') });

  const go = (b: Batch) => {
    setBatch(b);
    setStep(b.status === 'done' ? 'done' : b.kind === 'sheet' ? 'columns' : 'check');
  };

  return (
    <>
      <Link to="/properties" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Properties
      </Link>
      <PageHeader
        title="Import properties"
        subtitle="Any Excel or CSV sheet, our template, or a brochure. Nothing is saved until you've checked it."
        actions={
          <a href="/api/imports/template.xlsx">
            <Button icon={<Download className="h-4 w-4" />}>Our template</Button>
          </a>
        }
      />
      <Steps step={step} kind={batch?.kind} />
      <div className="mt-5">
        {step === 'upload' && <Upload onDone={go} />}
        {step === 'columns' && batch && <Columns batch={batch} fields={overview.data?.fields ?? []} onChange={setBatch} onNext={() => setStep('check')} />}
        {step === 'check' && batch && <Check batch={batch} onChange={setBatch} onBack={batch.kind === 'sheet' ? () => setStep('columns') : undefined} onDone={(b) => { setBatch(b); setStep('done'); void overview.refetch(); }} />}
        {step === 'done' && batch && <Done batch={batch} onAgain={() => { setBatch(null); setStep('upload'); }} />}
      </div>
      {step === 'upload' && <History data={overview.data} onRefresh={() => overview.refetch()} />}
    </>
  );
}

function Steps({ step, kind }: { step: string; kind?: string }) {
  const steps = [
    ['upload', 'Upload'],
    ...(kind === 'brochure' ? [] : [['columns', 'Columns']]),
    ['check', 'Check'],
    ['done', 'Done'],
  ];
  const at = steps.findIndex(([k]) => k === step);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map(([k, label], i) => (
        <li key={k} className="flex items-center gap-2">
          <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', i < at ? 'bg-brand-700 text-white' : i === at ? 'bg-brand-100 text-brand-800 ring-2 ring-brand-600' : 'bg-slate-100 text-slate-400')}>{i < at ? '✓' : i + 1}</span>
          <span className={i === at ? 'font-medium text-slate-900' : 'text-slate-500'}>{label}</span>
          {i < steps.length - 1 && <span className="h-px w-6 bg-slate-200 sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

function Upload({ onDone }: { onDone: (b: Batch) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sender, setSender] = useState('');
  const [defaultType, setDefaultType] = useState('');
  const [defaultCity, setDefaultCity] = useState('');
  const [drag, setDrag] = useState(false);
  const start = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file!);
      if (sender) fd.append('sender', sender);
      if (defaultType) fd.append('defaultType', defaultType);
      if (defaultCity) fd.append('defaultCity', defaultCity);
      return api.upload<{ batch: Batch }>('/imports', fd);
    },
    onSuccess: (r) => onDone(r.batch),
  });
  const isDoc = file && /pdf|image/.test(file.type);
  return (
    <Card className="p-5">
      <button
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
        }}
        className={clsx('flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition', drag ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50')}
      >
        {file ? (
          <>
            {isDoc ? <FileText className="h-8 w-8 text-ai-600" /> : <FileSpreadsheet className="h-8 w-8 text-brand-700" />}
            <p className="mt-2 font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB · click to choose another</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-slate-400" />
            <p className="mt-2 font-medium text-slate-800">Drop a file here, or click to choose</p>
            <p className="mt-1 text-xs text-slate-500">Excel (.xlsx), CSV, or a brochure / catalogue (PDF, photo) · up to 2,000 rows</p>
          </>
        )}
      </button>
      <input ref={ref} type="file" className="hidden" accept=".xlsx,.csv,application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Who sent it? (optional)" hint="Their column layout is remembered for next time">
          <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="e.g. ABC Realty" />
        </Field>
        <Field label="If the sheet has no Type column" hint="Used only for rows that don't say">
          <Select value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>
            <option value="">Work it out from each row</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                All are {PROPERTY_TYPE_LABEL[t].toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="If the sheet has no City column">
          <Input value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)} placeholder="e.g. Chennai" />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {start.isPending && <span className="text-sm text-slate-500">{isDoc ? 'Reading the brochure…' : 'Reading the sheet…'}</span>}
        <Button variant="primary" disabled={!file} loading={start.isPending} onClick={() => start.mutate()}>
          Read the file
        </Button>
      </div>
      <div className="mt-3">
        <ErrorNote error={start.error} />
      </div>
    </Card>
  );
}

function Columns({ batch, fields, onChange, onNext }: { batch: Batch; fields: { key: string; label: string }[]; onChange: (b: Batch) => void; onNext: () => void }) {
  const update = useMutation({
    mutationFn: (body: object) => api.patch<{ batch: Batch }>(`/imports/${batch.id}/mapping`, body),
    onSuccess: (r) => onChange(r.batch),
  });
  const unsure = batch.mapping.filter((m) => m.confidence === 'check' || m.how === 'none').length;
  return (
    <Card className="p-5">
      <SectionTitle>
        Columns in <span className="font-normal text-slate-500">{batch.fileName}</span>
      </SectionTitle>
      <p className="-mt-2 mb-4 text-xs text-slate-500">
        {batch.sheetName}
        {batch.aiUsed && ' · the AI suggested some columns'}. {unsure ? `${unsure} to look at.` : 'Everything matched.'} Columns you don't map are kept as internal details on each property, so nothing is lost.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="pb-2 font-medium">Heading in the file</th>
              <th className="pb-2 font-medium">Looks like</th>
              <th className="pb-2 font-medium">Goes to</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batch.mapping.map((m) => (
              <tr key={m.column} className={clsx(m.confidence === 'check' && 'bg-amber-50/40')}>
                <td className="py-2 pr-3 font-medium text-slate-800">{m.header}</td>
                <td className="max-w-[220px] truncate py-2 pr-3 text-xs text-slate-500">{m.samples.join(' · ') || '(empty)'}</td>
                <td className="py-2 pr-3">
                  <Select className="py-1.5" value={m.field} onChange={(e) => update.mutate({ mapping: [{ column: m.column, field: e.target.value }] })}>
                    {fields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="py-2">
                  <Badge tone={m.confidence === 'check' ? 'amber' : HOW[m.how].tone}>{m.confidence === 'check' && m.how !== 'none' ? `${HOW[m.how].label} · check` : HOW[m.how].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" loading={update.isPending} onClick={onNext}>
          Looks right — check the rows
        </Button>
      </div>
      <ErrorNote error={update.error} />
    </Card>
  );
}

function Check({ batch, onChange, onBack, onDone }: { batch: Batch; onChange: (b: Batch) => void; onBack?: () => void; onDone: (b: Batch) => void }) {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<Row['status'] | 'all'>(batch.summary.error ? 'error' : 'all');
  const [asLive, setAsLive] = useState(can('property.publish'));
  const [dups, setDups] = useState<'skip' | 'update'>('skip');
  const fix = useMutation({
    mutationFn: ({ index, fixes }: { index: number; fixes: Record<string, unknown> }) => api.patch<{ batch: Batch }>(`/imports/${batch.id}/rows/${index}`, fixes),
    onSuccess: (r) => onChange(r.batch),
  });
  const commit = useMutation({
    mutationFn: () => api.post<{ batch: Batch }>(`/imports/${batch.id}/commit`, { asLive, duplicates: dups }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['properties'] });
      void qc.invalidateQueries({ queryKey: ['projects'] });
      toast(`Imported ${r.batch.counts?.imported ?? 0} properties`);
      onDone(r.batch);
    },
  });
  const s = batch.summary;
  const rows = batch.rows.filter((r) => filter === 'all' || r.status === filter);
  const missingCity = batch.rows.filter((r) => r.issues?.some((i) => /\bcity\b/i.test(i))).length;
  const [city, setCity] = useState('');
  const fillAll = useMutation({
    mutationFn: () => api.patch<{ batch: Batch }>(`/imports/${batch.id}/mapping`, { mapping: [], defaultCity: city }),
    onSuccess: (r) => onChange(r.batch),
  });
  const willImport = s.ready + s.draft + (dups === 'update' ? s.duplicate : 0) - batch.rows.filter((r) => r.fixes?.skip && (r.status === 'ready' || r.status === 'draft')).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', `All ${s.total}`],
            ['ready', `Ready ${s.ready}`],
            ['draft', `Draft ${s.draft}`],
            ['duplicate', `Already exist ${s.duplicate}`],
            ['error', `Needs fixing ${s.error}`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={clsx('rounded-full border px-3 py-1 text-xs font-medium', filter === k ? 'border-brand-600 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-600')}>
            {label}
          </button>
        ))}
      </div>
      {missingCity >= 2 && (
        <Card className="flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50/60 p-3">
          <p className="text-sm text-amber-900">{missingCity} rows have no city. Set one for all of them:</p>
          <Input className="w-48 bg-white" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Chennai" />
          <Button size="sm" variant="primary" disabled={!city.trim()} loading={fillAll.isPending} onClick={() => fillAll.mutate()}>
            Apply to all
          </Button>
        </Card>
      )}
      <Card className="divide-y divide-slate-100">
        {rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nothing in this group.</p>}
        {rows.slice(0, 200).map((r) => (
          <CheckRow key={r.index} row={r} kind={batch.kind} onFix={(fixes) => fix.mutate({ index: r.index, fixes })} busy={fix.isPending && fix.variables?.index === r.index} />
        ))}
        {rows.length > 200 && <p className="p-3 text-center text-xs text-slate-500">Showing the first 200 of {rows.length}.</p>}
      </Card>
      <Card className="flex flex-wrap items-center gap-4 p-4">
        {can('property.publish') && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={asLive} onChange={(e) => setAsLive(e.target.checked)} /> Make ready rows live
          </label>
        )}
        {s.duplicate > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Rows that already exist:
            <Select className="w-auto py-1" value={dups} onChange={(e) => setDups(e.target.value as 'skip' | 'update')}>
              <option value="skip">Skip them</option>
              <option value="update">Update the existing property</option>
            </Select>
          </label>
        )}
        <div className="ml-auto flex gap-2">
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              Back to columns
            </Button>
          )}
          <Button variant="primary" disabled={willImport < 1} loading={commit.isPending} onClick={() => commit.mutate()}>
            Import {willImport} {willImport === 1 ? 'row' : 'rows'}
          </Button>
        </div>
        {s.error > 0 && <p className="w-full text-xs text-slate-500">Rows that need fixing are not imported; download them afterwards from the result.</p>}
        <ErrorNote error={commit.error ?? fix.error} />
      </Card>
    </div>
  );
}

function CheckRow({ row, kind, onFix, busy }: { row: Row; kind: string; onFix: (f: Record<string, unknown>) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const v = row.values ?? {};
  const skipped = !!row.fixes?.skip;
  return (
    <div className={clsx('px-4 py-3', skipped && 'opacity-50')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-8 text-xs text-slate-400">#{row.index + 1}</span>
        <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{v.title || 'Untitled'}</span>
        <span className="text-sm text-slate-700">{v.price ? formatINR(v.price) : '—'}</span>
        <span className="text-xs text-slate-500">
          {v.area ? `${v.area} ${v.areaUnit}` : ''} {v.locality ? `· ${v.locality}` : ''}
        </span>
        <span className="flex gap-1">
          {(row.status === 'error' || row.status === 'draft') && (
            <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
              Fix
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onFix({ skip: !skipped })}>
            {skipped ? 'Include' : 'Skip'}
          </Button>
        </span>
      </div>
      {row.issues?.length > 0 && <p className={clsx('ml-11 mt-1 text-xs', row.status === 'error' ? 'text-rose-600' : 'text-slate-500')}>{row.issues.join(' · ')}</p>}
      {row.duplicateOf?.id && (
        <p className="ml-11 mt-0.5 text-xs">
          <Link to={`/properties/${row.duplicateOf.id}`} target="_blank" className="link">
            Open the existing one
          </Link>
        </p>
      )}
      {kind === 'brochure' && row.source && (
        <p className="ml-11 mt-1 flex items-start gap-1 text-xs text-ai-700">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" /> Read from {row.source}
        </p>
      )}
      {open && (
        <div className="ml-11 mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
          {[
            ['type', 'Type', v.type],
            ['price', 'Price (e.g. 48 L)', v.price],
            ['area', 'Area (e.g. 1200 sqft)', v.area],
            ['locality', 'Locality', v.locality],
            ['city', 'City', v.city],
            ['bedrooms', 'BHK', undefined],
            ['floor', 'Floor', undefined],
            ['dimensions', 'Dimensions (30x40)', undefined],
          ].map(([k, label, cur]) =>
            k === 'type' ? (
              <Field key={k} label={label as string}>
                <Select value={f.type ?? String(cur ?? '')} onChange={(e) => setF({ ...f, type: e.target.value })}>
                  <option value="">—</option>
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PROPERTY_TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field key={k as string} label={label as string}>
                <Input value={f[k as string] ?? (cur !== undefined && cur !== null ? String(cur) : '')} onChange={(e) => setF({ ...f, [k as string]: e.target.value })} />
              </Field>
            ),
          )}
          <div className="col-span-2 flex items-end justify-end sm:col-span-4">
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              onClick={() => {
                onFix(Object.fromEntries(Object.entries(f).filter(([, x]) => x !== '')));
                setOpen(false);
              }}
            >
              Re-check row
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Done({ batch, onAgain }: { batch: Batch; onAgain: () => void }) {
  const c = batch.counts ?? { imported: 0, updated: 0, skipped: 0, failed: 0 };
  return (
    <Card className="p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
      <p className="mt-3 text-lg font-semibold text-slate-900">Import finished</p>
      <p className="mt-1 text-sm text-slate-600">
        {c.imported} added · {c.updated} updated · {c.skipped} skipped · {c.failed} not imported
      </p>
      {batch.sender && <p className="mt-1 text-xs text-slate-400">{batch.sender}'s column layout is saved for next time.</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to="/properties?listing=draft">
          <Button>See drafts</Button>
        </Link>
        <Link to="/properties">
          <Button variant="primary">Go to properties</Button>
        </Link>
        {c.skipped + c.failed > 0 && (
          <a href={`/api/imports/${batch.id}/errors.csv`}>
            <Button icon={<Download className="h-4 w-4" />}>Rows not imported (CSV)</Button>
          </a>
        )}
        <Button variant="ghost" onClick={onAgain}>
          Import another file
        </Button>
      </div>
    </Card>
  );
}

function History({ data, onRefresh }: { data?: Overview; onRefresh: () => void }) {
  const forget = useMutation({ mutationFn: (id: string) => api.del(`/imports/formats/${id}`), onSuccess: onRefresh });
  if (!data) return <PageLoader />;
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
      <Card className="p-5">
        <SectionTitle>Recent imports</SectionTitle>
        {!data.items.length ? (
          <p className="text-sm text-slate-500">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                {i.kind === 'brochure' ? <FileText className="h-4 w-4 text-ai-600" /> : <FileSpreadsheet className="h-4 w-4 text-brand-700" />}
                <span className="font-medium text-slate-800">{i.fileName}</span>
                {i.sender && <span className="text-xs text-slate-500">from {i.sender}</span>}
                {i.aiUsed && <Badge tone="ai">AI</Badge>}
                <span className="ml-auto text-xs text-slate-500">
                  {i.status === 'done' ? `${i.counts?.imported ?? 0} added · ${i.counts?.updated ?? 0} updated` : 'Not finished'} · {i.by} · {relativeDay(i.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-5">
        <SectionTitle>Saved formats</SectionTitle>
        {!data.formats.length ? (
          <p className="text-sm text-slate-500">When you say who sent a file, their column layout is remembered here.</p>
        ) : (
          <ul className="space-y-2">
            {data.formats.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 capitalize text-slate-800">{f.sender}</span>
                <span className="text-xs text-slate-400">used {f.uses}×</span>
                <button className="text-slate-400 hover:text-rose-600" title="Forget this format" onClick={() => forget.mutate(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
