import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, CalendarClock, Check, ChevronDown, CircleDot, FileText, Home, MessageCircle, MoreHorizontal, Pencil, Phone, PhoneCall, Shield, ShieldCheck, Sparkles, StickyNote, Users, Wallet, Wand2 } from 'lucide-react';
import {
  CALL_OUTCOMES,
  FINANCING_LABEL,
  INTENT_LABEL,
  LEAD_SOURCE_LABEL,
  OPEN_STAGES,
  SEGMENT_LABEL,
  TEMPERATURES,
  TEMPERATURE_LABEL,
  TIMELINE_LABEL,
  relativeDay,
  requirementGaps,
  scoreBand,
  type ActivityType,
  type Requirement,
  type ScoreBand,
  type Temperature,
} from '@estate/shared';
import { api } from '../lib/api';
import { useAuth, useUsers } from '../lib/auth';
import { TEMP_DOT, prettyPhone, waLink, type Lead, type TimelineItem } from '../lib/leads';
import { Avatar, Badge, Button, Drawer, EmptyState, ErrorNote, PageLoader, Select, Textarea } from '../components/ui';
import { Popover } from '../components/Popover';
import { RequirementEditor } from '../components/RequirementEditor';
import { BAND_STYLE, ScoreRing, budgetText, shortDate, whatAndWhere, type MatchItem } from '../components/leadBits';
import { useToast } from '../components/toast';
import { useAssistant, useAssistantPage } from '../ai/assistant';
import { leadSlots } from '../slots-leads';

export function useLead(id: string) {
  return useQuery({ queryKey: ['lead', id], queryFn: () => api.get<{ lead: Lead }>(`/leads/${id}`), select: (d) => d.lead });
}

/**
 * A customer's page. Left: the sales stage, the next step, and tabs for
 * activity, matches and what qualifies them. Right: who they are at a glance.
 */
