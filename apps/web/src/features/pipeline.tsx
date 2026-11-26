import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlarmClock, ArrowRight, CalendarClock, Check, Flame, MoreHorizontal, RotateCcw, TrendingDown, TrendingUp, Trophy, Users, X } from 'lucide-react';
import { ACTIVITY_LABEL, CALL_OUTCOMES, HOT_SCORE, LEAD_SOURCE_LABEL, LOST_REASONS, OPEN_STAGES, SEGMENT_LABEL, STAGE_META, formatINR, scoreBand, type ActivityType, type Stage } from '@estate/shared';
import { api, ApiError, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { STAGE_TONE, type Lead } from '../lib/leads';
import { priceLabel, type Property } from '../lib/property';
import type { Deal } from '../lib/deals';
import { Avatar, Button, ErrorNote, Input, Modal, PageLoader, Textarea } from '../components/ui';
import { STAGE_DOT, ScoreRing, budgetText, daysFromToday, shortDate, whatAndWhere } from '../components/leadBits';
import { useToast } from '../components/toast';
import { leadSlots, views } from '../slots-leads';

type Column = { stage: Stage; label: string; entry: string; leads: Lead[] };
type Need = 'conversation' | 'requirement' | 'visit' | 'property' | 'reason' | 'booking' | 'reopen';

function useMove(onNeed: (lead: Lead, to: Stage, need: Need, message: string) => void) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ lead, to, extra }: { lead: Lead; to: Stage; extra?: object }) => api.post<{ lead: Lead }>(`/pipeline/move/${lead.id}`, { to, ...extra }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['board'] });
      void qc.invalidateQueries({ queryKey: ['lead', r.lead.id] });
      void qc.invalidateQueries({ queryKey: ['timeline', r.lead.id] });
      void qc.invalidateQueries({ queryKey: ['insights'] });
      toast(`${r.lead.name} → ${STAGE_META[r.lead.stage].label}`);
    },
    onError: (e, v) => {
      if (e instanceof ApiError && e.status === 422) onNeed(v.lead, v.to, (e.details as { need: Need }).need, e.message);
      else toast(e instanceof Error ? e.message : 'Could not move', 'error');
    },
  });
}

type Insights = { total: number; booked: number; overallRate: number; funnel: { stage: Stage; label: string; count: number }[]; weakest: { from: string; to: string; rate: number } | null; stuck: { label: string; stuck: number; open: number }[]; lostReasons: { reason: string; count: number }[]; lostAt: { stage: string; count: number }[] };
type Focus = 'all' | 'overdue' | 'today' | 'hot' | 'stuck' | 'none';

const isToday = (l: Lead) => !l.overdue && !!l.nextAction?.dueAt && daysFromToday(l.nextAction.dueAt) === 0;
const FOCUS: { key: Focus; label: string; test: (l: Lead) => boolean; dot?: string }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'overdue', label: 'Overdue', test: (l) => l.overdue, dot: 'bg-rose-500' },
  { key: 'today', label: 'Due today', test: isToday, dot: 'bg-amber-500' },
  { key: 'hot', label: 'Hot', test: (l) => l.score >= HOT_SCORE, dot: 'bg-emerald-500' },
  { key: 'stuck', label: 'Stuck', test: (l) => l.stale, dot: 'bg-orange-500' },
  { key: 'none', label: 'No next step', test: (l) => !l.nextAction, dot: 'bg-slate-400' },
];

/** Sale budgets only (rent is per month, so it would mislead in a total). */
const valueOf = (leads: Lead[]) => leads.reduce((t, l) => t + (l.requirement.purpose && l.requirement.purpose !== 'sale' ? 0 : (l.requirement.budgetMax ?? l.requirement.budgetMin ?? 0)), 0);

/**
 * The pipeline: how leads flow through the stages, then one lane per stage.
 * Drag a card onto another lane (or use its "Move to" menu) to move it; if
 * something is missing for that stage, it asks for exactly that.
 */
