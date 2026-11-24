import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, CalendarDays, Check, Flame, MessageCircle, Phone, Send, Sparkles, UserPlus } from 'lucide-react';
import { ACTIVITY_LABEL, DEAL_STATUS_LABEL, OPEN_STAGES, STAGE_META, formatINR, formatTime, relativeDay, type Stage } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { waLink, type Lead } from '../lib/leads';
import type { Deal } from '../lib/deals';
import type { Property } from '../lib/property';
import { Button } from '../components/ui';
import { Tile, TileHead } from '../components/Bento';
import { PropertyCover } from '../components/PropertyCard';
import { NewLead } from '../components/NewLead';
import { DealDrawer } from '../components/DealDrawer';
import { CompleteDialog, type AgendaItem } from '../features/activities';
import { Reasons, ShareDialog } from '../features/matching';
import { useAssistant, useAssistantPage } from '../ai/assistant';

type Day = { overdue: AgendaItem[]; today: AgendaItem[]; doneToday: number; newLeads: Lead[]; noNextStep: Lead[] };
type Column = { stage: Stage; leads: Lead[] };
type Match = { lead: { id: string; name: string }; property: Property; fit: 'strong' | 'good' | 'partial'; reasons: { ok: 'yes' | 'near' | 'no' | 'info'; text: string }[] };

/**
 * The executive's first screen: how the day is going, what's next, where the
 * pipeline stands, the customer most worth a call, and deals close to money.
 */
