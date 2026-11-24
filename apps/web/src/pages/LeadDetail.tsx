import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, CalendarClock, CircleDot, FileText, Home, MessageCircle, Phone, PhoneCall, Sparkles, StickyNote, Users, Wand2 } from 'lucide-react';
import {
  ACTIVITY_LABEL,
  CALL_OUTCOMES,
  FINANCING_LABEL,
  LEAD_SOURCE_LABEL,
  PROPERTY_TYPE_LABEL,
  STAGE_META,
  TEMPERATURES,
  TEMPERATURE_LABEL,
  TIMELINE_LABEL,
  formatINR,
  formatTime,
  relativeDay,
  requirementGaps,
  type ActivityType,
  type Requirement,
} from '@estate/shared';
import { api } from '../lib/api';
import { useAuth, useUsers } from '../lib/auth';
import { STAGE_TONE, TEMP_DOT, prettyPhone, relLower, waLink, type Lead, type TimelineItem } from '../lib/leads';
import { Avatar, Badge, Button, Card, Drawer, EmptyState, ErrorNote, PageLoader, SectionTitle, Select, Textarea } from '../components/ui';
import { RequirementEditor } from '../components/RequirementEditor';
import { useToast } from '../components/toast';
import { useAssistant, useAssistantPage } from '../ai/assistant';
import { leadSlots } from '../slots-leads';

export function useLead(id: string) {
  return useQuery({ queryKey: ['lead', id], queryFn: () => api.get<{ lead: Lead }>(`/leads/${id}`), select: (d) => d.lead });
}