export function PipelineBoard({ owner, q }: { owner: string; q: string }) {
  const { can } = useAuth();
  const [gate, setGate] = useState<{ lead: Lead; to: Stage; need: Need; message: string } | null>(null);
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [focus, setFocus] = useState<Focus>('all');
  const [flash, setFlash] = useState<Stage | null>(null);
  const [phoneStage, setPhoneStage] = useState<Stage>('new');
  const b = useQuery({ queryKey: ['board', owner, q], queryFn: () => api.get<{ columns: Column[] }>(`/pipeline/board${qs({ owner, q })}`) });
  const ins = useQuery({ queryKey: ['insights', owner], queryFn: () => api.get<Insights>(`/pipeline/insights${qs({ owner: owner && owner !== 'none' ? owner : undefined })}`) });
  const move = useMove((lead, to, need, message) => setGate({ lead, to, need, message }));
  if (b.isLoading) return <PageLoader />;

  const cols = (b.data?.columns ?? []).map((c) => ({ ...c, leads: [...c.leads].sort((x, y) => y.score - x.score) }));
  const col = (s: Stage) => cols.find((c) => c.stage === s);
  const open = cols.filter((c) => OPEN_STAGES.includes(c.stage));
  const openLeads = open.flatMap((c) => c.leads);
  const test = FOCUS.find((f) => f.key === focus)!.test;

  /** Moving is the same from a drop or a menu: lost asks why, everything else tries and asks for what's missing. */
  const moveTo = (lead: Lead, to: Stage) => {
    if (lead.stage === to) return;
    if (to === 'lost') setGate({ lead, to: 'lost', need: 'reason', message: 'Why was it lost?' });
    else move.mutate({ lead, to });
  };
  const dropProps = (s: Stage) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(s);
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      if (dragging) moveTo(dragging, s);
      setDragging(null);
    },
  });
  const dragProps = (l: Lead) => ({
    draggable: true,
    onDragStart: () => setDragging(l),
    onDragEnd: () => setDragging(null),
  });
  const jump = (s: Stage) => {
    if (OPEN_STAGES.includes(s)) setPhoneStage(s);
    document.getElementById(`lane-${s}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setFlash(s);
    window.setTimeout(() => setFlash(null), 1600);
  };

  return (
    <div className="space-y-4">
      {col('booked') && col('lost') && (
        <Outcomes
          booked={col('booked')!}
          lost={col('lost')!}
          open={openLeads}
          insights={ins.data}
          over={dragging && over && dragging.stage !== over ? over : null}
          flash={flash}
          drop={dropProps}
          drag={dragProps}
          dragging={dragging}
          compare={!owner && !q}
          onStuck={() => {
            setFocus('stuck');
            document.getElementById('board-columns')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          onJump={jump}
        />
      )}
      <FlowPanel cols={cols} open={openLeads} insights={ins.data} onPick={jump} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1" role="group" aria-label="Show">
          {FOCUS.map((f) => {
            const n = openLeads.filter(f.test).length;
            const on = focus === f.key;
            return (
              <button
                key={f.key}
                aria-pressed={on}
                onClick={() => setFocus(f.key)}
                className={clsx('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition', on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900')}
              >
                {f.dot && <span className={clsx('h-1.5 w-1.5 rounded-full', f.dot)} />}
                {f.label}
                <span className={on ? 'text-white/60' : 'text-slate-400'}>{n}</span>
              </button>
            );
          })}
        </div>
        <p className="ml-auto hidden text-xs text-slate-400 lg:block">Drag a card to another column, or use its ⋯ menu.</p>
      </div>

      {/* Phones: one stage at a time. */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:hidden" role="tablist" aria-label="Stage">
        {open.map((c) => (
          <button
            key={c.stage}
            role="tab"
            aria-selected={phoneStage === c.stage}
            onClick={() => setPhoneStage(c.stage)}
            className={clsx('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium', phoneStage === c.stage ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600')}
          >
            <span className={clsx('h-1.5 w-1.5 rounded-full', STAGE_DOT[STAGE_TONE[c.stage]])} />
            {c.label}
            <span className={phoneStage === c.stage ? 'text-white/60' : 'text-slate-400'}>{c.leads.filter(test).length}</span>
          </button>
        ))}
      </div>

      <div id="board-columns" className="grid scroll-mt-24 items-start gap-3 md:auto-cols-[minmax(212px,1fr)] md:grid-flow-col md:overflow-x-auto md:pb-1">
      {open.map((c) => {
        const shown = c.leads.filter(test);
        return (
          <Lane
            key={c.stage}
            c={c}
            shown={shown}
            filtered={focus !== 'all'}
            over={over === c.stage && dragging?.stage !== c.stage}
            flash={flash === c.stage}
            phone={phoneStage === c.stage}
            drop={dropProps(c.stage)}
          >
            {shown.map((l) => (
              <LeadCard key={l.id} l={l} showOwner={can('lead.viewAll')} dragging={dragging?.id === l.id} drag={dragProps(l)} onMove={(to) => moveTo(l, to)} />
            ))}
          </Lane>
        );
      })}
      </div>

      <DropBar dragging={dragging} over={over} drop={dropProps} />

      {gate && <MoveDialog {...gate} onClose={() => setGate(null)} onRetry={(extra) => move.mutateAsync({ lead: gate.lead, to: gate.to, extra }).then(() => setGate(null))} />}
    </div>
  );
}

/* ───────────────────────── Flow panel ───────────────────────── */

const FLOW_STAGES: Stage[] = ['new', 'contacted', 'qualified', 'visit', 'negotiation', 'booked'];

/** Stats over a flow chart: 90 days of leads narrowing from enquiry to booking, and where they sit today. */
function FlowPanel({ cols, open, insights: d, onPick }: { cols: Column[]; open: Lead[]; insights?: Insights; onPick: (s: Stage) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const funnel = FLOW_STAGES.map((s) => d?.funnel.find((f) => f.stage === s)?.count ?? 0);
  const max = Math.max(1, ...funnel);
  const now = FLOW_STAGES.map((s) => cols.find((c) => c.stage === s)?.leads ?? []);
  const rate = (i: number) => (funnel[i] ? Math.round((funnel[i + 1] / funnel[i]) * 100) : 0);
  const weakest = d?.weakest ? FLOW_STAGES.findIndex((s) => STAGE_META[s].label === d.weakest!.from) : -1;
  const lostAt = d?.lostAt ?? [];

  // The band: half-height per stage, joined by smooth curves, mirrored round the middle line.
  const h = funnel.map((n) => 6 + 40 * (n / max));
  const cx = (i: number) => i * 100 + 50;
  let top = `M0,${50 - h[0]} L${cx(0)},${50 - h[0]}`;
  let bottom = `L600,${50 + h[5]} L${cx(5)},${50 + h[5]}`;
  for (let i = 0; i < 5; i++) top += ` C${cx(i) + 50},${50 - h[i]} ${cx(i + 1) - 50},${50 - h[i + 1]} ${cx(i + 1)},${50 - h[i + 1]}`;
  for (let i = 5; i > 0; i--) bottom += ` C${cx(i) - 50},${50 + h[i]} ${cx(i - 1) + 50},${50 + h[i - 1]} ${cx(i - 1)},${50 + h[i - 1]}`;
  const band = `${top} L600,${50 - h[5]} ${bottom} L0,${50 + h[0]} Z`;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-slate-900">
            How leads flow
            {d && (
              <span className="text-xs font-normal text-slate-500">
                <b className="font-semibold text-emerald-700">{d.overallRate}%</b> converted · {d.booked} of {d.total} new leads booked in 90 days
              </span>
            )}
          </h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-full bg-gradient-to-r from-sky-300 to-emerald-400" /> Reached, 90 days
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Lost from that stage
            </span>
            <span>Numbers: there today</span>
          </p>
        </div>
        <div className="-mx-5 overflow-x-auto px-5">
          <div className="relative min-w-[560px]">
            <div className="grid grid-cols-6">
              {FLOW_STAGES.map((s, i) => (
                <p key={s} className={clsx('flex items-center justify-center gap-1.5 px-2 text-xs font-medium transition', hover === i ? 'text-slate-900' : 'text-slate-500')}>
                  <span className={clsx('h-1.5 w-1.5 rounded-full', STAGE_DOT[STAGE_TONE[s]])} />
                  {STAGE_META[s].label}
                </p>
              ))}
            </div>
            <div className="relative mt-2 h-28">
              <svg viewBox="0 0 600 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                <defs>
                  <linearGradient id="flow-band" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.55" />
                    <stop offset="45%" stopColor="#14b8a6" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.75" />
                  </linearGradient>
                </defs>
                <path d={band} fill="url(#flow-band)" />
                <line x1="0" x2="600" y1="50" y2="50" stroke="white" strokeOpacity="0.6" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 4" />
              </svg>
              {/* One clickable band per stage over the chart. */}
              <div className="absolute inset-0 grid grid-cols-6">
                {FLOW_STAGES.map((s, i) => (
                  <button
                    key={s}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => onPick(s)}
                    className={clsx('relative rounded-xl transition', hover === i ? 'bg-slate-900/[0.04]' : 'hover:bg-slate-900/[0.03]')}
                    aria-label={`${STAGE_META[s].label}: ${funnel[i]} reached it in 90 days, ${now[i].length} there now. Go to the lane.`}
                  >
                    <span className={clsx('absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-800 shadow-sm transition', hover === i ? 'scale-110' : '')}>{funnel[i]}</span>
                  </button>
                ))}
              </div>
              {/* Conversion from each stage to the next, on the joins. */}
              {FLOW_STAGES.slice(0, -1).map((s, i) => (
                <span
                  key={s}
                  className={clsx('pointer-events-none absolute bottom-0 -translate-x-1/2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ring-1', i === weakest ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-white text-slate-500 ring-slate-200')}
                  style={/* scan-ok: sits on the join between two stages */ { left: `${((i + 1) / 6) * 100}%` }}
                  title={`${STAGE_META[s].label} → ${STAGE_META[FLOW_STAGES[i + 1]].label}`}
                >
                  {rate(i)}%
                </span>
              ))}
            </div>
            {/* Lost from each stage: a rose drop under the band. */}
            <div className="grid h-9 grid-cols-6" aria-label="Lost from each stage, 90 days">
              {FLOW_STAGES.map((s) => {
                const n = lostAt.find((x) => x.stage === STAGE_META[s].label)?.count ?? 0;
                return (
                  <div key={s} className="flex flex-col items-center">
                    {n > 0 && (
                      <>
                        <span className="h-3 w-px bg-gradient-to-b from-rose-200 to-rose-400" />
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200" title={`${n} lead${n === 1 ? '' : 's'} lost at ${STAGE_META[s].label} in 90 days`}>
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          {n} lost
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 grid grid-cols-6">
              {FLOW_STAGES.map((s, i) => (
                <div key={s} className="px-2 text-center">
                  <p className="text-lg font-semibold tabular-nums text-slate-900">{now[i].length}</p>
                  <p className="truncate text-[11px] text-slate-500">{valueOf(now[i]) ? formatINR(valueOf(now[i])) : s === 'booked' ? 'last 30 days' : '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Lanes ───────────────────────── */

type DropProps = { onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void };
type DragProps = { draggable: boolean; onDragStart: () => void; onDragEnd: () => void };

/** One stage as a column: what it holds at the top, its leads below. The whole column takes a drop. */
function Lane({ c, shown, filtered, over, flash, phone, drop, children }: { c: Column; shown: Lead[]; filtered: boolean; over: boolean; flash: boolean; phone: boolean; drop: DropProps; children: React.ReactNode }) {
  const avg = c.leads.length ? Math.round(c.leads.reduce((t, l) => t + l.score, 0) / c.leads.length) : 0;
  const stuck = c.leads.filter((l) => l.stale).length;
  const value = valueOf(c.leads);
  return (
    <section
      id={`lane-${c.stage}`}
      aria-label={`${c.label}, ${c.leads.length} lead${c.leads.length === 1 ? '' : 's'}`}
      {...drop}
      className={clsx(
        'min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-3xl border bg-slate-50/80 transition',
        phone ? 'flex' : 'hidden md:flex',
        over ? 'border-brand-400 bg-brand-50/60 ring-4 ring-brand-100' : flash ? 'border-slate-300 ring-4 ring-slate-100' : 'border-slate-200/80',
      )}
    >
      <header className="relative border-b border-slate-200/70 bg-white px-4 pb-3 pt-4" title={c.entry}>
        <span className={clsx('absolute inset-x-0 top-0 h-1', STAGE_DOT[STAGE_TONE[c.stage]])} />
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{c.label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
            {filtered ? shown.length : c.leads.length}
            {filtered && <span className="ml-1 text-xs font-medium text-slate-400">/ {c.leads.length}</span>}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-slate-500">{value ? formatINR(value) : 'No budgets'}</span>
          {!!c.leads.length && (
            <span className="flex shrink-0 items-center gap-1.5 text-slate-500" title="Average lead score">
              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-100">
                <span className={clsx('block h-full rounded-full', avg >= HOT_SCORE ? 'bg-emerald-500' : avg >= 60 ? 'bg-blue-500' : 'bg-amber-400')} style={/* scan-ok: bar width is the score */ { width: `${avg}%` }} />
              </span>
              <span className="font-medium tabular-nums text-slate-700">{avg}</span>
            </span>
          )}
        </div>
        {stuck > 0 && <p className="mt-1.5 text-[11px] font-medium text-amber-700">{stuck} stuck too long</p>}
      </header>
      <div className="flex flex-1 flex-col gap-2.5 p-2.5 md:max-h-[72vh] md:overflow-y-auto">
        {children}
        {!shown.length && (
          <p className={clsx('flex min-h-[120px] items-center justify-center rounded-2xl border-2 border-dashed px-3 text-center text-xs', over ? 'border-brand-300 text-brand-700' : 'border-slate-200 text-slate-400')}>
            {filtered && c.leads.length ? 'None here for this filter' : over ? 'Drop to move here' : c.entry}
          </p>
        )}
      </div>
    </section>
  );
}

/** The next step as a small chip: red when overdue, amber today, grey later. */
function NextChip({ l }: { l: Lead }) {
  const due = l.nextAction?.dueAt;
  const base = 'inline-flex min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium';
  if (!due) return <span className={clsx(base, 'bg-amber-50 text-amber-800')}>No next step</span>;
  const what = l.nextAction?.title ?? ACTIVITY_LABEL[l.nextAction?.type as ActivityType] ?? 'Follow-up';
  return (
    <span className={clsx(base, l.overdue ? 'bg-rose-50 text-rose-700' : isToday(l) ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600')} title={what}>
      {l.overdue ? <AlarmClock className="h-3 w-3 shrink-0" /> : <CalendarClock className="h-3 w-3 shrink-0" />}
      <span className="shrink-0">{isToday(l) ? 'Today' : shortDate(due)}</span>
      <span className="truncate font-normal">· {what}</span>
    </span>
  );
}

const STRIPE = (l: Lead) => (l.overdue ? 'bg-rose-500' : isToday(l) ? 'bg-amber-400' : !l.nextAction ? 'bg-amber-200' : 'bg-transparent');

/** One lead: who, how keen, what they want, what's next. Drag it, or use ⋯ to move it. */
function LeadCard({ l, showOwner, dragging, drag, onMove }: { l: Lead; showOwner: boolean; dragging: boolean; drag: DragProps; onMove: (to: Stage) => void }) {
  const want = [...whatAndWhere(l), budgetText(l)].filter(Boolean).join(' · ');
  return (
    <article
      {...drag}
      className={clsx(
        'group relative flex w-full cursor-grab flex-col rounded-2xl bg-white p-3.5 pl-4 shadow-sm ring-1 ring-slate-200 transition duration-200 hover:-translate-y-0.5 hover:shadow-card hover:ring-slate-300 active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
    >
      <span className={clsx('absolute inset-y-3 left-0 w-1 rounded-r-full', STRIPE(l))} aria-hidden />
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <Link to={`/leads/${l.id}`} className="block truncate text-sm font-semibold text-slate-900 outline-none after:absolute after:inset-0 focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-brand-500">
            {l.name}
          </Link>
          <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
            {l.score >= HOT_SCORE && <Flame className="h-3 w-3 shrink-0 text-emerald-600" aria-label="Hot lead" />}
            {SEGMENT_LABEL[l.segment]}
          </p>
        </div>
        <ScoreRing score={l.score} band={scoreBand(l.score, l.stage)} size="xs" />
      </div>
      <p className="mt-2.5 line-clamp-2 min-h-[2rem] text-xs leading-4 text-slate-600">{want || 'Requirement not captured yet'}</p>
      <div className="mt-2.5">
        <NextChip l={l} />
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5 text-[11px]">
        {showOwner ? (
          l.ownerName ? (
            <span className="flex min-w-0 items-center gap-1.5 text-slate-500">
              <Avatar name={l.ownerName} size="sm" />
              <span className="truncate">{l.ownerName}</span>
            </span>
          ) : (
            <span className="font-medium text-amber-700">Unassigned</span>
          )
        ) : (
          <span className="truncate text-slate-500">{LEAD_SOURCE_LABEL[l.source]}</span>
        )}
        <span className={clsx('ml-auto shrink-0 tabular-nums', l.stale ? 'font-medium text-amber-700' : 'text-slate-400')} title={l.stale ? 'Longer than usual in this stage' : 'Days in this stage'}>
          {l.daysInStage}d
        </span>
        {/* A native list: works with a keyboard and on phones, and is never clipped by the lane's scroll. */}
        <label className="relative z-10 -mr-1 flex cursor-pointer rounded-md p-1 text-slate-400 transition focus-within:bg-slate-100 focus-within:text-slate-800 hover:bg-slate-100 hover:text-slate-800 md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100" title="Move to another stage">
          <MoreHorizontal className="h-4 w-4" />
          <select
            aria-label={`Move ${l.name} to another stage`}
            className="absolute inset-0 cursor-pointer opacity-0"
            value=""
            onChange={(e) => e.target.value && onMove(e.target.value as Stage)}
          >
            <option value="">Move to…</option>
            {[...FLOW_STAGES, 'lost' as Stage]
              .filter((s) => s !== l.stage)
              .map((s) => (
                <option key={s} value={s}>
                  {s === 'lost' ? 'Close as lost' : STAGE_META[s].label}
                </option>
              ))}
          </select>
        </label>
      </div>
    </article>
  );
}

const DAY_MS = 86_400_000;

/**
 * The top of the pipeline, in three equal columns: Status (four tiles),
 * Booked and Lost, each over the last 30 days. Booked takes a drop to book,
 * Lost a drop to close as lost; lost chips drag back onto a column to reopen.
 */
function Outcomes({ booked, lost, open, insights: d, over, flash, drop, drag, dragging, compare, onStuck, onJump }: { booked: Column; lost: Column; open: Lead[]; insights?: Insights; over: Stage | null; flash: Stage | null; drop: (s: Stage) => DropProps; drag: (l: Lead) => DragProps; dragging: Lead | null; compare: boolean; onStuck: () => void; onJump: (s: Stage) => void }) {
  const deals = useQuery({ queryKey: ['deals', 'booked'], queryFn: () => api.get<{ items: Deal[] }>(`/deals${qs({ status: ['booked', 'registered'] })}`) });
  const byLead = new Map((deals.data?.items ?? []).filter((x) => x.lead).map((x) => [x.lead!.id, x]));
  const amount = (l: Lead) => {
    const x = byLead.get(l.id);
    return x ? (x.agreedPrice ?? x.currentPrice) : null;
  };
  const total = booked.leads.reduce((t, l) => t + (amount(l) ?? 0), 0);
  const now = Date.now();
  const bookedAt = (x: Deal) => +new Date(x.booking?.date ?? x.booking?.confirmedAt ?? x.updatedAt);
  const before = (deals.data?.items ?? []).filter((x) => x.booking && now - bookedAt(x) >= 30 * DAY_MS && now - bookedAt(x) < 60 * DAY_MS).length;
  const diff = booked.leads.length - before;

  const won = booked.leads.length;
  const lostN = lost.leads.length;
  const closed = won + lostN;
  const winRate = closed ? Math.round((won / closed) * 100) : 0;
  const lostValue = valueOf(lost.leads);
  const stuck = open.filter((l) => l.stale).length;
  const overdue = open.filter((l) => l.overdue).length;
  const weakestStage = d?.weakest ? FLOW_STAGES.find((s) => STAGE_META[s].label === d.weakest!.from) : undefined;

  const byStage = FLOW_STAGES.slice(0, -1).map((s) => ({ s, n: d?.lostAt.find((x) => x.stage === STAGE_META[s].label)?.count ?? 0 }));
  const stageTop = Math.max(1, ...byStage.map((x) => x.n));

  return (
    <section aria-label="Status and outcomes, last 30 days" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Status: four tiles. A row of four on mid widths, 2×2 elsewhere. */}
      <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-1 xl:grid-cols-2 lg:grid-cols-4">
        <StatusTile icon={<Users className="h-4 w-4" />} label="Open leads" value={open.length} sub={valueOf(open) ? `${formatINR(valueOf(open))} in budgets` : 'No budgets yet'} />
        <StatusTile icon={<Trophy className="h-4 w-4" />} label="Win rate" value={closed ? `${winRate}%` : '–'} valueTone="text-slate-900" sub={`${won} won · ${lostN} lost`}>
          <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${won} won, ${lostN} lost`}>
            {closed > 0 && (
              <>
                <span className="h-full bg-emerald-500" style={/* scan-ok: share won */ { width: `${(won / closed) * 100}%` }} />
                <span className="h-full border-l-2 border-white bg-rose-400" style={/* scan-ok: share lost */ { width: `${(lostN / closed) * 100}%` }} />
              </>
            )}
          </div>
        </StatusTile>
        <StatusTile
          icon={<TrendingDown className="h-4 w-4" />}
          label="Weakest step"
          value={d?.weakest ? `${d.weakest.rate}%` : '–'}
          valueTone="text-rose-600"
          sub={d?.weakest ? `${d.weakest.from} → ${d.weakest.to}` : 'Not enough history'}
          onClick={weakestStage ? () => onJump(weakestStage) : undefined}
          action={weakestStage && `Go to ${STAGE_META[weakestStage].label}`}
        />
        <StatusTile icon={<AlarmClock className="h-4 w-4" />} label="Needs attention" value={stuck + overdue} valueTone="text-amber-700" sub={`${overdue} overdue · ${stuck} stuck`} onClick={onStuck} action="Show the stuck leads" />
      </div>

      {/* Booked */}
      <div
        id="lane-booked"
        aria-label={`Booked, ${won} in the last 30 days`}
        {...drop('booked')}
        className={clsx(
          'relative flex min-w-0 scroll-mt-24 flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-800 p-4 text-white shadow-card transition',
          over === 'booked' ? 'ring-4 ring-emerald-300' : flash === 'booked' && 'ring-4 ring-emerald-200',
        )}
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-50/80">
            <Check className="h-3.5 w-3.5" /> Booked · 30 days
          </p>
          {compare && deals.data && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium ring-1 ring-white/20 backdrop-blur" title="Against the 30 days before">
              {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : null}
              {diff === 0 ? 'Same as before' : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} vs before`}
            </span>
          )}
        </div>
        <div className="relative mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{total ? formatINR(total) : won}</p>
            <p className="mt-0.5 truncate text-sm text-emerald-50/80">
              {won} booking{won === 1 ? '' : 's'}
              {won > 0 && total > 0 && ` · avg ${formatINR(Math.round(total / won))}`}
            </p>
          </div>
          {won ? (
            <AvatarStack leads={booked.leads} tone="dark" label={(l) => `${l.name} · booked ${shortDate(l.stageChangedAt)}${amount(l) ? ` · ${formatINR(amount(l)!)}` : ''}`} />
          ) : (
            <span className="text-xs text-emerald-50/80">{over === 'booked' ? 'Drop to book' : 'No bookings yet'}</span>
          )}
        </div>
        <BuildUp leads={booked.leads} amount={amount} />
      </div>

      {/* Lost: why, where, and who */}
      <div
        id="lane-lost"
        aria-label={`Lost, ${lostN} in the last 30 days`}
        {...drop('lost')}
        className={clsx('flex min-w-0 scroll-mt-24 flex-col rounded-3xl border bg-white p-4 shadow-card transition', over === 'lost' ? 'border-rose-300 bg-rose-50/60 ring-4 ring-rose-100' : flash === 'lost' ? 'border-slate-300 ring-4 ring-slate-100' : 'border-slate-200/80')}
      >
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <X className="h-3.5 w-3.5 text-rose-500" /> Lost · 30 days
        </p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p tabIndex={0} className="group/val relative rounded-md text-3xl font-semibold tracking-tight tabular-nums text-rose-600 outline-none focus-visible:ring-2 focus-visible:ring-rose-300" aria-label={`${lostN} lead${lostN === 1 ? '' : 's'} lost${lostValue ? `, ${formatINR(lostValue)} in their budgets` : ''}`}>
            {lostValue ? formatINR(lostValue) : lostN}
            <Tip className="left-0 top-full mt-2 group-hover/val:opacity-100 group-focus-visible/val:opacity-100">
              {lostN} lead{lostN === 1 ? '' : 's'} lost{lostValue ? ` · ${formatINR(lostValue)} in their budgets` : ''}
            </Tip>
          </p>
          {lostN > 0 && <AvatarStack leads={lost.leads} tone="light" label={(l) => `${l.name} · ${l.lostReason ?? 'lost'} · drag onto a column to reopen`} drag={drag} dragging={dragging} />}
        </div>
        <div className="mt-auto pt-3" role="img" aria-label={`Where, 90 days: ${byStage.map((x) => `${x.n} at ${STAGE_META[x.s].label}`).join(', ')}`}>
          <p className="mb-1.5 text-[11px] font-medium text-slate-400">Where · furthest stage reached, 90 days</p>
          <div className="grid grid-cols-5 items-end gap-1">
            {byStage.map(({ s, n }) => (
              <div key={s} className="flex min-w-0 flex-col items-center gap-1" title={`${n} lost at ${STAGE_META[s].label}`}>
                <span className={clsx('text-[11px] font-semibold tabular-nums', n ? 'text-rose-600' : 'text-slate-300')}>{n}</span>
                <span className="flex h-9 w-full items-end justify-center">
                  <span className={clsx('w-full max-w-[36px] rounded-t-lg', n ? 'bg-gradient-to-t from-rose-500 to-rose-300' : 'bg-slate-100')} style={/* scan-ok: bar height is the count */ { height: `${n ? 10 + (n / stageTop) * 26 : 3}px` }} />
                </span>
                <span className="w-full truncate text-center text-[11px] leading-tight text-slate-500">{SHORT_STAGE[s] ?? STAGE_META[s].label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** One status number. With `onClick` it acts on the board (filter or jump) and says so. */
function StatusTile({ icon, label, value, sub, valueTone = 'text-slate-900', onClick, action, children }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; valueTone?: string; onClick?: () => void; action?: string | false; children?: React.ReactNode }) {
  // The label sits at the top and the number at the bottom, so tall tiles read as intended.
  const body = (
    <>
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
        {label}
        <span className={clsx('text-slate-400 transition [&>svg]:h-3.5 [&>svg]:w-3.5', onClick && 'group-hover:text-brand-700')}>{icon}</span>
      </span>
      <span className="mt-auto block pt-1">
        <span className={clsx('block text-2xl font-semibold leading-tight tracking-tight tabular-nums', valueTone)}>{value}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{sub}</span>
        {children}
        {onClick && action && <span className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-brand-700 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">{action} →</span>}
      </span>
    </>
  );
  const cls = 'group flex min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-left shadow-card transition';
  return onClick ? (
    <button type="button" onClick={onClick} className={clsx(cls, 'hover:-translate-y-0.5 hover:border-slate-300')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A small dark tooltip; its parent shows it on hover or focus. */
function Tip({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={clsx('pointer-events-none absolute z-20 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-pop transition', className)}>{children}</span>;
}

/** The three most recent leads as overlapping avatars, then "+N". Hover one for its name; click to open it. */
function AvatarStack({ leads, tone, label, drag, dragging }: { leads: Lead[]; tone: 'dark' | 'light'; label: (l: Lead) => string; drag?: (l: Lead) => DragProps; dragging?: Lead | null }) {
  const recent = [...leads].sort((a, b) => +new Date(b.stageChangedAt) - +new Date(a.stageChangedAt));
  const shown = recent.slice(0, 3);
  const more = recent.length - shown.length;
  const ring = tone === 'dark' ? 'ring-teal-700' : 'ring-white';
  return (
    <ul className="flex items-center" aria-label={recent.map(label).join('; ')}>
      {shown.map((l, i) => (
        <li key={l.id} {...(drag ? drag(l) : {})} className={clsx('group/av relative transition hover:z-40 focus-within:z-40', ['z-30', 'z-20', 'z-10'][i], i > 0 && '-ml-3', drag && 'cursor-grab active:cursor-grabbing', dragging?.id === l.id && 'opacity-40')}>
          <Link to={`/leads/${l.id}`} aria-label={label(l)} className={clsx('block rounded-full ring-[3px] transition duration-200 group-hover/av:-translate-y-1 group-focus-within/av:-translate-y-1', ring)}>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold"
              style={/* scan-ok: avatar colour is worked out from the name */ avatarColours(l.name, tone)}
            >
              {initials(l.name)}
            </span>
          </Link>
          <Tip className="right-0 top-full mt-2 group-hover/av:opacity-100 group-focus-within/av:opacity-100">{label(l)}</Tip>
        </li>
      ))}
      {more > 0 && (
        <li className={clsx('-ml-3 flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-semibold ring-[3px]', ring, tone === 'dark' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600')} title={recent.slice(3).map((l) => l.name).join(', ')}>
          +{more}
        </li>
      )}
    </ul>
  );
}

/** Soft colours from the name, like the app's avatars; on the green panel, light tints that read on dark. */
function avatarColours(name: string, tone: 'dark' | 'light') {
  const hue = [...name].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  // scan-ok: avatar colour is worked out from the name
  return tone === 'dark' ? { background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 55% 28%)` } : { background: `hsl(${hue} 60% 94%)`, color: `hsl(${hue} 50% 32%)` };
}