export function TodayExec() {
  const { user } = useAuth();
  const assistant = useAssistant();
  const [adding, setAdding] = useState(false);
  useAssistantPage({ page: 'Today', suggestions: ['Plan my day', 'Which of my leads need attention?', 'Draft a follow-up for my hottest lead'] });

  const day = useQuery({ queryKey: ['today'], queryFn: () => api.get<Day>('/activities/today'), refetchInterval: 120_000 });
  const board = useQuery({ queryKey: ['board', '', ''], queryFn: () => api.get<{ columns: Column[] }>('/pipeline/board') });
  const deals = useQuery({ queryKey: ['deals', 'mine-open'], queryFn: () => api.get<{ items: Deal[] }>('/deals?status=negotiating,approval,approved,booked') });
  const matches = useQuery({ queryKey: ['best-matches'], queryFn: () => api.get<{ items: Match[] }>('/matching/today') });

  const d = day.data;
  const today = d?.today ?? [];
  // "1 call and 1 meeting today."
  const n = (types: string[]) => today.filter((a) => types.includes(a.type)).length;
  const words: [number, string][] = [
    [n(['call', 'whatsapp', 'email']), 'call'],
    [n(['site_visit']), 'site visit'],
    [n(['meeting']), 'meeting'],
    [n(['task', 'note']), 'task'],
  ];
  const parts = words.filter(([c]) => c).map(([c, w]) => `${c} ${w}${c > 1 ? 's' : ''}`);
  const said = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  const weekday = new Date().toLocaleDateString('en-IN', { weekday: 'long' });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{weekday}.</h1>
          <p className="mt-1 text-2xl font-medium tracking-tight text-slate-400 sm:text-3xl">{d ? (said ? `${said} today.` : 'A clear day — time to find new buyers.') : ' '}</p>
        </div>
        <div className="flex gap-2">
          <Button className="rounded-full" icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>
            New lead
          </Button>
          <Button variant="primary" className="rounded-full bg-slate-900 hover:bg-slate-800" icon={<Sparkles className="h-4 w-4" />} onClick={() => assistant.ask('Plan my day: what should I do first and why?')}>
            Plan my day
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <DayProgress d={d} name={user?.name.split(' ')[0] ?? ''} className="lg:col-span-5" />
        <PipelineTile columns={board.data?.columns} className="lg:col-span-3" />
        <Timeline items={today} className="lg:col-span-4" />

        <Spotlight columns={board.data?.columns} matches={matches.data?.items} className="lg:col-span-4" />
        <DealsTile deals={deals.data?.items} className="lg:col-span-5" />
        <FollowUps d={d} className="lg:col-span-3" />

        <MatchOfTheDay matches={matches.data?.items} className="lg:col-span-12" />
      </div>
      <NewLead open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

/** How the day is going: done vs planned, and the very next thing with a call button. */
function DayProgress({ d, name, className }: { d?: Day; name: string; className?: string }) {
  const planned = (d?.today.length ?? 0) + (d?.overdue.length ?? 0);
  const done = d?.doneToday ?? 0;
  const total = Math.max(1, planned + done);
  const next = d?.overdue[0] ?? d?.today[0];
  return (
    <section className={clsx('relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 to-brand-700 p-6 text-white', className)}>
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">Your day</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-6xl font-semibold tracking-tight">{done}</span>
        <span className="pb-2 text-lg text-white/60">of {planned + done} done</span>
        {d && d.overdue.length > 0 && <span className="mb-2 ml-auto rounded-full bg-rose-400/20 px-2.5 py-1 text-xs font-medium text-rose-100">{d.overdue.length} overdue</span>}
      </div>
      <div className="mt-4 flex h-2.5 gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={clsx('flex-1 rounded-full', i < done ? 'bg-lime-300' : i < done + (d?.overdue.length ?? 0) ? 'bg-rose-300/70' : 'bg-white/15')} />
        ))}
      </div>
      <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">
        {next?.lead ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/60">{d?.overdue[0] ? `Overdue · was ${relativeDay(next.scheduledAt).toLowerCase()}` : `Next · ${formatTime(next.scheduledAt)}`}</p>
              <p className="truncate font-medium">
                {ACTIVITY_LABEL[next.type]} with{' '}
                <Link to={`/leads/${next.lead.id}`} className="underline decoration-white/30 underline-offset-2 hover:decoration-white">
                  {next.lead.name}
                </Link>
              </p>
              <p className="truncate text-xs text-white/60">{next.title}</p>
            </div>
            <a href={`tel:${next.lead.phone}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime-300 text-brand-900 transition hover:bg-lime-200" aria-label={`Call ${next.lead.name}`}>
              <Phone className="h-5 w-5" />
            </a>
          </div>
        ) : (
          <p className="text-sm text-white/80">Nothing else planned{name ? `, ${name}` : ''}. Call a new lead or send a match below.</p>
        )}
      </div>
    </section>
  );
}

const STAGE_BAR: Partial<Record<Stage, string>> = { new: 'bg-sky-400', contacted: 'bg-slate-400', qualified: 'bg-brand-500', visit: 'bg-ai-500', negotiation: 'bg-amber-400' };

function PipelineTile({ columns, className }: { columns?: Column[]; className?: string }) {
  const open = (columns ?? []).filter((c) => OPEN_STAGES.includes(c.stage));
  const total = open.reduce((s, c) => s + c.leads.length, 0);
  const hot = open.reduce((s, c) => s + c.leads.filter((l) => l.temperature === 'hot').length, 0);
  const max = Math.max(1, ...open.map((c) => c.leads.length));
  return (
    <Tile className={className}>
      <TileHead label="My pipeline" />
      <p className="text-5xl font-semibold tracking-tight text-slate-900">{total}</p>
      <p className="mt-1 text-xs text-slate-500">
        open leads · <span className="font-medium text-rose-600">{hot} hot</span>
      </p>
      <ul className="mt-4 space-y-2.5">
        {open.map((c) => (
          <li key={c.stage}>
            <Link to={`/leads?stages=${c.stage}`} className="group grid grid-cols-[76px_1fr_20px] items-center gap-2 text-xs">
              <span className="text-slate-600 group-hover:text-slate-900">{STAGE_META[c.stage].label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <span className={clsx('block h-full rounded-full', STAGE_BAR[c.stage])} style={{ width: `${(c.leads.length / max) * 100}%` }} />
              </span>
              <span className="text-right font-medium text-slate-800">{c.leads.length}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/leads?view=board" className="mt-4 flex items-center justify-center gap-1 text-xs font-medium text-brand-700 hover:underline">
        Open the board <ArrowRight className="h-3 w-3" />
      </Link>
    </Tile>
  );
}

function Timeline({ items, className }: { items: AgendaItem[]; className?: string }) {
  return (
    <Tile className={className}>
      <TileHead label={`Today · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} right={<Link to="/calendar" className="text-slate-400 hover:text-slate-700" aria-label="Calendar"><CalendarDays className="h-4 w-4" /></Link>} />
      {!items.length ? (
        <p className="py-8 text-center text-sm text-slate-400">Nothing else booked today.</p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[59px] before:top-2 before:w-px before:bg-slate-100">
          {items.slice(0, 5).map((a) => (
            <li key={a.id} className="relative grid grid-cols-[52px_16px_1fr] items-start gap-1">
              <span className="pt-0.5 text-xs font-semibold text-slate-700">{formatTime(a.scheduledAt).replace(' ', ' ')}</span>
              <span className={clsx('relative z-10 mt-1.5 h-2.5 w-2.5 justify-self-center rounded-full ring-4 ring-white', a.type === 'site_visit' ? 'bg-ai-500' : a.type === 'meeting' ? 'bg-amber-400' : 'bg-brand-500')} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {ACTIVITY_LABEL[a.type]} · {a.lead && <Link to={`/leads/${a.lead.id}`} className="hover:text-brand-800">{a.lead.name}</Link>}
                </span>
                <span className="block truncate text-xs text-slate-400">{a.properties[0]?.title ?? a.title}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {items.length > 5 && <p className="mt-3 text-center text-xs text-slate-400">+{items.length - 5} more</p>}
      <Link to="/calendar" className="mt-4 flex items-center justify-center gap-1 text-xs font-medium text-brand-700 hover:underline">
        Full calendar <ArrowRight className="h-3 w-3" />
      </Link>
    </Tile>
  );
}

/** The customer most worth a call right now, with what to send them. */
function Spotlight({ columns, matches, className }: { columns?: Column[]; matches?: Match[]; className?: string }) {
  const [sharing, setSharing] = useState(false);
  const order: Stage[] = ['negotiation', 'visit', 'qualified', 'contacted', 'new'];
  const candidates = (columns ?? []).filter((c) => order.includes(c.stage)).flatMap((c) => c.leads);
  const lead = candidates.sort((a, b) => Number(b.temperature === 'hot') - Number(a.temperature === 'hot') || order.indexOf(a.stage) - order.indexOf(b.stage))[0];
  const direct = useQuery({ queryKey: ['matches', lead?.id, 'top'], queryFn: () => api.get<{ items: { property: Property; fit: Match['fit']; reasons: Match['reasons'] }[] }>(`/matching/lead/${lead!.id}?limit=1`), enabled: !!lead });
  const top = matches?.find((m) => m.lead.id === lead?.id) ?? direct.data?.items[0];
  if (!lead) return <Tile className={className}><TileHead label="Spotlight" /><p className="text-sm text-slate-400">No open customers yet.</p></Tile>;
  return (
    <Tile className={className}>
      <TileHead label="Spotlight" right={lead.temperature === 'hot' && <span className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600"><Flame className="h-3 w-3" /> Hot</span>} />
      <Link to={`/leads/${lead.id}`} className="block">
        <p className="text-lg font-semibold text-slate-900 hover:text-brand-800">{lead.name}</p>
        <p className="text-xs text-slate-500">
          {STAGE_META[lead.stage].label} · {lead.summary}
        </p>
      </Link>
      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
        {lead.nextAction?.dueAt ? (
          <p>
            Next: <b className="text-slate-800">{lead.nextAction.title}</b> · {relativeDay(lead.nextAction.dueAt).toLowerCase()}
          </p>
        ) : (
          <p className="text-amber-700">No next step planned — call today.</p>
        )}
        {top && (
          <p className="mt-1.5">
            Best fit: <Link to={`/properties/${top.property.id}`} className="font-medium text-slate-800 hover:underline">{top.property.title}</Link> · {formatINR(top.property.price)}
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={waLink(lead.phone)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800">
          <MessageCircle className="h-4 w-4" /> Message
        </a>
        <a href={`tel:${lead.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <Phone className="h-4 w-4" /> Call
        </a>
        {top && (
          <button onClick={() => setSharing(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Send className="h-4 w-4" /> Send match
          </button>
        )}
      </div>
      {sharing && top && <ShareDialog lead={{ id: lead.id, name: lead.name, phone: lead.phone }} propertyIds={[top.property.id]} onClose={() => setSharing(false)} />}
    </Tile>
  );
}

const STEPS = ['Offer', 'Approval', 'Agreed', 'Booked', 'Paid'];

/** Each deal on the road to money, as a five-step track. */
function DealsTile({ deals, className }: { deals?: Deal[]; className?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const summary = useQuery({ queryKey: ['deals-summary'], queryFn: () => api.get<{ negotiating: { value: number }; bookedThisMonth: { count: number; value: number }; dueSoon: { amount: number }[] }>('/deals/summary') });
  const list = (deals ?? []).slice(0, 4);
  const value = (deals ?? []).reduce((s, d) => s + (d.agreedPrice ?? d.currentPrice), 0);
  const stepOf = (d: Deal) => (d.status === 'negotiating' ? 1 : d.status === 'approval' ? 2 : d.status === 'approved' ? 3 : d.payments.every((p) => p.status === 'paid') ? 5 : 4);
  return (
    <Tile className={className}>
      <TileHead label={`Deals in motion · ${formatINR(value)}`} right={<Link to="/deals" className="text-xs font-medium text-brand-700 hover:underline">All deals →</Link>} />
      {!list.length ? (
        <p className="py-8 text-center text-sm text-slate-400">No negotiations yet. Start one from a customer's page.</p>
      ) : (
        <ul className="space-y-4">
          {list.map((d) => {
            const step = stepOf(d);
            const stuck = d.status === 'approval';
            return (
              <li key={d.id}>
                <button onClick={() => setOpen(d.id)} className="grid w-full grid-cols-[88px_1fr] items-center gap-3 text-left sm:grid-cols-[96px_1fr_110px]">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">{formatINR(d.agreedPrice ?? d.currentPrice)}</span>
                    <span className="block truncate text-[11px] text-slate-400">{d.lead?.name}</span>
                  </span>
                  <span className="flex gap-1">
                    {STEPS.map((s, i) => (
                      <span key={s} title={s} className={clsx('h-2 flex-1 rounded-full', i < step - 1 ? 'bg-brand-600' : i === step - 1 ? (stuck ? 'bg-amber-400' : 'bg-brand-400') : 'bg-slate-100')} />
                    ))}
                  </span>
                  <span className={clsx('hidden truncate text-right text-[11px] sm:block', stuck ? 'font-medium text-amber-700' : 'text-slate-500')}>
                    {d.status === 'booked' ? `${Math.round((d.paid / (d.agreedPrice ?? 1)) * 100)}% paid` : DEAL_STATUS_LABEL[d.status]}
                  </span>
                </button>
              </li>
            );
          })}
          <li className="grid grid-cols-[88px_1fr] gap-3 sm:grid-cols-[96px_1fr_110px]">
            <span />
            <span className="flex gap-1 text-[9px] uppercase tracking-wide text-slate-400">
              {STEPS.map((s) => (
                <span key={s} className="flex-1 text-center">
                  {s}
                </span>
              ))}
            </span>
          </li>
        </ul>
      )}
      {summary.data && (
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
          {[
            ['Negotiating', formatINR(summary.data.negotiating.value) || '—'],
            ['Booked this month', summary.data.bookedThisMonth.count ? formatINR(summary.data.bookedThisMonth.value) : '—'],
            ['Due in 30 days', summary.data.dueSoon.length ? formatINR(summary.data.dueSoon.reduce((t, p) => t + p.amount, 0)) : '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] text-slate-400">{k}</p>
              <p className="text-sm font-semibold text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      )}
      {open && <DealDrawer id={open} onClose={() => setOpen(null)} />}
    </Tile>
  );
}

/** Things owed to customers: overdue first, then today's calls, then anyone with no plan. */
function FollowUps({ d, className }: { d?: Day; className?: string }) {
  const [doing, setDoing] = useState<AgendaItem | null>(null);
  const items = [...(d?.overdue ?? []), ...(d?.today ?? []).filter((a) => a.type !== 'site_visit')].slice(0, 5);
  // New leads waiting for a first call come right after what's overdue or due.
  const fresh = (d?.newLeads ?? []).slice(0, Math.max(0, 6 - items.length));
  const gaps = (d?.noNextStep ?? []).slice(0, Math.max(0, 6 - items.length - fresh.length));
  return (
    <Tile dark className={className}>
      <TileHead dark label="Follow-ups" right={d && d.overdue.length > 0 && <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-medium text-rose-200">{d.overdue.length} overdue</span>} />
      <ul className="space-y-3">
        {items.map((a) => {
          const late = new Date(a.scheduledAt) < new Date();
          return (
            <li key={a.id} className="flex items-start gap-3">
              <button onClick={() => setDoing(a)} className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/30 text-transparent transition hover:border-lime-300 hover:text-lime-300" aria-label={`Mark done: ${a.title}`}>
                <Check className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.lead ? <Link to={`/leads/${a.lead.id}`} className="hover:underline">{ACTIVITY_LABEL[a.type]} {a.lead.name}</Link> : a.title}</p>
                <p className="truncate text-[11px] text-white/50">{a.title}</p>
              </div>
              <span className={clsx('shrink-0 text-[11px]', late ? 'font-medium text-rose-300' : 'text-white/50')}>{late ? relativeDay(a.scheduledAt) : formatTime(a.scheduledAt)}</span>
            </li>
          );
        })}
        {fresh.map((l) => (
          <li key={l.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-400/20 text-[10px] font-bold text-sky-200">N</span>
            <div className="min-w-0 flex-1">
              <Link to={`/leads/${l.id}`} className="block truncate text-sm font-medium hover:underline">
                {l.name}
              </Link>
              <p className="truncate text-[11px] text-white/50">New lead · first call</p>
            </div>
            <a href={`tel:${l.phone}`} className="shrink-0 text-[11px] font-medium text-lime-300 hover:underline">
              Call
            </a>
          </li>
        ))}
        {gaps.map((l) => (
          <li key={l.id} className="flex items-start gap-3">
            <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md border border-dashed border-white/20" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.name}</p>
              <p className="truncate text-[11px] text-white/50">No next step · {STAGE_META[l.stage].label}</p>
            </div>
            <Link to={`/leads/${l.id}`} className="shrink-0 text-[11px] font-medium text-lime-300 hover:underline">
              Plan
            </Link>
          </li>
        ))}
        {!items.length && !gaps.length && <li className="py-6 text-center text-sm text-white/50">All caught up.</li>}
      </ul>
      {doing?.lead && <CompleteDialog id={doing.id} type={doing.type} title={doing.title} leadId={doing.lead.id} leadName={doing.lead.name} properties={doing.properties} onClose={() => setDoing(null)} />}
    </Tile>
  );
}

/** One strong, unsent match, big enough to act on. */
function MatchOfTheDay({ matches, className }: { matches?: Match[]; className?: string }) {
  const [sharing, setSharing] = useState(false);
  const leads = useQuery({ queryKey: ['leads', 'phones'], queryFn: () => api.get<{ items: Lead[] }>('/leads?open=true&limit=300'), enabled: !!matches?.length });
  const m = matches?.[0];
  if (!m) return null;
  const lead = leads.data?.items.find((l) => l.id === m.lead.id);
  const others = (matches ?? []).slice(1, 4);
  return (
    <section className={clsx('overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-card', className)}>
      <div className="grid md:grid-cols-[320px_1fr]">
        <div className="relative">
          <PropertyCover property={m.property} className="h-48 w-full md:h-full" iconSize="h-14 w-14" />
          <span className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-sm">
            <Sparkles className="h-3 w-3 text-ai-600" /> Match of the day
          </span>
        </div>
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold tracking-tight text-slate-900">
              {m.property.title} <span className="ml-1 text-brand-700">{formatINR(m.property.price)}</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              A {m.fit} fit for <Link to={`/leads/${m.lead.id}`} className="font-medium text-slate-800 hover:underline">{m.lead.name}</Link>, and you haven't sent it yet.
            </p>
            <div className="mt-2">
              <Reasons reasons={m.reasons} max={3} />
            </div>
            {others.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {others.map((o) => (
                  <Link key={o.lead.id + o.property.id} to={`/leads/${o.lead.id}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200">
                    {o.lead.name} · {o.property.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 md:w-48">
            <button disabled={!lead} onClick={() => setSharing(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
              <Send className="h-4 w-4" /> Send to {m.lead.name.split(' ')[0]}
            </button>
            <Link to={`/properties/${m.property.id}`} className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
              View listing
            </Link>
          </div>
        </div>
      </div>
      {sharing && lead && <ShareDialog lead={{ id: lead.id, name: lead.name, phone: lead.phone }} propertyIds={[m.property.id]} onClose={() => setSharing(false)} />}
    </section>
  );
}
