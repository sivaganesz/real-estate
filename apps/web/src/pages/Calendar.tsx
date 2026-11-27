import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlarmClock, CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, MapPin, Plus, Sun } from 'lucide-react';
import { ACTIVITY_LABEL, formatTime, relativeDay } from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth, useUsers } from '../lib/auth';
import { PageHeader } from '../components/Layout';
import { Button, Drawer, EmptyState, PageLoader, Select } from '../components/ui';
import { AgendaCard, NewAppointment, type AgendaItem } from '../features/activities';
import { useAssistantPage } from '../ai/assistant';

const DAY = 86_400_000;
const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
/** Weeks run Monday to Sunday. */
const mondayOf = (d: Date) => {
  const x = startOfDay(d);
  return new Date(x.getTime() - ((x.getDay() + 6) % 7) * DAY);
};

type Kind = 'talk' | 'visit' | 'meeting' | 'task';
const kindOf = (t: string): Kind => (t === 'site_visit' ? 'visit' : t === 'meeting' ? 'meeting' : t === 'task' || t === 'note' ? 'task' : 'talk');
const KIND: Record<Kind, { label: string; dot: string; block: string }> = {
  talk: { label: 'Calls & messages', dot: 'bg-brand-500', block: 'border-brand-200 bg-brand-50 text-brand-900' },
  visit: { label: 'Site visits', dot: 'bg-ai-500', block: 'border-ai-200 bg-ai-50 text-ai-700' },
  meeting: { label: 'Meetings', dot: 'bg-amber-400', block: 'border-amber-200 bg-amber-50 text-amber-900' },
  task: { label: 'Tasks', dot: 'bg-slate-400', block: 'border-slate-200 bg-slate-50 text-slate-700' },
};

