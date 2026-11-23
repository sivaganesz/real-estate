import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useAuth, useUsers } from '../lib/auth';
import { PageHeader } from '../components/Layout';
import { Button, EmptyState, PageLoader, Select } from '../components/ui';
import { AgendaCard, type AgendaItem } from '../features/activities';
import { useAssistantPage } from '../ai/assistant';

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** A week at a time: a strip of days with counts, and the selected day's plan. */
export function Calendar() {
  const { can } = useAuth();
  const users = useUsers();
  const [weekStart, setWeekStart] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);
  const [owner, setOwner] = useState('');
  useAssistantPage({ page: 'Calendar', suggestions: ['What does my week look like?', 'Move my 4 pm call to tomorrow morning', 'Which site visits are planned this week?'] });

  const end = new Date(weekStart.getTime() + 7 * 86_400_000);
  const q = useQuery({
    queryKey: ['agenda', weekStart.toISOString(), owner],
    queryFn: () => api.get<{ items: AgendaItem[] }>(`/activities/agenda${qs({ from: weekStart.toISOString(), to: end.toISOString(), owner: owner || undefined, done: 'true' })}`),
  });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86_400_000)), [weekStart]);
  const byDay = (d: Date) => (q.data?.items ?? []).filter((a) => startOfDay(new Date(a.scheduledAt)).getTime() === d.getTime());
  const shown = selected ? [selected] : days;

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Calls, visits and meetings. Plan new ones from a customer's page or ask the assistant."
        actions={
          can('activity.viewAll') && (
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
          )
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" variant="ghost" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86_400_000))} aria-label="Previous week" />
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {days.map((d) => {
            const n = byDay(d).filter((a) => a.status === 'planned').length;
            const today = d.getTime() === startOfDay(new Date()).getTime();
            const on = selected?.getTime() === d.getTime();
            return (
              <button key={d.toISOString()} onClick={() => setSelected(on ? null : d)} className={clsx('rounded-xl border px-1 py-2 text-center transition', on ? 'border-brand-600 bg-brand-700 text-white' : today ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300')}>
                <p className={clsx('text-[10px] uppercase', on ? 'text-white/80' : 'text-slate-400')}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                <p className="text-lg font-semibold leading-tight">{d.getDate()}</p>
                <p className={clsx('text-[10px]', on ? 'text-white/90' : n ? 'text-brand-700' : 'text-slate-300')}>{n ? `${n} planned` : '—'}</p>
              </button>
            );
          })}
        </div>
        <Button size="sm" variant="ghost" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86_400_000))} aria-label="Next week" />
      </div>
      {q.isLoading ? (
        <PageLoader />
      ) : (
        <div className="space-y-6">
          {shown.map((d) => {
            const items = byDay(d);
            if (!items.length && !selected) return null;
            return (
              <section key={d.toISOString()}>
                <h2 className="mb-2 text-sm font-semibold text-slate-700">{d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
                {items.length ? (
                  <div className="space-y-2">
                    {items.map((a) => (
                      <div key={a.id} className={clsx(a.status !== 'planned' && 'opacity-60')}>
                        <AgendaCard a={a} overdue={a.status === 'planned' && new Date(a.scheduledAt) < new Date()} showOwner={can('activity.viewAll')} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Nothing planned" />
                )}
              </section>
            );
          })}
          {!selected && !(q.data?.items ?? []).length && <EmptyState title="A quiet week" body="Plan calls and visits from a customer's page." />}
        </div>
      )}
    </>
  );
}
