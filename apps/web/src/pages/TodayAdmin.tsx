import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, FileSpreadsheet, Settings, Sparkles } from 'lucide-react';
import { ROLE_LABEL, formatINR, relativeDay, type Role } from '@estate/shared';
import { api } from '../lib/api';
import { ApprovalsTile, AskButton, DayHeadline, FunnelTile, MoneyStats, ProjectPace, TeamTile, Tile, TileHead, TileLink, lastSeen, useDealSummary, useWaiting } from '../components/Bento';
import { useAssistantPage } from '../ai/assistant';

type Overview = {
  stock: {
    available: number;
    held: number;
    booked: number;
    sold: number;
    drafts: number;
    availableValue: number;
  };
  people: {
    id: string;
    name: string;
    role: Role;
    active: boolean;
    lastLoginAt: string | null;
  }[];
  activeThisWeek: number;
  imports: {
    id: string;
    name: string;
    kind: string;
    status: 'checking' | 'importing' | 'done';
    rows: number;
    problems: number;
    counts: { imported?: number; updated?: number; failed?: number } | null;
    by: string | null;
    at: string;
  }[];
  recent: {
    id: string;
    who: string;
    viaAI: boolean;
    entity: string;
    entityId: string;
    action: string;
    summary: string;
    at: string;
  }[];
};

/**
 * The admin's first screen: the business as a whole — money, stock, decisions
 * only an admin can make, people using the app and what changed lately.
 */
export function TodayAdmin() {
  useAssistantPage({
    page: 'Today',
    suggestions: ['How are sales this month?', 'Which projects have low inventory movement?', 'Where are deals getting stuck?', 'Which properties receive the most enquiries?'],
  });
  const o = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get<Overview>('/insights/overview'),
    refetchInterval: 300_000,
  });
  const money = useDealSummary().data;
  const waiting = useWaiting().data;
  const adminOnly = waiting?.approvals.filter((d) => d.approval?.level === 'admin').length ?? 0;

  const line = money ? [money.bookedThisMonth.count ? `${formatINR(money.bookedThisMonth.value)} booked this month` : 'No bookings yet this month', adminOnly ? `${adminOnly} above the manager's limit` : ''].filter(Boolean).join(', ') + '.' : '';

  return (
    <div className="space-y-4">
      <DayHeadline
        line={line}
        actions={
          <>
            <Link to="/settings" className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <AskButton label="Brief me" question="Give me a short brief of the business: bookings and money this month, stock that isn't moving, deals waiting for my approval, and the biggest risk this week." />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <BusinessPulse o={o.data} className="lg:col-span-5" />
        <ApprovalsTile adminFirst className="lg:col-span-4" />
        <PeopleTile o={o.data} className="lg:col-span-3" />

        <StockTile o={o.data} className="lg:col-span-7" />
        <FunnelTile showSources className="lg:col-span-5" />

        <div className="flex flex-col gap-4 lg:col-span-7">
          <TeamTile label="Sales team" />
          <ImportsTile o={o.data} className="flex-1" />
        </div>
        <RecentTile o={o.data} className="lg:col-span-5" />
      </div>
    </div>
  );
}

