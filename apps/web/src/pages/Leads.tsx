import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, Check, ChevronDown, Clock, Flame, MessageCircle, Phone, Search, Shuffle, SlidersHorizontal, Sparkles, TriangleAlert, UserPlus, UserRound, Users, X } from 'lucide-react';
import {
  ACTIVITY_LABEL,
  HOT_SCORE,
  INTENT_LABEL,
  LEAD_SOURCE_LABEL,
  OPEN_STAGES,
  PROPERTY_TYPE_LABEL,
  SCORE_BAND_LABEL,
  SEGMENT_LABEL,
  STAGE_META,
  TIMELINE_LABEL,
  formatINR,
  formatTime,
  scoreBand,
  type ActivityType,
  type ScoreBand,
  type Stage,
} from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth, useUsers } from '../lib/auth';
import { STAGE_TONE, waLink, type Lead, type TimelineItem } from '../lib/leads';
import { priceLabel, typeLabel, type Property } from '../lib/property';
import { PageHeader } from '../components/Layout';
import { Avatar, Button, EmptyState, PageLoader, Segmented, Select, type Tone } from '../components/ui';
import { Popover } from '../components/Popover';
import { PropertyCover } from '../components/PropertyCard';
import { FilterChip } from './Properties';
import { NewLead } from '../components/NewLead';
import { useToast } from '../components/toast';
import { useAssistant, useAssistantPage } from '../ai/assistant';
import { CompleteDialog, PlanNextDialog } from '../features/activities';
import { views } from '../slots-leads';

type Tab = 'all' | 'hot' | 'investors' | 'hni' | 'closed';
type FocusKey = 'overdue' | 'today' | 'hot' | 'new';

const isHot = (l: Lead) => l.score >= HOT_SCORE;

/** The tabs over the list. "Closed / Lost" loads separately; the rest slice the open leads. */
const TABS: { key: Tab; label: string; test?: (l: Lead) => boolean }[] = [
  { key: 'all', label: 'All' },
  { key: 'hot', label: 'Hot leads', test: isHot },
  { key: 'investors', label: 'Investors', test: (l) => l.requirement.intent === 'investment' },
  { key: 'hni', label: 'HNI', test: (l) => l.segment === 'hni' },
  { key: 'closed', label: 'Closed / Lost' },
];

