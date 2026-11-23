import { Router } from 'express';
import { z } from 'zod';
import { DEAL_STATUSES, DEAL_STATUS_LABEL, formatINR, relativeDay, type DealStatus } from '@estate/shared';
import { badRequest, parse } from '../lib/http';
import { requirePermission } from '../lib/auth';
import { Settings, getSettings } from '../models/deal';
import {
  addOffer,
  cancelDeal,
  confirmBooking,
  dealRef,
  dealSummary,
  decidePrice,
  getDeal,
  holdUnit,
  listDeals,
  proposePrice,
  recordPayment,
  registerSale,
  requestBooking,
  startDeal,
  waitingOn,
} from '../services/deals';
import { registerTools } from '../ai/tools';
import { registerIntents } from '../ai/offline';
import { callTool } from '../ai/assistant';

export const dealsRouter = Router();
export const settingsRouter = Router();

const csv = (v: unknown) => (typeof v === 'string' && v ? v.split(',') : undefined);
const Booking = z.object({ amount: z.number().positive(), date: z.string().optional().transform((s) => (s ? new Date(s) : undefined)), mode: z.enum(['Cheque', 'NEFT / RTGS', 'UPI', 'Demand draft', 'Cash']), reference: z.string().max(80).optional() });

dealsRouter.get('/', async (req, res) => {
  const status = parse(z.array(z.enum(DEAL_STATUSES)).optional(), csv(req.query.status));
  res.json({ items: await listDeals(req.actor, { status, leadId: (req.query.lead as string) || undefined }) });
});
dealsRouter.get('/waiting', async (req, res) => {
  res.json(await waitingOn(req.actor));
});
dealsRouter.get('/summary', async (req, res) => {
  res.json(await dealSummary(req.actor));
});
dealsRouter.post('/', async (req, res) => {
  const b = parse(z.object({ leadId: z.string(), propertyId: z.string(), offer: z.number().positive().optional(), note: z.string().optional() }), req.body);
  const d = await startDeal(b.leadId, b.propertyId, req.actor, b);
  res.status(201).json({ deal: await getDeal(String(d._id), req.actor) });
});
dealsRouter.get('/:id', async (req, res) => {
  res.json({ deal: await getDeal(String(req.params.id), req.actor) });
});
dealsRouter.post('/:id/offers', async (req, res) => {
  const b = parse(z.object({ by: z.enum(['customer', 'us']), amount: z.number().positive(), note: z.string().max(300).optional() }), req.body);
  await addOffer(String(req.params.id), b, req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor) });
});
dealsRouter.post('/:id/price', async (req, res) => {
  const b = parse(z.object({ price: z.number().positive(), note: z.string().max(300).optional() }), req.body);
  const r = await proposePrice(String(req.params.id), b, req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor), needsApproval: r.needsApproval });
});
dealsRouter.post('/:id/decision', async (req, res) => {
  const b = parse(z.object({ decision: z.enum(['approve', 'reject', 'counter']), counterPrice: z.number().positive().optional(), note: z.string().max(300).optional() }), req.body);
  await decidePrice(String(req.params.id), b, req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor) });
});
dealsRouter.post('/:id/hold', async (req, res) => {
  const { days } = parse(z.object({ days: z.number().int().min(1).max(30).optional() }), req.body);
  await holdUnit(String(req.params.id), days, req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor) });
});
dealsRouter.post('/:id/booking-request', async (req, res) => {
  await requestBooking(String(req.params.id), parse(Booking, req.body), req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor) });
});
dealsRouter.post('/:id/book', async (req, res) => {
  const r = await confirmBooking(String(req.params.id), parse(Booking.partial(), req.body), req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor), closedRivals: r.closedRivals });
});
dealsRouter.post('/:id/payments/:index', async (req, res) => {
  const b = parse(z.object({ paidAt: z.string().optional(), reference: z.string().max(80).optional() }), req.body);
  await recordPayment(String(req.params.id), Number(req.params.index), { paidAt: b.paidAt ? new Date(b.paidAt) : undefined, reference: b.reference }, req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor) });
});
dealsRouter.post('/:id/register', async (req, res) => {
  await registerSale(String(req.params.id), req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor) });
});
dealsRouter.post('/:id/cancel', async (req, res) => {
  const b = parse(z.object({ reason: z.string().min(3).max(300), then: z.enum(['negotiation', 'lost']).default('negotiation') }), req.body);
  await cancelDeal(String(req.params.id), b, req.actor);
  res.json({ deal: await getDeal(String(req.params.id), req.actor) });
});

