import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, UserCheck, Wand2 } from 'lucide-react';
import { LEAD_SOURCES, LEAD_SOURCE_LABEL, STAGE_META, requirementSummary, type Requirement, type Stage } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth, useUsers } from '../lib/auth';
import { Button, Drawer, ErrorNote, Field, Input, Select, Textarea } from './ui';
import { RequirementEditor } from './RequirementEditor';
import { useToast } from './toast';

type Existing = { id: string; name: string; stage: string; owner: string | null; mine: boolean };

/**
 * New lead in under a minute: name, phone, where they came from, and what
 * they said in their own words. Repeat callers are spotted while typing.
 */
export function NewLead({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can, user } = useAuth();
  const users = useUsers();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', phone: '', email: '', source: 'phone', ownerId: '', note: '' });
  const [said, setSaid] = useState('');
  const [req, setReq] = useState<Partial<Requirement>>({});
  const digits = f.phone.replace(/\D/g, '');

  const lookup = useQuery({
    queryKey: ['lead-lookup', digits],
    queryFn: () => api.get<{ existing: Existing | null }>(`/leads/lookup?phone=${digits}`),
    enabled: digits.length >= 10,
  });
  const existing = lookup.data?.existing;

  const parse = useMutation({
    mutationFn: () => api.post<{ requirement: Partial<Requirement> }>('/leads/parse-requirement', { text: said }),
    onSuccess: (r) => setReq((cur) => ({ ...cur, ...r.requirement })),
  });

  const save = useMutation({
    mutationFn: () =>
      api.post<{ lead: { id: string; name: string } }>(`/leads${f.ownerId === 'auto' ? '?autoAssign=true' : ''}`, {
        name: f.name,
        phone: f.phone,
        email: f.email || null,
        source: f.source,
        ownerId: f.ownerId && f.ownerId !== 'auto' ? f.ownerId : null,
        requirement: req,
        note: [said, f.note].filter(Boolean).join('\n') || null,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      toast(`Added ${r.lead.name}`);
      close();
      navigate(`/leads/${r.lead.id}`);
    },
  });
  const enquiry = useMutation({
    mutationFn: () => api.post(`/leads/${existing!.id}/enquiries`, { source: f.source, message: said || f.note || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      toast(`Added a new enquiry to ${existing!.name}`);
      const id = existing!.id;
      close();
      navigate(`/leads/${id}`);
    },
  });

  const close = () => {
    setF({ name: '', phone: '', email: '', source: 'phone', ownerId: '', note: '' });
    setSaid('');
    setReq({});
    onClose();
  };
  useEffect(() => {
    if (existing && !f.name) setF((s) => ({ ...s, name: existing.name }));
  }, [existing, f.name]);

  return (
    <Drawer
      open={open}
      onClose={close}
      title="New lead"
      footer={
        existing ? (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" loading={enquiry.isPending} onClick={() => enquiry.mutate()} disabled={!existing.mine && !can('lead.viewAll') && !!existing.owner}>
              Add as a new enquiry
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" loading={save.isPending} disabled={f.name.trim().length < 2 || digits.length < 10} onClick={() => save.mutate()}>
              Add lead
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mobile number" className="col-span-2 sm:col-span-1">
            <Input inputMode="tel" autoFocus value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="98400 12345" />
          </Field>
          <Field label="Name" className="col-span-2 sm:col-span-1">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
        </div>
        {existing && (
          <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
            <UserCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>
                <b>{existing.name}</b> is already a customer ({STAGE_META[existing.stage as Stage]?.label ?? existing.stage}
                {existing.owner ? `, with ${existing.mine ? 'you' : existing.owner}` : ', unassigned'}).
              </p>
              <p className="mt-0.5 text-xs">Their history stays on one record — this will be added as a new enquiry. {!existing.mine && existing.owner && !can('lead.viewAll') && 'Ask your manager if they should move to you.'}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Came from">
            <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          {can('lead.assign') ? (
            <Field label="Owner">
              <Select value={f.ownerId} onChange={(e) => setF({ ...f, ownerId: e.target.value })}>
                <option value="">Leave unassigned</option>
                <option value="auto">Whoever has the fewest open leads</option>
                {users.data
                  ?.filter((u) => u.role === 'executive' && u.active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            </Field>
          ) : (
            <Field label="Owner">
              <Input disabled value={`${user?.name} (you)`} />
            </Field>
          )}
        </div>
        {!existing && (
          <Field label="Email (optional)">
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
        )}

        <div className="rounded-2xl border border-ai-100 bg-gradient-to-br from-ai-50 to-white p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
            <Sparkles className="h-4 w-4 text-ai-600" /> What are they looking for?
          </p>
          <Textarea rows={2} className="mt-2 bg-white" value={said} onChange={(e) => setSaid(e.target.value)} placeholder="In their words: 2-3 BHK near Porur, 70-80 lakhs, home loan, wants to move by March, east facing" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="truncate text-xs text-slate-500">{requirementSummary(req)}</p>
            <Button size="sm" variant="ai" icon={<Wand2 className="h-3.5 w-3.5" />} disabled={said.trim().length < 3} loading={parse.isPending} onClick={() => parse.mutate()}>
              Understand
            </Button>
          </div>
        </div>
        {Object.keys(req).length > 0 && <RequirementEditor value={req} onChange={setReq} />}
        <ErrorNote error={save.error ?? enquiry.error ?? parse.error} />
      </div>
    </Drawer>
  );
}
