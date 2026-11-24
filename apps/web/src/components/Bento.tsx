import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, ClipboardCheck, Sparkles, TrendingDown } from 'lucide-react';
import { formatINR, relativeDay } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Deal } from '../lib/deals';
import { Avatar } from './ui';
import { DealDrawer } from './DealDrawer';
import { useAssistant } from '../ai/assistant';

/** A bento tile: one job each, generous padding, soft edges. */
export function Tile({ children, className, dark }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return <section className={clsx('rounded-3xl p-5', dark ? 'bg-slate-900 text-white' : 'border border-slate-200/70 bg-white shadow-card', className)}>{children}</section>;
}

export function TileHead({ label, right, dark }: { label: string; right?: React.ReactNode; dark?: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className={clsx('text-[11px] font-semibold uppercase tracking-[0.08em]', dark ? 'text-white/50' : 'text-slate-400')}>{label}</p>
      {right}
    </div>
  );
}

export function TileLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
      {children} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

/** Big weekday headline used by every role's Today. */
export function DayHeadline({ line, actions }: { line: string; actions?: React.ReactNode }) {
  const weekday = new Date().toLocaleDateString('en-IN', { weekday: 'long' });
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{weekday}.</h1>
        <p className="mt-1 text-2xl font-medium tracking-tight text-slate-400 sm:text-3xl">{line || ' '}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** The dark "ask the assistant" pill button. */
export function AskButton({ label, question }: { label: string; question: string }) {
  const assistant = useAssistant();
  return (
    <button onClick={() => assistant.ask(question)} className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800">
      <Sparkles className="h-4 w-4" /> {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Shared data

export type PipelineInsights = {
  total: number;
  booked: number;
  overallRate: number;
  funnel: { stage: string; label: string; count: number }[];
  conversion: { from: string; to: string; rate: number }[];
  weakest: { from: string; to: string; rate: number } | null;
  sources: { source: string; leads: number; booked: number; rate: number }[];
  team: TeamRow[];
};
export type TeamRow = {
  id: string;
  name: string;
  open: number;
  stuck: number;
  overdue: number;
  noNextStep: number;
  booked: number;
};
export type Overdue = {
  ownerId: string;
  name: string;
  count: number;
  oldestDays: number;
};
export type Movement = {
  projects: {
    id: string;
    name: string;
    locality: string;
    total: number;
    available: number;
    soldOrBooked: number;
    perMonth: number;
    monthsOfStock: number | null;
    slow: boolean;
  }[];
};
export type DealSummary = {
  negotiating: { count: number; value: number };
  bookedThisMonth: { count: number; value: number };
  dueSoon: { amount: number; overdue: boolean }[];
  stuck: { id: string }[];
};

export const useInsights = () =>
  useQuery({
    queryKey: ['pipeline-insights'],
    queryFn: () => api.get<PipelineInsights>('/pipeline/insights'),
  });
export const useTeam = () =>
  useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<{ overdue: Overdue[]; team: TeamRow[] }>('/activities/team'),
  });
export const useMovement = () =>
  useQuery({
    queryKey: ['movement'],
    queryFn: () => api.get<Movement>('/insights/movement'),
  });
export const useDealSummary = () =>
  useQuery({
    queryKey: ['deals-summary'],
    queryFn: () => api.get<DealSummary>('/deals/summary'),
  });
export const useWaiting = () => {
  const { can } = useAuth();
  return useQuery({
    queryKey: ['deals-waiting'],
    queryFn: () => api.get<{ approvals: Deal[]; bookings: Deal[] }>('/deals/waiting'),
    enabled: can('deal.approve'),
  });
};

/** Who needs a hand most: overdue first, then stuck, then no next step. */
export function needsHand(team: TeamRow[], overdue: Overdue[]) {
  return team
    .map((t) => ({
      ...t,
      overdue: overdue.find((o) => o.ownerId === t.id)?.count ?? 0,
      oldestDays: overdue.find((o) => o.ownerId === t.id)?.oldestDays ?? 0,
    }))
    .filter((t) => t.overdue || t.stuck > 2 || t.noNextStep > 2)
    .sort((a, b) => b.overdue - a.overdue || b.stuck - a.stuck || b.noNextStep - a.noNextStep);
}

// ---------------------------------------------------------------------------
// Tiles

/** Price approvals and bookings that need this person's decision; opens the deal to decide. */
export function ApprovalsTile({ className, adminFirst }: { className?: string; adminFirst?: boolean }) {
  const q = useWaiting();
  const [open, setOpen] = useState<string | null>(null);
  const approvals = [...(q.data?.approvals ?? [])].sort((a, b) => (adminFirst ? Number(b.approval?.level === 'admin') - Number(a.approval?.level === 'admin') : 0));
  const bookings = q.data?.bookings ?? [];
  const n = approvals.length + bookings.length;
  return (
    <Tile className={className}>
      <TileHead label="Decisions" right={<TileLink to="/deals">All deals</TileLink>} />
      <p className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <span className={clsx('flex h-8 w-8 items-center justify-center rounded-full', n ? 'bg-ai-50 text-ai-700' : 'bg-slate-100 text-slate-400')}>
          <ClipboardCheck className="h-4 w-4" />
        </span>
        {n ? `${n} waiting for you` : 'Nothing waiting for you'}
      </p>
      <ul className="mt-3 space-y-2">
        {approvals.slice(0, 3).map((d) => (
          <li key={d.id}>
            <button onClick={() => setOpen(d.id)} className="w-full rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-slate-100">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">{d.lead?.name ?? d.code}</span>
                <span className="shrink-0 text-sm font-semibold text-slate-900">{formatINR(d.approval?.price)}</span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="truncate">
                  {d.property?.title} · asked by {d.approval?.requestedByName}
                </span>
                <span className={clsx('shrink-0 rounded-full px-1.5 py-0.5 font-medium', d.approval?.level === 'admin' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700')}>
                  {d.approval?.discountPct}% off
                  {d.approval?.level === 'admin' ? ' · admin' : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
        {bookings.slice(0, Math.max(0, 3 - approvals.length)).map((d) => (
          <li key={d.id}>
            <button onClick={() => setOpen(d.id)} className="w-full rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-slate-100">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-900">{d.lead?.name ?? d.code}</span>
                <span className="shrink-0 text-[11px] font-medium text-brand-700">Confirm booking</span>
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                {formatINR(d.bookingRequest?.amount)} token · {d.property?.title}
              </span>
            </button>
          </li>
        ))}
        {n > 3 && <li className="text-center text-xs text-slate-400">+{n - 3} more on Deals</li>}
        {!n && <li className="py-4 text-center text-sm text-slate-400">Approvals and bookings to confirm will show up here.</li>}
      </ul>
      {open && <DealDrawer id={open} onClose={() => setOpen(null)} />}
    </Tile>
  );
}

/** Each salesperson's open customers, split by health, with what needs chasing. */
export function TeamTile({ className, label = 'Team' }: { className?: string; label?: string }) {
  const q = useTeam();
  const rows = (q.data?.team ?? []).map((t) => ({
    ...t,
    overdue: q.data!.overdue.find((o) => o.ownerId === t.id)?.count ?? 0,
  }));
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <Tile className={className}>
      <TileHead label={label} right={<TileLink to="/leads?view=board">Pipeline</TileLink>} />
      <ul className="space-y-3">
        {rows.map((t) => {
          const healthy = Math.max(0, t.open - t.stuck - t.noNextStep);
          return (
            <li key={t.id}>
              <Link to={`/leads?owner=${t.id}`} className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[150px_1fr_auto]">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={t.name} size="sm" />
                  <span className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-800">{t.name}</span>
                </span>
                <span
                  className="order-3 col-span-2 flex h-2 overflow-hidden rounded-full bg-slate-100 sm:order-none sm:col-span-1"
                  style={{ width: `${Math.max(12, (t.open / max) * 100)}%` }}
                  title={`${healthy} on track · ${t.noNextStep} no next step · ${t.stuck} stuck`}
                >
                  <span className="bg-brand-500" style={{ flex: healthy }} />
                  <span className="bg-amber-300" style={{ flex: t.noNextStep }} />
                  <span className="bg-rose-400" style={{ flex: t.stuck }} />
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-slate-800">{t.open}</span>
                  {t.overdue > 0 && <span className="rounded-full bg-rose-50 px-1.5 py-0.5 font-medium text-rose-600">{t.overdue} late</span>}
                  {t.booked > 0 && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">{t.booked} booked</span>}
                </span>
              </Link>
            </li>
          );
        })}
        {q.data && !rows.length && <li className="py-4 text-center text-sm text-slate-400">No active sales executives yet.</li>}
      </ul>
      <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <Legend className="bg-brand-500">On track</Legend>
        <Legend className="bg-amber-300">No next step</Legend>
        <Legend className="bg-rose-400">Stuck</Legend>
      </div>
    </Tile>
  );
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx('h-2 w-2 rounded-full', className)} /> {children}
    </span>
  );
}

/** From enquiry to booking over the last 90 days, with the weakest step called out. */
export function FunnelTile({ className, showSources }: { className?: string; showSources?: boolean }) {
  const q = useInsights();
  const f = q.data?.funnel ?? [];
  const max = Math.max(1, f[0]?.count ?? 1);
  return (
    <Tile className={className}>
      <TileHead label="Funnel · 90 days" right={q.data && <span className="text-xs text-slate-500">{q.data.overallRate}% book</span>} />
      <ul className="space-y-2">
        {f.map((s, i) => (
          <li key={s.stage} className="grid grid-cols-[84px_1fr_32px] items-center gap-2 text-xs">
            <span className="text-slate-600">{s.label}</span>
            <span className="h-5 overflow-hidden rounded-lg bg-slate-50">
              <span
                className={clsx('block h-full rounded-lg', i === f.length - 1 ? 'bg-emerald-400' : 'bg-brand-500/80')}
                style={{
                  width: `${Math.max(3, (s.count / max) * 100)}%`,
                  opacity: 1 - i * 0.08,
                }}
              />
            </span>
            <span className="text-right font-semibold text-slate-800">{s.count}</span>
          </li>
        ))}
      </ul>
      {q.data?.weakest && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
          <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Weakest step:{' '}
            <b>
              {q.data.weakest.from} → {q.data.weakest.to}
            </b>
            , only {q.data.weakest.rate}% move on.
          </span>
        </p>
      )}
      {showSources && !!q.data?.sources.length && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Best sources</p>
          <ul className="space-y-1.5 text-xs">
            {q.data.sources.slice(0, 4).map((s) => (
              <li key={s.source} className="flex justify-between gap-2">
                <span className="capitalize text-slate-600">{s.source.replace(/_/g, ' ')}</span>
                <span className="text-slate-500">
                  <b className="text-slate-800">{s.leads}</b> leads · {s.booked} booked
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tile>
  );
}

/** How fast each project sells, slowest first. */
export function ProjectsTile({ className, limit = 4 }: { className?: string; limit?: number }) {
  return (
    <Tile className={className}>
      <TileHead label="Projects · selling pace" right={<TileLink to="/properties?tab=projects">Projects</TileLink>} />
      <ProjectPace limit={limit} />
    </Tile>
  );
}

export function ProjectPace({ limit = 4 }: { limit?: number }) {
  const q = useMovement();
  const projects = (q.data?.projects ?? []).slice(0, limit);
  return (
    <ul className="space-y-3">
      {projects.map((p) => {
        const sold = p.total ? (p.soldOrBooked / p.total) * 100 : 0;
        return (
          <li key={p.id}>
            <Link to={`/projects/${p.id}`} className="group block">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-800">
                  {p.name} <span className="font-normal text-slate-400">· {p.locality}</span>
                </span>
                <span className={clsx('shrink-0 text-[11px]', p.slow ? 'font-medium text-rose-600' : 'text-slate-500')}>{p.slow ? (p.perMonth ? `${p.monthsOfStock} months of stock` : 'No sales in 90 days') : `${p.perMonth} a month`}</span>
              </span>
              <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span className={p.slow ? 'bg-rose-400' : 'bg-emerald-400'} style={{ width: `${sold}%` }} />
              </span>
              <span className="mt-1 block text-[11px] text-slate-400">
                {p.soldOrBooked} of {p.total} sold or booked · {p.available} available
              </span>
            </Link>
          </li>
        );
      })}
      {q.data && !projects.length && <li className="py-4 text-center text-sm text-slate-400">No projects yet.</li>}
    </ul>
  );
}

/** Money in the pipeline for whoever is looking. */
export function MoneyStats({ dark }: { dark?: boolean }) {
  const s = useDealSummary().data;
  const due = s?.dueSoon.reduce((t, p) => t + p.amount, 0) ?? 0;
  const late = s?.dueSoon.filter((p) => p.overdue).length ?? 0;
  const rows: [string, string, string?][] = [
    ['Negotiating', s?.negotiating.count ? formatINR(s.negotiating.value) : '—', s?.negotiating.count ? `${s.negotiating.count} deals` : undefined],
    ['Due in 30 days', due ? formatINR(due) : '—', late ? `${late} overdue` : undefined],
    ['Deals quiet 5+ days', String(s?.stuck.length ?? '—')],
  ];
  return (
    <dl className="space-y-3">
      {rows.map(([k, v, hint]) => (
        <div key={k} className="flex items-baseline justify-between gap-2">
          <dt className={clsx('text-xs', dark ? 'text-white/60' : 'text-slate-500')}>{k}</dt>
          <dd className="text-right">
            <span className={clsx('text-sm font-semibold', dark ? 'text-white' : 'text-slate-900')}>{v}</span>
            {hint && <span className={clsx('ml-1.5 text-[11px]', hint.includes('overdue') ? 'text-rose-400' : dark ? 'text-white/50' : 'text-slate-400')}>{hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export const lastSeen = (at: string | null) => (at ? relativeDay(at) : 'Never');
