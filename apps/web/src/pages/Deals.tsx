import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, Handshake } from 'lucide-react';
import { DEAL_STATUS_LABEL, formatINR, relativeDay, type DealStatus } from '@estate/shared';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DEAL_TONE, type Deal } from '../lib/deals';
import { PageHeader } from '../components/Layout';
import { Badge, Card, EmptyState, PageLoader, SectionTitle, Segmented, Stat } from '../components/ui';
import { DealDrawer } from '../components/DealDrawer';
import { useAssistantPage } from '../ai/assistant';

type Summary = {
  negotiating: { count: number; value: number };
  bookedThisMonth: { count: number; value: number };
  dueSoon: { deal: string; dealId: string; customer: string; label: string; amount: number; dueDate: string; overdue: boolean }[];
  stuck: { id: string; code: string; customer: string; property: string; days: number }[];
};

const TABS: Record<'active' | 'booked' | 'closed', DealStatus[]> = {
  active: ['negotiating', 'approval', 'approved'],
  booked: ['booked'],
  closed: ['registered', 'cancelled'],
};

export function Deals() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');
  const [tab, setTab] = useState<keyof typeof TABS>('active');
  useAssistantPage({ page: 'Deals', suggestions: ['What approvals are waiting for me?', 'Which payments are due this month?', 'Which deals have not moved in a week?'] });
  const list = useQuery({ queryKey: ['deals', tab], queryFn: () => api.get<{ items: Deal[] }>(`/deals${qs({ status: TABS[tab] })}`) });
  const summary = useQuery({ queryKey: ['deals-summary'], queryFn: () => api.get<Summary>('/deals/summary') });
  const waiting = useQuery({ queryKey: ['deals-waiting'], queryFn: () => api.get<{ approvals: Deal[]; bookings: Deal[] }>('/deals/waiting'), enabled: can('deal.approve') });
  const open = (id: string) => setParams({ open: id });
  const s = summary.data;
  const waitingItems = [...(waiting.data?.approvals ?? []), ...(waiting.data?.bookings ?? [])];

  return (
    <>
      <PageHeader title="Deals" subtitle="Negotiations, approvals, bookings and payments." />
      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Being negotiated" value={formatINR(s.negotiating.value)} hint={`${s.negotiating.count} deals`} />
          <Stat label="Booked this month" value={formatINR(s.bookedThisMonth.value)} hint={`${s.bookedThisMonth.count} bookings`} tone="green" />
          <Stat label="Due in 30 days" value={formatINR(s.dueSoon.reduce((t, p) => t + p.amount, 0))} hint={`${s.dueSoon.length} payments`} />
          <Stat label="Overdue payments" value={s.dueSoon.filter((p) => p.overdue).length} tone={s.dueSoon.some((p) => p.overdue) ? 'red' : undefined} hint={s.stuck.length ? `${s.stuck.length} deals idle 5+ days` : 'No idle deals'} />
        </div>
      )}

      {waitingItems.length > 0 && (
        <Card className="mb-5 border-ai-200 p-4">
          <SectionTitle>Waiting for you</SectionTitle>
          <ul className="divide-y divide-slate-100">
            {waitingItems.map((d) => (
              <li key={d.id}>
                <button onClick={() => open(d.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50">
                  <Badge tone={d.status === 'approval' ? 'ai' : 'green'}>{d.status === 'approval' ? 'Price approval' : 'Confirm booking'}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <b>{d.lead?.name}</b> · {d.property?.title}
                  </span>
                  <span className="text-sm font-medium">{d.status === 'approval' ? `${formatINR(d.approval?.price)} (${d.approval?.discountPct}% off)` : formatINR(d.agreedPrice)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {s && s.dueSoon.some((p) => p.overdue) && (
        <Card className="mb-5 border-rose-200 p-4">
          <SectionTitle>
            <span className="flex items-center gap-1.5 text-rose-700">
              <AlertTriangle className="h-4 w-4" /> Overdue payments
            </span>
          </SectionTitle>
          {s.dueSoon
            .filter((p) => p.overdue)
            .map((p) => (
              <button key={p.dealId + p.label} onClick={() => open(p.dealId)} className="flex w-full items-center justify-between py-1.5 text-left text-sm hover:text-brand-800">
                <span>
                  <b>{p.customer}</b> — {p.label}, due {relativeDay(p.dueDate).toLowerCase()}
                </span>
                <span className="font-medium">{formatINR(p.amount)}</span>
              </button>
            ))}
        </Card>
      )}

      <Segmented
        className="mb-3"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'active', label: 'In progress' },
          { value: 'booked', label: 'Booked' },
          { value: 'closed', label: 'Closed' },
        ]}
      />
      {list.isLoading ? (
        <PageLoader />
      ) : !list.data?.items.length ? (
        <EmptyState icon={<Handshake className="h-5 w-5" />} title={tab === 'active' ? 'No negotiations right now' : 'Nothing here yet'} body="Start one from a customer's page, on a property they like." />
      ) : (
        <Card className="divide-y divide-slate-100">
          {list.data.items.map((d) => (
            <button key={d.id} onClick={() => open(d.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {d.lead?.name} <span className="font-normal text-slate-400">· {d.code}</span>
                </p>
                <p className="truncate text-xs text-slate-500">
                  {d.property?.title}
                  {can('lead.viewAll') && d.lead?.owner && ` · ${d.lead.owner}`}
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{formatINR(d.agreedPrice ?? d.currentPrice)}</p>
                <p className="text-xs text-slate-400">list {formatINR(d.listPrice)}</p>
              </div>
              {d.status === 'booked' && <p className="hidden w-28 text-right text-xs text-slate-500 md:block">{Math.round((d.paid / (d.agreedPrice ?? 1)) * 100)}% paid</p>}
              <Badge tone={DEAL_TONE[d.status]} className={clsx('w-32 justify-center')}>
                {DEAL_STATUS_LABEL[d.status]}
              </Badge>
            </button>
          ))}
        </Card>
      )}
      {openId && <DealDrawer id={openId} onClose={() => setParams({})} />}
      <p className="mt-6 text-center text-xs text-slate-400">
        Approval limits are set by an admin in <Link to="/settings" className="link">Settings</Link>.
      </p>
    </>
  );
}
