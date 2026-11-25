import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowUpRight, Check, FileImage, FileText, Info, Plus, ShieldCheck, Upload, X } from 'lucide-react';
import { relativeDay } from '@estate/shared';
import { api } from '../../lib/api';
import type { Property } from '../../lib/property';
import { Button, Card, ErrorNote, Input, Modal } from '../ui';
import { useToast } from '../toast';
import { useConfirm } from '../confirm';
import { Popover } from '../Popover';
import { Ring } from './visuals';

/** The approvals people usually claim; anything else can be typed. */
const COMMON = ['RERA', 'DTCP', 'CMDA', 'Building approval', 'Bank approved'];

const STATE = [
  { label: 'Document pending', pill: 'bg-amber-50 text-amber-800', icon: 'bg-amber-50 text-amber-600', bar: 'bg-amber-400' },
  { label: 'Uploaded · to check', pill: 'bg-sky-50 text-sky-700', icon: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500' },
  { label: 'Verified', pill: 'bg-emerald-50 text-emerald-700', icon: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
];

const isImage = (url: string) => /\.(png|jpe?g|webp|gif)$/i.test(url);

/** Approvals as cards with their progress, documents as file tiles, and what buyers see. */
export function LegalTab({ p, canEdit, canVerify }: { p: Property; canEdit: boolean; canVerify: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const [open, setOpen] = useState<{ approval?: string } | null>(null);
  const [name, setName] = useState('');
  const [custom, setCustom] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['property', p.id] });
    void qc.invalidateQueries({ queryKey: ['properties'] });
  };
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || open?.approval || 'Document');
      if (open?.approval) fd.append('approval', open.approval);
      return api.upload(`/properties/${p.id}/documents`, fd);
    },
    onSuccess: () => {
      refresh();
      toast('Document uploaded');
      setOpen(null);
      setName('');
    },
  });
  const verify = useMutation({
    mutationFn: (a: string) => api.post(`/properties/${p.id}/approvals/${encodeURIComponent(a)}/verify`),
    onSuccess: () => {
      refresh();
      toast('Marked verified');
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not verify', 'error'),
  });
  // Adding or removing an approval saves the whole list; the server keeps documents and verified marks.
  const saveApprovals = useMutation({
    mutationFn: (list: string[]) => api.patch(`/properties/${p.id}`, { approvals: list.map((n) => ({ name: n, documentUrl: p.approvals.find((a) => a.name === n)?.documentUrl ?? null })) }),
    onSuccess: (_r, list) => {
      refresh();
      toast(list.length > p.approvals.length ? 'Approval added' : 'Approval removed');
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not save', 'error'),
  });
  const names = p.approvals.map((a) => a.name);
  const add = (n: string) => {
    const nm = n.trim();
    if (!nm || names.some((x) => x.toLowerCase() === nm.toLowerCase())) return;
    saveApprovals.mutate([...names, nm]);
  };
  // A project unit's approvals belong to its project: documents are handled there.
  const unit = !!p.projectId;
  const manage = canEdit && !unit;
  const verified = p.approvals.filter((a) => a.verified).length;
  const onListing = p.approvals.filter((a) => a.documentUrl);
  // An approval's document is shown on its card, not again here.
  const others = p.documents.filter((d) => !p.approvals.some((a) => a.documentUrl === d.url));

  return (
    <div className="space-y-5">
      {/* Summary: how far the paperwork has got, and what buyers see. */}
      <Card className="flex flex-wrap items-center gap-4 rounded-3xl p-5">
        <Ring value={p.approvals.length ? Math.round((verified / p.approvals.length) * 100) : 0} size={60} label={p.approvals.length ? `${verified}/${p.approvals.length}` : '—'} tone={verified && verified === p.approvals.length ? '#10b981' : '#0d9488'} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">Legal & documents</h2>
          <p className="text-sm text-slate-500">
            {p.approvals.length ? `${p.approvals.length} ${p.approvals.length === 1 ? 'approval' : 'approvals'} · ${verified} verified` : 'No approvals claimed'} · {others.length} other {others.length === 1 ? 'document' : 'documents'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Buyers see</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {onListing.length ? (
              onListing.map((a) => (
                <span key={a.name} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> {a.name}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No approval badges yet</span>
            )}
          </div>
        </div>
      </Card>

      {/* Approvals */}
      <section>
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Approvals</h3>
            <p className="text-xs text-slate-500">
              {unit ? (
                <>
                  These come from the project.{' '}
                  <Link to={`/projects/${p.projectId}`} className="link">
                    Upload or verify them on the project page
                  </Link>
                  .
                </>
              ) : (
                'A badge shows on the listing once its document is uploaded.'
              )}
            </p>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {p.approvals.map((a) => {
            const step = a.verified ? 2 : a.documentUrl ? 1 : 0;
            const s = STATE[step];
            return (
              <li key={a.name}>
                <Card className="group relative flex h-full flex-col rounded-3xl p-4">
                  {manage && (
                    <button
                      type="button"
                      aria-label={`Remove ${a.name}`}
                      disabled={saveApprovals.isPending}
                      onClick={async () => {
                        if (await ask({ title: `Remove ${a.name}?`, body: a.documentUrl ? 'Its badge and uploaded document come off the listing. You can add it again later.' : 'It comes off the listing. You can add it again later.', confirmLabel: 'Remove', danger: true }))
                          saveApprovals.mutate(names.filter((n) => n !== a.name));
                      }}
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:text-rose-600 disabled:opacity-40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="flex items-center gap-3 pr-6">
                    <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', s.icon)}>
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold text-slate-900">{a.name}</span>
                      <span className={clsx('mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium', s.pill)}>{s.label}</span>
                    </span>
                  </div>
                  {/* Three short bars: claimed, uploaded, verified. */}
                  <div className="mt-4" aria-label={`Step ${step + 1} of 3`}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className={clsx('h-1.5 flex-1 rounded-full', i <= step ? s.bar : 'bg-slate-100')} />
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                      <span>Claimed</span>
                      <span>Uploaded</span>
                      <span>Verified</span>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                    {a.documentUrl && (
                      <a href={a.documentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        View <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {manage && (
                      <button type="button" onClick={() => setOpen({ approval: a.name })} className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        <Upload className="h-3.5 w-3.5" /> {a.documentUrl ? 'Replace' : 'Upload'}
                      </button>
                    )}
                    {a.documentUrl && !a.verified && canVerify && !unit && (
                      <Button size="sm" variant="primary" className="h-8 rounded-full" icon={<Check className="h-3.5 w-3.5" />} loading={verify.isPending && verify.variables === a.name} onClick={() => verify.mutate(a.name)}>
                        Mark verified
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}

          {manage && (
            <li>
              <Popover
                label="Add an approval"
                wrapClass="h-full"
                className="w-72"
                buttonClass={(o) => clsx('flex h-full min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-4 text-sm font-medium transition', o ? 'border-brand-400 bg-brand-50/50 text-brand-800' : 'border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-700')}
                trigger={() => (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                      <Plus className="h-5 w-5" />
                    </span>
                    Add approval
                    <span className="text-xs font-normal text-slate-400">RERA, DTCP, CMDA or any other</span>
                  </>
                )}
              >
                {(close) => (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON.filter((c) => !names.includes(c)).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            add(c);
                            close();
                          }}
                          className="rounded-full border border-dashed border-brand-300 px-2.5 py-1 text-xs text-brand-800 hover:bg-brand-50"
                        >
                          ＋ {c}
                        </button>
                      ))}
                    </div>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        add(custom);
                        setCustom('');
                        close();
                      }}
                    >
                      <Input aria-label="Another approval" placeholder="Another, e.g. Fire NOC" value={custom} onChange={(e) => setCustom(e.target.value)} className="py-1.5 text-xs" />
                      <Button type="submit" size="sm" variant="primary" disabled={!custom.trim()}>
                        Add
                      </Button>
                    </form>
                  </div>
                )}
              </Popover>
            </li>
          )}
        </ul>
        {!p.approvals.length && !manage && <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No approvals claimed for this property.</p>}
      </section>

      {/* Other documents: everyone on the team can open them (to share on request); managers add them. */}
      <section>
        <div className="mb-2.5">
          <h3 className="text-sm font-semibold text-slate-900">Other documents</h3>
          <p className="text-xs text-slate-500">Sale deed, EC, patta, tax receipts. Shared with a customer only on request.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {others.map((d) => {
            const img = isImage(d.url);
            const Icon = img ? FileImage : FileText;
            return (
              <li key={d.url}>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="group flex h-full items-center gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:border-brand-300 hover:shadow-pop">
                  <span className={clsx('flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-[9px] font-bold uppercase', img ? 'bg-violet-50 text-violet-600' : 'bg-rose-50 text-rose-600')}>
                    <Icon className="h-5 w-5" />
                    {img ? 'img' : 'pdf'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{d.name}</span>
                    <span className="block text-xs text-slate-400">Uploaded {relativeDay(d.uploadedAt).toLowerCase()}</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-600" />
                </a>
              </li>
            );
          })}
          {canEdit && (
            <li>
              <button type="button" onClick={() => setOpen({})} className="flex h-full min-h-[80px] w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-200 p-4 text-sm font-medium text-slate-500 transition hover:border-brand-300 hover:text-brand-700">
                <Upload className="h-4 w-4" /> Upload a document
              </button>
            </li>
          )}
        </ul>
        {!others.length && !canEdit && <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No documents uploaded yet. Ask your manager if a customer needs one.</p>}
      </section>

      <p className="flex items-start gap-2 px-1 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        The listing shows approval badges only, never the documents, and never says “100% legally clear”.
      </p>

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.approval ? `Upload the ${open.approval} document` : 'Upload a document'}>
        <div className="space-y-3">
          {!open?.approval && <Input aria-label="Document name" placeholder="Name, e.g. Sale deed, EC, Patta" value={name} onChange={(e) => setName(e.target.value)} />}
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" aria-label="Choose a file" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          <Button variant="primary" className="w-full" loading={upload.isPending} disabled={!open?.approval && name.trim().length < 2} onClick={() => fileRef.current?.click()}>
            Choose a PDF or photo
          </Button>
          <p className="text-xs text-slate-400">Documents stay inside the team. Buyers only see the approval badge.</p>
          <ErrorNote error={upload.error} />
        </div>
      </Modal>
    </div>
  );
}
