import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { UserPlus, Users } from 'lucide-react';
import { ACTIVITY_LABEL, STAGE_META, formatINR, formatTime, relativeDay } from '@estate/shared';
import { api } from '../lib/api';
import type { Lead } from '../lib/leads';
import type { AgendaItem } from '../features/activities';
import { NewLead } from '../components/NewLead';
import { ApprovalsTile, AskButton, DayHeadline, FunnelTile, MoneyStats, ProjectsTile, TeamTile, Tile, TileHead, needsHand, useDealSummary, useTeam, useWaiting } from '../components/Bento';
import { useAssistantPage } from '../ai/assistant';

type Day = {
  overdue: AgendaItem[];
  today: AgendaItem[];
  doneToday: number;
  newLeads: Lead[];
  noNextStep: Lead[];
};

/**
 * The sales manager's first screen: how the team's day is going, who needs a
 * hand, what is waiting on the manager, and where the funnel leaks.
 */
export function TodayManager() {
  const [adding, setAdding] = useState(false);
  useAssistantPage({
    page: 'Today',
    suggestions: ['Which leads require immediate attention?', 'Which sales executives have overdue follow-ups?', 'Where are deals getting stuck?', 'Which projects have low inventory movement?'],
  });
  const day = useQuery({
    queryKey: ['today'],
    queryFn: () => api.get<Day>('/activities/today'),
    refetchInterval: 120_000,
  });
  const team = useTeam();
  const waiting = useWaiting();
  const unassigned = useQuery({
    queryKey: ['leads', 'unassigned-count'],
    queryFn: () => api.get<{ total: number }>('/leads?ownerId=none&open=true&limit=1'),
  });

  const help = team.data ? needsHand(team.data.team, team.data.overdue) : [];
  const decisions = (waiting.data?.approvals.length ?? 0) + (waiting.data?.bookings.length ?? 0);
  const bits = [help.length && `${help.length} ${help.length === 1 ? 'person needs' : 'people need'} a hand`, decisions && `${decisions} waiting for you`].filter(Boolean) as string[];
  const line = team.data ? (bits.length ? `${bits.join(', ')}.` : 'The team is on track today.') : '';

  return (
    <div className="space-y-4">
      <DayHeadline
        line={line}
        actions={
          <>
            <button onClick={() => setAdding(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <UserPlus className="h-4 w-4" /> New lead
            </button>
            <AskButton label="Brief me" question="Give me a short brief of the team for today: who needs help, what is stuck, and what I should do first." />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <TeamPulse d={day.data} help={help} unassigned={unassigned.data?.total ?? 0} className="lg:col-span-5" />
        <ApprovalsTile className="lg:col-span-4" />
        <MoneyTile className="lg:col-span-3" />

        <Attention d={day.data} className="lg:col-span-7" />
        <FunnelTile className="lg:col-span-5" />

        <TeamTile className="lg:col-span-7" />
        <ProjectsTile className="lg:col-span-5" />
      </div>
      <NewLead open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

/** The team's day in one tile: follow-ups done vs planned, and who to check on first. */
function TeamPulse({ d, help, unassigned, className }: { d?: Day; help: ReturnType<typeof needsHand>; unassigned: number; className?: string }) {
  const planned = (d?.today.length ?? 0) + (d?.overdue.length ?? 0);
  const done = d?.doneToday ?? 0;
  const total = Math.max(1, planned + done);
  return (
    <section className={clsx('relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 p-6 text-white', className)}>
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">Team follow-ups today</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-6xl font-semibold tracking-tight">{done}</span>
        <span className="pb-2 text-lg text-white/60">of {planned + done} done</span>
        {d && d.overdue.length > 0 && <span className="mb-2 ml-auto rounded-full bg-rose-400/20 px-2.5 py-1 text-xs font-medium text-rose-100">{d.overdue.length} overdue</span>}
      </div>
      <div className="mt-4 flex h-2.5 gap-1">
        {Array.from({ length: Math.min(total, 40) }, (_, i) => {
          const at = (i / Math.min(total, 40)) * total;
          return <span key={i} className={clsx('flex-1 rounded-full', at < done ? 'bg-lime-300' : at < done + (d?.overdue.length ?? 0) ? 'bg-rose-300/70' : 'bg-white/15')} />;
        })}
      </div>
      <div className="mt-6 space-y-2">
        {help.slice(0, 2).map((p) => (
          <Link key={p.id} to={`/leads?owner=${p.id}`} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 backdrop-blur transition hover:bg-white/15">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">{p.name.charAt(0)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">Check in with {p.name.split(' ')[0]}</span>
              <span className="block truncate text-xs text-white/60">
                {[p.overdue && `${p.overdue} overdue${p.oldestDays ? `, oldest ${p.oldestDays} d` : ''}`, p.stuck && `${p.stuck} stuck`, p.noNextStep && `${p.noNextStep} with no next step`].filter(Boolean).join(' · ')}
              </span>
            </span>
          </Link>
        ))}
        {!help.length && d && <p className="rounded-2xl bg-white/10 p-3 text-sm text-white/80">Nobody is behind. A good day to coach on the funnel's weakest step.</p>}
        {unassigned > 0 && (
          <Link to="/leads?owner=none" className="flex items-center gap-3 rounded-2xl bg-lime-300 p-3 text-brand-900 transition hover:bg-lime-200">
            <Users className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-sm font-medium">
              {unassigned} new lead{unassigned === 1 ? '' : 's'} waiting for an owner
            </span>
            <span className="text-xs font-semibold">Assign →</span>
          </Link>
        )}
      </div>
    </section>
  );
}

function MoneyTile({ className }: { className?: string }) {
  const s = useDealSummary().data;
  return (
    <Tile className={className}>
      <TileHead label="Booked this month" />
      <p className="text-4xl font-semibold tracking-tight text-slate-900">{s?.bookedThisMonth.count ? formatINR(s.bookedThisMonth.value) : '₹0'}</p>
      <p className="mt-1 text-xs text-slate-500">{s ? `${s.bookedThisMonth.count} booking${s.bookedThisMonth.count === 1 ? '' : 's'}` : ' '}</p>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <MoneyStats />
      </div>
    </Tile>
  );
}

/** What's slipping across the team right now, oldest first, with whose it is. */
function Attention({ d, className }: { d?: Day; className?: string }) {
  const overdue = (d?.overdue ?? []).slice(0, 4);
  const gaps = (d?.noNextStep ?? []).slice(0, Math.max(0, 6 - overdue.length));
  return (
    <Tile dark className={className}>
      <TileHead
        dark
        label="Slipping"
        right={
          d && (
            <span className="text-[11px] text-white/50">
              {d.overdue.length} overdue · {d.noNextStep.length} no plan
            </span>
          )
        }
      />
      <ul className="space-y-3">
        {overdue.map((a) => (
          <li key={a.id} className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {a.lead ? (
                  <Link to={`/leads/${a.lead.id}`} className="hover:underline">
                    {ACTIVITY_LABEL[a.type]} {a.lead.name}
                  </Link>
                ) : (
                  a.title
                )}
              </p>
              <p className="truncate text-[11px] text-white/50">{a.owner?.name ?? 'Unassigned'}</p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-rose-300">{relativeDay(a.scheduledAt)}</span>
          </li>
        ))}
        {gaps.map((l) => (
          <li key={l.id} className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-white/40" />
            <div className="min-w-0 flex-1">
              <Link to={`/leads/${l.id}`} className="block truncate text-sm font-medium hover:underline">
                {l.name}
              </Link>
              <p className="truncate text-[11px] text-white/50">
                No next step · {STAGE_META[l.stage].label}
                {l.ownerName ? ` · ${l.ownerName}` : ''}
              </p>
            </div>
          </li>
        ))}
        {d && !overdue.length && !gaps.length && <li className="py-6 text-center text-sm text-white/50">Nothing slipping. Every customer has a plan.</li>}
      </ul>
      {d && d.today.length > 0 && (
        <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/50">
          Next on the team calendar: {ACTIVITY_LABEL[d.today[0].type].toLowerCase()} with {d.today[0].lead?.name ?? '—'} at {formatTime(d.today[0].scheduledAt)}
          {d.today[0].owner ? ` (${d.today[0].owner.name.split(' ')[0]})` : ''}.
        </p>
      )}
    </Tile>
  );
}
