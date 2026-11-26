import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Archive, ArrowLeft, Building2, ChevronDown, MapPin, MoreHorizontal, Pencil, RotateCcw, Send, Share2, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react';
import { PROPERTY_TYPE_LABEL } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { availabilityLabel, priceLabel, type Property } from '../lib/property';
import { Button, EmptyState, ErrorNote, PageLoader } from '../components/ui';
import { AvailabilityModal, EditProperty, ShareSheet } from '../components/PropertyActions';
import { Popover } from '../components/Popover';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/confirm';
import { useAssistant, useAssistantPage } from '../ai/assistant';
import { OverviewTab } from '../components/property/OverviewTab';
import { LegalTab } from '../components/property/LegalTab';
import { PriceTab } from '../components/property/PriceTab';
import { MatchingTab } from '../components/property/MatchingTab';
import { HistoryTab } from '../components/property/HistoryTab';
import { canMatch, perSqft, useBuyers } from '../components/property/data';

const TABS = ['overview', 'legal', 'price', 'matching', 'history'] as const;
type Tab = (typeof TABS)[number];

const STATUS_DOT: Record<string, string> = { available: 'bg-emerald-500', held: 'bg-amber-400', booked: 'bg-sky-500', sold: 'bg-slate-500', draft: 'bg-amber-400', archived: 'bg-slate-400' };

