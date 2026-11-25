import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertTriangle, ChevronDown, ClipboardCheck, Handshake, Wallet } from 'lucide-react';
import { formatINR, relativeDay } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DEAL_STEPS, dealStep, type Deal } from '../lib/deals';
import { PageHeader } from '../components/Layout';
import { EmptyState, PageLoader } from '../components/ui';
import { DealDrawer } from '../components/DealDrawer';
import { NextStepNote, StepTrack } from '../components/DealSteps';
import { PropertyCover } from '../components/PropertyCard';
import { useAssistantPage } from '../ai/assistant';

type Summary = {
  negotiating: { count: number; value: number };
  bookedThisMonth: { count: number; value: number };
  dueSoon: { deal: string; dealId: string; customer: string; label: string; amount: number; dueDate: string; overdue: boolean }[];
  stuck: { id: string; code: string; customer: string; property: string; days: number }[];
};

/**
 * Deals, explained by their steps: what a deal is, where each one stands, and
 * what has to happen next — with anything waiting on the viewer first.
 */
export function Deals() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');
  const [step, setStep] = useState<number | null>(null);
  const [showDropped, setShowDropped] = useState(false);
  useAssistantPage({ page: 'Deals', suggestions: ['What approvals are waiting for me?', 'Which payments are due this month?', 'Which deals have not moved in a week?'] });

  const list = useQuery({ queryKey: ['deals', 'all'], queryFn: () => api.get<{ items: Deal[] }>('/deals') });
  const summary = useQuery({ queryKey: ['deals-summary'], queryFn: () => api.get<Summary>('/deals/summary') });
  const waiting = useQuery({ queryKey: ['deals-waiting'], queryFn: () => api.get<{ approvals: Deal[]; bookings: Deal[] }>('/deals/waiting'), enabled: can('deal.approve') });
  const open = (id: string) => setParams({ open: id });

  const all = list.data?.items ?? [];
  const live = all.filter((d) => d.status !== 'cancelled');
  const dropped = all.filter((d) => d.status === 'cancelled');
  const shown = step === null ? live : live.filter((d) => dealStep(d) === step);
  const s = summary.data;
  const overdue = s?.dueSoon.filter((p) => p.overdue) ?? [];
  const actions = [
    ...(waiting.data?.approvals ?? []).map((d) => ({ key: `a${d.id}`, id: d.id, tag: 'Price approval', tone: 'bg-ai-50 text-ai-700', who: d.lead?.name, what: d.property?.title, amount: `${formatINR(d.approval?.price)} · ${d.approval?.discountPct}% off`, cta: 'Approve or counter' })),
    ...(waiting.data?.bookings ?? []).map((d) => ({ key: `b${d.id}`, id: d.id, tag: 'Confirm booking', tone: 'bg-emerald-50 text-emerald-700', who: d.lead?.name, what: d.property?.title, amount: `${formatINR(d.bookingRequest?.amount)} received`, cta: 'Check and confirm' })),
    ...overdue.map((p) => ({ key: `p${p.dealId}${p.label}`, id: p.dealId, tag: 'Payment overdue', tone: 'bg-rose-50 text-rose-700', who: p.customer, what: `${p.label}, was due ${relativeDay(p.dueDate).toLowerCase()}`, amount: formatINR(p.amount), cta: 'Chase or mark received' })),
  ];

  return (
    <>
      <PageHeader title="Deals" subtitle="A deal is one customer buying one property. Every deal moves through the five steps below — tap a step to see the deals in it." />

      {/* The five steps, each with how many deals are in it. */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {DEAL_STEPS.map((st, i) => {
          const n = live.filter((d) => dealStep(d) === i).length;
          const on = step === i;
          return (
            <button key={st.label} onClick={() => setStep(on ? null : i)} aria-label={`Step ${i + 1}: ${st.label}, ${n} ${n === 1 ? 'deal' : 'deals'}`} aria-pressed={on} className={clsx('relative flex flex-col rounded-2xl border p-3 text-left transition', on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200/80 bg-white hover:border-slate-300', i === 4 && 'col-span-2 sm:col-span-1')}>
              <span className="flex w-full items-center gap-2">
                <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold', on ? 'bg-white/15' : 'bg-slate-100 text-slate-600')}>{i + 1}</span>
                <span className="ml-auto text-right">
                  <span className="text-2xl font-semibold leading-none">{list.data ? n : '–'}</span>
                  <span className={clsx('ml-1 text-[11px]', on ? 'text-white/60' : 'text-slate-400')}>{n === 1 ? 'deal' : 'deals'}</span>
                </span>
              </span>
              <span className="mt-2 text-sm font-semibold">{st.label}</span>
              <span className={clsx('mt-0.5 text-[11px] leading-snug', on ? 'text-white/70' : 'text-slate-500')}>{st.explain}</span>
              {i < 4 && <span className="absolute -right-1.5 top-1/2 z-10 hidden h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-slate-200 bg-white sm:block" />}
            </button>
          );
        })}
      </div>

      {actions.length > 0 && (
        <section className="mb-4 rounded-3xl border border-ai-100 bg-white p-4 shadow-card">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClipboardCheck className="h-4 w-4 text-ai-600" /> Needs your action · {actions.length}
          </p>
          <ul className="divide-y divide-slate-100">
            {actions.map((a) => (
              <li key={a.key}>
                <button onClick={() => open(a.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50">
                  <span className={clsx('w-32 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold', a.tone)}>{a.tag}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <b className="font-medium text-slate-900">{a.who}</b> <span className="text-slate-500">· {a.what}</span>
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{a.amount}</span>
                  <span className="hidden w-40 text-right text-xs font-medium text-brand-700 sm:block">{a.cta} →</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s && (
        <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/80 sm:grid-cols-4">
          {[
            ['Being negotiated', formatINR(s.negotiating.value), `${s.negotiating.count} deal${s.negotiating.count === 1 ? '' : 's'} not yet booked`],
            ['Booked this month', s.bookedThisMonth.count ? formatINR(s.bookedThisMonth.value) : '₹0', `${s.bookedThisMonth.count} booking${s.bookedThisMonth.count === 1 ? '' : 's'}`],
            ['Payments due in 30 days', formatINR(s.dueSoon.reduce((t, p) => t + p.amount, 0)), `${s.dueSoon.length} instalment${s.dueSoon.length === 1 ? '' : 's'}`],
            ['Overdue payments', String(overdue.length), overdue.length ? 'Chase these first' : 'None — good'],
          ].map(([k, v, hint], i) => (
            <div key={k} className="bg-white px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                {i === 3 && overdue.length > 0 ? <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> : i === 2 ? <Wallet className="h-3.5 w-3.5 text-slate-400" /> : null}
                {k}
              </p>
              <p className={clsx('text-lg font-semibold', i === 3 && overdue.length ? 'text-rose-600' : i === 1 ? 'text-emerald-700' : 'text-slate-900')}>{v}</p>
              <p className="text-[11px] text-slate-400">{hint}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{step === null ? `All open deals · ${shown.length}` : `Step ${step + 1}: ${DEAL_STEPS[step].label} · ${shown.length}`}</p>
        {step !== null && (
          <button onClick={() => setStep(null)} className="text-xs font-medium text-brand-700 hover:underline">
            Show all
          </button>
        )}
      </div>

      {list.isLoading ? (
        <PageLoader />
      ) : !shown.length ? (
        <EmptyState icon={<Handshake className="h-5 w-5" />} title={step === null ? 'No deals yet' : `No deals at “${DEAL_STEPS[step].label}”`} body="A deal starts on a customer's page: pick a property from their shortlist and tap Negotiate." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((d) => (
            <DealCard key={d.id} d={d} showOwner={can('lead.viewAll')} onOpen={() => open(d.id)} />
          ))}
        </div>
      )}

      {dropped.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowDropped(!showDropped)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
            <ChevronDown className={clsx('h-3.5 w-3.5 transition', showDropped && 'rotate-180')} /> Dropped deals · {dropped.length}
          </button>
          {showDropped && (
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {dropped.map((d) => (
                <DealCard key={d.id} d={d} showOwner={can('lead.viewAll')} onOpen={() => open(d.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {openId && <DealDrawer id={openId} onClose={() => setParams({})} />}
      <p className="mt-6 text-center text-xs text-slate-400">
        How much discount each role can give without approval is set by an admin in <Link to="/settings" className="link">Settings</Link>.
      </p>
    </>
  );
}

/** One deal: who and what, the price, where it is in the five steps, and what happens next. */
function DealCard({ d, showOwner, onOpen }: { d: Deal; showOwner: boolean; onOpen: () => void }) {
  const price = d.agreedPrice ?? d.currentPrice;
  const off = d.listPrice ? Math.round(((d.listPrice - price) / d.listPrice) * 1000) / 10 : 0;
  return (
    <button onClick={onOpen} className={clsx('flex flex-col gap-3 rounded-3xl border border-slate-200/80 bg-white p-4 text-left shadow-card transition hover:border-slate-300 hover:shadow-pop', d.status === 'cancelled' && 'opacity-60')}>
      <div className="flex w-full items-start gap-3">
        {d.property && <PropertyCover property={{ type: d.property.type as never, media: d.property.media, title: d.property.title }} className="h-12 w-14 shrink-0 rounded-xl" iconSize="h-4 w-4" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {d.lead?.name} <span className="font-normal text-slate-400">· {d.code}</span>
          </p>
          <p className="truncate text-xs text-slate-500">
            {d.property?.title}
            {showOwner && d.lead?.owner && ` · ${d.lead.owner}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-slate-900">{formatINR(price)}</p>
          <p className="text-[11px] text-slate-400">{off > 0 ? `${off}% below list` : 'at list price'}</p>
        </div>
      </div>
      <StepTrack d={d} labels className="w-full" />
      <NextStepNote d={d} className="w-full rounded-xl bg-slate-50 px-3 py-2" />
    </button>
  );
}
