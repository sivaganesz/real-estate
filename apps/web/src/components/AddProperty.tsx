import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FileUp, Sparkles, Wand2 } from 'lucide-react';
import type { AreaUnit, PropertyType, Purpose } from '@estate/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Drawer, ErrorNote, Textarea } from './ui';
import { PropertyForm, emptyForm, formReadiness, toPayload, type FormState } from './PropertyForm';
import { useToast } from './toast';

type Extracted = {
  priceNegotiable?: boolean;
  type: PropertyType | null;
  purpose: Purpose | null;
  title: string | null;
  price: number | null;
  area: number | null;
  areaUnit: AreaUnit | null;
  city: string | null;
  locality: string | null;
  address: string | null;
  pincode: string | null;
  details: Record<string, string | number | boolean | null>;
  amenities: string[];
  highlights: string[];
  description: string | null;
  approvals: string[];
  extras: { label: string; value: string }[];
  sources: Record<string, string>;
  unsure: { field: string; why: string }[];
  checks: string[];
};

type Dup = { id: string; title: string; subtitle?: string };

const EXAMPLE = '2 BHK flat for sale in Porur, Chennai. 980 sq.ft on the 3rd floor of 5, east facing, semi-furnished. Asking 62 lakhs, negotiable. RERA registered. Lift, car parking, power backup.';

/**
 * Add property without a long form: describe it (type, paste, speak or attach a
 * brochure or photo), the assistant fills the short form, the person checks and saves.
 */
