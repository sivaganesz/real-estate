import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AMENITIES, PROJECT_STATUSES, PROJECT_STATUS_LABEL, PROPERTY_TYPES, PROPERTY_TYPE_LABEL, type PropertyType } from '@estate/shared';
import clsx from 'clsx';
import { api } from '../lib/api';
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from './ui';
import { usePlaces } from '../lib/property';

export function NewProject({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const places = usePlaces();
  const [f, setF] = useState({ name: '', type: 'apartment' as PropertyType, status: 'under_construction', city: 'Chennai', locality: '', address: '', reraNumber: '', possessionDate: '', description: '', amenities: [] as string[] });
  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const save = useMutation({
    mutationFn: () => api.post<{ project: { _id: string } }>('/projects', { ...f, possessionDate: f.possessionDate || null, reraNumber: f.reraNumber || null }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      onClose();
      navigate(`/projects/${r.project._id}?units=1`);
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="New project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Create and add units
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project name" className="col-span-2">
            <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Green Meadows" />
          </Field>
          <Field label="What it sells">
            <Select value={f.type} onChange={(e) => set('type', e.target.value)}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stage">
            <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="City">
            <Input list="np-cities" value={f.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Locality">
            <Input list="np-localities" value={f.locality} onChange={(e) => set('locality', e.target.value)} />
          </Field>
          <datalist id="np-cities">{places.data?.cities.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="np-localities">{places.data?.localities.map((c) => <option key={c} value={c} />)}</datalist>
          <Field label="RERA number" hint="Copied to every unit">
            <Input value={f.reraNumber} onChange={(e) => set('reraNumber', e.target.value)} />
          </Field>
          <Field label="Possession">
            <Input type="date" value={f.possessionDate} onChange={(e) => set('possessionDate', e.target.value)} />
          </Field>
          <Field label="Address" className="col-span-2">
            <Input value={f.address} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="Short description" className="col-span-2">
            <Textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <div>
          <span className="label">Amenities (copied to every unit)</span>
          <div className="flex flex-wrap gap-1.5">
            {AMENITIES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => set('amenities', f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a])}
                className={clsx('rounded-full border px-2.5 py-1 text-xs', f.amenities.includes(a) ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600')}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <ErrorNote error={save.error} />
      </div>
    </Modal>
  );
}