export function LeadDetail() {
  const { id = '' } = useParams();
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

  return (
    <>
      <Link to="/leads" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          {[...leadSlots.hero, ...leadSlots.next, ...leadSlots.top].map((S, i) => (
            <S key={i} lead={lead} />
          ))}
          <LeadTabs lead={lead} onEdit={() => setEditReq(true)} />
        </div>

        {/* On phones the profile comes first: who they are before what happened. */}
        <div className="order-first space-y-4 lg:order-none">
          <Profile lead={lead} onTemperature={(temperature) => patch.mutate({ temperature })} onEdit={() => setEditReq(true)} />
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

/* ───────────────────────── Profile card (right) ───────────────────────── */

const READY_LABEL: Record<ScoreBand, string> = { high: 'High priority', qualified: 'Qualified', nurture: 'Nurture', early: 'Early stage', closed: 'Closed' };
const FIT_WORD = { strong: 'Strong', good: 'Good', partial: 'Partial' } as const;
const ICON_BTN = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900';

/** Who they are at a glance: contact, three scores, what they want, money, then deals and visits. */
function Profile({ lead, onTemperature, onEdit }: { lead: Lead; onTemperature: (t: Temperature) => void; onEdit: () => void }) {
  const { can } = useAuth();
  const r = lead.requirement;
  const open = OPEN_STAGES.includes(lead.stage);
  const matches = useQuery({ queryKey: ['matches', lead.id], queryFn: () => api.get<{ qualified: boolean; total: number; items: MatchItem[] }>(`/matching/lead/${lead.id}?limit=6`), enabled: open });
  const top = matches.data?.items[0];
  const band = scoreBand(lead.score, lead.stage);
  const fitScore = top ? Math.min(100, top.score) : 0;
  const fitBand: ScoreBand = fitScore >= 85 ? 'high' : fitScore >= 70 ? 'qualified' : 'nurture';
  const budget = r.budgetMax ?? r.budgetMin;
  const hni = lead.segment === 'hni' ? 'yes' : budget ? 'no' : 'unknown';
  const what = whatAndWhere(lead);
  const fundsReady = r.financing === 'own_funds' || r.financing === 'loan_approved';
  const money = [r.financing && r.financing !== 'unknown' && !fundsReady ? FINANCING_LABEL[r.financing] : null, r.intent ? INTENT_LABEL[r.intent] : null, r.timeline ? TIMELINE_LABEL[r.timeline] : null].filter(Boolean).join(' · ');

  return (
    <section className="card overflow-hidden rounded-3xl">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="relative">
            <Avatar name={lead.name} size="lg" soft />
            <span className={clsx('absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white', TEMP_DOT[lead.temperature])} title={`${TEMPERATURE_LABEL[lead.temperature]} lead`} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">{lead.name}</h1>
            <p className="truncate text-sm text-slate-500">{[r.intent ? INTENT_LABEL[r.intent] : null, SEGMENT_LABEL[lead.segment]].filter(Boolean).join(' · ')}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              <span className="font-mono">{lead.code}</span> · {LEAD_SOURCE_LABEL[lead.source]} · {shortDate(lead.createdAt, true)}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              Agent: <Owner lead={lead} />
            </p>
          </div>
          <Popover
            label="More for this lead"
            align="right"
            className="w-56"
            buttonClass={(o) => clsx('-mr-1 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900', o && 'bg-slate-100 text-slate-900')}
            trigger={() => <MoreHorizontal className="h-5 w-5" aria-label="More" />}
          >
            {(close) => (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">How keen are they?</p>
                <div className="flex rounded-full bg-slate-100 p-0.5">
                  {TEMPERATURES.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        onTemperature(t);
                        close();
                      }}
                      className={clsx('flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-1 text-xs font-medium', lead.temperature === t ? 'bg-white shadow-sm' : 'text-slate-500')}
                    >
                      <span className={clsx('h-2 w-2 rounded-full', TEMP_DOT[t])} /> {TEMPERATURE_LABEL[t]}
                    </button>
                  ))}
                </div>
                {can('lead.editOwn') && (
                  <button
                    onClick={() => {
                      close();
                      onEdit();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit what they want
                  </button>
                )}
              </div>
            )}
          </Popover>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3">
        <Phone className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
          {prettyPhone(lead.phone)}
          {lead.email && <span className="block truncate text-xs text-slate-400">{lead.email}</span>}
        </span>
        <a href={`tel:${lead.phone}`} className={ICON_BTN} aria-label={`Call ${lead.name}`} title="Call">
          <Phone className="h-4 w-4" />
        </a>
        <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className={ICON_BTN} aria-label={`WhatsApp ${lead.name}`} title="WhatsApp">
          <MessageCircle className="h-4 w-4" />
        </a>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 px-4 py-4">
        <Metric title="Property fit">
          {top ? <ScoreRing score={fitScore} band={fitBand} size="sm" label="Best property fit" /> : <Blank />}
          <span className={clsx('text-xs font-semibold', top ? BAND_STYLE[fitBand].text : 'text-slate-500')}>{top ? FIT_WORD[top.fit] : open ? 'No match yet' : '—'}</span>
        </Metric>
        <Metric title="Ready to buy">
          <ScoreRing score={lead.score} band={band} size="sm" />
          <span className={clsx('text-xs font-semibold', BAND_STYLE[band].text)}>{band === 'closed' ? (lead.stage === 'booked' ? 'Booked' : 'Lost') : READY_LABEL[band]}</span>
        </Metric>
        <Metric title="HNI status">
          <span className={clsx('flex h-12 w-12 items-center justify-center rounded-full', hni === 'yes' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400')}>
            {hni === 'yes' ? <ShieldCheck className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
          </span>
          <span className={clsx('text-xs font-semibold', hni === 'yes' ? 'text-emerald-700' : 'text-slate-600')}>{hni === 'yes' ? 'Potential HNI' : hni === 'no' ? 'Not HNI' : 'Not determined'}</span>
        </Metric>
      </div>

      <ProfileSection icon={<Home className="h-3.5 w-3.5" />} title="Looking for">
        <p className="text-sm font-medium text-slate-900">{what.length ? what.join(' · ') : 'Not known yet'}</p>
        {!!r.mustHaves?.length && <p className="mt-0.5 text-sm text-slate-500">Must have: {r.mustHaves.join(', ')}</p>}
      </ProfileSection>

      <ProfileSection icon={<Wallet className="h-3.5 w-3.5" />} title="Money">
        <p className="text-sm font-semibold text-slate-900">{budgetText(lead, true) ?? <span className="font-normal text-slate-500">Budget not known yet</span>}</p>
        {money && <p className="mt-0.5 text-sm text-slate-500">{money}</p>}
        {fundsReady && <p className="mt-0.5 text-sm font-medium text-emerald-700">{r.financing === 'loan_approved' ? 'Loan approved · funds ready' : 'Own funds · funds ready'}</p>}
      </ProfileSection>

      {leadSlots.side.map((S, i) => (
        <S key={i} lead={lead} />
      ))}
    </section>
  );
}

function Metric({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200/80 px-1 py-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">{title}</p>
      {children}
    </div>
  );
}

const Blank = () => <span className="flex h-12 w-12 items-center justify-center rounded-full border-[5px] border-slate-100 text-sm text-slate-400">—</span>;

function ProfileSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {icon}
        {title}
      </p>
      {children}
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
    return <span className={clsx('font-medium', lead.ownerName ? 'text-slate-700' : 'text-amber-700')}>{lead.ownerName ?? 'Unassigned'}</span>;
  // Managers change the agent right here: a plain-looking select with a small arrow.
  return (
    <span className="relative inline-flex items-center">
    <Select
      className={clsx('h-auto w-auto cursor-pointer rounded-md border-0 bg-transparent bg-none py-0 pl-0 pr-4 text-xs font-medium shadow-none hover:text-brand-700 focus:ring-2', lead.ownerId ? 'text-slate-700' : 'text-amber-700')}
      value={lead.ownerId ?? ''}
      onChange={(e) => e.target.value && assign.mutate(e.target.value)}
      aria-label="Agent"
    >
      {!lead.ownerId && <option value="">Unassigned — choose</option>}
      {users.data
        ?.filter((u) => u.active && u.role !== 'admin')
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
    </Select>
    <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-slate-400" />
    </span>
  );
}

/* ───────────────────────── Tabs (left) ───────────────────────── */

/** Activity, then any tabs modules add (Matches), then Qualification. */
function LeadTabs({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  const [tab, setTab] = useState('activity');
  const t = useQuery({ queryKey: ['timeline', lead.id], queryFn: () => api.get<{ items: TimelineItem[] }>(`/leads/${lead.id}/timeline`) });
  const done = (t.data?.items ?? []).filter((i) => i.kind === 'activity' && i.status === 'done').length;
  // The registry is fixed when the app loads, so these hooks run in the same order every time.
  const counts = leadSlots.tabs.map((x) => x.useCount?.(lead));
  const tabs = [{ key: 'activity', label: 'Activity', count: done || undefined }, ...leadSlots.tabs.map((x, i) => ({ key: x.key, label: x.label, count: counts[i] })), { key: 'qualification', label: 'Qualification', count: undefined }];
  const extra = leadSlots.tabs.find((x) => x.key === tab);
  return (
    <section className="card overflow-hidden rounded-3xl">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3" role="tablist" aria-label={`About ${lead.name}`}>
        {tabs.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={clsx('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3.5 text-sm font-medium transition', tab === x.key ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}
          >
            {x.label}
            {x.count != null && <span className={clsx('rounded-full px-1.5 text-xs', tab === x.key ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500')}>{x.count}</span>}
          </button>
        ))}
      </div>
      <div className="p-5" role="tabpanel">
        {tab === 'activity' ? (
          <>
            <Composer lead={lead} />
            <History items={t.data?.items} loading={t.isLoading} />
          </>
        ) : extra ? (
          <extra.C lead={lead} />
        ) : (
          <Qualification lead={lead} onEdit={onEdit} />
        )}
      </div>
    </section>
  );
}

/** What qualifies them: the full requirement, what's still unknown, contact and enquiries. */
function Qualification({ lead, onEdit }: { lead: Lead; onEdit: () => void }) {
  const { can } = useAuth();
  const r = lead.requirement;
  const gaps = requirementGaps(r);
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">What they want</p>
          {can('lead.editOwn') && (
            <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <Row label="Looking for" value={whatAndWhere(lead).join(' · ') || '—'} />
          <Row label="Budget" value={budgetText(lead, true) ?? '—'} />
          <Row label="When" value={r.timeline ? TIMELINE_LABEL[r.timeline] : '—'} />
          <Row label="Paying by" value={r.financing ? FINANCING_LABEL[r.financing] : '—'} />
          <Row label="Buying for" value={r.intent ? INTENT_LABEL[r.intent] : '—'} />
          {!!r.mustHaves?.length && <Row label="Must-haves" value={r.mustHaves.join(', ')} />}
          {r.notes && <Row label="Notes" value={r.notes} />}
        </dl>
        {gaps.length > 0 ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Still unknown: {gaps.join(', ')}. Ask on the next call — it's what qualifies them.</p>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Check className="h-3.5 w-3.5" /> Budget, location and type known: qualified.
          </p>
        )}
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Contact</p>
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <Row label="Phone" value={prettyPhone(lead.phone)} />
          {lead.email && <Row label="Email" value={lead.email} />}
          <Row label="Source" value={LEAD_SOURCE_LABEL[lead.source]} />
          <Row label="Lead ID" value={lead.code} />
        </dl>
      </div>
      {lead.enquiries.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Enquiries · {lead.enquiries.length}</p>
          <ul className="space-y-2 text-sm">
            {lead.enquiries
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={i} className="text-slate-700">
                  <span className="text-xs text-slate-400">
                    {shortDate(e.at, true)} · {LEAD_SOURCE_LABEL[e.source as keyof typeof LEAD_SOURCE_LABEL] ?? e.source}
                  </span>
                  {e.message && <p className="text-sm">{e.message}</p>}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-800">{value}</dd>
    </div>
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

/* ───────────────────────── Activity ───────────────────────── */

const ICON: Record<string, React.ReactNode> = {
  call: <PhoneCall className="h-3.5 w-3.5" />,
  whatsapp: <MessageCircle className="h-3.5 w-3.5" />,
  meeting: <Users className="h-3.5 w-3.5" />,
  site_visit: <Home className="h-3.5 w-3.5" />,
  email: <FileText className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
  task: <CalendarClock className="h-3.5 w-3.5" />,
};

/** What's coming up, then what happened, newest first. */
function History({ items = [], loading }: { items?: TimelineItem[]; loading: boolean }) {
  if (loading) return <PageLoader />;
  const planned = items.filter((i) => i.status === 'planned').sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const past = items.filter((i) => i.status !== 'planned');
  return (
    <ol className="mt-5 space-y-4">
      {planned.length > 0 && <li className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Coming up</li>}
      {planned.map((i) => (
        <TimelineEntry key={i.id} i={i} />
      ))}
      {planned.length > 0 && past.length > 0 && <li className="pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Earlier</li>}
      {past.map((i) => (
        <TimelineEntry key={i.id} i={i} />
      ))}
    </ol>
  );
}

function TimelineEntry({ i }: { i: TimelineItem }) {
  if (i.kind === 'event')
    return (
      <li className="flex gap-3 text-sm text-slate-500">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ai-50 text-ai-600">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="pt-1.5">
          <b className="font-semibold text-slate-800">{shortDate(i.at, true)}</b> · {i.title}
          {i.by && ` · ${i.by}`}
          {i.viaAI && ' · via assistant'}
        </span>
      </li>
    );
  return (
    <li className="flex gap-3">
      <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', i.status === 'planned' ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : i.status === 'cancelled' || i.status === 'missed' ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600')}>
        {ICON[i.type] ?? <CircleDot className="h-3.5 w-3.5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">
          <b className="font-semibold text-slate-800">{i.status === 'planned' ? `${relativeDay(i.at)}, ${new Date(i.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : shortDate(i.at, true)}</b> <span className={clsx(i.status === 'cancelled' && 'line-through')}>{i.title}</span>
          {i.by && ` · ${i.by}`}
          {i.viaAI && (
            <Badge tone="ai" className="ml-2">
              via assistant
            </Badge>
          )}
        </p>
        {i.body && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-800">{i.body}</p>}
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

/** Extra composer tabs added by later modules (e.g. Plan next). */
export const composerTabs: { key: string; label: string; icon: React.ReactNode; C: React.ComponentType<{ lead: Lead; onDone: () => void }> }[] = [];

/** Log what just happened: a call (with its outcome), a WhatsApp or a note. */
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
    ['call', 'Call', <PhoneCall key="c" className="h-3.5 w-3.5" />],
    ['whatsapp', 'WhatsApp', <MessageCircle key="w" className="h-3.5 w-3.5" />],
    ['note', 'Note', <StickyNote key="n" className="h-3.5 w-3.5" />],
    ...composerTabs.map((c) => [c.key, c.label, c.icon] as [string, string, React.ReactNode]),
  ];
  const extra = composerTabs.find((c) => c.key === tab);
  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200/70">
      <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="What to log">
        {tabs.map(([k, label, icon]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={clsx('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition', tab === k ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800')}>
            {icon} {label}
          </button>
        ))}
      </div>
      {extra ? (
        <div className="rounded-xl bg-white p-3">
          <extra.C lead={lead} onDone={done} />
        </div>
      ) : (
        <>
          {tab === 'call' && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CALL_OUTCOMES.map((o) => (
                <button key={o} onClick={() => setOutcome(o === outcome ? '' : o)} className={clsx('rounded-full border px-2.5 py-1 text-xs', o === outcome ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 bg-white text-slate-600')}>
                  {o}
                </button>
              ))}
            </div>
          )}
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label="Notes"
            className="border-0 bg-transparent px-1 shadow-none focus:ring-0"
            placeholder={tab === 'note' ? 'Anything worth remembering about them' : tab === 'whatsapp' ? 'What did you send? What did they reply?' : 'What did you talk about? What did they ask for?'}
          />
          <div className="flex justify-end">
            <Button size="sm" variant="primary" disabled={!notes.trim() && !outcome} loading={log.isPending} onClick={() => log.mutate()}>
              Log
            </Button>
          </div>
          <ErrorNote error={log.error} />
        </>
      )}
    </div>
  );
}

