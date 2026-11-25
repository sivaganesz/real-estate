import { useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, Building2, Camera, CheckCircle2, CircleAlert, FileText, History, Pencil, Send, Share2, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { PROPERTY_TYPE_LABEL, TYPE_DETAILS, formatINR, relativeDay } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { AVAILABILITY_TONE, areaLabel, availabilityLabel, priceLabel, type Property } from '../lib/property';
import { Badge, Button, Card, EmptyState, ErrorNote, Input, Modal, PageLoader, SectionTitle } from '../components/ui';
import { PropertyCover } from '../components/PropertyCard';
import { AvailabilityModal, EditProperty, ShareSheet } from '../components/PropertyActions';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/confirm';
import { useAssistant, useAssistantPage } from '../ai/assistant';
import { slots } from '../slots';

export function PropertyDetail() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const assistant = useAssistant();
  const [edit, setEdit] = useState(false);
  const [share, setShare] = useState(false);
  const [avail, setAvail] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const q = useQuery({ queryKey: ['property', id], queryFn: () => api.get<{ property: Property }>(`/properties/${id}`), select: (d) => d.property });
  const p = q.data;
  useAssistantPage({
    page: 'Property',
    entity: 'property',
    entityId: id,
    label: p?.title,
    suggestions: [
      'Write a WhatsApp message about this property',
      'Which of my leads would like this?',
      ...(can('property.edit') ? ['What is missing on this listing?', 'Is the price in line with similar properties?'] : ['Summarise this property in 3 lines for a buyer']),
    ],
  });

  const listing = useMutation({
    mutationFn: (to: 'live' | 'draft' | 'archived') => api.post(`/properties/${id}/listing`, { to }),
    onSuccess: (_r, to) => {
      void qc.invalidateQueries({ queryKey: ['property', id] });
      void qc.invalidateQueries({ queryKey: ['properties'] });
      toast(to === 'live' ? 'It’s live' : to === 'archived' ? 'Archived' : 'Moved back to draft');
    },
  });
  const upload = useMutation({
    mutationFn: (files: FileList) => {
      const fd = new FormData();
      [...files].forEach((f) => fd.append('files', f));
      return api.upload(`/properties/${id}/photos`, fd);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['property', id] }),
  });

  if (q.isLoading) return <PageLoader />;
  if (!p) return <EmptyState title="Property not found" body="It may have been archived." action={<Link to="/properties" className="link">Back to properties</Link>} />;

  const canEdit = can('property.edit');
  const r = p.readiness;
  const fields = TYPE_DETAILS[p.type];
  const pendingApprovals = p.approvals.filter((a) => !a.documentUrl);

  return (
    <>
      <Link to={p.projectId ? `/projects/${p.projectId}` : '/properties'} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {p.projectId ? 'Back to project' : 'Properties'}
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Gallery property={p} canEdit={canEdit} onAdd={() => photoRef.current?.click()} uploading={upload.isPending} />
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)} />

          {slots.propertyTop.map((S, i) => (
            <S key={i} property={p} />
          ))}

          <Card className="p-5">
            <SectionTitle>Key facts</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Fact label="Type" value={PROPERTY_TYPE_LABEL[p.type]} />
              <Fact label="Area" value={areaLabel(p)} source={p.sources?.area} />
              {p.price && p.areaSqft && p.purpose === 'sale' && <Fact label="Rate" value={`₹${Math.round(p.price / p.areaSqft).toLocaleString('en-IN')}/sq.ft`} />}
              {fields.map((f) => {
                const v = p.details[f.key];
                if (v === null || v === undefined || v === '') return null;
                return <Fact key={f.key} label={f.label} value={typeof v === 'boolean' ? (v ? 'Yes' : 'No') : `${v}${f.unit ? ` ${f.unit}` : ''}`} source={p.sources?.[`details.${f.key}`]} />;
              })}
              {p.unitNumber && <Fact label="Unit" value={`${p.block ? `${p.block}-` : ''}${p.unitNumber}`} />}
              {p.address && <Fact label="Address" value={`${p.address}${p.pincode ? ` – ${p.pincode}` : ''}`} wide />}
            </dl>
            {p.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{p.description}</p>}
            {p.highlights.length > 0 && (
              <ul className="mt-3 space-y-1">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {h}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(p.amenities.length > 0 || p.extras.length > 0) && (
            <Card className="p-5">
              {p.amenities.length > 0 && (
                <>
                  <SectionTitle>Amenities</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {p.amenities.map((a) => (
                      <Badge key={a}>{a}</Badge>
                    ))}
                  </div>
                </>
              )}
              {p.extras.length > 0 && (
                <>
                  <SectionTitle className="mt-5">Other details</SectionTitle>
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {p.extras.map((e) => (
                      <div key={e.label + e.value} className="rounded-xl bg-slate-50 px-3 py-2">
                        <dt className="flex items-center gap-1 text-xs text-slate-500">
                          {e.label} {e.internal && <Badge tone="amber">Internal</Badge>}
                        </dt>
                        <dd className="text-sm text-slate-800">{e.value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </Card>
          )}

          <Documents property={p} canEdit={canEdit} canVerify={can('property.publish')} />
          {canEdit && <HistoryCard id={p.id} />}
        </div>

        {/* Summary and actions */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            <div className="flex flex-wrap gap-1.5">
              {p.listing === 'live' ? <Badge tone={AVAILABILITY_TONE[p.availability]}>{availabilityLabel(p.availability)}</Badge> : <Badge tone="amber">{p.listing === 'draft' ? 'Draft' : 'Archived'}</Badge>}
              {p.purpose !== 'sale' && <Badge className="capitalize">For {p.purpose}</Badge>}
              {p.approvals.filter((a) => a.documentUrl).map((a) => (
                <Badge key={a.name} tone="green" icon={<ShieldCheck className="h-3 w-3" />}>
                  {a.name}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{priceLabel(p)}</p>
            {p.priceNegotiable && <p className="text-xs text-slate-500">Negotiable</p>}
            <h1 className="mt-1 text-base font-medium text-slate-800">{p.title}</h1>
            <p className="text-sm text-slate-500">{[p.locality, p.city].filter(Boolean).join(', ')}</p>
            {p.projectId && (
              <Link to={`/projects/${p.projectId}`} className="mt-1 inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                <Building2 className="h-3.5 w-3.5" /> Part of a project
              </Link>
            )}
            {p.availability === 'held' && p.heldUntil && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">On hold until {new Date(p.heldUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>}
            <p className="mt-2 text-[11px] text-slate-400">
              {p.code}
              {p.enquiries ? ` · ${p.enquiries} enquiries` : ''}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {p.listing === 'live' && (
                <Button variant="primary" className="col-span-2" icon={<Share2 className="h-4 w-4" />} onClick={() => setShare(true)}>
                  Share with a buyer
                </Button>
              )}
              {p.listing === 'draft' && can('property.publish') && (
                <Button variant="primary" className="col-span-2" icon={<Send className="h-4 w-4" />} disabled={!r.ready} loading={listing.isPending} onClick={() => listing.mutate('live')}>
                  Publish
                </Button>
              )}
              {canEdit && (
                // Full width unless "Availability" sits beside it (live listings only).
                <Button icon={<Pencil className="h-4 w-4" />} className={p.listing === 'live' && can('property.availability') ? undefined : 'col-span-2'} onClick={() => setEdit(true)}>
                  Edit
                </Button>
              )}
              {p.listing === 'live' && can('property.availability') && <Button onClick={() => setAvail(true)}>Availability</Button>}
              <Button variant="ai" className="col-span-2" icon={<Sparkles className="h-4 w-4" />} onClick={() => assistant.ask('Write a short WhatsApp message to send this property to a buyer.')}>
                Draft a buyer message
              </Button>
              {canEdit && p.listing !== 'archived' && (
                <Button variant="ghost" size="sm" className="col-span-2 text-slate-500" icon={<Archive className="h-3.5 w-3.5" />} onClick={async () => (await ask({ title: 'Archive this property?', body: 'It will be hidden everywhere but kept on record.', confirmLabel: 'Archive', danger: true })) && listing.mutate('archived')}>
                  Archive
                </Button>
              )}
              {canEdit && p.listing === 'archived' && (
                <Button size="sm" className="col-span-2" onClick={() => listing.mutate('draft')}>
                  Restore as draft
                </Button>
              )}
            </div>
            <ErrorNote error={listing.error} />
          </Card>

          {canEdit && (!r.ready || r.suggestions.length > 0 || pendingApprovals.length > 0) && (
            <Card className="p-5">
              <SectionTitle>To do</SectionTitle>
              <ul className="space-y-2">
                {r.missing.map((m) => (
                  <ToDo key={m.key} tone="required" onClick={() => setEdit(true)}>
                    Add {m.label.toLowerCase()} <span className="text-xs text-rose-600">(needed to go live)</span>
                  </ToDo>
                ))}
                {!p.media.length && <ToDo onClick={() => photoRef.current?.click()}>Add photos — listings with photos get far more replies</ToDo>}
                {pendingApprovals.map((a) => (
                  <ToDo key={a.name}>Upload the {a.name} document (claimed, document pending)</ToDo>
                ))}
                {r.suggestions
                  .filter((s) => s.key !== 'media' && s.key !== 'approvals')
                  .slice(0, 4)
                  .map((s) => (
                    <ToDo key={s.key} onClick={() => setEdit(true)}>
                      {s.label.startsWith('Add') ? s.label : `Add ${s.label.toLowerCase()}`}
                    </ToDo>
                  ))}
              </ul>
            </Card>
          )}
          {slots.propertySide.map((S, i) => (
            <S key={i} property={p} />
          ))}
        </div>
      </div>

      {edit && <EditProperty property={p} open onClose={() => setEdit(false)} />}
      <ShareSheet property={p} open={share} onClose={() => setShare(false)} />
      {avail && <AvailabilityModal property={p} open onClose={() => setAvail(false)} />}
    </>
  );
}

function Fact({ label, value, source, wide }: { label: string; value: ReactNode; source?: string; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : undefined}>
      <dt className="flex items-center gap-1 text-xs text-slate-500">
        {label}
        {source && (
          <span title={`Read from: “${source}”`}>
            <Sparkles className="h-3 w-3 text-ai-500" />
          </span>
        )}
      </dt>
      <dd className="text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function ToDo({ children, onClick, tone }: { children: ReactNode; onClick?: () => void; tone?: 'required' }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full items-start gap-2 rounded-lg px-1 py-0.5 text-left text-sm text-slate-700 hover:bg-slate-50">
        <CircleAlert className={tone === 'required' ? 'mt-0.5 h-4 w-4 shrink-0 text-rose-500' : 'mt-0.5 h-4 w-4 shrink-0 text-amber-500'} />
        <span>{children}</span>
      </button>
    </li>
  );
}

function Gallery({ property, canEdit, onAdd, uploading }: { property: Property; canEdit: boolean; onAdd: () => void; uploading: boolean }) {
  const photos = property.media.filter((m) => m.kind === 'photo');
  const [i, setI] = useState(0);
  return (
    <Card className="overflow-hidden">
      <div className="relative">
        {photos.length ? <img src={photos[Math.min(i, photos.length - 1)].url} alt={property.title} className="h-64 w-full object-cover sm:h-80" /> : <PropertyCover property={property} className="h-64 w-full sm:h-80" iconSize="h-16 w-16" />}
        {canEdit && (
          <button onClick={onAdd} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-xl bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow hover:bg-white">
            <Camera className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Add photos'}
          </button>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-2">
          {photos.map((m, j) => (
            <button key={m.url} onClick={() => setI(j)} className={j === i ? 'ring-2 ring-brand-500 rounded-lg' : 'opacity-80 hover:opacity-100'}>
              <img src={m.url} className="h-14 w-20 rounded-lg object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function Documents({ property, canEdit, canVerify }: { property: Property; canEdit: boolean; canVerify: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<{ approval?: string } | null>(null);
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || open?.approval || 'Document');
      if (open?.approval) fd.append('approval', open.approval);
      return api.upload(`/properties/${property.id}/documents`, fd);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['property', property.id] });
      setOpen(null);
      setName('');
    },
  });
  const verify = useMutation({
    mutationFn: (a: string) => api.post(`/properties/${property.id}/approvals/${encodeURIComponent(a)}/verify`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['property', property.id] }),
  });
  if (!canEdit && !property.approvals.some((a) => a.documentUrl)) return null;
  return (
    <Card className="p-5">
      <SectionTitle
        action={
          canEdit && (
            <Button size="sm" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => setOpen({})}>
              Upload
            </Button>
          )
        }
      >
        Approvals & documents
      </SectionTitle>
      {!property.approvals.length && !property.documents.length && <p className="text-sm text-slate-500">None yet. This section is optional — upload what you have.</p>}
      <ul className="space-y-2">
        {property.approvals.map((a) => (
          <li key={a.name} className="flex items-center gap-2 text-sm">
            <ShieldCheck className={a.documentUrl ? 'h-4 w-4 text-emerald-600' : 'h-4 w-4 text-amber-500'} />
            <span className="font-medium">{a.name}</span>
            {a.documentUrl ? (a.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="blue">Document uploaded</Badge>) : <Badge tone="amber">Document pending</Badge>}
            <span className="ml-auto flex gap-1">
              {!a.documentUrl && canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setOpen({ approval: a.name })}>
                  Upload
                </Button>
              )}
              {a.documentUrl && !a.verified && canVerify && (
                <Button size="sm" variant="ghost" onClick={() => verify.mutate(a.name)}>
                  Mark verified
                </Button>
              )}
            </span>
          </li>
        ))}
        {canEdit &&
          property.documents.map((d) => (
            <li key={d.url} className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-slate-400" />
              <a href={d.url} target="_blank" rel="noreferrer" className="link">
                {d.name}
              </a>
              <span className="text-xs text-slate-400">{relativeDay(d.uploadedAt)}</span>
            </li>
          ))}
      </ul>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.approval ? `Upload the ${open.approval} document` : 'Upload a document'}>
        <div className="space-y-3">
          {!open?.approval && <Input placeholder="Name, e.g. Sale deed, EC, Patta" value={name} onChange={(e) => setName(e.target.value)} />}
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          <Button variant="primary" className="w-full" loading={upload.isPending} disabled={!open?.approval && name.trim().length < 2} onClick={() => fileRef.current?.click()}>
            Choose a PDF or photo
          </Button>
          <p className="text-xs text-slate-400">Documents stay internal. Buyers only see the approval badge.</p>
          <ErrorNote error={upload.error} />
        </div>
      </Modal>
    </Card>
  );
}

function HistoryCard({ id }: { id: string }) {
  const h = useQuery({ queryKey: ['property', id, 'history'], queryFn: () => api.get<{ items: { id: string; at: string; actor: string; viaAI: boolean; summary: string }[] }>(`/properties/${id}/history`) });
  if (!h.data?.items.length) return null;
  return (
    <Card className="p-5">
      <SectionTitle>
        <span className="flex items-center gap-1.5">
          <History className="h-4 w-4 text-slate-400" /> History
        </span>
      </SectionTitle>
      <ol className="space-y-2.5">
        {h.data.items.slice(0, 12).map((e) => (
          <li key={e.id} className="flex gap-3 text-sm">
            <span className="w-20 shrink-0 text-xs text-slate-400">{relativeDay(e.at)}</span>
            <span className="text-slate-700">
              {e.summary} <span className="text-xs text-slate-400">— {e.actor}</span> {e.viaAI && <Badge tone="ai">via assistant</Badge>}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export { formatINR };
