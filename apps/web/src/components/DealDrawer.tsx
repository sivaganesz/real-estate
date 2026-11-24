import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, Lock, ShieldCheck, Undo2 } from 'lucide-react';
import { DEAL_STATUS_LABEL, formatINR, relativeDay } from '@estate/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DEAL_STEPS, DEAL_TONE, PAYMENT_MODES, dealStep, fromLakhs, type Deal } from '../lib/deals';
import { NextStepNote, StepTrack } from './DealSteps';
import { Badge, Button, Drawer, ErrorNote, Field, Input, PageLoader, SectionTitle, Select, Textarea } from './ui';
import { PropertyCover } from './PropertyCard';
import { useToast } from './toast';

/**
 * Everything about one deal, with only the next sensible actions shown:
 * negotiate → agree a price (or get it approved) → book → collect → register.
 */
export function DealDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['deal', id], queryFn: () => api.get<{ deal: Deal }>(`/deals/${id}`), select: (d) => d.deal });
  const d = q.data;
  return (
    <Drawer open onClose={onClose} title={d ? `${d.lead?.name} · ${d.code}` : 'Deal'} width="max-w-xl">
      {!d ? <PageLoader /> : <DealBody d={d} />}
    </Drawer>
  );
}

function useAct(d: Deal) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object; msg?: string }) => api.post<{ deal: Deal; needsApproval?: boolean; closedRivals?: number }>(`/deals/${d.id}/${path}`, body ?? {}),
    onSuccess: (r, v) => {
      for (const k of ['deal', 'deals', 'deals-waiting', 'deals-summary', 'lead', 'leads', 'board', 'property', 'properties', 'timeline']) void qc.invalidateQueries({ queryKey: [k] });
      toast(r.needsApproval ? 'Sent for approval' : r.closedRivals ? `${v.msg ?? 'Done'} · closed ${r.closedRivals} other negotiation${r.closedRivals > 1 ? 's' : ''}` : v.msg ?? 'Done');
    },
  });
}