export function PropertyDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview';
  const goTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === 'overview') next.delete('tab');
    else next.set('tab', t);
    next.delete('share');
    setParams(next, { replace: true });
  };
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const ask = useConfirm();
  const assistant = useAssistant();
  // 'ai' opens the editor with the "say what changed" box ready to type in.
  const [edit, setEdit] = useState<false | 'form' | 'ai'>(false);
  // "?share=1" (from the list's row menu) opens the share sheet straight away.
  const [share, setShare] = useState(() => params.get('share') === '1');
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

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['property', id] });
    void qc.invalidateQueries({ queryKey: ['properties'] });
  };
  const listing = useMutation({
    mutationFn: (to: 'live' | 'draft' | 'archived') => api.post(`/properties/${id}/listing`, { to }),
    onSuccess: (_r, to) => {
      refresh();
      toast(to === 'live' ? 'It’s live' : to === 'archived' ? 'Archived' : 'Moved back to draft');
    },
  });
  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      return api.upload(`/properties/${id}/photos`, fd);
    },
    onSuccess: () => {
      refresh();
      toast('Photos added');
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not upload', 'error'),
  });

  if (q.isLoading) return <PageLoader />;
  if (!p) return <EmptyState title="Property not found" body="It may have been archived." action={<Link to="/properties" className="link">Back to properties</Link>} />;

  const canEdit = can('property.edit');
  const status = p.listing === 'live' ? p.availability : p.listing;
  const statusText = p.listing === 'live' ? availabilityLabel(p.availability) : p.listing === 'draft' ? 'Draft' : 'Archived';
  const rate = p.price && p.areaSqft && p.purpose === 'sale' ? Math.round(p.price / p.areaSqft) : null;
  const pending = p.projectId ? [] : p.approvals.filter((a) => !a.documentUrl);

  return (
    <>
      <Link to={p.projectId ? `/projects/${p.projectId}` : '/properties'} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {p.projectId ? 'Back to project' : 'Properties'}
      </Link>

      <section className="card rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                <span className={clsx('h-2 w-2 rounded-full', STATUS_DOT[status])} /> {statusText}
              </span>
              {p.purpose !== 'sale' && <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium capitalize text-sky-700">For {p.purpose}</span>}
              {p.projectId && (
                <Link to={`/projects/${p.projectId}`} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 hover:bg-brand-100">
                  <Building2 className="h-3 w-3" /> Part of a project
                </Link>
              )}
            </div>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {p.title}
              {canEdit && (
                <button type="button" onClick={() => setEdit('form')} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit property">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="font-mono text-xs text-slate-400">{p.code}</span>
              <span>{PROPERTY_TYPE_LABEL[p.type]}</span>
              {(p.locality || p.city) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {[p.locality, p.city].filter(Boolean).join(', ')}
                </span>
              )}
            </p>
            {(p.approvals.some((a) => a.documentUrl) || pending.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.approvals
                  .filter((a) => a.documentUrl)
                  .map((a) => (
                    <span key={a.name} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" /> {a.name}
                      {a.verified && ' ✓'}
                    </span>
                  ))}
                {pending.length > 0 && (
                  <button type="button" onClick={() => goTab('legal')} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100">
                    <ShieldAlert className="h-3.5 w-3.5" /> {pending.length} document{pending.length === 1 ? '' : 's'} pending
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <div className="sm:text-right">
              <p className="text-3xl font-semibold tracking-tight text-slate-900">{priceLabel(p)}</p>
              <p className="text-sm text-slate-500">
                {rate ? `${perSqft(rate)}/sq.ft` : ''}
                {p.priceNegotiable && `${rate ? ' · ' : ''}Negotiable`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {p.listing === 'live' && can('property.availability') && (
                <button type="button" onClick={() => setAvail(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <span className={clsx('h-2 w-2 rounded-full', STATUS_DOT[status])} /> {statusText} <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              )}
              {p.listing === 'draft' && can('property.publish') && (
                <Button variant="primary" className="h-10 rounded-full" icon={<Send className="h-4 w-4" />} disabled={!p.readiness.ready} title={p.readiness.ready ? undefined : `Still needed: ${p.readiness.missing.map((m) => m.label).join(', ')}`} loading={listing.isPending} onClick={() => listing.mutate('live')}>
                  Publish
                </Button>
              )}
              {p.listing === 'live' && can('property.share') && (
                <button type="button" onClick={() => setShare(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
                  <Share2 className="h-4 w-4" /> Share
                </button>
              )}
              {canEdit && (
                <button type="button" onClick={() => setEdit('form')} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              )}
              <Popover
                label="More actions"
                align="right"
                className="w-60 p-1.5"
                buttonClass={(open) => clsx('flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50', open && 'bg-slate-50')}
                trigger={() => (
                  <>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </>
                )}
              >
                {(close) => (
                  <div>
                    <MenuItem
                      icon={<Sparkles className="h-4 w-4 text-ai-600" />}
                      onClick={() => {
                        close();
                        assistant.ask('Write a short WhatsApp message to send this property to a buyer.');
                      }}
                    >
                      Draft a buyer message
                    </MenuItem>
                    {canEdit && p.listing !== 'archived' && (
                      <MenuItem
                        icon={<Archive className="h-4 w-4 text-rose-500" />}
                        danger
                        onClick={async () => {
                          close();
                          if (await ask({ title: 'Archive this property?', body: 'It will be hidden everywhere but kept on record. You can restore it later.', confirmLabel: 'Archive', danger: true })) listing.mutate('archived');
                        }}
                      >
                        Archive
                      </MenuItem>
                    )}
                    {canEdit && p.listing === 'archived' && (
                      <MenuItem
                        icon={<RotateCcw className="h-4 w-4" />}
                        onClick={() => {
                          close();
                          listing.mutate('draft');
                        }}
                      >
                        Restore as draft
                      </MenuItem>
                    )}
                  </div>
                )}
              </Popover>
            </div>
          </div>
        </div>
        {p.availability === 'held' && p.heldUntil && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">On hold until {new Date(p.heldUntil).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}.</p>}
        <ErrorNote error={listing.error} />
      </section>

      <Tabs p={p} tab={tab} onTab={goTab} />

      <div className="mt-4">
        {tab === 'overview' && <OverviewTab p={p} canEdit={canEdit} onEdit={() => setEdit('form')} onEditWithAi={() => setEdit('ai')} onAddPhotos={() => photoRef.current?.click()} uploading={upload.isPending} goTab={goTab} />}
        {tab === 'legal' && <LegalTab p={p} canEdit={canEdit} canVerify={can('property.publish')} />}
        {tab === 'price' && <PriceTab p={p} />}
        {tab === 'matching' && <MatchingTab p={p} />}
        {tab === 'history' && <HistoryTab id={p.id} />}
      </div>

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Add photos"
        onChange={(e) => {
          // Copy the files first: clearing the input below empties its live file list.
          const files = [...(e.target.files ?? [])];
          if (files.length) upload.mutate(files);
          // Let the same file be picked again after a failed upload.
          e.target.value = '';
        }}
      />
      {edit && <EditProperty property={p} open aiFirst={edit === 'ai'} onClose={() => setEdit(false)} />}
      <ShareSheet property={p} open={share} onClose={() => setShare(false)} />
      {avail && <AvailabilityModal property={p} open onClose={() => setAvail(false)} />}
    </>
  );
}

function Tabs({ p, tab, onTab }: { p: Property; tab: Tab; onTab: (t: Tab) => void }) {
  const buyers = useBuyers(p);
  const docs = p.approvals.length + p.documents.filter((x) => !p.approvals.some((ap) => ap.documentUrl === x.url)).length;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'legal', label: 'Legal & documents', count: docs || undefined },
    { key: 'price', label: 'Price' },
    { key: 'matching', label: 'Matching customers', count: canMatch(p) ? buyers.data?.length : undefined },
    { key: 'history', label: 'History' },
  ];
  return (
    <div className="mt-4 overflow-x-auto" role="tablist" aria-label="Property sections">
      <div className="inline-flex min-w-full gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => onTab(t.key)}
            className={clsx('-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition', tab === t.key ? 'border-brand-600 font-semibold text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}
          >
            {t.label}
            {t.count !== undefined && <span className={clsx('rounded-full px-1.5 text-[11px]', tab === t.key ? 'bg-brand-50 text-brand-800' : 'bg-slate-100 text-slate-500')}>{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuItem({ icon, onClick, danger, children }: { icon: React.ReactNode; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={clsx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-50', danger ? 'text-rose-600' : 'text-slate-700')}>
      {icon}
      {children}
    </button>
  );
}
