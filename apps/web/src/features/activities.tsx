import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell, CalendarPlus, Check, Clock, MessageCircle, Phone, X } from 'lucide-react';
import { ACTIVITY_LABEL, CALL_OUTCOMES, VISIT_INTEREST, formatTime, relativeDay, type ActivityType } from '@estate/shared';
import { api, ApiError, qs } from '../lib/api';
import { waLink, type Lead, type TimelineItem } from '../lib/leads';
import { priceLabel, type Property } from '../lib/property';
import { Button, ErrorNote, Input, Modal, Textarea } from '../components/ui';
import { useToast } from '../components/toast';
import { PlannedActionsSlot, composerTabs } from '../pages/LeadDetail';

export type AgendaItem = {
  id: string;
  type: ActivityType;
  status: string;
  title: string;
  scheduledAt: string;
  durationMin: number;
  notes?: string;
  rescheduled: boolean;
  lead: { id: string; name: string; phone: string; stage: string } | null;
  owner: { id: string; name: string } | null;
  properties: { id: string; title: string; locality?: string }[];
  viaAI: boolean;
};

const PLAN_TYPES: ActivityType[] = ['call', 'site_visit', 'meeting', 'whatsapp', 'task'];

function at(daysFromNow: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function nextWeekday(day: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + (((day - d.getDay() + 7) % 7) || 7));
  d.setHours(hour, 0, 0, 0);
  return d;
}
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/** Quick picks for the times salespeople actually use, plus an exact picker. */
export function WhenPicker({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const now = new Date();
  const picks: [string, Date][] = [
    ['In 1 hour', new Date(Math.ceil((now.getTime() + 3_600_000) / 900_000) * 900_000)],
    ...(now.getHours() < 17 ? ([['This evening', at(0, 18)]] as [string, Date][]) : []),
    ['Tomorrow 11 am', at(1, 11)],
    ['Tomorrow 5 pm', at(1, 17)],
    ['Saturday 11 am', nextWeekday(6, 11)],
    ['Sunday 11 am', nextWeekday(0, 11)],
  ];
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {picks.map(([label, d]) => (
          <button key={label} type="button" onClick={() => onChange(d)} className={clsx('rounded-full border px-2.5 py-1 text-xs', value && Math.abs(value.getTime() - d.getTime()) < 60_000 ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
            {label}
          </button>
        ))}
      </div>
      <Input type="datetime-local" className="mt-2" value={value ? toLocalInput(value) : ''} onChange={(e) => e.target.value && onChange(new Date(e.target.value))} />
    </div>
  );
}

function PropertyPicker({ lead, value, onChange }: { lead: Lead; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  const list = useQuery({
    queryKey: ['visit-props', lead.id, q],
    queryFn: () => api.get<{ items: Property[] }>(`/properties${qs({ q: q || lead.summary.replace(/·/g, ' '), availability: ['available', 'held'], limit: 6 })}`),
  });
  return (
    <div>
      <Input placeholder="Which properties? Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
        {list.data?.items.map((p) => {
          const on = value.includes(p.id);
          return (
            <button key={p.id} type="button" onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])} className={clsx('flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs', on ? 'border-brand-400 bg-brand-50' : 'border-slate-200')}>
              <span className="truncate">
                {on && '✓ '}
                {p.title}
              </span>
              <span className="text-slate-500">{priceLabel(p)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Plan next" on a lead page. */
function ScheduleTab({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<ActivityType>('call');
  const [when, setWhen] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [props, setProps] = useState<string[]>([]);
  const [clash, setClash] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (force: boolean) => api.post('/activities', { leadId: lead.id, type, scheduledAt: when!.toISOString(), notes: notes || undefined, propertyIds: type === 'site_visit' ? props : undefined, force }),
    onSuccess: () => {
      toast(`${ACTIVITY_LABEL[type]} planned for ${relativeDay(when!)}, ${formatTime(when!)}`);
      setWhen(null);
      setNotes('');
      setProps([]);
      setClash(null);
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) setClash(e.message);
    },
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PLAN_TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)} className={clsx('rounded-full border px-2.5 py-1 text-xs', type === t ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
            {ACTIVITY_LABEL[t]}
          </button>
        ))}
      </div>
      <WhenPicker value={when} onChange={setWhen} />
      {type === 'site_visit' && <PropertyPicker lead={lead} value={props} onChange={setProps} />}
      <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What it's for (optional)" />
      {clash && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
          {clash}.{' '}
          <button className="font-medium underline" onClick={() => save.mutate(true)}>
            Plan it anyway
          </button>
        </p>
      )}
      <div className="flex justify-end">
        <Button size="sm" variant="primary" disabled={!when} loading={save.isPending} onClick={() => save.mutate(false)}>
          Plan it
        </Button>
      </div>
      {save.error && !clash && <ErrorNote error={save.error} />}
    </div>
  );
}

/** Book a meeting, call or visit from anywhere (the Calendar): pick the customer, what, when. */
/** The same "Plan next" form, in a dialog: used from the Leads list preview. */
export function PlanNextDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const refresh = useRefresh(lead.id);
  return (
    <Modal open onClose={onClose} title={`Plan the next step with ${lead.name}`}>
      <ScheduleTab
        lead={lead}
        onDone={() => {
          refresh();
          onClose();
        }}
      />
    </Modal>
  );
}

export function NewAppointment({ day, onClose }: { day?: Date; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [lead, setLead] = useState<Lead | null>(null);
  const [type, setType] = useState<ActivityType>('meeting');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [props, setProps] = useState<string[]>([]);
  const [clash, setClash] = useState<string | null>(null);
  const [when, setWhen] = useState<Date | null>(() => {
    if (!day) return null;
    const d = new Date(day);
    d.setHours(11, 0, 0, 0);
    // A day already under way starts from the next full hour.
    return d.getTime() > Date.now() ? d : new Date(Math.ceil((Date.now() + 3_600_000) / 3_600_000) * 3_600_000);
  });
  const found = useQuery({
    queryKey: ['leads', 'pick', q],
    queryFn: () => api.get<{ items: Lead[] }>(`/leads${qs({ q: q || undefined, open: true, limit: 6 })}`),
    enabled: !lead,
  });
  const save = useMutation({
    mutationFn: (force: boolean) => api.post('/activities', { leadId: lead!.id, type, scheduledAt: when!.toISOString(), title: title.trim() || undefined, notes: notes.trim() || undefined, propertyIds: type === 'site_visit' ? props : undefined, force }),
    onSuccess: () => {
      for (const k of ['agenda', 'today', 'upcoming', 'lead', 'leads', 'timeline', 'team']) void qc.invalidateQueries({ queryKey: [k] });
      toast(`${ACTIVITY_LABEL[type]} with ${lead!.name.split(' ')[0]} booked for ${relativeDay(when!)}, ${formatTime(when!)}`);
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) setClash(e.message);
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="New appointment"
      footer={
        <Button variant="primary" disabled={!lead || !when} loading={save.isPending} onClick={() => save.mutate(false)}>
          Book it
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Customer</p>
          {lead ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-brand-300 bg-brand-50/60 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{lead.name}</span>
                <span className="block truncate text-xs text-slate-500">{lead.summary}</span>
              </span>
              <button type="button" onClick={() => setLead(null)} className="shrink-0 text-xs font-medium text-brand-700 hover:underline">
                Change
              </button>
            </div>
          ) : (
            <>
              <Input autoFocus placeholder="Customer name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="mt-1.5 space-y-1">
                {found.data?.items.map((l) => (
                  <button key={l.id} type="button" onClick={() => setLead(l)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-left text-xs hover:border-brand-300">
                    <span className="truncate font-medium text-slate-800">{l.name}</span>
                    <span className="truncate text-slate-500">{l.summary}</span>
                  </button>
                ))}
                {found.data && !found.data.items.length && <p className="text-xs text-slate-500">No open customer matches “{q}”.</p>}
              </div>
            </>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">What</p>
          <div className="flex flex-wrap gap-1.5">
            {PLAN_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className={clsx('rounded-full border px-2.5 py-1 text-xs', type === t ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                {ACTIVITY_LABEL[t]}
              </button>
            ))}
          </div>
          <Input className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'meeting' ? 'What it’s about, e.g. Discuss payment plan' : 'What it’s about (optional)'} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">When</p>
          <WhenPicker value={when} onChange={setWhen} />
        </div>
        {type === 'site_visit' && lead && <PropertyPicker lead={lead} value={props} onChange={setProps} />}
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
        {clash && (
          <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            {clash}.{' '}
            <button type="button" className="font-medium underline" onClick={() => save.mutate(true)}>
              Book it anyway
            </button>
          </p>
        )}
        {save.error && !clash && <ErrorNote error={save.error} />}
      </div>
    </Modal>
  );
}

/** Done / move / cancel on a planned item, wherever it appears. */
export function PlannedButtons({ id, type, title, leadId, leadName, properties, onChanged }: { id: string; type: ActivityType; title: string; leadId: string; leadName?: string; properties?: { id: string; title: string }[]; onChanged?: () => void }) {
  const [mode, setMode] = useState<'done' | 'move' | 'cancel' | null>(null);
  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <Button size="sm" variant="primary" icon={<Check className="h-3.5 w-3.5" />} onClick={() => setMode('done')}>
          Done
        </Button>
        <Button size="sm" variant="ghost" icon={<Clock className="h-3.5 w-3.5" />} onClick={() => setMode('move')}>
          Reschedule
        </Button>
        <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} onClick={() => setMode('cancel')}>
          Cancel
        </Button>
      </div>
      {mode === 'done' && <CompleteDialog id={id} type={type} title={title} leadId={leadId} leadName={leadName} properties={properties ?? []} onClose={() => setMode(null)} onChanged={onChanged} />}
      {(mode === 'move' || mode === 'cancel') && <MoveOrCancel id={id} mode={mode} leadId={leadId} title={title} onClose={() => setMode(null)} onChanged={onChanged} />}
    </>
  );
}

function useRefresh(leadId: string, extra?: () => void) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['timeline', leadId] });
    void qc.invalidateQueries({ queryKey: ['lead', leadId] });
    void qc.invalidateQueries({ queryKey: ['leads'] });
    void qc.invalidateQueries({ queryKey: ['today'] });
    void qc.invalidateQueries({ queryKey: ['agenda'] });
    void qc.invalidateQueries({ queryKey: ['board'] });
    extra?.();
  };
}