function BusinessPulse({ o, className }: { o?: Overview; className?: string }) {
  const s = useDealSummary().data;
  return (
    <section className={clsx('relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 p-6 text-white', className)}>
      <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/5" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">Booked this month</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-5xl font-semibold tracking-tight sm:text-6xl">{s ? (s.bookedThisMonth.count ? formatINR(s.bookedThisMonth.value) : '₹0') : ' '}</span>
        {s && (
          <span className="pb-2 text-sm text-white/60">
            {s.bookedThisMonth.count} booking
            {s.bookedThisMonth.count === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">
        <MoneyStats dark />
        <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-white/10 pt-3">
          <span className="text-xs text-white/60">Stock for sale</span>
          <span className="text-sm font-semibold">
            {o ? formatINR(o.stock.availableValue) : '—'}
            {o && <span className="ml-1.5 text-[11px] font-normal text-white/50">{o.stock.available} units</span>}
          </span>
        </div>
      </div>
    </section>
  );
}

const STOCK: {
  key: 'available' | 'held' | 'booked' | 'sold';
  label: string;
  bar: string;
}[] = [
  { key: 'available', label: 'Available', bar: 'bg-brand-500' },
  { key: 'held', label: 'Held', bar: 'bg-amber-300' },
  { key: 'booked', label: 'Booked', bar: 'bg-ai-500' },
  { key: 'sold', label: 'Sold', bar: 'bg-slate-700' },
];

/** Everything listed, by state, plus drafts nobody has published. */
function StockTile({ o, className }: { o?: Overview; className?: string }) {
  const s = o?.stock;
  const total = s ? s.available + s.held + s.booked + s.sold : 0;
  return (
    <Tile className={className}>
      <TileHead label="Inventory" right={<TileLink to="/properties">Properties</TileLink>} />
      <div className="flex items-end gap-3">
        <p className="text-5xl font-semibold tracking-tight text-slate-900">{s ? total : ' '}</p>
        <p className="pb-1.5 text-xs text-slate-500">live units and listings</p>
      </div>
      <div className="mt-4 flex h-4 gap-1 overflow-hidden rounded-full">
        {s && STOCK.map((x) => (s[x.key] ? <span key={x.key} className={clsx('h-full', x.bar)} style={{ flex: s[x.key] }} title={`${x.label}: ${s[x.key]}`} /> : null))}
        {!s && <span className="h-full flex-1 bg-slate-100" />}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STOCK.map((x) => (
          <div key={x.key}>
            <dt className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className={clsx('h-2 w-2 rounded-full', x.bar)} /> {x.label}
            </dt>
            <dd className="text-lg font-semibold text-slate-900">{s?.[x.key] ?? '—'}</dd>
          </div>
        ))}
      </dl>
      {!!s?.drafts && (
        <Link to="/properties?listing=draft" className="mt-4 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 transition hover:bg-amber-100">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            <b>{s.drafts} drafts</b> not published yet, so no buyer can see them.
          </span>
          <span className="font-semibold">Review →</span>
        </Link>
      )}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Projects · selling pace</p>
          <TileLink to="/properties?tab=projects">Projects</TileLink>
        </div>
        <ProjectPace limit={4} />
      </div>
    </Tile>
  );
}

/** Who uses the app, and who hasn't signed in lately. */
function PeopleTile({ o, className }: { o?: Overview; className?: string }) {
  const people = o?.people.filter((p) => p.active) ?? [];
  const byRole = (r: Role) => people.filter((p) => p.role === r).length;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const away = people.filter((p) => !p.lastLoginAt || new Date(p.lastLoginAt).getTime() < weekAgo);
  return (
    <Tile className={className}>
      <TileHead label="People" right={<TileLink to="/settings">Manage</TileLink>} />
      <div className="flex items-end gap-2">
        <p className="text-5xl font-semibold tracking-tight text-slate-900">{o ? o.activeThisWeek : ' '}</p>
        <p className="pb-1.5 text-xs text-slate-500">of {people.length} active this week</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(['admin', 'manager', 'executive'] as Role[]).map((r) => (
          <span key={r} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
            <b className="text-slate-800">{byRole(r)}</b> {ROLE_LABEL[r].toLowerCase()}
            {byRole(r) === 1 || r === 'admin' ? '' : 's'}
          </span>
        ))}
      </div>
      {away.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[11px] text-slate-400">Not signed in this week</p>
          <ul className="space-y-1.5">
            {away.slice(0, 3).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium text-slate-700">{p.name}</span>
                <span className="shrink-0 text-slate-400">{lastSeen(p.lastLoginAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tile>
  );
}

const ENTITY_LINK: Record<string, (id: string) => string> = {
  property: (id) => `/properties/${id}`,
  lead: (id) => `/leads/${id}`,
  project: (id) => `/projects/${id}`,
  deal: () => '/deals',
  user: () => '/settings',
};

/** The latest changes anyone made, including the assistant on someone's behalf. */
function RecentTile({ o, className }: { o?: Overview; className?: string }) {
  return (
    <Tile dark className={className}>
      <TileHead dark label="Latest changes" />
      <ul className="space-y-3">
        {(o?.recent ?? []).slice(0, 7).map((a) => {
          const to = ENTITY_LINK[a.entity]?.(a.entityId);
          const text = <span className="line-clamp-1">{a.summary}</span>;
          return (
            <li key={a.id} className="flex items-start gap-3">
              <span className={clsx('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', a.viaAI ? 'bg-ai-500/30 text-ai-100' : 'bg-white/10 text-white/80')}>
                {a.viaAI ? <Sparkles className="h-3 w-3" /> : a.who.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {to ? (
                    <Link to={to} className="hover:underline">
                      {text}
                    </Link>
                  ) : (
                    text
                  )}
                </p>
                <p className="truncate text-[11px] text-white/50">
                  {a.who}
                  {a.viaAI ? ' via assistant' : ''} · {relativeDay(a.at).toLowerCase()}
                </p>
              </div>
            </li>
          );
        })}
        {o && !o.recent.length && <li className="py-6 text-center text-sm text-white/50">No changes yet.</li>}
      </ul>
    </Tile>
  );
}

/** Recent owner sheets and brochures, and whether any need a second look. */
function ImportsTile({ o, className }: { o?: Overview; className?: string }) {
  return (
    <Tile className={className}>
      <TileHead label="Recent imports" right={<TileLink to="/properties/import">Import</TileLink>} />
      <ul className="space-y-2.5">
        {(o?.imports ?? []).map((b) => {
          const added = (b.counts?.imported ?? 0) + (b.counts?.updated ?? 0);
          return (
            <li key={b.id}>
              <Link to="/properties/import" className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-slate-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{b.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {b.by ?? 'Someone'} · {relativeDay(b.at).toLowerCase()} · {b.rows} rows
                  </span>
                </span>
                {b.status !== 'done' ? (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Not finished</span>
                ) : b.counts?.failed ? (
                  <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">{b.counts.failed} failed</span>
                ) : (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{added} added</span>
                )}
              </Link>
            </li>
          );
        })}
        {o && !o.imports.length && <li className="py-6 text-center text-sm text-slate-400">No imports yet. Owner sheets and brochures you load will show here.</li>}
      </ul>
    </Tile>
  );
}