export function Leads() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [acting, setActing] = useState<Lead | null>(null);
  const manager = can('lead.viewAll');
  const view = params.get('view') ?? 'list';
  const owner = params.get('owner') ?? '';
  const q = params.get('q') ?? '';
  const stageParam = (params.get('stages')?.split(',').filter(Boolean) ?? []) as Stage[];
  // Older links ask for ?stages=booked or ?stages=lost: that is the Closed tab now.
  const tab: Tab = (params.get('tab') as Tab) ?? (stageParam.some((s) => s === 'booked' || s === 'lost') ? 'closed' : 'all');
  const stages = stageParam.filter((s) => OPEN_STAGES.includes(s));
  const focus = (params.get('focus') ?? '') as FocusKey | '';

  useAssistantPage({
    page: 'Leads',
    suggestions: manager
      ? ['Which leads need attention today?', 'Who has overdue follow-ups?', 'Where are deals getting stuck?']
      : ['Which of my leads need attention?', 'Show my hot leads', 'Show my leads without follow-ups'],
  });

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  const ownerId = owner || undefined;
  // The open list always loads: the tiles and tab counts come from it.
  const open = useQuery({
    queryKey: ['leads', { q, owner, stages, open: true }],
    queryFn: () => api.get<{ items: Lead[]; total: number }>(`/leads${qs({ q, ownerId, stages: stages.length ? stages : undefined, open: stages.length ? undefined : true, limit: 300 })}`),
  });
  const closed = useQuery({
    queryKey: ['leads', { q, owner, stages: ['booked', 'lost'] }],
    queryFn: () => api.get<{ items: Lead[]; total: number }>(`/leads${qs({ q, ownerId, stages: ['booked', 'lost'], limit: 300 })}`),
    enabled: tab === 'closed',
  });
  const closedCount = useQuery({ queryKey: ['leads', 'count', 'closed', { q, owner }], queryFn: () => api.get<{ total: number }>(`/leads${qs({ q, ownerId, stages: ['booked', 'lost'], limit: 1 })}`) }).data?.total;

  const openItems = open.data?.items ?? [];
  const list = tab === 'closed' ? closed : open;
  const tabTest = TABS.find((t) => t.key === tab)?.test;
  let items = list.data?.items ?? [];
  if (tabTest) items = items.filter(tabTest);
  if (tab !== 'closed' && focus) items = items.filter(FOCUS[focus].test);
  const groups = tab === 'closed' ? [{ key: 'closed', label: 'Closed / Lost', dot: 'bg-slate-400', items: [...items].sort((a, b) => +new Date(b.stageChangedAt) - +new Date(a.stageChangedAt)) }] : groupByDue(items);
  const ordered = groups.flatMap((g) => g.items);

  // Wide screens show the chosen lead beside the list; narrower ones open its page.
  const wide = useMedia('(min-width: 1280px)');
  const [picked, setPicked] = useState<string | null>(null);
  const selected = ordered.find((l) => l.id === picked) ?? ordered[0];

  const spread = useMutation({
    mutationFn: () => api.post<{ assigned: { lead: string; owner: string }[] }>('/leads/assign-evenly'),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      toast(`Assigned ${r.assigned.length} leads across the team`);
    },
  });
  const unassignedCount = useQuery({
    queryKey: ['leads', 'unassigned-count'],
    queryFn: () => api.get<{ total: number }>('/leads?ownerId=none&open=true&limit=1'),
    enabled: manager,
  });
  const BoardView = views.board;
  const filters = stages.length + (owner ? 1 : 0);
  const tabCount = (t: (typeof TABS)[number]) => (t.key === 'closed' ? closedCount : !open.data ? undefined : t.test ? openItems.filter(t.test).length : open.data.total);

  return (
    <>
      <PageHeader
        title={manager ? 'Leads' : 'My leads'}
        subtitle="Every customer, from first enquiry to booking."
        actions={
          <>
            {BoardView && (
              <Segmented
                value={view}
                onChange={(v) => update({ view: v === 'list' ? null : v })}
                options={[
                  { value: 'list', label: 'List' },
                  { value: 'board', label: 'Pipeline' },
                ]}
              />
            )}
            {manager && !!unassignedCount.data?.total && (
              <Button icon={<Shuffle className="h-4 w-4" />} loading={spread.isPending} onClick={() => spread.mutate()} title="Each goes to the executive with the fewest open leads">
                Assign {unassignedCount.data.total} unassigned evenly
              </Button>
            )}
            <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              New lead
            </Button>
          </>
        }
      />

      {view === 'board' && BoardView ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchBox q={q} onSearch={(v) => update({ q: v || null })} className="min-w-[220px] flex-1" />
            {manager && <OwnerSelect value={owner} onChange={(v) => update({ owner: v || null })} className="w-auto py-2" />}
          </div>
          <BoardView owner={owner} q={q} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(Object.keys(FOCUS) as FocusKey[]).map((k) => {
              const on = k === 'hot' ? tab === 'hot' : tab !== 'closed' && focus === k;
              return (
                <FocusTile
                  key={k}
                  k={k}
                  n={open.data ? openItems.filter(FOCUS[k].test).length : null}
                  on={on}
                  // The hot tile is the "Hot leads" tab; the others narrow the list.
                  onClick={() => (k === 'hot' ? update({ tab: on ? null : 'hot', focus: null }) : update({ focus: on ? null : k, tab: tab === 'closed' || tab === 'all' ? null : tab }))}
                />
              );
            })}
          </div>

          <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
                <div className="-mx-1 flex max-w-full items-center gap-0.5 overflow-x-auto whitespace-nowrap px-1" role="tablist" aria-label="Lead groups">
                  {TABS.map((t) => {
                    const n = tabCount(t);
                    return (
                      <button
                        key={t.key}
                        role="tab"
                        aria-selected={tab === t.key}
                        onClick={() => update({ tab: t.key === 'all' ? null : t.key, stages: t.key === 'closed' ? null : stages.join(',') || null, focus: t.key === 'closed' ? null : focus || null })}
                        className={clsx('rounded-xl px-2.5 py-1.5 text-sm font-medium transition', tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
                      >
                        {t.label}
                        {n != null && <span className={clsx('ml-1 text-xs', tab === t.key ? 'text-white/60' : 'text-slate-400')}>{n}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto">
                  <SearchBox q={q} onSearch={(v) => update({ q: v || null })} className="min-w-0 flex-1 sm:w-40 sm:flex-none" />
                  <Popover
                    label="Filter leads"
                    align="right"
                    className="w-72"
                    buttonClass={(o) => clsx('flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition', o || filters ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300')}
                    trigger={() => (
                      <>
                        <SlidersHorizontal className="h-4 w-4" />
                        <span className="hidden sm:inline xl:hidden 2xl:inline">Filter</span>
                        {!!filters && <span className="rounded-full bg-brand-700 px-1.5 text-[11px] text-white">{filters}</span>}
                      </>
                    )}
                  >
                    {() => (
                      <div className="space-y-3">
                        {manager && (
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-slate-500">Owner</p>
                            <OwnerSelect value={owner} onChange={(v) => update({ owner: v || null })} />
                          </div>
                        )}
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-slate-500">Stage (open leads)</p>
                          <div className="flex flex-wrap gap-1.5">
                            {OPEN_STAGES.map((s) => (
                              <FilterChip key={s} on={stages.includes(s)} onClick={() => update({ tab: tab === 'closed' ? null : params.get('tab'), stages: (stages.includes(s) ? stages.filter((x) => x !== s) : [...stages, s]).join(',') || null })}>
                                {STAGE_META[s].label}
                              </FilterChip>
                            ))}
                          </div>
                        </div>
                        {!!filters && (
                          <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => update({ owner: null, stages: null })}>
                            Clear filters
                          </button>
                        )}
                      </div>
                    )}
                  </Popover>
                </div>
              </div>

              {tab !== 'closed' && focus && (
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-600">
                  Showing <span className="font-medium text-slate-900">{FOCUS[focus].label.toLowerCase()}</span> only
                  <button className="ml-1 inline-flex items-center gap-0.5 font-medium text-brand-700 hover:underline" onClick={() => update({ focus: null })}>
                    <X className="h-3.5 w-3.5" /> Show all
                  </button>
                </div>
              )}

              {list.isLoading ? (
                <div className="p-6">
                  <PageLoader />
                </div>
              ) : !items.length ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Users className="h-5 w-5" />}
                    title={q ? `No ${tab === 'closed' ? 'closed' : 'open'} leads match “${q}”` : focus && tab !== 'closed' ? `No one in “${FOCUS[focus].label}”` : 'No leads here'}
                    body={q && tab !== 'closed' ? 'Try Closed / Lost, or another search.' : 'Add a lead, or change the filters.'}
                    action={
                      <Button variant="primary" onClick={() => setAdding(true)}>
                        New lead
                      </Button>
                    }
                  />
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.key}>
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      <span className={clsx('h-1.5 w-1.5 rounded-full', g.dot)} />
                      {g.label}
                      <span className="font-medium text-slate-400">{g.items.length}</span>
                    </div>
                    <div className="divide-y divide-slate-100 border-b border-slate-100 last:border-b-0">
                      {g.items.map((l) => (
                        <LeadRow
                          key={l.id}
                          l={l}
                          selected={wide && selected?.id === l.id}
                          onDone={() => setActing(l)}
                          onPick={
                            wide
                              ? (e) => {
                                  e.preventDefault();
                                  setPicked(l.id);
                                }
                              : undefined
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>

            {wide && selected && <LeadPreview key={selected.id} lead={selected} onDone={() => setActing(selected)} />}
          </div>
        </>
      )}
      {acting && <DoneDialog lead={acting} onClose={() => setActing(null)} />}
      <NewLead open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

/** "Done": finish the planned follow-up (and plan the next), or plan one if there is none. */
function DoneDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const next = lead.nextAction;
  if (!next) return <PlanNextDialog lead={lead} onClose={onClose} />;
  return <CompleteDialog id={next.activityId} type={next.type as ActivityType} title={next.title ?? ACTIVITY_LABEL[next.type as ActivityType] ?? next.type} leadId={lead.id} leadName={lead.name} properties={[]} onClose={onClose} />;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysFromToday = (iso: string) => Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
const isNew = (l: Lead) => Date.now() - new Date(l.createdAt).getTime() < 7 * 86_400_000;
/** "6 Nov", or "6 Nov 2026" with the year. */
const shortDate = (d: string, year = false) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });

/** The four counts above the list. */
const FOCUS: Record<FocusKey, { label: string; hint: string; mark: ReactNode; text: string; glow: string; ring: string; test: (l: Lead) => boolean }> = {
  overdue: { label: 'Overdue', hint: 'Follow-ups past their date', mark: <span className="h-2 w-2 rounded-full bg-rose-600" />, text: 'text-rose-700', glow: 'bg-rose-100/60', ring: 'ring-rose-300', test: (l) => l.overdue },
  today: { label: 'Due today', hint: 'Follow-ups planned for today', mark: <span className="h-2 w-2 rounded-full bg-amber-600" />, text: 'text-amber-800', glow: 'bg-amber-100/70', ring: 'ring-amber-300', test: (l) => !l.overdue && !!l.nextAction?.dueAt && daysFromToday(l.nextAction.dueAt) === 0 },
  hot: { label: 'Hot leads', hint: `Ready to buy (${HOT_SCORE}+)`, mark: <Flame className="h-4 w-4" />, text: 'text-emerald-700', glow: 'bg-emerald-100/60', ring: 'ring-emerald-300', test: isHot },
  new: { label: 'New this week', hint: 'Enquired in the last 7 days', mark: <Sparkles className="h-4 w-4" />, text: 'text-ai-600', glow: 'bg-ai-100/60', ring: 'ring-ai-300', test: isNew },
};

function FocusTile({ k, n, on, onClick }: { k: FocusKey; n: number | null; on: boolean; onClick: () => void }) {
  const f = FOCUS[k];
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx('relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-card transition hover:border-slate-300', on ? clsx('border-transparent ring-2', f.ring) : 'border-slate-200/80')}
    >
      <span className={clsx('pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full', f.glow)} />
      <span className={clsx('relative flex items-center gap-1.5 text-sm font-medium', f.text)}>
        {f.mark}
        {f.label}
      </span>
      <span className="relative mt-1 block text-3xl font-semibold tracking-tight text-slate-900">{n ?? '–'}</span>
      <span className="relative mt-0.5 block truncate text-xs text-slate-500">{f.hint}</span>
    </button>
  );
}

type Group = { key: string; label: string; dot: string; items: Lead[] };

/** Open leads by when the next follow-up is due; the most urgent first. */
function groupByDue(items: Lead[]): Group[] {
  const defs: Group[] = [
    { key: 'overdue', label: 'Overdue', dot: 'bg-rose-600', items: [] },
    { key: 'today', label: 'Today', dot: 'bg-amber-600', items: [] },
    { key: 'week', label: 'This week', dot: 'bg-sky-600', items: [] },
    { key: 'later', label: 'Later', dot: 'bg-slate-400', items: [] },
    { key: 'none', label: 'No follow-up planned', dot: 'bg-amber-400', items: [] },
  ];
  const at = (k: string) => defs.find((d) => d.key === k)!.items;
  for (const l of items) {
    const due = l.nextAction?.dueAt;
    if (!due) at('none').push(l);
    else if (l.overdue) at('overdue').push(l);
    else {
      const d = daysFromToday(due);
      at(d <= 0 ? 'today' : d < 7 ? 'week' : 'later').push(l);
    }
  }
  const byDue = (a: Lead, b: Lead) => +new Date(a.nextAction?.dueAt ?? 0) - +new Date(b.nextAction?.dueAt ?? 0);
  for (const d of defs) d.key === 'none' ? d.items.sort((a, b) => b.score - a.score) : d.items.sort(byDue);
  return defs.filter((d) => d.items.length);
}

const STAGE_DOT: Record<Tone, string> = { slate: 'bg-slate-500', blue: 'bg-sky-500', brand: 'bg-brand-500', ai: 'bg-ai-500', amber: 'bg-amber-600', green: 'bg-emerald-500', red: 'bg-rose-500' };

function StageLabel({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', STAGE_DOT[STAGE_TONE[stage]])} />
      {STAGE_META[stage].label}
    </span>
  );
}

/** "₹30 L–₹40 L", "up to ₹95 L"; rent per month. `spaced` puts spaces round the dash. */
function budgetText(l: Lead, spaced = false) {
  const r = l.requirement;
  const rent = r.purpose && r.purpose !== 'sale';
  const f = (n: number) => (rent ? `${formatINR(n, { short: false })}/mo` : formatINR(n));
  if (r.budgetMin && r.budgetMax) return `${f(r.budgetMin)}${spaced ? ' – ' : '–'}${f(r.budgetMax)}`;
  if (r.budgetMax) return `up to ${f(r.budgetMax)}`;
  if (r.budgetMin) return `from ${f(r.budgetMin)}`;
  return null;
}

/** "Plot · K.K. Nagar / Anna Nagar · 1,200 sq.ft. · 2 BHK": what and where. */
function whatAndWhere(l: Lead) {
  const r = l.requirement;
  return [
    r.types?.length ? r.types.map((t) => PROPERTY_TYPE_LABEL[t]).join(' / ') : null,
    r.localities?.length ? r.localities.join(' / ') : r.city,
    r.areaMin ? `${r.areaMin.toLocaleString('en-IN')} sq.ft.` : null,
    r.bedrooms ? `${r.bedrooms} BHK` : null,
  ].filter(Boolean) as string[];
}

/** When the next step is due, coloured by urgency. */
function DueLabel({ l }: { l: Lead }) {
  const due = l.nextAction?.dueAt;
  if (l.stage === 'booked') return <span className="text-slate-500">{shortDate(l.stageChangedAt)}</span>;
  if (l.stage === 'lost') return <span className="text-slate-500">{l.lostReason ?? shortDate(l.stageChangedAt)}</span>;
  if (!due) return <span className="text-amber-700">No follow-up</span>;
  if (l.overdue)
    return (
      <span className="inline-flex items-center gap-1 font-medium text-rose-600">
        <TriangleAlert className="h-3.5 w-3.5" />
        {shortDate(due)}
      </span>
    );
  return daysFromToday(due) === 0 ? <span className="font-medium text-amber-700">Today</span> : <span className="text-slate-500">{shortDate(due)}</span>;
}

const ICON_BTN = 'relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900';

/** One customer in the list. On wide screens, hovering it (or tabbing into it) shows quick actions. */
function LeadRow({ l, selected, onPick, onDone }: { l: Lead; selected?: boolean; onPick?: (e: React.MouseEvent) => void; onDone: () => void }) {
  const isOpen = OPEN_STAGES.includes(l.stage);
  const sub = [...whatAndWhere(l), budgetText(l), SEGMENT_LABEL[l.segment]].filter(Boolean).join(' · ');
  return (
    <div className={clsx('group relative flex items-center gap-3 border-l-[3px] py-3 pl-[13px] pr-4 transition', selected ? 'border-brand-600 bg-brand-50/50' : 'border-transparent hover:bg-slate-50')}>
      <Avatar name={l.name} soft />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <Link
            to={`/leads/${l.id}`}
            onClick={onPick}
            aria-current={selected || undefined}
            className="truncate font-medium text-slate-900 outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand-500"
          >
            {l.name}
          </Link>
          {isHot(l) && <Flame className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Hot lead" />}
        </p>
        <p className="truncate text-sm text-slate-500">{sub}</p>
      </div>
      <div className={clsx('flex shrink-0 flex-col items-end gap-0.5 text-right text-sm', isOpen && 'xl:group-hover:hidden xl:group-has-[:focus-visible]:hidden')}>
        <StageLabel stage={l.stage} className="text-slate-600" />
        <DueLabel l={l} />
      </div>
      {isOpen && (
        <div className="hidden shrink-0 items-center gap-1.5 xl:group-hover:flex xl:group-has-[:focus-visible]:flex">
          <a href={`tel:${l.phone}`} className={ICON_BTN} aria-label={`Call ${l.name}`} title="Call">
            <Phone className="h-4 w-4" />
          </a>
          <a href={waLink(l.phone)} target="_blank" rel="noreferrer" className={ICON_BTN} aria-label={`WhatsApp ${l.name}`} title="WhatsApp">
            <MessageCircle className="h-4 w-4" />
          </a>
          <button type="button" onClick={onDone} className={ICON_BTN} aria-label={l.nextAction ? `Mark the follow-up with ${l.name} done` : `Plan a follow-up with ${l.name}`} title={l.nextAction ? 'Done' : 'Plan a follow-up'}>
            <Check className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

const BAND_STYLE: Record<ScoreBand, { text: string; stroke: string }> = {
  high: { text: 'text-emerald-700', stroke: 'stroke-emerald-600' },
  qualified: { text: 'text-blue-700', stroke: 'stroke-blue-600' },
  nurture: { text: 'text-amber-700', stroke: 'stroke-amber-500' },
  early: { text: 'text-slate-600', stroke: 'stroke-slate-400' },
  closed: { text: 'text-slate-600', stroke: 'stroke-slate-400' },
};

/** The lead score as a ring, like a progress dial. */
function ScoreRing({ score, band }: { score: number; band: ScoreBand }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center" role="img" aria-label={`Lead score ${score} of 100`} title="Lead score, out of 100">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-slate-200/70" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round" className={BAND_STYLE[band].stroke} strokeDasharray={`${(c * score) / 100} ${c}`} />
      </svg>
      <span className="text-lg font-semibold text-slate-900">{score}</span>
    </span>
  );
}

/** Match scores: green for strong, blue for good, amber for the rest. */
const matchTone = (s: number) => (s >= 85 ? 'text-emerald-700' : s >= 70 ? 'text-blue-700' : 'text-amber-700');

type MatchItem = { property: Property; score: number };

/** The chosen lead, beside the list: enough to act without opening the page. */
function LeadPreview({ lead: l, onDone }: { lead: Lead; onDone: () => void }) {
  const isOpen = OPEN_STAGES.includes(l.stage);
  const matches = useQuery({ queryKey: ['matches', l.id], queryFn: () => api.get<{ qualified: boolean; total: number; items: MatchItem[] }>(`/matching/lead/${l.id}?limit=6`), enabled: isOpen });
  const timeline = useQuery({ queryKey: ['timeline', l.id], queryFn: () => api.get<{ items: TimelineItem[] }>(`/leads/${l.id}/timeline`) });
  const last = timeline.data?.items.find((t) => t.kind === 'activity' && t.status === 'done');
  const r = l.requirement;
  // With nothing known about what they want, any "match" is a guess: don't show one.
  const nothingKnown = !r.types?.length && !r.budgetMax && !r.budgetMin && !r.city && !r.localities?.length;
  const best = nothingKnown ? [] : matches.data?.items.slice(0, 3) ?? [];
  const total = nothingKnown ? 0 : matches.data?.total ?? 0;
  const [showAll, setShowAll] = useState(false);
  const band = scoreBand(l.score, l.stage);
  const due = l.nextAction?.dueAt;
  const late = due ? -daysFromToday(due) : 0;
  const what = whatAndWhere(l);
  const money = [budgetText(l, true), r.intent ? INTENT_LABEL[r.intent] : null].filter(Boolean).join(' · ');

  return (
    <aside className="sticky top-20 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card" aria-label={`${l.name}, preview`}>
      <div className="p-5">
        <div className="flex items-center gap-3">
          <Avatar name={l.name} size="lg" soft />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-slate-900">{l.name}</p>
            <p className="truncate text-sm text-slate-500">
              <span className="font-mono">{l.code}</span> · {LEAD_SOURCE_LABEL[l.source]}
            </p>
          </div>
          <ScoreRing score={l.score} band={band} />
        </div>
        <p className={clsx('mt-4 text-base font-semibold', BAND_STYLE[band].text)}>{band === 'closed' ? (l.stage === 'booked' ? 'Booked' : 'Lost lead') : SCORE_BAND_LABEL[band]}</p>
        <div className="mt-2 flex gap-1">
          <Chip>
            <Clock className="h-3 w-3 shrink-0 text-slate-400" />
            {r.timeline ? TIMELINE_LABEL[r.timeline] : 'No timeline yet'}
          </Chip>
          <Chip>{SEGMENT_LABEL[l.segment]}</Chip>
          <Chip>
            <StageLabel stage={l.stage} />
          </Chip>
        </div>
      </div>

      <PreviewSection title="Looking for">
        <p className="text-sm text-slate-800">{what.length ? what.join(' · ') : 'Requirement not captured yet'}</p>
        <div className="mt-0.5 flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate text-slate-500">{money}</span>
          <span className={clsx('flex shrink-0 items-center gap-1.5', l.ownerName ? 'text-slate-500' : 'font-medium text-amber-700')} title="Owner">
            <UserRound className="h-3.5 w-3.5" />
            {l.ownerName ?? 'Unassigned'}
          </span>
        </div>
      </PreviewSection>

      {isOpen && (
        <PreviewSection title="Next step">
          {!due ? (
            <p className="text-sm text-slate-700">No follow-up planned — set one with ✓ Done.</p>
          ) : l.overdue ? (
            <>
              <p className="text-sm font-medium text-rose-600">
                Follow-up was due {shortDate(due, true)} ({late <= 0 ? 'earlier today' : `${late} day${late === 1 ? '' : 's'} ago`})
              </p>
              {l.nextAction?.title && <p className="mt-0.5 text-xs text-slate-500">{l.nextAction.title}</p>}
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-800">
                {ACTIVITY_LABEL[l.nextAction!.type as ActivityType] ?? 'Follow-up'} {daysFromToday(due) === 0 ? 'today' : `on ${shortDate(due, true)}`} at {formatTime(due)}
              </p>
              {l.nextAction?.title && <p className="mt-0.5 text-xs text-slate-500">{l.nextAction.title}</p>}
            </>
          )}
        </PreviewSection>
      )}

      {isOpen && (
        <PreviewSection
          title="Best match"
          action={
            best.length > 1 && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                aria-expanded={showAll}
                aria-label={showAll ? 'Show only the best match' : `Show the top ${best.length} of ${total} matching properties`}
                className="-my-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              >
                {total} propert{total === 1 ? 'y' : 'ies'}
                <ChevronDown className={clsx('h-3.5 w-3.5 transition', showAll && 'rotate-180')} />
              </button>
            )
          }
        >
          {matches.isLoading && !nothingKnown ? (
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ) : best.length ? (
            <div className="-mx-2">
              {(showAll ? best : best.slice(0, 1)).map((m) => (
                <Link key={m.property.id} to={`/properties/${m.property.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50">
                  <PropertyCover property={m.property} className="h-12 w-12 shrink-0 rounded-lg" iconSize="h-5 w-5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{m.property.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {priceLabel(m.property)} · {typeLabel(m.property.type)}
                    </span>
                  </span>
                  <span className={clsx('shrink-0 text-base font-semibold tabular-nums', matchTone(m.score))} title="How well it fits, out of 100">
                    {Math.min(100, m.score)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{nothingKnown || (matches.data && !matches.data.qualified) ? 'Capture budget, location and type to see matches.' : 'Nothing in stock fits yet.'}</p>
          )}
        </PreviewSection>
      )}

      <PreviewSection title="Last contact">
        {last ? (
          <>
            <p className="text-sm text-slate-800">{last.body || last.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {shortDate(last.at, true)}
              {last.by && ` · ${last.by}`}
            </p>
          </>
        ) : l.lastContactAt ? (
          <p className="text-sm text-slate-800">Spoke on {shortDate(l.lastContactAt, true)}</p>
        ) : (
          <p className="text-sm text-slate-500">Not spoken yet</p>
        )}
      </PreviewSection>

      <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 p-4">
        <a href={`tel:${l.phone}`} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          <Phone className="h-4 w-4" /> Call
        </a>
        <a href={waLink(l.phone)} target="_blank" rel="noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        {isOpen && (
          <Button variant="primary" className="flex-1" icon={<Check className="h-4 w-4" />} onClick={onDone} title={l.nextAction ? `Mark “${l.nextAction.title ?? 'the follow-up'}” done` : 'Plan the next follow-up'}>
            Done
          </Button>
        )}
      </div>
      <Link to={`/leads/${l.id}`} className="flex items-center justify-center gap-1 border-t border-slate-100 py-3 text-sm font-medium text-brand-700 hover:bg-slate-50">
        Open full lead page <ArrowRight className="h-4 w-4" />
      </Link>
    </aside>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{children}</span>;
}

function PreviewSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-5 py-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Search box; the sparkle button asks the assistant the same words. */
function SearchBox({ q, onSearch, className }: { q: string; onSearch: (q: string) => void; className?: string }) {
  const [draft, setDraft] = useState(q);
  const assistant = useAssistant();
  useEffect(() => setDraft(q), [q]);
  return (
    <form
      role="search"
      className={clsx('flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white pl-3 pr-1.5', className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <Search className="h-4 w-4 shrink-0 text-slate-400" />
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search leads…" aria-label="Search leads" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      {q && (
        <button type="button" aria-label="Clear search" onClick={() => onSearch('')}>
          <X className="h-4 w-4 text-slate-400" />
        </button>
      )}
      <button
        type="button"
        className="rounded-lg p-1 text-ai-600 transition hover:bg-ai-50"
        aria-label="Ask the assistant"
        title="Ask the assistant, e.g. “hot leads in Porur”"
        onClick={() => (draft.trim() ? assistant.ask(draft.trim()) : assistant.setOpen(true))}
      >
        <Sparkles className="h-4 w-4" />
      </button>
    </form>
  );
}

function OwnerSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const users = useUsers();
  return (
    <Select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Owner">
      <option value="">Everyone</option>
      <option value="none">Unassigned</option>
      {users.data
        ?.filter((u) => u.role !== 'admin')
        .map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
    </Select>
  );
}

function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const fn = () => setOn(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return on;
}