export function CompleteDialog({ id, type, title, leadId, leadName, properties, onClose, onChanged }: { id: string; type: ActivityType; title: string; leadId: string; leadName?: string; properties: { id: string; title: string }[]; onClose: () => void; onChanged?: () => void }) {
  const toast = useToast();
  const refresh = useRefresh(leadId, onChanged);
  const [planning, setPlanning] = useState(false);
  const [outcome, setOutcome] = useState(type === 'call' ? 'Interested' : '');
  const [notes, setNotes] = useState('');
  const [interest, setInterest] = useState('');
  const [liked, setLiked] = useState('');
  const [concerns, setConcerns] = useState('');
  const [perProp, setPerProp] = useState<Record<string, 'liked' | 'rejected' | 'visited'>>({});
  const [nextType, setNextType] = useState<ActivityType>('call');
  const [nextWhen, setNextWhen] = useState<Date | null>(null);
  const [askNext, setAskNext] = useState(false);
  const visit = type === 'site_visit';
  const run = useMutation({
    mutationFn: (noShow: boolean) =>
      api.post<{ needsNextStep: boolean }>(`/activities/${id}/complete`, {
        noShow,
        outcome: outcome || (visit ? 'Visited' : undefined),
        notes: notes || undefined,
        feedback: visit && !noShow ? { interest: interest || undefined, liked: liked || undefined, concerns: concerns || undefined } : undefined,
        propertyFeedback: visit && Object.keys(perProp).length ? Object.entries(perProp).map(([propertyId, status]) => ({ propertyId, status })) : undefined,
        next: nextWhen ? { type: nextType, scheduledAt: nextWhen.toISOString() } : undefined,
      }),
    onSuccess: (r) => {
      refresh();
      if (r.needsNextStep && !askNext) {
        setAskNext(true);
        toast('Saved. What happens next?');
        return;
      }
      toast(nextWhen ? 'Saved, next step planned' : 'Saved');
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={askNext ? `What's next with ${leadName ?? 'them'}?` : `How did it go? ${title}`}
      footer={
        askNext ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Nothing for now
            </Button>
            <Button
              variant="primary"
              disabled={!nextWhen}
              loading={planning}
              onClick={async () => {
                setPlanning(true);
                try {
                  await api.post('/activities', { leadId, type: nextType, scheduledAt: nextWhen!.toISOString(), force: true });
                  refresh();
                  toast('Next step planned');
                  onClose();
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Could not plan it', 'error');
                } finally {
                  setPlanning(false);
                }
              }}
            >
              Plan it
            </Button>
          </>
        ) : (
          <>
            {(visit || type === 'meeting') && (
              <Button variant="ghost" onClick={() => run.mutate(true)}>
                They didn't come
              </Button>
            )}
            <Button variant="primary" loading={run.isPending} onClick={() => run.mutate(false)}>
              Save
            </Button>
          </>
        )
      }
    >
      {askNext ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Nothing else is planned with them. A lead without a next step usually goes cold.</p>
          <div className="flex flex-wrap gap-1.5">
            {PLAN_TYPES.map((t) => (
              <button key={t} onClick={() => setNextType(t)} className={clsx('rounded-full border px-2.5 py-1 text-xs', nextType === t ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                {ACTIVITY_LABEL[t]}
              </button>
            ))}
          </div>
          <WhenPicker value={nextWhen} onChange={setNextWhen} />
        </div>
      ) : (
        <div className="space-y-3">
          {type === 'call' && (
            <div className="flex flex-wrap gap-1.5">
              {CALL_OUTCOMES.map((o) => (
                <button key={o} onClick={() => setOutcome(o)} className={clsx('rounded-full border px-2.5 py-1 text-xs', outcome === o ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                  {o}
                </button>
              ))}
            </div>
          )}
          {visit && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {VISIT_INTEREST.map((o) => (
                  <button key={o} onClick={() => setInterest(o)} className={clsx('rounded-full border px-2.5 py-1 text-xs', interest === o ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                    {o}
                  </button>
                ))}
              </div>
              {properties.length > 1 &&
                properties.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{p.title}</span>
                    <span className="flex gap-1">
                      {(['liked', 'visited', 'rejected'] as const).map((s) => (
                        <button key={s} onClick={() => setPerProp({ ...perProp, [p.id]: s })} className={clsx('rounded-md border px-2 py-0.5', perProp[p.id] === s ? 'border-brand-500 bg-brand-50' : 'border-slate-200')}>
                          {s === 'liked' ? '👍 Liked' : s === 'rejected' ? '👎 No' : 'Neutral'}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}
              <Input placeholder="What they liked" value={liked} onChange={(e) => setLiked(e.target.value)} />
              <Input placeholder="Their concerns" value={concerns} onChange={(e) => setConcerns(e.target.value)} />
            </>
          )}
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-600">Next step (recommended)</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {PLAN_TYPES.map((t) => (
                <button key={t} onClick={() => setNextType(t)} className={clsx('rounded-full border px-2 py-0.5 text-xs', nextType === t ? 'border-brand-500 bg-white text-brand-800' : 'border-slate-200 text-slate-500')}>
                  {ACTIVITY_LABEL[t]}
                </button>
              ))}
            </div>
            <WhenPicker value={nextWhen} onChange={setNextWhen} />
          </div>
          <ErrorNote error={run.error} />
        </div>
      )}
    </Modal>
  );
}

function MoveOrCancel({ id, mode, leadId, title, onClose, onChanged }: { id: string; mode: 'move' | 'cancel'; leadId: string; title: string; onClose: () => void; onChanged?: () => void }) {
  const toast = useToast();
  const refresh = useRefresh(leadId, onChanged);
  const [when, setWhen] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [clash, setClash] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (force: boolean) => (mode === 'move' ? api.post(`/activities/${id}/reschedule`, { scheduledAt: when!.toISOString(), reason: reason || undefined, force }) : api.post(`/activities/${id}/cancel`, { reason })),
    onSuccess: () => {
      refresh();
      toast(mode === 'move' ? 'Rescheduled' : 'Cancelled');
      onClose();
    },
    onError: (e) => e instanceof ApiError && e.status === 409 && setClash(e.message),
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'move' ? `Reschedule: ${title}` : `Cancel: ${title}`}
      footer={
        <Button variant={mode === 'cancel' ? 'danger' : 'primary'} disabled={mode === 'move' ? !when : reason.trim().length < 2} loading={run.isPending} onClick={() => run.mutate(false)}>
          {mode === 'move' ? 'Move it' : 'Cancel it'}
        </Button>
      }
    >
      <div className="space-y-3">
        {mode === 'move' && <WhenPicker value={when} onChange={setWhen} />}
        <Input placeholder={mode === 'move' ? 'Why (optional), e.g. customer travelling' : 'Why, e.g. customer asked to postpone'} value={reason} onChange={(e) => setReason(e.target.value)} />
        {clash && (
          <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            {clash}.{' '}
            <button className="font-medium underline" onClick={() => run.mutate(true)}>
              Move anyway
            </button>
          </p>
        )}
        {run.error && !clash && <ErrorNote error={run.error} />}
      </div>
    </Modal>
  );
}

/** A planned item as a card, for Today and the Calendar. */
export function AgendaCard({ a, overdue, showOwner }: { a: AgendaItem; overdue?: boolean; showOwner?: boolean }) {
  return (
    <div className={clsx('rounded-2xl border bg-white p-3.5 shadow-sm', overdue ? 'border-rose-200' : 'border-slate-200/80')}>
      <div className="flex items-start gap-3">
        <div className={clsx('w-14 shrink-0 text-center', overdue ? 'text-rose-600' : 'text-slate-700')}>
          <p className="text-sm font-semibold">{formatTime(a.scheduledAt)}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{overdue ? relativeDay(a.scheduledAt) : ACTIVITY_LABEL[a.type]}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">
            {a.title}
            {a.lead && (
              <>
                {' · '}
                <Link to={`/leads/${a.lead.id}`} className="text-brand-700 hover:underline">
                  {a.lead.name}
                </Link>
              </>
            )}
          </p>
          {a.notes && <p className="truncate text-xs text-slate-500">{a.notes}</p>}
          {a.properties.length > 0 && <p className="truncate text-xs text-slate-500">{a.properties.map((p) => p.title).join(' · ')}</p>}
          {showOwner && a.owner && <p className="text-xs text-slate-400">{a.owner.name}</p>}
          {a.lead && a.status === 'planned' && <PlannedButtons id={a.id} type={a.type} title={a.title} leadId={a.lead.id} leadName={a.lead.name} properties={a.properties} />}
        </div>
        {a.lead && (
          <div className="flex shrink-0 gap-1">
            <a href={`tel:${a.lead.phone}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Call">
              <Phone className="h-4 w-4" />
            </a>
            <a href={waLink(a.lead.phone)} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** In-app reminders: a nudge 15 minutes before anything planned. */
export function Reminders({ plain }: { plain?: boolean } = {}) {
  const toast = useToast();
  const shown = useRef(new Set<string>());
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ['upcoming'], queryFn: () => api.get<{ items: AgendaItem[] }>('/activities/upcoming?minutes=60'), refetchInterval: 60_000 });
  const soon = q.data?.items ?? [];
  useEffect(() => {
    for (const a of soon) {
      const mins = Math.round((new Date(a.scheduledAt).getTime() - Date.now()) / 60_000);
      if (mins <= 15 && !shown.current.has(a.id)) {
        shown.current.add(a.id);
        toast(`${mins <= 0 ? 'Now' : `In ${mins} min`}: ${a.title} with ${a.lead?.name}`);
      }
    }
  }, [soon, toast]);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className={plain ? 'relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800' : 'relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50'} aria-label="Coming up">
        <Bell className="h-4 w-4" />
        {soon.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{soon.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-pop">
          <p className="mb-2 text-xs font-medium text-slate-500">Next hour</p>
          {!soon.length && <p className="text-sm text-slate-500">Nothing in the next hour.</p>}
          {soon.map((a) => (
            <Link key={a.id} to={a.lead ? `/leads/${a.lead.id}` : '/calendar'} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
              <b>{formatTime(a.scheduledAt)}</b> {a.title} · {a.lead?.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelinePlanned({ item }: { item: TimelineItem }) {
  const { pathname } = window.location;
  const leadId = pathname.split('/leads/')[1]?.split('/')[0] ?? '';
  return <PlannedButtons id={item.id} type={item.type as ActivityType} title={item.title} leadId={leadId} properties={item.properties} />;
}

PlannedActionsSlot.C = TimelinePlanned;
composerTabs.push({ key: 'schedule', label: 'Plan next', icon: <CalendarPlus className="h-3.5 w-3.5" />, C: ScheduleTab });