const SHORT_STAGE: Partial<Record<Stage, string>> = { contacted: 'Contact.', qualified: 'Qualif.', visit: 'Visit', negotiation: 'Negot.' };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/** Booked value building up over the 30 days: a step line in white on the green panel. */
function BuildUp({ leads, amount }: { leads: Lead[]; amount: (l: Lead) => number | null }) {
  const now = Date.now();
  const points = leads
    .map((l) => ({ t: +new Date(l.stageChangedAt), v: amount(l) ?? 0 }))
    .filter((p) => now - p.t <= 30 * DAY_MS)
    .sort((a, b) => a.t - b.t);
  if (!points.length) return null;
  const total = points.reduce((t, p) => t + p.v, 0) || 1;
  const x = (t: number) => Math.max(0, Math.min(300, 300 - ((now - t) / (30 * DAY_MS)) * 300));
  let run = 0;
  let line = 'M0,56';
  for (const p of points) {
    line += ` L${x(p.t)},${56 - (run / total) * 48}`;
    run += p.v;
    line += ` L${x(p.t)},${56 - (run / total) * 48}`;
  }
  line += ` L300,${56 - (run / total) * 48}`;
  return (
    <div className="relative mt-2 flex min-h-[44px] flex-1 flex-col" aria-hidden>
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" className="min-h-[32px] w-full flex-1">
        <defs>
          <linearGradient id="build-up" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L300,60 L0,60 Z`} fill="url(#build-up)" />
        <path d={line} fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] text-emerald-50/60">
        <span>30 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

/** While a card is dragged, two big targets slide up from the bottom: no scrolling down to close a deal. */
function DropBar({ dragging, over, drop }: { dragging: Lead | null; over: Stage | null; drop: (s: Stage) => DropProps }) {
  const show = !!dragging && OPEN_STAGES.includes(dragging.stage);
  return (
    <div
      aria-hidden={!show}
      className={clsx('pointer-events-none fixed inset-x-0 bottom-6 z-40 hidden justify-center px-4 transition duration-200 md:flex', show ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')}
    >
      <div className={clsx('flex gap-3 rounded-3xl bg-white/90 p-2 shadow-pop ring-1 ring-slate-200 backdrop-blur', show && 'pointer-events-auto')}>
        <div
          {...drop('booked')}
          data-drop="booked"
          className={clsx('flex w-60 items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-4 text-sm font-semibold transition', over === 'booked' ? 'scale-105 border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-300 bg-emerald-50 text-emerald-800')}
        >
          <Check className="h-4 w-4" /> Book it
        </div>
        <div
          {...drop('lost')}
          data-drop="lost"
          className={clsx('flex w-60 items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-4 text-sm font-semibold transition', over === 'lost' ? 'scale-105 border-rose-500 bg-rose-500 text-white' : 'border-rose-300 bg-rose-50 text-rose-800')}
        >
          <X className="h-4 w-4" /> Close as lost
        </div>
      </div>
    </div>
  );
}

/** Asks for exactly what a move needs: a reason, a property, the first conversation… */
export function MoveDialog({ lead, to, need, message, onClose, onRetry }: { lead: Lead; to: Stage; need: Need; message: string; onClose: () => void; onRetry: (extra?: object) => Promise<unknown> }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState('Interested');
  const [search, setSearch] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const props = useQuery({
    queryKey: ['props-pick', search, lead.id],
    queryFn: () => api.get<{ items: Property[] }>(`/properties${qs({ q: search || lead.summary.replace(/·/g, ' '), availability: ['available', 'held'], limit: 8 })}`),
    enabled: need === 'property',
  });
  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr(null);
      await fn();
    } catch (e) {
      setErr(e);
    }
  };
  const logAndMove = () =>
    run(async () => {
      await api.post(`/leads/${lead.id}/log`, { type: 'call', outcome, notes: note || undefined });
      void qc.invalidateQueries({ queryKey: ['timeline', lead.id] });
      await onRetry();
    });
  return (
    <Modal open onClose={onClose} title={need === 'reason' ? `Close ${lead.name} as lost` : `Move ${lead.name} to ${STAGE_META[to].label}`}>
      <div className="space-y-3">
        {need !== 'reason' && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p>}
        {need === 'reason' && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {LOST_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} className={clsx('rounded-full border px-2.5 py-1 text-xs', reason === r ? 'border-rose-500 bg-rose-600 text-white' : 'border-slate-200 text-slate-600')}>
                  {r}
                </button>
              ))}
            </div>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember, e.g. bought in Vadapalani for 68 L" />
            <p className="text-xs text-slate-500">Their planned follow-ups are cancelled. If they come back, their history is waiting.</p>
            <Button variant="danger" className="w-full" disabled={!reason} onClick={() => run(() => onRetry({ reason, note: note || undefined }))}>
              Close as lost
            </Button>
          </>
        )}
        {need === 'conversation' && (
          <>
            <p className="text-sm text-slate-600">Log how the first conversation went, and I'll move them.</p>
            <div className="flex flex-wrap gap-1.5">
              {CALL_OUTCOMES.slice(0, 3).map((o) => (
                <button key={o} onClick={() => setOutcome(o)} className={clsx('rounded-full border px-2.5 py-1 text-xs', outcome === o ? 'border-brand-500 bg-brand-700 text-white' : 'border-slate-200 text-slate-600')}>
                  {o}
                </button>
              ))}
            </div>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was said" />
            <Button variant="primary" className="w-full" onClick={logAndMove}>
              Log call and move
            </Button>
          </>
        )}
        {need === 'property' && (
          <>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a property, code or locality" />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {props.data?.items.map((p) => (
                <button key={p.id} onClick={() => run(() => onRetry({ propertyId: p.id }))} className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-300 hover:bg-brand-50">
                  <span className="truncate">{p.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{priceLabel(p)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {(need === 'requirement' || need === 'visit') && (
          <Link to={`/leads/${lead.id}`} onClick={onClose}>
            <Button variant="primary" className="w-full" icon={<ArrowRight className="h-4 w-4" />}>
              {need === 'visit' ? 'Open their page to schedule the visit' : 'Open their page to fill it in'}
            </Button>
          </Link>
        )}
        {need === 'booking' && <p className="text-sm text-slate-600">Open the deal on their page and confirm the booking there, with the booking amount and payment plan.</p>}
        <ErrorNote error={err} />
      </div>
    </Modal>
  );
}

/** Short names for the stage steps, so each fits on one line. */
const STEP_LABEL: Partial<Record<Stage, string>> = { new: 'Enquiry' };
const STEPS: Stage[] = ['new', 'contacted', 'qualified', 'visit', 'negotiation', 'booked'];
// Arrow-shaped steps: the first has a flat left edge, the last a flat right edge.
const ARROW = {
  first: '[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%)]',
  middle: '[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%,14px_50%)]',
  last: '[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,14px_50%)]',
};

/** The sales stage on a lead's page: where they are, since when, and one click to move them on. */
function StageBar({ lead }: { lead: Lead }) {
  const [gate, setGate] = useState<{ to: Stage; need: Need; message: string } | null>(null);
  const move = useMove((_l, to, need, message) => setGate({ to, need, message }));
  const lost = lead.stage === 'lost';
  const at = STEPS.indexOf(lead.stage);
  const since = new Date(lead.stageChangedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className="card rounded-3xl p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-sm text-slate-500">
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Sales stage</span>
          <span className={clsx('font-semibold', lost ? 'text-rose-600' : 'text-brand-700')}>{STAGE_META[lead.stage].label}</span> · since {since} · {lead.daysInStage} day{lead.daysInStage === 1 ? '' : 's'}
        </p>
        {lost ? (
          <Button size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => move.mutate({ lead, to: 'contacted' })}>
            Reopen
          </Button>
        ) : (
          lead.stage !== 'booked' && (
            <Button size="sm" icon={<X className="h-3.5 w-3.5" />} onClick={() => setGate({ to: 'lost', need: 'reason', message: '' })}>
              Mark as lost
            </Button>
          )
        )}
      </div>
      <ol className="mt-4 flex overflow-x-auto" aria-label="Sales stages">
        {STEPS.map((s, i) => {
          const done = !lost && i < at;
          const current = s === lead.stage;
          const label = STEP_LABEL[s] ?? STAGE_META[s].label;
          return (
            <li key={s} className={clsx('min-w-[104px] flex-1', i > 0 && '-ml-2')}>
              <button
                disabled={lost || s === 'booked' || current}
                onClick={() => move.mutate({ lead, to: s })}
                aria-current={current ? 'step' : undefined}
                aria-label={current ? `${STAGE_META[s].label}, current stage` : `Move to ${STAGE_META[s].label}`}
                title={STAGE_META[s].entry}
                className={clsx(
                  'flex h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap px-6 text-sm font-medium transition',
                  i === 0 ? clsx(ARROW.first, 'rounded-l-xl') : i === STEPS.length - 1 ? clsx(ARROW.last, 'rounded-r-xl') : ARROW.middle,
                  current ? 'bg-brand-700 font-semibold text-white' : done ? 'bg-brand-50 text-brand-800 hover:bg-brand-100' : 'bg-slate-100 text-slate-500 enabled:hover:bg-slate-200',
                  lost && 'opacity-60',
                )}
              >
                {done && <Check className="h-3.5 w-3.5 shrink-0" />}
                {label}
              </button>
            </li>
          );
        })}
      </ol>
      {lost && lead.lostReason && (
        <p className="mt-3 text-xs text-rose-700">
          Lost: {lead.lostReason}
          {lead.lostNote && ` — ${lead.lostNote}`}
        </p>
      )}
      {lead.stale && !lost && (
        <p className="mt-3 text-xs text-amber-700">
          {lead.daysInStage} days in {STAGE_META[lead.stage].label}, longer than usual. To move on: {STAGE_META[STEPS[at + 1] ?? lead.stage].entry.toLowerCase()}.
        </p>
      )}
      {gate && <MoveDialog lead={lead} {...gate} onClose={() => setGate(null)} onRetry={(extra) => move.mutateAsync({ lead, to: gate.to, extra }).then(() => setGate(null))} />}
    </section>
  );
}

views.board = PipelineBoard;
leadSlots.hero.push(StageBar);