settingsRouter.get('/', async (_req, res) => {
  res.json(await getSettings());
});
settingsRouter.patch('/', requirePermission('settings.manage'), async (req, res) => {
  const b = parse(z.object({ companyName: z.string().min(2).optional(), discountLimitPct: z.object({ executive: z.number().min(0).max(10), manager: z.number().min(0).max(25) }).optional(), holdDays: z.number().int().min(1).max(30).optional() }), req.body);
  if (b.discountLimitPct && b.discountLimitPct.executive > b.discountLimitPct.manager) throw badRequest('An executive limit above the manager limit makes no sense');
  await getSettings();
  res.json(await Settings.findByIdAndUpdate('org', b, { new: true }).lean());
});

// AI ---------------------------------------------------------------------------

const brief = (d: Awaited<ReturnType<typeof getDeal>>) => ({
  dealId: d.id,
  code: d.code,
  customer: d.lead?.name,
  property: d.property?.title,
  status: DEAL_STATUS_LABEL[d.status],
  listPrice: formatINR(d.listPrice),
  latestOffer: d.offers.at(-1) ? `${d.offers.at(-1)!.by === 'customer' ? 'customer' : 'us'} ${formatINR(d.offers.at(-1)!.amount)}` : null,
  agreedPrice: d.agreedPrice ? formatINR(d.agreedPrice) : null,
  discount: d.discountPct ? `${d.discountPct}%` : null,
  waitingFor: d.status === 'approval' ? `${d.approval?.level} approval of ${formatINR(d.approval?.price)}` : d.bookingRequest ? 'booking confirmation' : null,
  paid: d.paid ? formatINR(d.paid) : null,
  due: d.due ? formatINR(d.due) : null,
});

