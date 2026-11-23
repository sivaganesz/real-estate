import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, ArrowRight, CalendarCheck2, PhoneIncoming, Sparkles, UserX } from 'lucide-react';
import { STAGE_META } from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { Lead } from '../lib/leads';
import { PageHeader } from '../components/Layout';
import { Avatar, Badge, Button, Card, EmptyState, PageLoader, SectionTitle } from '../components/ui';
import { LeadRow } from './Leads';
import { AgendaCard, type AgendaItem } from '../features/activities';
import { useAssistant, useAssistantPage } from '../ai/assistant';
import { todaySlots } from '../slots-today';

type Day = { overdue: AgendaItem[]; today: AgendaItem[]; doneToday: number; newLeads: Lead[]; noNextStep: Lead[] };
type Team = { overdue: { ownerId: string; name: string; count: number; oldestDays: number }[]; team: { id: string; name: string; open: number; stuck: number; overdue: number; noNextStep: number; booked: number }[] };

/**
 * Today: the first screen of the day. What to do, in the order to do it —
 * overdue, today's plan, new leads to call, customers with no next step.
 */
export function Today() {
  const { user, can } = useAuth();
  const assistant = useAssistant();
  const manager = can('team.view');
  useAssistantPage({
    page: 'Today',
    suggestions: manager
      ? ['Which leads require immediate attention?', 'Which sales executives have overdue follow-ups?', 'Where are deals getting stuck?', 'Which projects have low inventory movement?']
      : ['Plan my day', 'Which of my leads need attention?', 'Show my leads without follow-ups'],
  });
  const day = useQuery({ queryKey: ['today'], queryFn: () => api.get<Day>('/activities/today'), refetchInterval: 120_000 });
  const team = useQuery({ queryKey: ['team'], queryFn: () => api.get<Team>('/activities/team'), enabled: manager });
  const unassigned = useQuery({ queryKey: ['leads', 'unassigned-count'], queryFn: () => api.get<{ total: number }>('/leads?ownerId=none&open=true&limit=1'), enabled: manager });

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const d = day.data;
  const brief = d
    ? [
        d.overdue.length && `${d.overdue.length} overdue`,
        d.today.length && `${d.today.length} planned today`,
        d.newLeads.length && `${d.newLeads.length} new lead${d.newLeads.length > 1 ? 's' : ''} to call`,
        d.noNextStep.length && `${d.noNextStep.length} without a next step`,
      ]
        .filter(Boolean)
        .join(' · ') || 'All clear — nothing overdue and every customer has a next step.'
    : '';

  return (
    <>
      <PageHeader
        title={`${greet}, ${user?.name.split(' ')[0]}`}
        subtitle={brief}
        actions={
          <Button variant="ai" icon={<Sparkles className="h-4 w-4" />} onClick={() => assistant.ask(manager ? 'Give me a short brief of the team for today: who needs help, what is stuck, and what I should do first.' : 'Plan my day: what should I do first and why?')}>
            {manager ? 'Brief me' : 'Plan my day'}
          </Button>
        }
      />

      {manager && (
        <div className="mb-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="p-4">
            <SectionTitle action={<Link to="/leads?view=board" className="link text-xs">Pipeline →</Link>}>Team</SectionTitle>
            {!team.data ? (
              <PageLoader />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className="pb-2 font-medium">Person</th>
                      <th className="pb-2 text-center font-medium">Open</th>
                      <th className="pb-2 text-center font-medium">Overdue</th>
                      <th className="pb-2 text-center font-medium">No next step</th>
                      <th className="pb-2 text-center font-medium">Stuck</th>
                      <th className="pb-2 text-center font-medium">Booked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {team.data.team.map((t) => {
                      const od = team.data!.overdue.find((o) => o.ownerId === t.id);
                      return (
                        <tr key={t.id}>
                          <td className="py-2">
                            <Link to={`/leads?owner=${t.id}`} className="flex items-center gap-2 font-medium text-slate-800 hover:text-brand-800">
                              <Avatar name={t.name} size="sm" /> {t.name}
                            </Link>
                          </td>
                          <td className="text-center">{t.open}</td>
                          <td className={clsx('text-center', od?.count && 'font-semibold text-rose-600')} title={od ? `Oldest ${od.oldestDays} days` : undefined}>
                            {od?.count ?? 0}
                          </td>
                          <td className={clsx('text-center', t.noNextStep > 2 && 'font-semibold text-amber-600')}>{t.noNextStep}</td>
                          <td className={clsx('text-center', t.stuck > 2 && 'font-semibold text-amber-600')}>{t.stuck}</td>
                          <td className="text-center text-emerald-700">{t.booked}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <div className="space-y-4">
            {!!unassigned.data?.total && (
              <Link to="/leads?owner=none" className="card flex items-center gap-3 p-4 transition hover:shadow-pop">
                <span className="rounded-xl bg-amber-50 p-2 text-amber-700">
                  <UserX className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{unassigned.data.total} unassigned leads</span>
                  <span className="text-xs text-slate-500">New enquiries waiting for an owner</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            )}
            {todaySlots.managerSide.map((S, i) => (
              <S key={i} />
            ))}
          </div>
        </div>
      )}

      {day.isLoading || !d ? (
        <PageLoader />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0 space-y-6">
            {d.overdue.length > 0 && (
              <section>
                <SectionTitle>
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <AlertTriangle className="h-4 w-4" /> Overdue
                  </span>
                </SectionTitle>
                <div className="space-y-2">
                  {d.overdue.map((a) => (
                    <AgendaCard key={a.id} a={a} overdue showOwner={manager} />
                  ))}
                </div>
              </section>
            )}
            <section>
              <SectionTitle action={<Link to="/calendar" className="link text-xs">Calendar →</Link>}>
                <span className="flex items-center gap-1.5">
                  <CalendarCheck2 className="h-4 w-4 text-brand-700" /> Today {d.doneToday > 0 && <Badge tone="green">{d.doneToday} done</Badge>}
                </span>
              </SectionTitle>
              {d.today.length ? (
                <div className="space-y-2">
                  {d.today.map((a) => (
                    <AgendaCard key={a.id} a={a} showOwner={manager} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Nothing else planned today" body="Use the gaps: call a new lead or someone without a next step." />
              )}
            </section>
            {todaySlots.main.map((S, i) => (
              <S key={i} />
            ))}
          </div>

          <div className="min-w-0 space-y-6">
            <section>
              <SectionTitle>
                <span className="flex items-center gap-1.5">
                  <PhoneIncoming className="h-4 w-4 text-sky-600" /> New leads to call
                </span>
              </SectionTitle>
              {d.newLeads.length ? (
                <Card className="divide-y divide-slate-100">
                  {d.newLeads.map((l) => (
                    <LeadRow key={l.id} l={l} showOwner={manager} compact />
                  ))}
                </Card>
              ) : (
                <p className="text-sm text-slate-500">All new leads have been contacted.</p>
              )}
            </section>
            <section>
              <SectionTitle>No next step planned</SectionTitle>
              {d.noNextStep.length ? (
                <Card className="divide-y divide-slate-100">
                  {d.noNextStep.map((l) => (
                    <Link key={l.id} to={`/leads/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                      <Avatar name={l.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{l.name}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {STAGE_META[l.stage].label} · {l.summary}
                        </span>
                      </span>
                      <span className="text-xs font-medium text-brand-700">Plan →</span>
                    </Link>
                  ))}
                </Card>
              ) : (
                <p className="text-sm text-slate-500">Every open customer has a next step.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}

export { qs };