export function LeadDetail() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const assistant = useAssistant();
  const q = useLead(id);
  const lead = q.data;
  const [editReq, setEditReq] = useState(false);

  useAssistantPage({
    page: 'Lead',
    entity: 'lead',
    entityId: id,
    label: lead?.name,
    suggestions: ['Summarise this customer', 'What should I do next with them?', 'Draft a WhatsApp follow-up', 'Find properties that fit them'],
  });

  const patch = useMutation({
    mutationFn: (body: object) => api.patch(`/leads/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lead', id] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['timeline', id] });
    },
  });

  if (q.isLoading) return <PageLoader />;
  if (!lead) return <EmptyState title="Lead not found" body="It may belong to someone else on the team." action={<Link className="link" to="/leads">Back to leads</Link>} />;

  const r = lead.requirement;
  const gaps = requirementGaps(r);

  return (
    <>
      <Link to="/leads" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>

      <section className="card mb-4 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative">
            <Avatar name={lead.name} />
            <span className={clsx('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white', TEMP_DOT[lead.temperature])} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{lead.name}</h1>
              <Badge tone={STAGE_TONE[lead.stage]}>{STAGE_META[lead.stage].label}</Badge>
              {lead.lostReason && <Badge tone="red">{lead.lostReason}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {prettyPhone(lead.phone)} · {LEAD_SOURCE_LABEL[lead.source]} · first enquiry {relLower(lead.createdAt)}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <div className="flex rounded-full bg-slate-100 p-0.5">
                {TEMPERATURES.map((t) => (
                  <button key={t} onClick={() => patch.mutate({ temperature: t })} className={clsx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', lead.temperature === t ? 'bg-white shadow-sm' : 'text-slate-500')}>
                    <span className={clsx('h-2 w-2 rounded-full', TEMP_DOT[t])} /> {TEMPERATURE_LABEL[t]}
                  </button>
                ))}
              </div>
              <Owner lead={lead} />
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <a href={`tel:${lead.phone}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
              <Phone className="h-4 w-4" /> Call
            </a>
            <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
            {leadSlots.actions.map((S, i) => (
              <S key={i} lead={lead} />
            ))}
          </div>
        </div>

        <Facts lead={lead} />

        {leadSlots.hero.map((S, i) => (
          <div key={i} className="mt-4 border-t border-slate-100 pt-4">
            <S lead={lead} />
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {leadSlots.top.map((S, i) => (
            <S key={i} lead={lead} />
          ))}
          <Timeline lead={lead} />
        </div>

        <div className="space-y-4">
          <Card className="rounded-3xl p-5">
            <SectionTitle
              action={
                can('lead.editOwn') && (
                  <Button size="sm" variant="ghost" onClick={() => setEditReq(true)}>
                    Edit
                  </Button>
                )
              }
            >
              About {lead.name.split(' ')[0]}
            </SectionTitle>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Looking for</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{lead.summary || 'Not known yet'}</p>
            {!!(r.localities?.length || r.types?.length) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(r.localities ?? []).map((l) => (
                  <span key={l} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">
                    {l}
                  </span>
                ))}
                {(r.types ?? []).map((t) => (
                  <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {PROPERTY_TYPE_LABEL[t]}
                  </span>
                ))}
              </div>
            )}
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="Budget" value={budgetText(r) ?? '—'} />
              {r.bedrooms ? <Row label="Bedrooms" value={`${r.bedrooms} BHK`} /> : null}
              <Row label="When" value={r.timeline ? TIMELINE_LABEL[r.timeline] : '—'} />
              <Row label="Paying by" value={r.financing ? FINANCING_LABEL[r.financing] : '—'} />
              {!!r.mustHaves?.length && <Row label="Must-haves" value={r.mustHaves.join(', ')} />}
              {r.notes && <Row label="Notes" value={r.notes} />}
            </dl>
            {gaps.length > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Still unknown: {gaps.join(', ')}. Ask on the next call — it's what qualifies them.
              </p>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Contact</p>
              <dl className="mt-2 space-y-1.5 text-sm">
                <Row label="Phone" value={prettyPhone(lead.phone)} />
                {lead.email && <Row label="Email" value={lead.email} />}
                <Row label="Source" value={LEAD_SOURCE_LABEL[lead.source]} />
                <Row label="Lead ID" value={lead.code} />
              </dl>
            </div>

            {lead.enquiries.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Enquiries · {lead.enquiries.length}</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {lead.enquiries
                    .slice()
                    .reverse()
                    .map((e, i) => (
                      <li key={i} className="text-slate-700">
                        <span className="text-xs text-slate-400">
                          {relativeDay(e.at)} · {LEAD_SOURCE_LABEL[e.source as keyof typeof LEAD_SOURCE_LABEL] ?? e.source}
                        </span>
                        {e.message && <p className="text-sm">{e.message}</p>}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Card>

          {leadSlots.side.map((S, i) => (
            <S key={i} lead={lead} />
          ))}

          <section className="rounded-3xl border border-ai-100 bg-gradient-to-br from-ai-50 to-white p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-ai-600" /> Ask about {lead.name.split(' ')[0]}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['Summarise this customer', 'Summarise'],
                ['What should I do next with them, and why?', 'What next?'],
                ['Draft a warm WhatsApp follow-up for them based on our last conversation.', 'Draft a follow-up'],
              ].map(([prompt, label]) => (
                <button key={label} onClick={() => assistant.ask(prompt)} className="rounded-full border border-ai-200 bg-white px-3 py-1.5 text-xs font-medium text-ai-700 transition hover:bg-ai-50">
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
      {editReq && <EditRequirement lead={lead} onClose={() => setEditReq(false)} onSave={(requirement) => patch.mutateAsync({ requirement }).then(() => setEditReq(false))} saving={patch.isPending} />}
    </>
  );
}

const budgetText = (r: Partial<Requirement>) =>
  r.budgetMin && r.budgetMax ? `${formatINR(r.budgetMin)} – ${formatINR(r.budgetMax)}` : r.budgetMax ? `Up to ${formatINR(r.budgetMax)}` : r.budgetMin ? `From ${formatINR(r.budgetMin)}` : null;

/** The four things to know before calling: what's next, when we last spoke, how long they've waited, what they've seen. */
function Facts({ lead }: { lead: Lead }) {
  const open = lead.stage !== 'lost' && lead.stage !== 'booked';
  const sent = lead.shortlist.filter((s) => s.status !== 'suggested' && s.status !== 'rejected').length;
  const liked = lead.shortlist.filter((s) => s.status === 'liked').length;
  const visited = lead.shortlist.filter((s) => s.status === 'visited').length;
  const next = lead.nextAction?.dueAt;
  const facts: { label: string; value: string; hint?: string; tone?: 'rose' | 'amber' }[] = [
    next
      ? { label: 'Next step', value: lead.nextAction?.title || ACTIVITY_LABEL[lead.nextAction?.type as ActivityType] || 'Follow-up', hint: `${relativeDay(next)}, ${formatTime(next)}`, tone: lead.overdue ? 'rose' : undefined }
      : { label: 'Next step', value: open ? 'None planned' : '—', hint: open ? 'Plan one below' : undefined, tone: open ? 'amber' : undefined },
    { label: 'Last spoke', value: lead.lastContactAt ? relativeDay(lead.lastContactAt) : 'Never', hint: lead.lastContactAt ? undefined : 'Make the first call', tone: lead.lastContactAt ? undefined : 'amber' },
    { label: 'In this stage', value: `${lead.daysInStage} day${lead.daysInStage === 1 ? '' : 's'}`, hint: lead.stale ? 'Longer than usual' : STAGE_META[lead.stage].label, tone: lead.stale ? 'amber' : undefined },
    { label: 'Properties sent', value: sent ? String(sent) : 'None yet', hint: [liked && `${liked} liked`, visited && `${visited} visited`].filter(Boolean).join(' · ') || undefined },
  ];
  return (
    <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className={clsx('rounded-2xl p-3', f.tone === 'rose' ? 'bg-rose-50' : f.tone === 'amber' ? 'bg-amber-50' : 'bg-slate-50')}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{f.label}</dt>
          <dd className={clsx('mt-1 truncate text-sm font-semibold', f.tone === 'rose' ? 'text-rose-700' : f.tone === 'amber' ? 'text-amber-800' : 'text-slate-900')} title={f.value}>
            {f.value}
          </dd>
          {f.hint && <dd className={clsx('truncate text-xs', f.tone === 'rose' ? 'text-rose-600' : 'text-slate-500')}>{f.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}

function Owner({ lead }: { lead: Lead }) {
  const { can } = useAuth();
  const users = useUsers();
  const qc = useQueryClient();
  const toast = useToast();
  const assign = useMutation({
    mutationFn: (ownerId: string) => api.post(`/leads/${lead.id}/assign`, { ownerId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lead', lead.id] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      toast('Owner changed');
    },
  });
  if (!can('lead.assign'))
    return (
      <span className="flex items-center gap-1 text-xs text-slate-500">
        <Users className="h-3.5 w-3.5" /> {lead.ownerName ?? 'Unassigned'}
      </span>
    );
  return (
    <Select className="w-auto py-1 text-xs" value={lead.ownerId ?? ''} onChange={(e) => e.target.value && assign.mutate(e.target.value)}>
      {!lead.ownerId && <option value="">Unassigned — choose owner</option>}
      {users.data
        ?.filter((u) => u.active && u.role !== 'admin')
        .map((u) => (
          <option key={u.id} value={u.id}>
            Owner: {u.name}
          </option>
        ))}
    </Select>
  );
}

function EditRequirement({ lead, onClose, onSave, saving }: { lead: Lead; onClose: () => void; onSave: (r: Partial<Requirement>) => Promise<unknown>; saving: boolean }) {
  const [req, setReq] = useState<Partial<Requirement>>(lead.requirement);
  const [said, setSaid] = useState('');
  const parse = useMutation({
    mutationFn: () => api.post<{ requirement: Partial<Requirement> }>('/leads/parse-requirement', { text: said }),
    onSuccess: (r) => {
      setReq((cur) => ({ ...cur, ...r.requirement }));
      setSaid('');
    },
  });
  return (
    <Drawer
      open
      onClose={onClose}
      title={`What ${lead.name.split(' ')[0]} is looking for`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={() => onSave(req)}>
            Save
          </Button>
        </>
      }
    >
      <div className="mb-4 flex gap-2 rounded-2xl border border-ai-100 bg-ai-50/60 p-2">
        <input className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" placeholder='Say what changed: "budget up to 90 L, also fine with Valasaravakkam"' value={said} onChange={(e) => setSaid(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && said.trim() && parse.mutate()} />
        <Button size="sm" variant="ai" icon={<Wand2 className="h-3.5 w-3.5" />} disabled={!said.trim()} loading={parse.isPending} onClick={() => parse.mutate()}>
          Apply
        </Button>
      </div>
      <RequirementEditor value={req} onChange={setReq} />
      <ErrorNote error={parse.error} />
    </Drawer>
  );
}

const ICON: Record<string, React.ReactNode> = {
  call: <PhoneCall className="h-3.5 w-3.5" />,
  whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  site_visit: <Home className="h-3.5 w-3.5" />,
  email: <FileText className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
  task: <CalendarClock className="h-3.5 w-3.5" />,
};

export function Timeline({ lead }: { lead: Lead }) {
  const t = useQuery({ queryKey: ['timeline', lead.id], queryFn: () => api.get<{ items: TimelineItem[] }>(`/leads/${lead.id}/timeline`) });
  const items = t.data?.items ?? [];
  const planned = items.filter((i) => i.status === 'planned').sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const past = items.filter((i) => i.status !== 'planned');
  const did = past.filter((i) => i.kind === 'activity' && i.status === 'done');
  const count = (types: string[], one: string, many: string) => {
    const n = did.filter((i) => types.includes(i.type)).length;
    return n ? `${n} ${n === 1 ? one : many}` : null;
  };
  const tally = [count(['call'], 'call', 'calls'), count(['whatsapp', 'email'], 'message', 'messages'), count(['site_visit'], 'visit', 'visits'), count(['meeting'], 'meeting', 'meetings')].filter(Boolean).join(' · ');
  return (
    <Card className="rounded-3xl p-5">
      <SectionTitle action={tally && <span className="text-xs text-slate-500">{tally}</span>}>History</SectionTitle>
      <Composer lead={lead} />
      {t.isLoading ? (
        <PageLoader />
      ) : (
        <ol className="mt-5 space-y-4">
          {planned.length > 0 && <li className="text-xs font-medium uppercase tracking-wide text-slate-400">Coming up</li>}
          {planned.map((i) => (
            <TimelineEntry key={i.id} i={i} />
          ))}
          {planned.length > 0 && past.length > 0 && <li className="pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">Earlier</li>}
          {past.map((i) => (
            <TimelineEntry key={i.id} i={i} />
          ))}
        </ol>
      )}
    </Card>
  );
}

function TimelineEntry({ i }: { i: TimelineItem }) {
  if (i.kind === 'event')
    return (
      <li className="flex gap-3 text-xs text-slate-500">
        <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
        <span>
          {i.title} · {i.by} · {relativeDay(i.at)}
          {i.viaAI && ' · via assistant'}
        </span>
      </li>
    );
  return (
    <li className="flex gap-3">
      <span className={clsx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', i.status === 'planned' ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : i.status === 'cancelled' || i.status === 'missed' ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600')}>
        {ICON[i.type] ?? <CircleDot className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={clsx('text-sm font-medium', i.status === 'cancelled' ? 'text-slate-400 line-through' : 'text-slate-800')}>
          {i.title}
          {i.viaAI && (
            <Badge tone="ai" className="ml-2">
              via assistant
            </Badge>
          )}
        </p>
        {i.body && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{i.body}</p>}
        {i.feedback && (i.feedback.interest || i.feedback.liked || i.feedback.concerns) && (
          <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">
            {i.feedback.interest && <b>{i.feedback.interest}. </b>}
            {i.feedback.liked && `Liked: ${i.feedback.liked}. `}
            {i.feedback.concerns && `Concerns: ${i.feedback.concerns}.`}
          </p>
        )}
        {!!i.properties?.length && (
          <div className="mt-1 flex flex-wrap gap-1">
            {i.properties.map((p) => (
              <Link key={p.id} to={`/properties/${p.id}`} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-brand-50">
                {p.title}
              </Link>
            ))}
          </div>
        )}
        <p className="mt-0.5 text-xs text-slate-400">
          {i.status === 'planned' ? `${relativeDay(i.at)}, ${new Date(i.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : relativeDay(i.at)}
          {i.by && ` · ${i.by}`}
        </p>
        {i.status === 'planned' && <PlannedActions item={i} />}
      </div>
    </li>
  );
}

/** Filled in by the activities module: complete / reschedule / cancel buttons. */
export const PlannedActionsSlot: { C: React.ComponentType<{ item: TimelineItem }> | null } = { C: null };
function PlannedActions({ item }: { item: TimelineItem }) {
  const C = PlannedActionsSlot.C;
  return C ? <C item={item} /> : null;
}

/** Extra composer tabs added by later modules (e.g. Schedule). */
export const composerTabs: { key: string; label: string; icon: React.ReactNode; C: React.ComponentType<{ lead: Lead; onDone: () => void }> }[] = [];

function Composer({ lead }: { lead: Lead }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<string>('call');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const log = useMutation({
    mutationFn: () => api.post(`/leads/${lead.id}/log`, { type: tab as ActivityType, outcome: tab === 'call' ? outcome || undefined : undefined, notes: notes || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['timeline', lead.id] });
      void qc.invalidateQueries({ queryKey: ['lead', lead.id] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      toast('Logged');
      setNotes('');
      setOutcome('');
    },
  });
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['timeline', lead.id] });
    void qc.invalidateQueries({ queryKey: ['lead', lead.id] });
    void qc.invalidateQueries({ queryKey: ['leads'] });
  };
  const tabs: [string, string, React.ReactNode][] = [
    ...composerTabs.map((c) => [c.key, c.label, c.icon] as [string, string, React.ReactNode]),
    ['call', 'Log a call', <PhoneCall key="c" className="h-3.5 w-3.5" />],
    ['whatsapp', 'WhatsApp', <MessageCircle key="w" className="h-3.5 w-3.5" />],
    ['note', 'Note', <StickyNote key="n" className="h-3.5 w-3.5" />],
  ];
  const extra = composerTabs.find((c) => c.key === tab);
  return (
    <div className="rounded-2xl border border-slate-200 p-3">
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map(([k, label, icon]) => (
          <button key={k} onClick={() => setTab(k)} className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium', tab === k ? 'bg-brand-50 text-brand-800' : 'text-slate-500 hover:bg-slate-50')}>
            {icon} {label}
          </button>
        ))}
      </div>
      {extra ? (
        <extra.C lead={lead} onDone={done} />
      ) : (
        <>
          {tab === 'call' && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CALL_OUTCOMES.map((o) => (
                <button key={o} onClick={() => setOutcome(o === outcome ? '' : o)} className={clsx('rounded-full border px-2.5 py-1 text-xs', o === outcome ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                  {o}
                </button>
              ))}
            </div>
          )}
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tab === 'note' ? 'Anything worth remembering about them' : `What was said (${ACTIVITY_LABEL[tab as ActivityType] ?? ''})`} />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="primary" disabled={!notes.trim() && !outcome} loading={log.isPending} onClick={() => log.mutate()}>
              Save
            </Button>
          </div>
          <ErrorNote error={log.error} />
        </>
      )}
    </div>
  );
}