registerTools(
  {
    name: 'list_deals',
    kind: 'read',
    permission: 'deal.create',
    description: 'Negotiations and bookings in the user\'s scope, with status, list price, latest offer, agreed price, discount and what they are waiting for. Filter by status.',
    schema: z.object({ status: z.array(z.enum(DEAL_STATUSES)).optional() }),
    run: async ({ status }, { actor }) => {
      const items = await listDeals(actor, { status });
      return { data: items.slice(0, 20).map(brief), records: items.slice(0, 10).map((d) => dealRef({ _id: d.id, ...d }, `${d.lead?.name} · ${d.property?.title}`)) };
    },
  },
  {
    name: 'start_negotiation',
    kind: 'write',
    permission: 'deal.create',
    description: 'Open a negotiation for a customer on a specific property (optionally with their first offer in rupees). Moves the customer to Negotiation.',
    schema: z.object({ leadId: z.string(), propertyId: z.string(), customerOffer: z.number().optional() }),
    run: async ({ leadId, propertyId, customerOffer }, { actor }) => {
      const d = await startDeal(leadId, propertyId, actor, { offer: customerOffer });
      const s = await getDeal(String(d._id), actor);
      return { data: brief(s), records: [dealRef({ _id: s.id, ...s }, `${s.lead?.name} · ${s.property?.title}`)], done: `Negotiation opened on ${s.property?.title}` };
    },
  },
  {
    name: 'record_offer',
    kind: 'write',
    permission: 'deal.create',
    description: 'Record an offer in a negotiation: by the customer or by us, in rupees.',
    schema: z.object({ dealId: z.string(), by: z.enum(['customer', 'us']), amount: z.number(), note: z.string().optional() }),
    run: async (i, { actor }) => {
      await addOffer(i.dealId, i, actor);
      return { data: brief(await getDeal(i.dealId, actor)), done: `Recorded ${i.by === 'customer' ? "customer's" : 'our'} offer of ${formatINR(i.amount)}` };
    },
  },
  {
    name: 'propose_price',
    kind: 'write',
    permission: 'deal.create',
    description: 'Agree a final price. If the discount is within the user\'s own limit it is agreed immediately; otherwise it is sent for manager or admin approval (it does not approve itself). Say which happened.',
    schema: z.object({ dealId: z.string(), price: z.number(), note: z.string().optional() }),
    run: async (i, { actor }) => {
      const r = await proposePrice(i.dealId, i, actor);
      return { data: { needsApproval: r.needsApproval, level: r.level, deal: brief(await getDeal(i.dealId, actor)) }, done: r.needsApproval ? `Sent ${formatINR(i.price)} for ${r.level} approval` : `Price agreed at ${formatINR(i.price)}` };
    },
  },
  {
    name: 'decide_price_approval',
    kind: 'confirm',
    permission: 'deal.approve',
    description: 'Approve, reject or counter a discount waiting for approval.',
    schema: z.object({ dealId: z.string(), decision: z.enum(['approve', 'reject', 'counter']), counterPrice: z.number().optional(), note: z.string().optional() }),
    preview: async (i, { actor }) => {
      const d = await getDeal(i.dealId, actor);
      if (d.status !== 'approval') throw badRequest('Nothing is waiting for approval on this deal');
      const what = i.decision === 'approve' ? `Approve ${formatINR(d.approval?.price)} (${d.approval?.discountPct}% off ${formatINR(d.listPrice)})` : i.decision === 'counter' ? `Counter at ${formatINR(i.counterPrice)}` : `Reject ${formatINR(d.approval?.price)}`;
      return { summary: `${what} for ${d.lead?.name} on ${d.property?.title}`, records: [dealRef({ _id: d.id, ...d }, `${d.lead?.name} · ${d.property?.title}`)] };
    },
    execute: async (i, { actor }) => {
      await decidePrice(i.dealId, i, actor);
      const d = await getDeal(i.dealId, actor);
      return { data: brief(d), done: `${i.decision === 'approve' ? 'Approved' : i.decision === 'counter' ? 'Countered' : 'Rejected'} — ${d.lead?.name}` };
    },
  },
  {
    name: 'confirm_booking',
    kind: 'confirm',
    permission: 'deal.book',
    description: 'Confirm a booking on a deal with an agreed price: records the booking amount, marks the unit booked and the customer Booked, creates the payment plan and closes other negotiations on that unit.',
    schema: z.object({ dealId: z.string(), amount: z.number().optional(), mode: z.enum(['Cheque', 'NEFT / RTGS', 'UPI', 'Demand draft', 'Cash']).optional(), reference: z.string().optional() }),
    preview: async (i, { actor }) => {
      const d = await getDeal(i.dealId, actor);
      if (d.status !== 'approved') throw badRequest('Agree the price before booking');
      const amt = i.amount ?? d.bookingRequest?.amount;
      if (!amt) throw badRequest('What booking amount was received, and how (cheque, NEFT, UPI)?');
      return { summary: `Book ${d.property?.title} for ${d.lead?.name} at ${formatINR(d.agreedPrice)}, booking amount ${formatINR(amt)} by ${i.mode ?? d.bookingRequest?.mode ?? '—'}`, records: [dealRef({ _id: d.id, ...d }, `${d.lead?.name} · ${d.property?.title}`)] };
    },
    execute: async (i, { actor }) => {
      const r = await confirmBooking(i.dealId, i, actor);
      const d = await getDeal(i.dealId, actor);
      return { data: brief(d), done: `Booked ${d.property?.title} for ${d.lead?.name}${r.closedRivals ? `; closed ${r.closedRivals} other negotiation${r.closedRivals > 1 ? 's' : ''} on it` : ''}` };
    },
  },
  {
    name: 'cancel_deal',
    kind: 'confirm',
    permission: 'deal.create',
    description: 'Cancel a negotiation or a booking (bookings need a manager). The unit is released. "then" says whether the customer goes back to negotiating or is closed as lost.',
    schema: z.object({ dealId: z.string(), reason: z.string(), then: z.enum(['negotiation', 'lost']).default('negotiation') }),
    preview: async (i, { actor }) => {
      const d = await getDeal(i.dealId, actor);
      return { summary: `Cancel the ${d.status === 'booked' ? 'booking' : 'negotiation'} of ${d.property?.title} for ${d.lead?.name} (${i.reason})${i.then === 'lost' ? ' and close them as lost' : ''}` };
    },
    execute: async (i, { actor }) => {
      await cancelDeal(i.dealId, i, actor);
      return { data: { ok: true }, done: 'Cancelled and the unit released' };
    },
  },
  {
    name: 'deals_overview',
    kind: 'read',
    permission: 'deal.create',
    description: 'Money view: value under negotiation, bookings this month, payments due in 30 days (overdue flagged), deals with no movement for 5+ days, and what is waiting on the user to approve or confirm.',
    schema: z.object({}),
    run: async (_i, { actor }) => {
      const [s, w] = await Promise.all([dealSummary(actor), waitingOn(actor)]);
      return {
        data: {
          negotiating: { count: s.negotiating.count, value: formatINR(s.negotiating.value) },
          bookedThisMonth: { count: s.bookedThisMonth.count, value: formatINR(s.bookedThisMonth.value) },
          paymentsDue: s.dueSoon.map((p) => ({ ...p, amount: formatINR(p.amount), due: relativeDay(p.dueDate as Date) })),
          stuckDeals: s.stuck,
          waitingOnYou: { priceApprovals: w.approvals.map(brief), bookingsToConfirm: w.bookings.map(brief) },
        },
      };
    },
  },
);