/** A week at a time: four numbers, today's agenda beside the week grid on wide screens; a day strip and list on phones. */
export function Calendar() {
  const { can } = useAuth();
  const users = useUsers();
  const team = can('activity.viewAll');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [owner, setOwner] = useState('');
  const [open, setOpen] = useState<AgendaItem | null>(null);
  // false: closed; null: new with no day chosen; a Date: new on that day.
  const [adding, setAdding] = useState<Date | null | false>(false);
  useAssistantPage({ page: 'Calendar', suggestions: ['What does my week look like?', 'Move my 4 pm call to tomorrow morning', 'Which site visits are planned this week?'] });

  const end = new Date(weekStart.getTime() + 7 * DAY);
  const q = useQuery({
    queryKey: ['agenda', weekStart.toISOString(), owner],
    queryFn: () => api.get<{ items: AgendaItem[] }>(`/activities/agenda${qs({ from: weekStart.toISOString(), to: end.toISOString(), owner: owner || undefined, done: 'true' })}`),
  });
  // Today and anything overdue, whichever week is on screen.
  const todayStart = startOfDay(new Date());
  const todayQ = useQuery({
    queryKey: ['agenda', 'today', todayStart.toISOString(), owner],
    queryFn: () => api.get<{ items: AgendaItem[] }>(`/activities/agenda${qs({ from: todayStart.toISOString(), to: new Date(todayStart.getTime() + DAY).toISOString(), owner: owner || undefined, done: 'true' })}`),
  });
  const lateQ = useQuery({
    queryKey: ['agenda', 'overdue', todayStart.toISOString(), owner],
    queryFn: () => api.get<{ items: AgendaItem[] }>(`/activities/agenda${qs({ from: new Date(todayStart.getTime() - 30 * DAY).toISOString(), to: todayStart.toISOString(), owner: owner || undefined })}`),
  });
  const items = (q.data?.items ?? []).filter((a) => a.status !== 'cancelled');
  const todayItems = (todayQ.data?.items ?? []).filter((a) => a.status !== 'cancelled');
  const overdue = (lateQ.data?.items ?? []).filter((a) => a.status === 'planned');
  // Missed earlier today counts as overdue too.
  const missedToday = todayItems.filter((a) => a.status === 'planned' && new Date(a.scheduledAt) < new Date()).length;
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY)), [weekStart]);
  const byDay = (d: Date) => items.filter((a) => startOfDay(new Date(a.scheduledAt)).getTime() === d.getTime()).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const today = todayStart.getTime();

  const move = (weeks: number) => {
    const next = new Date(weekStart.getTime() + weeks * 7 * DAY);
    setWeekStart(next);
    setDay(weeks === 0 ? startOfDay(new Date()) : next);
  };
  const goToday = () => {
    setWeekStart(mondayOf(new Date()));
    setDay(startOfDay(new Date()));
  };

  const planned = items.filter((a) => a.status === 'planned' && new Date(a.scheduledAt) >= new Date());
  const count = (k: Kind) => planned.filter((a) => kindOf(a.type) === k).length;
  const todayLeft = todayItems.filter((a) => a.status === 'planned').length;
  const todayDone = todayItems.filter((a) => a.status === 'done').length;
  const range = `${days[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const thisWeek = weekStart.getTime() === mondayOf(new Date()).getTime();

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Calls, site visits and meetings: today first, then the week."
        actions={
          <>
            {team && (
              <Select className="w-auto" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Whose calendar">
                <option value="">Whole team</option>
                {users.data
                  ?.filter((u) => u.role !== 'admin')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </Select>
            )}
            <Button variant="primary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setAdding(null)}>
              New appointment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Sun className="h-4 w-4" />} label="Today" tone="text-brand-700" glow="bg-brand-100/60" value={todayQ.data ? todayLeft : '–'} hint={todayQ.data ? `left to do · ${todayDone} done` : ' '} />
        <Tile icon={<AlarmClock className="h-4 w-4" />} label="Overdue" tone={overdue.length + missedToday ? 'text-rose-700' : 'text-slate-600'} glow={overdue.length + missedToday ? 'bg-rose-100/60' : 'bg-slate-100'} value={lateQ.data ? overdue.length + missedToday : '–'} hint={overdue.length + missedToday ? 'Missed: do or move them' : 'Nothing missed'} />
        <Tile icon={<CalendarDays className="h-4 w-4" />} label={thisWeek ? 'Left this week' : 'Planned that week'} tone="text-amber-700" glow="bg-amber-100/70" value={q.data ? planned.length : '–'} hint={q.data ? `${count('talk')} calls · ${count('meeting')} meetings` : ' '} />
        <Tile icon={<MapPin className="h-4 w-4" />} label="Site visits" tone="text-ai-700" glow="bg-ai-100/60" value={q.data ? count('visit') : '–'} hint={thisWeek ? 'still to come this week' : 'planned that week'} />
      </div>

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Today's agenda: overdue first, then the day on a time rail with "now". */}
        <TodayCard items={todayItems} overdue={overdue} loading={todayQ.isLoading} showOwner={team && !owner} onOpen={setOpen} onAdd={() => setAdding(startOfDay(new Date()))} />

        <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5">
              <button onClick={() => move(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={goToday} className="h-8 rounded-full px-3 text-xs font-medium text-slate-700 hover:bg-slate-100">
                This week
              </button>
              <button onClick={() => move(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-800">{range}</p>
            <div className="ml-auto hidden flex-wrap gap-3 text-[11px] text-slate-500 sm:flex">
              {(Object.keys(KIND) as Kind[]).map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={clsx('h-2 w-2 rounded-full', KIND[k].dot)} /> {KIND[k].label}
                </span>
              ))}
            </div>
          </div>

          {q.isLoading ? (
            <div className="p-6">
              <PageLoader />
            </div>
          ) : (
            <>
              {/* Wide screens: the whole week side by side. */}
              <div className="hidden lg:grid lg:grid-cols-7">
                {days.map((d, i) => {
                  const list = byDay(d);
                  const isToday = d.getTime() === today;
                  const past = d.getTime() < today;
                  return (
                    <div key={d.toISOString()} className={clsx('flex min-h-[420px] flex-col', i > 0 && 'border-l border-slate-100', past && 'bg-slate-50/60', isToday && 'bg-brand-50/30')}>
                      <div className="group flex items-center justify-between gap-1 px-2.5 pb-2 pt-3">
                        <span className={clsx('text-[11px] font-semibold uppercase tracking-[0.08em]', isToday ? 'text-brand-700' : 'text-slate-400')}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                        {!past && (
                          <button onClick={() => setAdding(d)} className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100" aria-label={`Add on ${d.toLocaleDateString('en-IN', { weekday: 'long' })}`}>
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                        <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold', isToday ? 'bg-brand-700 text-white' : past ? 'text-slate-400' : 'text-slate-800')}>{d.getDate()}</span>
                      </div>
                      <div className="flex-1 space-y-1.5 px-1.5 pb-3">
                        {list.map((a) => (
                          <EventBlock key={a.id} a={a} showOwner={team && !owner} onOpen={() => setOpen(a)} />
                        ))}
                        {!list.length && !past && (
                          <button onClick={() => setAdding(d)} className="mt-4 w-full rounded-xl border border-dashed border-slate-200 py-3 text-[11px] text-slate-400 transition hover:border-slate-300 hover:text-slate-600">
                            Free · add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
          {/* Phones and tablets: pick a day, see its plan. */}
          <div className="p-3 lg:hidden">
            <div className="mb-3 grid grid-cols-7 gap-1">
              {days.map((d) => {
                const n = byDay(d).filter((a) => a.status === 'planned').length;
                const on = d.getTime() === day.getTime();
                const isToday = d.getTime() === today;
                return (
                  <button key={d.toISOString()} onClick={() => setDay(d)} className={clsx('flex flex-col items-center rounded-2xl py-2 transition', on ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-200/80')}>
                    <span className={clsx('text-[10px] uppercase', on ? 'text-white/60' : isToday ? 'font-semibold text-brand-700' : 'text-slate-400')}>{d.toLocaleDateString('en-IN', { weekday: 'narrow' })}</span>
                    <span className="text-base font-semibold leading-tight">{d.getDate()}</span>
                    <span className={clsx('mt-0.5 h-1.5 w-1.5 rounded-full', n ? (on ? 'bg-lime-300' : 'bg-brand-500') : 'bg-transparent')} />
                  </button>
                );
              })}
            </div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              {day.getTime() >= today && (
                <button onClick={() => setAdding(day)} className="flex items-center gap-1 text-xs font-medium text-brand-700">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              )}
            </div>
            {byDay(day).length ? (
              <div className="space-y-2">
                {byDay(day).map((a) => (
                  <div key={a.id} className={clsx(a.status !== 'planned' && 'opacity-60')}>
                    <AgendaCard a={a} overdue={a.status === 'planned' && new Date(a.scheduledAt) < new Date()} showOwner={team} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing planned" body="Plan calls and visits from a customer's page, or ask the assistant." />
            )}
          </div>
            </>
          )}
        </section>
      </div>

      {adding !== false && <NewAppointment day={adding ?? undefined} onClose={() => setAdding(false)} />}

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? `${ACTIVITY_LABEL[open.type]} · ${new Date(open.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}` : ''} width="max-w-md">
        {open && <AgendaCard a={items.find((x) => x.id === open.id) ?? open} overdue={open.status === 'planned' && new Date(open.scheduledAt) < new Date()} showOwner={team} />}
      </Drawer>
    </>
  );
}

/** One activity in the week grid: time, what, who — colour by kind; faded when done. */
function EventBlock({ a, showOwner, onOpen }: { a: AgendaItem; showOwner: boolean; onOpen: () => void }) {
  const k = KIND[kindOf(a.type)];
  const done = a.status !== 'planned';
  const late = !done && new Date(a.scheduledAt) < new Date();
  return (
    <button onClick={onOpen} aria-label={`${formatTime(a.scheduledAt)} ${ACTIVITY_LABEL[a.type]} with ${a.lead?.name ?? a.title}`} className={clsx('block w-full rounded-xl border px-2 py-1.5 text-left transition hover:shadow-sm', k.block, done && 'opacity-50', late && 'border-l-[3px] border-l-rose-400')}>
      {/* The colour says the kind (see the key); the time stays on one line in a narrow day. */}
      <span className="flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold" title={ACTIVITY_LABEL[a.type]}>
        {done && <Check className="h-3 w-3 shrink-0" />}
        {formatTime(a.scheduledAt)}
      </span>
      <span className="block truncate text-xs font-medium text-slate-900">{a.lead?.name ?? a.title}</span>
      <span className="block truncate text-[11px] opacity-70">{a.properties[0]?.title ?? a.title}</span>
      {showOwner && a.owner && <span className="block truncate text-[10px] opacity-60">{a.owner.name}</span>}
    </button>
  );
}

function Tile({ icon, label, value, hint, tone, glow }: { icon: ReactNode; label: string; value: ReactNode; hint: string; tone: string; glow: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
      <span className={clsx('pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full', glow)} />
      <span className={clsx('relative flex items-center gap-1.5 text-sm font-medium', tone)}>
        {icon}
        {label}
      </span>
      <span className="relative mt-1 block text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</span>
      <span className="relative mt-0.5 block truncate text-xs text-slate-500">{hint}</span>
    </div>
  );
}

/** Today, as a list on a time rail: overdue first, done ones faded, a "now" line between past and coming. */
function TodayCard({ items, overdue, loading, showOwner, onOpen, onAdd }: { items: AgendaItem[]; overdue: AgendaItem[]; loading: boolean; showOwner: boolean; onOpen: (a: AgendaItem) => void; onAdd: () => void }) {
  const now = Date.now();
  const sorted = [...items].sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const nowAt = sorted.findIndex((a) => +new Date(a.scheduledAt) > now);
  // Under 1024px the week card below already lists today, so this card keeps only what's overdue (or hides).
  return (
    <section className={clsx('overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card', !overdue.length && 'hidden lg:block')}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            <span className="lg:hidden">Overdue</span>
            <span className="hidden lg:inline">Today</span>
          </p>
          <p className="hidden text-xs text-slate-500 lg:block">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button onClick={onAdd} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {loading ? (
        <div className="p-6">
          <PageLoader />
        </div>
      ) : (
        <div className="max-h-[560px] overflow-y-auto p-3">
          {overdue.length > 0 && (
            <div className="mb-3 rounded-2xl bg-rose-50/70 p-2 ring-1 ring-inset ring-rose-100">
              <p className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-600">Overdue · {overdue.length}</p>
              {overdue.map((a) => (
                <AgendaRow key={a.id} a={a} late showOwner={showOwner} onOpen={() => onOpen(a)} />
              ))}
            </div>
          )}
          {!sorted.length ? (
            <p className="hidden rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400 lg:block">Nothing planned today.</p>
          ) : (
            <ol className="relative hidden space-y-1 lg:block before:absolute before:bottom-3 before:left-[58px] before:top-3 before:w-px before:bg-slate-100">
              {sorted.map((a, i) => (
                <li key={a.id}>
                  {i === nowAt && <NowLine />}
                  <AgendaRow a={a} showOwner={showOwner} onOpen={() => onOpen(a)} />
                </li>
              ))}
              {nowAt === -1 && (
                <li>
                  <NowLine />
                </li>
              )}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

function NowLine() {
  return (
    <div className="relative my-1 flex items-center gap-2 pl-[52px]" aria-label="Now">
      <span className="h-3 w-3 rounded-full bg-rose-500 ring-4 ring-rose-100" />
      <span className="h-px flex-1 bg-rose-300" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-500">Now</span>
    </div>
  );
}

/** One item on the rail: time, a coloured dot for its kind, who and what. Opens the full card with Done and Reschedule. */
function AgendaRow({ a, late, showOwner, onOpen }: { a: AgendaItem; late?: boolean; showOwner: boolean; onOpen: () => void }) {
  const k = KIND[kindOf(a.type)];
  const done = a.status !== 'planned';
  const missed = !done && new Date(a.scheduledAt) < new Date();
  return (
    <button onClick={onOpen} className={clsx('relative flex w-full items-start gap-3 rounded-xl px-1.5 py-2 text-left transition hover:bg-slate-50', done && 'opacity-55')}>
      <span className={clsx('w-11 shrink-0 whitespace-nowrap pt-0.5 text-right text-[11px] font-semibold tabular-nums', missed ? 'text-rose-600' : 'text-slate-700')} title={missed ? 'Missed' : undefined}>
        {late ? new Date(a.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : formatTime(a.scheduledAt).replace(' ', '')}
      </span>
      <span className={clsx('relative z-10 mt-1 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full ring-4 ring-white', done ? 'bg-slate-300' : k.dot)} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-sm font-medium text-slate-900">
          {done && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
          <span className="truncate">{a.lead?.name ?? a.title}</span>
        </span>
        <span className="block truncate text-xs text-slate-500">
          {ACTIVITY_LABEL[a.type]} · {a.properties[0]?.title ?? a.title}
        </span>
        {showOwner && a.owner && <span className="block truncate text-[11px] text-slate-400">{a.owner.name}</span>}
      </span>
    </button>
  );
}