export function AddProperty({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can, ai } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [sources, setSources] = useState<Record<string, string>>({});
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string[]>([]);
  const [options, setOptions] = useState<Extracted[]>([]);
  const [dups, setDups] = useState<Dup[] | null>(null);

  const reset = () => {
    setText('');
    setFile(null);
    setForm(emptyForm());
    setSources({});
    setAiFilled(new Set());
    setNotes([]);
    setOptions([]);
    setDups(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const apply = (e: Extracted) => {
    const filled = new Set<string>();
    const next: FormState = { ...form, details: { ...form.details } };
    const put = <K extends keyof FormState>(k: K, v: FormState[K] | null | undefined, key = k as string) => {
      if (v === null || v === undefined || v === '') return;
      next[k] = v as FormState[K];
      filled.add(key);
    };
    put('type', e.type ?? undefined);
    put('purpose', e.purpose ?? undefined);
    put('title', e.title ?? undefined);
    put('price', e.price ? String(e.price) : undefined);
    if (e.priceNegotiable) next.priceNegotiable = true;
    put('area', e.area ? String(e.area) : undefined);
    put('areaUnit', e.areaUnit ?? undefined);
    put('city', e.city ?? undefined);
    put('locality', e.locality ?? undefined);
    put('address', e.address ?? undefined);
    put('pincode', e.pincode ?? undefined);
    put('description', e.description ?? undefined);
    for (const [k, v] of Object.entries(e.details ?? {})) {
      if (v === null || v === '') continue;
      next.details[k] = v;
      filled.add(`details.${k}`);
    }
    if (e.amenities.length) next.amenities = [...new Set([...next.amenities, ...e.amenities])];
    if (e.highlights.length) next.highlights = e.highlights;
    if (e.extras.length) next.extras = [...next.extras, ...e.extras];
    if (e.approvals.length) next.approvals = e.approvals.map((name) => ({ name }));
    setForm(next);
    setAiFilled(filled);
    setSources(e.sources ?? {});
    setNotes([...e.checks, ...e.unsure.map((u) => `${u.field}: ${u.why}`)]);
  };

  const read = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (text.trim()) fd.append('text', text);
      if (file) fd.append('file', file);
      return api.upload<{ mode: string; properties: Extracted[] }>('/properties/extract', fd);
    },
    onSuccess: (r) => {
      if (!r.properties.length) {
        setNotes(['Nothing property-like was found. Add more detail.']);
        return;
      }
      apply(r.properties[0]);
      setOptions(r.properties.length > 1 ? r.properties : []);
    },
  });

  const save = useMutation({
    mutationFn: async ({ publish, allowDuplicate }: { publish: boolean; allowDuplicate?: boolean }) => {
      const payload = { ...toPayload(form), sources: Object.fromEntries([...aiFilled].filter((k) => sources[k]).map((k) => [k, sources[k]])) };
      const r = await api.post<{ property: { id: string; title: string } }>(`/properties${allowDuplicate ? '?allowDuplicate=true' : ''}`, payload);
      if (publish) await api.post(`/properties/${r.property.id}/listing`, { to: 'live' });
      return { ...r.property, publish };
    },
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ['properties'] });
      toast(p.publish ? `“${p.title}” is live` : `Saved “${p.title}” as a draft`);
      close();
      navigate(`/properties/${p.id}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) setDups((e.details as { duplicates: Dup[] }).duplicates);
    },
  });

  const readiness = formReadiness(form);
  const hasInput = !!text.trim() || !!file;

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Add a property"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button loading={save.isPending && !save.variables?.publish} onClick={() => save.mutate({ publish: false })}>
            Save as draft
          </Button>
          {can('property.publish') && (
            <Button variant="primary" disabled={!readiness.ready} title={readiness.ready ? undefined : `Still needed: ${readiness.missing.map((m) => m.label).join(', ')}`} loading={save.isPending && save.variables?.publish} onClick={() => save.mutate({ publish: true })}>
              Save & publish
            </Button>
          )}
        </>
      }
    >
      <div className="rounded-2xl border border-ai-100 bg-gradient-to-br from-ai-50 to-white p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Sparkles className="h-4 w-4 text-ai-600" /> Describe it, or drop a brochure or photo
        </p>
        <p className="mt-0.5 text-xs text-slate-500">Paste the owner's WhatsApp message, type a line, or attach a PDF. I'll fill the form below and show where each value came from.</p>
        <Textarea className="mt-3 bg-white" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button size="sm" variant="secondary" icon={<FileUp className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
            {file ? file.name : 'Attach brochure / photo'}
          </Button>
          {!hasInput && (
            <button className="text-xs text-ai-700 hover:underline" onClick={() => setText(EXAMPLE)}>
              Use an example
            </button>
          )}
          <Button size="sm" variant="ai" className="ml-auto" icon={<Wand2 className="h-3.5 w-3.5" />} disabled={!hasInput} loading={read.isPending} onClick={() => read.mutate()}>
            Fill the form
          </Button>
        </div>
        {ai?.mode === 'offline' && <p className="mt-2 text-[11px] text-slate-500">Offline mode reads typed text and PDFs with rules; photos need the Gemini key.</p>}
        <ErrorNote error={read.error} />
      </div>

      {options.length > 1 && (
        <div className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">
          This brochure describes {options.length} unit types. Showing one; pick another, or use <b>Import</b> to add them all at once.
          <div className="mt-2 flex flex-wrap gap-1.5">
            {options.map((o, i) => (
              <button key={i} onClick={() => apply(o)} className="rounded-lg bg-white px-2 py-1 text-xs shadow-sm hover:bg-sky-100">
                {o.title ?? `Option ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-4 space-y-1 rounded-xl bg-amber-50 p-3">
          {notes.map((n) => (
            <p key={n} className="flex items-start gap-1.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {n}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5">
        {!readiness.ready && (
          <p className="mb-3 text-xs text-slate-500">
            To go live it still needs: <span className="font-medium text-amber-700">{readiness.missing.map((m) => m.label).join(', ')}</span>. Everything else is optional and can be added later.
          </p>
        )}
        <PropertyForm value={form} onChange={setForm} sources={sources} aiFilled={aiFilled} />
      </div>

      {dups && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">This looks like a property you already have:</p>
          <ul className="mt-1 space-y-1">
            {dups.map((d) => (
              <li key={d.id}>
                <a href={`/properties/${d.id}`} target="_blank" rel="noreferrer" className="link text-sm">
                  {d.title}
                </a>{' '}
                <span className="text-xs text-slate-500">{d.subtitle}</span>
              </li>
            ))}
          </ul>
          <Button size="sm" className="mt-2" onClick={() => save.mutate({ publish: false, allowDuplicate: true })}>
            It's different — save anyway
          </Button>
        </div>
      )}
      {save.error && !(save.error instanceof ApiError && save.error.status === 409) && <div className="mt-3"><ErrorNote error={save.error} /></div>}
    </Drawer>
  );
}
