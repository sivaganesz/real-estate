import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, ClipboardCheck, Handshake, Hourglass, MessageCircle, Phone, ShieldCheck, Wallet } from 'lucide-react';
import { DEAL_STATUS_LABEL, formatINR, relativeDay } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { waLink } from '../lib/leads';
import { DEAL_STEPS, DEAL_TONE, dealStep, type Deal } from '../lib/deals';
import { PageHeader } from '../components/Layout';
import { Badge, Button, EmptyState, PageLoader } from '../components/ui';
import { DealDrawer } from '../components/DealDrawer';
import { NextStepNote, PriceTrack, StepTrack } from '../components/DealSteps';
import { PropertyCover } from '../components/PropertyCard';
import { useAssistantPage } from '../ai/assistant';

type Summary = {
  negotiating: { count: number; value: number };
  bookedThisMonth: { count: number; value: number };
  dueSoon: { deal: string; dealId: string; customer: string; label: string; amount: number; dueDate: string; overdue: boolean }[];
  stuck: { id: string; code: string; customer: string; property: string; days: number }[];
};

/** Tabs over the list: everything open, each of the five steps, and dropped deals. */
type Tab = 'all' | 0 | 1 | 2 | 3 | 4 | 'dropped';

/**
 * Deals: four numbers to start, what is waiting on you, then every deal with
 * its step and price. On wide screens the chosen deal sits beside the list;
 * "Open deal" brings up the drawer where offers, approvals and payments happen.
 */