function DealBody({ d }: { d: Deal }) {
  const { can, user } = useAuth();
  const act = useAct(d);
  const open = ['negotiating', 'approval', 'approved'].includes(d.status);
  return (
    <div className="space-y-5">
      {d.property && (
        <Link to={`/properties/${d.property.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 hover:border-brand-300">
          <PropertyCover property={{ type: d.property.type as never, media: d.property.media, title: d.property.title }} className="h-14 w-16 rounded-lg" iconSize="h-5 w-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{d.property.title}</p>
            <p className="text-xs text-slate-500">
              {d.property.code} · list {formatINR(d.listPrice)}
              {d.property.availability === 'held' && ` · on hold until ${relativeDay(d.property.heldUntil!)}`}
            </p>
          </div>
          <Badge tone={DEAL_TONE[d.status]}>{DEAL_STATUS_LABEL[d.status]}</Badge>
        </Link>
      )}
      {d.lead && (
        <p className="text-sm text-slate-600">
          Customer: <Link to={`/leads/${d.lead.id}`} className="link">{d.lead.name}</Link>
          {d.lead.owner && ` · with ${d.lead.owner}`}
        </p>
      )}

      <div className="rounded-2xl bg-slate-50 p-4">
        <StepTrack d={d} labels />
        {dealStep(d) >= 0 && (
          <p className="mt-3 text-xs text-slate-500">
            <b className="font-semibold text-slate-700">
              Step {dealStep(d) + 1} of 5 · {DEAL_STEPS[dealStep(d)].label}.
            </b>{' '}
            {DEAL_STEPS[dealStep(d)].explain}
          </p>
        )}
        <NextStepNote d={d} className="mt-3 rounded-xl bg-white px-3 py-2 text-sm" />
      </div>

      <PriceLadder d={d} />

      {d.status === 'negotiating' && <Negotiate d={d} act={act} />}
      {d.status === 'approval' && d.approval && (
        <div className="rounded-2xl border border-ai-200 bg-ai-50/60 p-4">
          <p className="text-sm text-slate-800">
            <b>{d.approval.requestedByName}</b> asked to agree <b>{formatINR(d.approval.price)}</b> ({d.approval.discountPct}% off). Needs {d.approval.level === 'admin' ? 'an admin' : 'a manager'}.
          </p>
          {d.approval.note && <p className="mt-1 text-xs text-slate-600">“{d.approval.note}”</p>}
          {can('deal.approve') && (d.approval.level !== 'admin' || user?.role === 'admin') && d.approval.requestedByName !== user?.name ? <Decide d={d} act={act} /> : <p className="mt-2 text-xs text-slate-500">Waiting for approval.</p>}
        </div>
      )}
      {d.status === 'approved' && <Book d={d} act={act} />}
      {(d.status === 'booked' || d.status === 'registered') && <Payments d={d} act={act} />}
      {d.status === 'booked' && can('deal.book') && (
        <Button variant="primary" className="w-full" icon={<ShieldCheck className="h-4 w-4" />} loading={act.isPending} onClick={() => confirm('Sale deed registered? The unit will be marked sold.') && act.mutate({ path: 'register', msg: 'Registered — unit sold' })}>
          Sale registered
        </Button>
      )}
      {d.status === 'cancelled' && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Cancelled: {d.cancelReason}</p>}
      {(open || (d.status === 'booked' && can('deal.book'))) && <Cancel d={d} act={act} />}
      <ErrorNote error={act.error} />
    </div>
  );
}

function PriceLadder({ d }: { d: Deal }) {
  return (
    <div>
      <SectionTitle>Price so far</SectionTitle>
      <ol className="space-y-2">
        <li className="flex items-center justify-between text-sm">
          <span className="text-slate-500">List price</span>
          <span className="font-medium">{formatINR(d.listPrice)}</span>
        </li>
        {d.offers.map((o, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 text-slate-600">
              <span className={clsx('mr-1.5 inline-block h-2 w-2 rounded-full', o.by === 'customer' ? 'bg-sky-400' : 'bg-brand-600')} />
              {o.by === 'customer' ? 'Customer offered' : 'We offered'} · {relativeDay(o.at)}
              {o.note && <span className="block truncate pl-3.5 text-xs text-slate-400">{o.note}</span>}
            </span>
            <span className="shrink-0 font-medium">
              {formatINR(o.amount)} <span className="text-xs text-slate-400">({Math.round(((d.listPrice - o.amount) / d.listPrice) * 1000) / 10}% off)</span>
            </span>
          </li>
        ))}
        {d.agreedPrice && (
          <li className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-brand-800">
              <CheckCircle2 className="h-4 w-4" /> Agreed {d.approval?.decidedByName && <span className="text-xs font-normal text-brand-700">by {d.approval.decidedByName}</span>}
            </span>
            <span className="font-semibold text-brand-900">
              {formatINR(d.agreedPrice)} {d.discountPct ? <span className="text-xs font-normal">({d.discountPct}% off)</span> : null}
            </span>
          </li>
        )}
        {d.approval?.decision === 'rejected' && d.status === 'negotiating' && <li className="text-xs text-rose-600">{formatINR(d.approval.price)} was not approved{d.approval.decisionNote ? `: ${d.approval.decisionNote}` : ''}.</li>}
      </ol>
    </div>
  );
}

type Act = ReturnType<typeof useAct>;

function Negotiate({ d, act }: { d: Deal; act: Act }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const lakhs = Number(amount) > 0;
  const off = lakhs ? Math.round(((d.listPrice - fromLakhs(amount)) / d.listPrice) * 1000) / 10 : 0;
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-900">Record an offer, or agree a price</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="Amount in lakhs" hint={lakhs ? `${formatINR(fromLakhs(amount))} · ${off}% off list` : undefined}>
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(d.listPrice / 100_000)} />
        </Field>
        <div className="flex items-end gap-1.5 pb-5">
          <Button size="sm" disabled={!lakhs} onClick={() => act.mutate({ path: 'offers', body: { by: 'customer', amount: fromLakhs(amount), note: note || undefined }, msg: 'Offer recorded' })}>
            They offered
          </Button>
          <Button size="sm" disabled={!lakhs} onClick={() => act.mutate({ path: 'offers', body: { by: 'us', amount: fromLakhs(amount), note: note || undefined }, msg: 'Counter recorded' })}>
            We offered
          </Button>
        </div>
      </div>
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), e.g. free car park instead of discount" />
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Button variant="primary" disabled={!lakhs} loading={act.isPending} onClick={() => act.mutate({ path: 'price', body: { price: fromLakhs(amount), note: note || undefined }, msg: 'Price agreed' })}>
          Agree at this price
        </Button>
        <Button onClick={() => act.mutate({ path: 'price', body: { price: d.listPrice }, msg: 'Agreed at list price' })}>Agree at list price</Button>
        {d.property?.availability === 'available' && (
          <Button variant="ghost" icon={<Lock className="h-3.5 w-3.5" />} onClick={() => act.mutate({ path: 'hold', body: {}, msg: 'Unit on hold' })}>
            Hold the unit
          </Button>
        )}
      </div>
      <p className="text-xs text-slate-400">Discounts within your limit are agreed at once; bigger ones go to a manager (or an admin) automatically.</p>
    </div>
  );
}

function Decide({ d, act }: { d: Deal; act: Act }) {
  const [counter, setCounter] = useState('');
  const [note, setNote] = useState('');
  return (
    <div className="mt-3 space-y-2">
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the team (optional)" />
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="primary" loading={act.isPending} onClick={() => act.mutate({ path: 'decision', body: { decision: 'approve', note: note || undefined }, msg: 'Approved' })}>
          Approve {formatINR(d.approval!.price)}
        </Button>
        <Button variant="ghost" className="text-rose-600" onClick={() => act.mutate({ path: 'decision', body: { decision: 'reject', note: note || undefined }, msg: 'Rejected' })}>
          Reject
        </Button>
        <div className="flex items-end gap-1.5">
          <Input className="w-28" inputMode="decimal" placeholder="Lakhs" value={counter} onChange={(e) => setCounter(e.target.value)} />
          <Button disabled={!Number(counter)} onClick={() => act.mutate({ path: 'decision', body: { decision: 'counter', counterPrice: fromLakhs(counter), note: note || undefined }, msg: 'Counter sent' })}>
            Counter
          </Button>
        </div>
      </div>
    </div>
  );
}

function Book({ d, act }: { d: Deal; act: Act }) {
  const { can } = useAuth();
  const r = d.bookingRequest;
  const [amount, setAmount] = useState(r ? String(r.amount / 100_000) : String(Math.round(((d.agreedPrice ?? d.listPrice) * 0.1) / 100_000 * 100) / 100));
  const [mode, setMode] = useState<string>(r?.mode ?? 'Cheque');
  const [reference, setReference] = useState(r?.reference ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const manager = can('deal.book');
  const body = { amount: fromLakhs(amount), mode, reference: reference || undefined, date };
  return (
    <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
      <p className="text-sm font-medium text-slate-900">Booking</p>
      {r && (
        <p className="text-xs text-slate-600">
          {r.requestedByName} recorded {formatINR(r.amount)} by {r.mode}
          {r.reference && ` (${r.reference})`} {relativeDay(r.requestedAt).toLowerCase()}.{manager ? ' Check it and confirm.' : ' Waiting for a manager to confirm.'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Booking amount (lakhs)">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Received by">
          <Select value={mode} onChange={(e) => setMode(e.target.value)}>
            {PAYMENT_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Reference">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque no., UTR" />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      {manager ? (
        <Button variant="primary" className="w-full" disabled={!Number(amount)} loading={act.isPending} onClick={() => act.mutate({ path: 'book', body, msg: 'Booked' })}>
          Confirm booking at {formatINR(d.agreedPrice)}
        </Button>
      ) : (
        <Button variant="primary" className="w-full" disabled={!Number(amount) || !!r} loading={act.isPending} onClick={() => act.mutate({ path: 'booking-request', body, msg: 'Sent to your manager to confirm' })}>
          {r ? 'Waiting for confirmation' : 'Send for confirmation'}
        </Button>
      )}
      <p className="text-xs text-slate-500">Confirming marks the unit booked and the customer Booked, starts the payment plan, and closes other negotiations on this unit.</p>
    </div>
  );
}

function Payments({ d, act }: { d: Deal; act: Act }) {
  const { can } = useAuth();
  const total = d.agreedPrice ?? 0;
  return (
    <div>
      <SectionTitle>
        Payments <span className="font-normal text-slate-500">· {formatINR(d.paid)} of {formatINR(total)} received</span>
      </SectionTitle>
      <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${total ? (d.paid / total) * 100 : 0}%` }} />
      </div>
      <ul className="space-y-2">
        {d.payments.map((p, i) => {
          const late = p.status === 'due' && new Date(p.dueDate) < new Date();
          return (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm">
              <span className={clsx('h-2.5 w-2.5 rounded-full', p.status === 'paid' ? 'bg-emerald-500' : late ? 'bg-rose-500' : 'bg-slate-300')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-slate-800">{p.label}</span>
                <span className={clsx('text-xs', late ? 'text-rose-600' : 'text-slate-400')}>{p.status === 'paid' ? `Paid ${relativeDay(p.paidAt!)}${p.reference ? ` · ${p.reference}` : ''}` : `${late ? 'Overdue — was due' : 'Due'} ${relativeDay(p.dueDate)}`}</span>
              </span>
              <span className="font-medium">{formatINR(p.amount)}</span>
              {p.status === 'due' && can('deal.book') && (
                <Button size="sm" variant="ghost" onClick={() => act.mutate({ path: `payments/${i}`, body: {}, msg: `${p.label} received` })}>
                  Received
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {d.registeredAt && <p className="mt-3 text-sm text-emerald-700">Sale registered {relativeDay(d.registeredAt)}.</p>}
    </div>
  );
}

function Cancel({ d, act }: { d: Deal; act: Act }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [then, setThen] = useState<'negotiation' | 'lost'>('negotiation');
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600">
        <Undo2 className="h-3.5 w-3.5" /> {d.status === 'booked' ? 'Cancel this booking' : 'Drop this negotiation'}
      </button>
    );
  return (
    <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? e.g. loan rejected, chose another unit" />
      <Select value={then} onChange={(e) => setThen(e.target.value as 'negotiation' | 'lost')}>
        <option value="negotiation">Keep working with the customer</option>
        <option value="lost">Close the customer as lost</option>
      </Select>
      <div className="flex gap-2">
        <Button variant="danger" disabled={reason.trim().length < 3} loading={act.isPending} onClick={() => act.mutate({ path: 'cancel', body: { reason, then }, msg: d.status === 'booked' ? 'Booking cancelled; unit released' : 'Negotiation dropped' })}>
          Confirm
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Back
        </Button>
      </div>
    </div>
  );
}