registerIntents(
  {
    name: 'approvals-waiting',
    example: 'What approvals are waiting for me?',
    match: (t) => /\b(approv|waiting for me|to confirm|pending)/.test(t),
    run: async (_a, ctx, out) => {
      const r = await callTool('deals_overview', {}, ctx, out);
      const d = JSON.parse(r.content) as { waitingOnYou: { priceApprovals: ReturnType<typeof brief>[]; bookingsToConfirm: ReturnType<typeof brief>[] } };
      const a = d.waitingOnYou.priceApprovals;
      const b = d.waitingOnYou.bookingsToConfirm;
      if (!a.length && !b.length) return 'Nothing is waiting on you.';
      return [
        a.length ? `**Price approvals (${a.length})**\n${a.map((x) => `• ${x.customer} — ${x.property}: ${x.waitingFor} (list ${x.listPrice})`).join('\n')}` : '',
        b.length ? `**Bookings to confirm (${b.length})**\n${b.map((x) => `• ${x.customer} — ${x.property} at ${x.agreedPrice}`).join('\n')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
    },
  },
  {
    name: 'payments-due',
    example: 'Which payments are due this month?',
    match: (t) => /\b(payments?|collections?|instal+ments?|dues?)\b/.test(t),
    run: async (_a, ctx, out) => {
      const r = await callTool('deals_overview', {}, ctx, out);
      const d = JSON.parse(r.content) as { paymentsDue: { customer: string; label: string; amount: string; due: string; overdue: boolean }[] };
      if (!d.paymentsDue.length) return 'No payments due in the next 30 days.';
      return d.paymentsDue.map((p) => `• ${p.overdue ? '⚠ ' : ''}**${p.customer}** — ${p.label}: ${p.amount}, due ${p.due.toLowerCase()}`).join('\n');
    },
  },
);

export const DEAL_LABEL = (s: DealStatus) => DEAL_STATUS_LABEL[s];