export function Deals() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const openId = params.get('open');
  const [tab, setTab] = useState<Tab>('all');
  const [picked, setPicked] = useState<string | null>(null);
  const wide = useMedia('(min-width: 1280px)');
  useAssistantPage({ page: 'Deals', suggestions: ['What approvals are waiting for me?', 'Which payments are due this month?', 'Which deals have not moved in a week?'] });

  const list = useQuery({ queryKey: ['deals', 'all'], queryFn: () => api.get<{ items: Deal[] }>('/deals') });
  const summary = useQuery({ queryKey: ['deals-summary'], queryFn: () => api.get<Summary>('/deals/summary') });
  const waiting = useQuery({ queryKey: ['deals-waiting'], queryFn: () => api.get<{ approvals: Deal[]; bookings: Deal[] }>('/deals/waiting'), enabled: can('deal.approve') });
  const open = (id: string) => setParams({ open: id });

  const all = list.data?.items ?? [];
  const live = all.filter((d) => d.status !== 'cancelled');
  const dropped = all.filter((d) => d.status === 'cancelled');
  const inTab = (t: Tab) => (t === 'all' ? live : t === 'dropped' ? dropped : live.filter((d) => dealStep(d) === t));
  const shown = inTab(tab);
  const selected = shown.find((d) => d.id === picked) ?? shown[0];
  const s = summary.data;
  const overdue = s?.dueSoon.filter((p) => p.overdue) ?? [];
  const mine = (waiting.data?.approvals.length ?? 0) + (waiting.data?.bookings.length ?? 0);

  const actions = [
    ...(waiting.data?.approvals ?? []).map((d) => ({ key: `a${d.id}`, id: d.id, tag: 'Price approval', tone: 'bg-ai-50 text-ai-700', who: d.lead?.name, what: d.property?.title, amount: `${formatINR(d.approval?.price)} · ${d.approval?.discountPct}% off`, cta: 'Approve or counter' })),
    ...(waiting.data?.bookings ?? []).map((d) => ({ key: `b${d.id}`, id: d.id, tag: 'Confirm booking', tone: 'bg-emerald-50 text-emerald-700', who: d.lead?.name, what: d.property?.title, amount: `${formatINR(d.bookingRequest?.amount)} received`, cta: 'Check and confirm' })),
    ...overdue.map((p) => ({ key: `p${p.dealId}${p.label}`, id: p.dealId, tag: 'Payment overdue', tone: 'bg-rose-50 text-rose-700', who: p.customer, what: `${p.label}, was due ${relativeDay(p.dueDate).toLowerCase()}`, amount: formatINR(p.amount), cta: 'Chase or mark received' })),
  ];

  const tabs: { key: Tab; label: string }[] = [{ key: 'all', label: 'All' }, ...DEAL_STEPS.map((st, i) => ({ key: i as Tab, label: st.short === 'Done' ? 'Registered' : st.short })), ...(dropped.length ? [{ key: 'dropped' as Tab, label: 'Dropped' }] : [])];

  return (
    <>
      <PageHeader title="Deals" subtitle="Every customer buying a property, from the first offer to registration." />

      {/* Four numbers; each one narrows the list below. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={<Handshake className="h-4 w-4" />} label="Negotiating" tone="text-amber-700" glow="bg-amber-100/70" value={s ? formatINR(s.negotiating.value) : '–'} hint={s ? `${s.negotiating.count} deal${s.negotiating.count === 1 ? '' : 's'} not booked yet` : ' '} on={tab === 0} onClick={() => setTab(tab === 0 ? 'all' : 0)} />
        <Tile
          icon={<Hourglass className="h-4 w-4" />}
          label="Waiting for approval"
          tone="text-ai-700"
          glow="bg-ai-100/60"
          value={list.data ? inTab(1).length : '–'}
          hint={can('deal.approve') ? (mine ? `${mine} waiting for you` : 'Nothing waiting for you') : 'With a manager or admin'}
          on={tab === 1}
          onClick={() => setTab(tab === 1 ? 'all' : 1)}
        />
        <Tile icon={<ShieldCheck className="h-4 w-4" />} label="Booked this month" tone="text-emerald-700" glow="bg-emerald-100/60" value={s ? formatINR(s.bookedThisMonth.value) || '₹0' : '–'} hint={s ? `${s.bookedThisMonth.count} booking${s.bookedThisMonth.count === 1 ? '' : 's'}` : ' '} on={tab === 3} onClick={() => setTab(tab === 3 ? 'all' : 3)} />
        <Tile
          icon={<Wallet className="h-4 w-4" />}
          label="Payments due · 30 days"
          tone={overdue.length ? 'text-rose-700' : 'text-brand-700'}
          glow={overdue.length ? 'bg-rose-100/60' : 'bg-brand-100/60'}
          value={s ? formatINR(s.dueSoon.reduce((t, p) => t + p.amount, 0)) : '–'}
          hint={s ? `${s.dueSoon.length} instalment${s.dueSoon.length === 1 ? '' : 's'}${overdue.length ? ` · ${overdue.length} overdue` : ''}` : ' '}
          hintTone={overdue.length ? 'text-rose-600' : undefined}
          on={false}
          onClick={() => setTab(3)}
        />
      </div>

      {actions.length > 0 && (
        <section className="mt-4 rounded-3xl border border-ai-100 bg-white p-4 shadow-card">
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClipboardCheck className="h-4 w-4 text-ai-600" /> Needs your action
            <span className="rounded-full bg-ai-50 px-1.5 text-xs font-medium text-ai-700">{actions.length}</span>
          </p>
          <ul className="divide-y divide-slate-100">
            {actions.map((a) => (
              <li key={a.key}>
                <button onClick={() => open(a.id)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50">
                  <span className={clsx('w-32 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold', a.tone)}>{a.tag}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <b className="font-medium text-slate-900">{a.who}</b> <span className="text-slate-500">· {a.what}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{a.amount}</span>
                  <span className="hidden w-40 text-right text-xs font-medium text-brand-700 sm:block">{a.cta} →</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card">
          <div className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-100 px-3" role="tablist" aria-label="Deal steps">
            {tabs.map((t) => {
              const n = list.data ? inTab(t.key).length : null;
              return (
                <button
                  key={String(t.key)}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  title={typeof t.key === 'number' ? DEAL_STEPS[t.key].explain : undefined}
                  className={clsx('-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-3 text-sm font-medium transition', tab === t.key ? 'border-brand-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800')}
                >
                  {typeof t.key === 'number' && <span className={clsx('flex h-4 w-4 items-center justify-center rounded-full text-[10px]', tab === t.key ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-500')}>{t.key + 1}</span>}
                  {t.label}
                  {n != null && <span className={clsx('rounded-full px-1.5 text-xs', tab === t.key ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500')}>{n}</span>}
                </button>
              );
            })}
          </div>

          {list.isLoading ? (
            <div className="p-6">
              <PageLoader />
            </div>
          ) : !shown.length ? (
            <div className="p-6">
              <EmptyState icon={<Handshake className="h-5 w-5" />} title={tab === 'all' ? 'No deals yet' : tab === 'dropped' ? 'Nothing dropped' : `No deals at “${DEAL_STEPS[tab].label}”`} body="A deal starts on a customer's page: pick a property from their shortlist and tap Negotiate." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shown.map((d) => (
                <li key={d.id}>
                  <DealRow d={d} showOwner={can('lead.viewAll')} selected={wide && selected?.id === d.id} onClick={() => (wide ? setPicked(d.id) : open(d.id))} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {wide && selected && <DealPreview key={selected.id} d={selected} onOpen={() => open(selected.id)} />}
      </div>

      {openId && <DealDrawer id={openId} onClose={() => setParams({})} />}
      <p className="mt-6 text-center text-xs text-slate-400">
        How much discount each role can give without approval is set by an admin in{' '}
        <Link to="/settings" className="link">
          Settings
        </Link>
        .
      </p>
    </>
  );
}

function Tile({ icon, label, value, hint, tone, glow, on, onClick, hintTone }: { icon: ReactNode; label: string; value: ReactNode; hint: string; tone: string; glow: string; on: boolean; onClick: () => void; hintTone?: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={clsx('relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-slate-300', on ? 'border-transparent ring-2 ring-brand-300' : 'border-slate-200/80')}>
      <span className={clsx('pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full', glow)} />
      <span className={clsx('relative flex items-center gap-1.5 text-sm font-medium', tone)}>
        {icon}
        {label}
      </span>
      <span className="relative mt-1 block text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{value}</span>
      <span className={clsx('relative mt-0.5 block truncate text-xs', hintTone ?? 'text-slate-500')}>{hint}</span>
    </button>
  );
}

/** One deal in the list: property, customer, where it is in the five steps, and the price. */
function DealRow({ d, showOwner, selected, onClick }: { d: Deal; showOwner: boolean; selected: boolean; onClick: () => void }) {
  const price = d.agreedPrice ?? d.currentPrice;
  const off = d.listPrice ? Math.round(((d.listPrice - price) / d.listPrice) * 1000) / 10 : 0;
  return (
    <button onClick={onClick} aria-current={selected || undefined} className={clsx('flex w-full items-center gap-3 border-l-[3px] py-3 pl-[13px] pr-4 text-left transition', selected ? 'border-brand-600 bg-brand-50/50' : 'border-transparent hover:bg-slate-50', d.status === 'cancelled' && 'opacity-60')}>
      {d.property && <PropertyCover property={{ type: d.property.type as never, media: d.property.media, title: d.property.title }} className="h-11 w-12 shrink-0 rounded-xl" iconSize="h-4 w-4" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">
          {d.lead?.name} <span className="font-mono text-[11px] font-normal text-slate-400">{d.code}</span>
        </span>
        <span className="block truncate text-xs text-slate-500">
          {d.property?.title}
          {showOwner && d.lead?.owner && ` · ${d.lead.owner}`}
        </span>
      </span>
      {/* The step bar, and the current step in words (all five names don't fit a row). */}
      <span className="hidden w-36 shrink-0 md:block">
        <StepTrack d={d} />
        <span className={clsx('mt-1 block truncate text-[11px]', d.status === 'cancelled' ? 'text-slate-400' : 'font-medium text-slate-600')}>
          {dealStep(d) < 0 ? 'Dropped' : `${dealStep(d) + 1} · ${DEAL_STEPS[dealStep(d)].label}`}
        </span>
      </span>
      <span className="w-24 shrink-0 text-right">
        <span className="block text-sm font-semibold tabular-nums text-slate-900">{formatINR(price)}</span>
        <span className="block text-[11px] text-slate-400">{off > 0 ? `${off}% below list` : 'at list price'}</span>
      </span>
    </button>
  );
}

/** The chosen deal beside the list: where it stands, the money, and what happens next. */
function DealPreview({ d, onOpen }: { d: Deal; onOpen: () => void }) {
  const price = d.agreedPrice ?? d.currentPrice;
  const off = d.listPrice ? Math.round(((d.listPrice - price) / d.listPrice) * 1000) / 10 : 0;
  const paidShare = d.paid + d.due > 0 ? (d.paid / (d.paid + d.due)) * 100 : 0;
  const nextDue = d.payments.find((p) => p.status === 'due');
  const btn = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900';
  return (
    <aside className="sticky top-20 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-card" aria-label={`${d.lead?.name ?? 'Deal'} ${d.code}, preview`}>
      {d.property && <PropertyCover property={{ type: d.property.type as never, media: d.property.media, title: d.property.title }} className="h-28 w-full" iconSize="h-8 w-8" />}
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-900">{d.lead?.name}</p>
            <p className="truncate text-sm text-slate-500">
              <span className="font-mono text-xs">{d.code}</span> · {d.property?.title}
            </p>
          </div>
          <Badge tone={DEAL_TONE[d.status]} className="shrink-0">
            {DEAL_STATUS_LABEL[d.status]}
          </Badge>
        </div>
        <StepTrack d={d} labels className="mt-4" />
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{d.agreedPrice ? 'Agreed price' : 'On the table'}</p>
        <p className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900">{formatINR(price)}</span>
          <span className="text-xs text-slate-500">{off > 0 ? `${off}% below ${formatINR(d.listPrice)}` : `list ${formatINR(d.listPrice)}`}</span>
        </p>
        {d.status !== 'cancelled' && <PriceTrack d={d} />}
      </div>

      {(d.status === 'booked' || d.status === 'registered') && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Payments</p>
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${formatINR(d.paid)} paid of ${formatINR(d.paid + d.due)}`}>
            <span className="h-full bg-emerald-500" style={/* scan-ok: share paid */ { width: `${paidShare}%` }} />
          </div>
          <p className="mt-1.5 flex justify-between text-xs text-slate-500">
            <span>
              <b className="font-semibold text-emerald-700">{formatINR(d.paid)}</b> paid
            </span>
            <span>{formatINR(d.due)} to come</span>
          </p>
          {nextDue && (
            <p className={clsx('mt-1 text-xs', new Date(nextDue.dueDate) < new Date() ? 'font-medium text-rose-600' : 'text-slate-500')}>
              Next: {nextDue.label}, {formatINR(nextDue.amount)} {new Date(nextDue.dueDate) < new Date() ? 'was due' : 'due'} {relativeDay(nextDue.dueDate).toLowerCase()}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-slate-100 px-5 py-4">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Next step</p>
        <NextStepNote d={d} className="rounded-xl bg-slate-50 px-3 py-2 text-sm" />
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 p-4">
        <Button variant="primary" className="flex-1" onClick={onOpen} icon={<ArrowRight className="h-4 w-4" />}>
          Open deal
        </Button>
        {d.lead?.phone && (
          <>
            <a href={`tel:${d.lead.phone}`} className={btn} aria-label={`Call ${d.lead.name}`} title="Call">
              <Phone className="h-4 w-4" />
            </a>
            <a href={waLink(d.lead.phone)} target="_blank" rel="noreferrer" className={btn} aria-label={`WhatsApp ${d.lead.name}`} title="WhatsApp">
              <MessageCircle className="h-4 w-4" />
            </a>
          </>
        )}
      </div>
      {d.lead && (
        <Link to={`/leads/${d.lead.id}`} className="flex items-center justify-center gap-1 border-t border-slate-100 py-3 text-sm font-medium text-brand-700 hover:bg-slate-50">
          Customer's page <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </aside>
  );
}

function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const fn = () => setOn(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return on;
}
