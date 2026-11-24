import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { ACTIVITY_LABEL, formatTime } from '@estate/shared';
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

/** A week at a time: a grid of days on wide screens, a day strip and list on phones. */
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
  const items = (q.data?.items ?? []).filter((a) => a.status !== 'cancelled');
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY)), [weekStart]);
  const byDay = (d: Date) => items.filter((a) => startOfDay(new Date(a.scheduledAt)).getTime() === d.getTime()).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const today = startOfDay(new Date()).getTime();

  const move = (weeks: number) => {
    const next = new Date(weekStart.getTime() + weeks * 7 * DAY);
    setWeekStart(next);
    setDay(weeks === 0 ? startOfDay(new Date()) : next);
  };
  const goToday = () => {
    setWeekStart(mondayOf(new Date()));
    setDay(startOfDay(new Date()));
  };

  const planned = items.filter((a) => a.status === 'planned');
  const tally = (['talk', 'visit', 'meeting', 'task'] as Kind[])
    .map((k) => [k, planned.filter((a) => kindOf(a.type) === k).length] as const)
    .filter(([, n]) => n)
    .map(([k, n]) => `${n} ${k === 'talk' ? (n === 1 ? 'call' : 'calls') : k === 'visit' ? (n === 1 ? 'site visit' : 'site visits') : k === 'meeting' ? (n === 1 ? 'meeting' : 'meetings') : n === 1 ? 'task' : 'tasks'}`)
    .join(' · ');
  const range = `${days[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={q.data ? (tally ? `Still to do this week: ${tally}.` : 'Nothing left to do this week.') : ' '}
        actions={
          <>
            {team && (
              <Select className="w-auto" value={owner} onChange={(e) => setOwner(e.target.value)}>
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-full border border-slate-200 bg-white p-0.5">
          <button onClick={() => move(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={goToday} className="h-8 rounded-full px-3 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Today
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
        <PageLoader />
      ) : (
        <>
          {/* Wide screens: the whole week side by side. */}
          <div className="hidden overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card lg:grid lg:grid-cols-7">
            {days.map((d, i) => {
              const list = byDay(d);
              const isToday = d.getTime() === today;
              const past = d.getTime() < today;
              return (
                <div key={d.toISOString()} className={clsx('flex min-h-[440px] flex-col', i > 0 && 'border-l border-slate-100', past && 'bg-slate-50/60')}>
                  <div className="group flex items-center justify-between gap-1 px-3 pb-2 pt-3">
                    <span className={clsx('text-[11px] font-semibold uppercase tracking-[0.08em]', isToday ? 'text-brand-700' : 'text-slate-400')}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                    {!past && (
                      <button onClick={() => setAdding(d)} className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100" aria-label={`Add on ${d.toLocaleDateString('en-IN', { weekday: 'long' })}`}>
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold', isToday ? 'bg-slate-900 text-white' : past ? 'text-slate-400' : 'text-slate-800')}>{d.getDate()}</span>
                  </div>
                  <div className="flex-1 space-y-1.5 px-2 pb-3">
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
          <div className="lg:hidden">
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
    <button onClick={onOpen} className={clsx('block w-full rounded-xl border px-2 py-1.5 text-left transition hover:shadow-sm', k.block, done && 'opacity-50', late && 'border-l-[3px] border-l-rose-400')}>
      <span className="flex items-center gap-1 text-[11px] font-semibold">
        {done && <Check className="h-3 w-3" />}
        {formatTime(a.scheduledAt)}
        <span className="truncate font-normal opacity-70">· {ACTIVITY_LABEL[a.type]}</span>
      </span>
      <span className="block truncate text-xs font-medium text-slate-900">{a.lead?.name ?? a.title}</span>
      <span className="block truncate text-[11px] opacity-70">{a.properties[0]?.title ?? a.title}</span>
      {showOwner && a.owner && <span className="block truncate text-[10px] opacity-60">{a.owner.name}</span>}
    </button>
  );
}
