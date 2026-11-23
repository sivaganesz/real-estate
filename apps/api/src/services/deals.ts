import mongoose from 'mongoose';
import { DEAL_STATUS_LABEL, DEFAULT_PAYMENT_PLAN, can, formatINR, type DealStatus } from '@estate/shared';
import { Deal, getSettings, type DealDoc } from '../models/deal';
import { Lead } from '../models/lead';
import { Property, nextCode } from '../models/property';
import { audit, assertCan, type Actor } from '../lib/auth';
import { HttpError, badRequest, forbidden, notFound } from '../lib/http';
import { getLeadFor, leadScope, setStage } from './leads';
import { setAvailability } from './properties';
import type { RecordRef } from '../ai/tools';

const OPEN: DealStatus[] = ['negotiating', 'approval', 'approved'];

export function dealRef(d: { _id: unknown; status: string; agreedPrice?: number | null; listPrice: number }, title: string): RecordRef {
  return { kind: 'deal', id: String(d._id), title, subtitle: `${DEAL_STATUS_LABEL[d.status as DealStatus]} · ${formatINR(d.agreedPrice ?? d.listPrice)}` };
}

async function load(dealId: string, actor: Actor) {
  if (!mongoose.isValidObjectId(dealId)) throw notFound('Deal');
  const deal = await Deal.findById(dealId);
  if (!deal) throw notFound('Deal');
  await getLeadFor(String(deal.leadId), actor); // executives only see deals of their own customers
  return deal;
}

const latestPrice = (d: DealDoc | InstanceType<typeof Deal>) => d.agreedPrice ?? d.offers.at(-1)?.amount ?? d.listPrice;

export async function shapeDeal(d: DealDoc | InstanceType<typeof Deal>) {
  const o = 'toObject' in d ? (d as InstanceType<typeof Deal>).toObject() : d;
  const [lead, property] = await Promise.all([Lead.findById(o.leadId).populate('ownerId', 'name').select('name phone stage ownerId').lean(), Property.findById(o.propertyId).select('title code price availability heldUntil locality projectId unitNumber block type media').lean()]);
  const price = o.agreedPrice ?? null;
  const paid = (o.payments ?? []).filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount ?? 0), 0);
  return {
    id: String(o._id),
    code: o.code,
    status: o.status as DealStatus,
    listPrice: o.listPrice,
    agreedPrice: price,
    currentPrice: latestPrice(o as never),
    discountPct: price ? Math.round(((o.listPrice - price) / o.listPrice) * 1000) / 10 : null,
    offers: o.offers ?? [],
    approval: o.approval ?? null,
    bookingRequest: o.bookingRequest ?? null,
    booking: o.booking ?? null,
    payments: o.payments ?? [],
    paid,
    due: (o.payments ?? []).filter((p) => p.status === 'due').reduce((s, p) => s + (p.amount ?? 0), 0),
    registeredAt: o.registeredAt ?? null,
    cancelReason: o.cancelReason ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    lead: lead ? { id: String(lead._id), name: lead.name, phone: lead.phone, stage: lead.stage, owner: (lead.ownerId as unknown as { name?: string })?.name ?? null } : null,
    property: property ? { id: String(property._id), title: property.title, code: property.code, price: property.price, availability: property.availability, heldUntil: property.heldUntil, locality: property.locality, type: property.type, media: property.media } : null,
  };
}

/** One open negotiation per customer and property. It moves the customer to Negotiation. */
export async function startDeal(leadId: string, propertyId: string, actor: Actor, opts: { offer?: number; note?: string } = {}) {
  assertCan(actor, 'deal.create');
  const lead = await getLeadFor(leadId, actor);
  if (lead.stage === 'lost') throw badRequest(`${lead.name} is closed as lost. Reopen them first.`);
  const property = await Property.findById(propertyId);
  if (!property || property.listing !== 'live') throw badRequest('Choose a live property');
  if (property.availability === 'booked' || property.availability === 'sold') throw badRequest(`${property.title} is already ${property.availability}`);
  if (property.availability === 'held' && String(property.heldFor ?? '') !== leadId) throw badRequest(`${property.title} is on hold for another customer`);
  if (!property.price) throw badRequest('The property needs a price before negotiating');
  const existing = await Deal.findOne({ leadId, propertyId, status: { $in: OPEN } });
  if (existing) return existing.toObject();
  const deal = await Deal.create({
    code: await nextCode('DL'),
    leadId,
    propertyId,
    ownerId: lead.ownerId ?? actor.id,
    listPrice: property.price,
    offers: opts.offer ? [{ by: 'customer', amount: opts.offer, note: opts.note, at: new Date(), byName: actor.name }] : [],
  });
  const item = lead.shortlist.find((s) => String(s.propertyId) === propertyId);
  if (item) item.status = 'liked';
  else lead.shortlist.push({ propertyId: property._id, status: 'liked', at: new Date() });
  await lead.save();
  if (['new', 'contacted', 'qualified', 'visit'].includes(lead.stage)) await setStage(lead, 'negotiation', actor, `negotiating on ${property.title}`);
  await audit(actor, 'deal', deal._id, 'create', `Negotiation started on ${property.title} at ${formatINR(property.price)}`);
  await audit(actor, 'lead', lead._id, 'deal', `Negotiation started on ${property.title}`);
  return deal.toObject();
}

export async function addOffer(dealId: string, input: { by: 'customer' | 'us'; amount: number; note?: string }, actor: Actor) {
  const deal = await load(dealId, actor);
  if (!OPEN.includes(deal.status as DealStatus)) throw badRequest(`This deal is ${DEAL_STATUS_LABEL[deal.status as DealStatus].toLowerCase()}`);
  if (!(input.amount > 0)) throw badRequest('Enter an amount');
  if (input.amount > deal.listPrice * 1.5 || input.amount < deal.listPrice * 0.5) throw badRequest(`${formatINR(input.amount)} is far from the list price of ${formatINR(deal.listPrice)}. Check the number.`);
  deal.offers.push({ ...input, at: new Date(), byName: actor.name });
  await deal.save();
  await audit(actor, 'deal', deal._id, 'offer', `${input.by === 'customer' ? 'Customer offered' : 'We offered'} ${formatINR(input.amount)}`);
  return deal.toObject();
}

function limitFor(role: Actor['role'], limits: { executive: number; manager: number }) {
  return role === 'admin' ? 100 : role === 'manager' ? limits.manager : limits.executive;
}

/**
 * Agreeing a price. Within the person's own limit it's agreed at once;
 * above it, it goes to a manager, or to an admin if it's beyond a manager's limit.
 */
export async function proposePrice(dealId: string, input: { price: number; note?: string }, actor: Actor) {
  const deal = await load(dealId, actor);
  if (!['negotiating', 'approved'].includes(deal.status)) throw badRequest(deal.status === 'approval' ? 'A price is already waiting for approval' : 'This deal is closed');
  if (!(input.price > 0) || input.price > deal.listPrice * 1.2) throw badRequest('Enter a sensible price');
  const discountLimitPct = { executive: 1, manager: 5, ...((await getSettings()).discountLimitPct ?? {}) };
  const discountPct = Math.max(0, Math.round(((deal.listPrice - input.price) / deal.listPrice) * 1000) / 10);
  const mine = limitFor(actor.role, discountLimitPct);
  // A manager's counter is an approval up to that price: agreeing at or above it needs no new request.
  const counter = deal.approval?.decision === 'countered' ? deal.approval.counterPrice ?? undefined : undefined;
  const preApproved = counter !== undefined && input.price >= counter;
  if (discountPct <= mine || preApproved) {
    deal.agreedPrice = input.price;
    deal.status = 'approved';
    deal.approval = { price: input.price, discountPct, note: input.note, requestedBy: new mongoose.Types.ObjectId(actor.id), requestedByName: actor.name, requestedAt: new Date(), decision: 'approved', decidedAt: new Date(), decisionNote: preApproved && discountPct > mine ? `Within the counter approved by ${deal.approval?.decidedByName}` : discountPct ? `Within ${actor.name.split(' ')[0]}'s ${mine}% limit` : 'At list price', decidedByName: preApproved && discountPct > mine ? deal.approval?.decidedByName : actor.name } as never;
    await deal.save();
    await audit(actor, 'deal', deal._id, 'price', `Price agreed at ${formatINR(input.price)}${discountPct ? ` (${discountPct}% off)` : ''}`);
    return { deal: deal.toObject(), needsApproval: false };
  }
  const level = discountPct <= discountLimitPct.manager ? 'manager' : 'admin';
  deal.status = 'approval';
  deal.agreedPrice = undefined; // a new proposal replaces any earlier agreement
  deal.approval = { price: input.price, discountPct, level, note: input.note, requestedBy: new mongoose.Types.ObjectId(actor.id), requestedByName: actor.name, requestedAt: new Date() } as never;
  await deal.save();
  await audit(actor, 'deal', deal._id, 'approval', `Asked ${level === 'admin' ? 'an admin' : 'a manager'} to approve ${formatINR(input.price)} (${discountPct}% off)`);
  return { deal: deal.toObject(), needsApproval: true, level };
}

export async function decidePrice(dealId: string, input: { decision: 'approve' | 'reject' | 'counter'; counterPrice?: number; note?: string }, actor: Actor) {
  assertCan(actor, 'deal.approve', 'Only managers and admins approve prices');
  const deal = await load(dealId, actor);
  if (deal.status !== 'approval' || !deal.approval) throw badRequest('Nothing is waiting for approval on this deal');
  if (deal.approval.level === 'admin' && actor.role !== 'admin') throw forbidden(`A ${deal.approval.discountPct}% discount is above the manager limit; an admin must approve it`);
  if (String(deal.approval.requestedBy) === actor.id && actor.role !== 'admin') throw forbidden('Someone else must approve your own request');
  const a = deal.approval;
  a.decidedByName = actor.name;
  a.decidedAt = new Date();
  a.decisionNote = input.note;
  if (input.decision === 'approve') {
    a.decision = 'approved';
    deal.agreedPrice = a.price ?? undefined;
    deal.status = 'approved';
  } else if (input.decision === 'counter') {
    if (!input.counterPrice) throw badRequest('Give the price you can approve');
    a.decision = 'countered';
    a.counterPrice = input.counterPrice;
    deal.status = 'negotiating';
    deal.offers.push({ by: 'us', amount: input.counterPrice, note: `Approved up to this by ${actor.name}`, at: new Date(), byName: actor.name });
  } else {
    a.decision = 'rejected';
    deal.status = 'negotiating';
  }
  deal.markModified('approval');
  await deal.save();
  await audit(actor, 'deal', deal._id, 'decision', `${input.decision === 'approve' ? 'Approved' : input.decision === 'counter' ? `Countered at ${formatINR(input.counterPrice)}` : 'Rejected'} ${formatINR(a.price)}${input.note ? ` — ${input.note}` : ''}`);
  return deal.toObject();
}

export async function holdUnit(dealId: string, days: number | undefined, actor: Actor) {
  const deal = await load(dealId, actor);
  if (!OPEN.includes(deal.status as DealStatus)) throw badRequest('This deal is closed');
  const holdDays = days ?? (await getSettings()).holdDays;
  // Holding is part of negotiating, so executives may do it for their own deals.
  await setAvailability(String(deal.propertyId), 'held', actor, { heldUntil: new Date(Date.now() + holdDays * 86_400_000), leadId: String(deal.leadId), system: true });
  await audit(actor, 'deal', deal._id, 'hold', `Unit held for ${holdDays} days`);
  return deal.toObject();
}

type BookingInput = { amount: number; date?: Date; mode: string; reference?: string };

/** Executives send a booking for confirmation; it appears in the manager's approvals. */
export async function requestBooking(dealId: string, input: BookingInput, actor: Actor) {
  const deal = await load(dealId, actor);
  if (deal.status !== 'approved') throw badRequest('Agree the price before booking');
  if (!(input.amount > 0)) throw badRequest('Enter the booking amount received');
  deal.bookingRequest = { ...input, date: input.date ?? new Date(), requestedByName: actor.name, requestedAt: new Date() } as never;
  await deal.save();
  await audit(actor, 'deal', deal._id, 'booking-request', `Booking amount ${formatINR(input.amount)} received (${input.mode}); waiting for confirmation`);
  return deal.toObject();
}

/**
 * Confirming a booking is the moment a sale becomes real: the unit is booked,
 * the customer is Booked, the payment plan starts, and rival negotiations on
 * the same unit are closed.
 */
export async function confirmBooking(dealId: string, input: Partial<BookingInput>, actor: Actor) {
  assertCan(actor, 'deal.book', 'A manager confirms bookings');
  const deal = await load(dealId, actor);
  if (deal.status !== 'approved') throw badRequest('Agree the price before booking');
  const b = { ...((deal.toObject().bookingRequest as object | undefined) ?? {}), ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) } as BookingInput;
  if (!(b.amount > 0) || !b.mode) throw badRequest('Booking amount and payment mode are needed');
  const property = await Property.findById(deal.propertyId);
  if (!property) throw notFound('Property');
  if (property.availability === 'booked' || property.availability === 'sold') throw new HttpError(409, `${property.title} was booked by someone else`);
  const price = deal.agreedPrice!;
  const bookingDate = b.date ? new Date(b.date) : new Date();
  deal.booking = { amount: b.amount, date: bookingDate, mode: b.mode, reference: b.reference, confirmedByName: actor.name, confirmedAt: new Date() } as never;
  deal.bookingRequest = undefined;
  // The booking amount is the first instalment; the balance is split over the
  // usual milestones in proportion, so the plan always adds up to the price.
  const later = DEFAULT_PAYMENT_PLAN.slice(1);
  const laterPct = later.reduce((s, m) => s + m.pct, 0);
  const balance = price - b.amount;
  const laterAmounts = later.map((m) => Math.round((balance * m.pct) / laterPct));
  laterAmounts[laterAmounts.length - 1] += balance - laterAmounts.reduce((s, a) => s + a, 0);
  let monthOffset = 0;
  deal.set(
    'payments',
    DEFAULT_PAYMENT_PLAN.map((m, i) => {
      const amount = i === 0 ? b.amount : laterAmounts[i - 1];
      const due = new Date(bookingDate);
      monthOffset += i === 0 ? 0 : i === 1 ? 1 : 3;
      due.setMonth(due.getMonth() + monthOffset);
      return { label: m.label, pct: m.pct, amount, dueDate: due, status: i === 0 ? 'paid' : 'due', paidAt: i === 0 ? bookingDate : undefined, reference: i === 0 ? b.reference : undefined };
    }),
  );
  deal.status = 'booked';
  await deal.save();
  await setAvailability(String(property._id), 'booked', actor, { system: true, reason: `Booked by deal ${deal.code}` });
  const lead = (await Lead.findById(deal.leadId))!;
  await setStage(lead, 'booked', actor, `booked ${property.title} at ${formatINR(price)}`);
  const rivals = await Deal.find({ propertyId: property._id, _id: { $ne: deal._id }, status: { $in: OPEN } });
  for (const r of rivals) {
    r.status = 'cancelled';
    r.cancelReason = 'Unit booked by another customer';
    r.cancelledAt = new Date();
    await r.save();
    await audit(actor, 'deal', r._id, 'cancel', 'Closed: unit booked by another customer');
  }
  await audit(actor, 'deal', deal._id, 'book', `Booked at ${formatINR(price)}; booking amount ${formatINR(b.amount)} by ${b.mode}`);
  return { deal: deal.toObject(), closedRivals: rivals.length };
}

export async function recordPayment(dealId: string, index: number, input: { paidAt?: Date; reference?: string }, actor: Actor) {
  assertCan(actor, 'deal.book', 'Managers and admins record payments');
  const deal = await load(dealId, actor);
  const p = deal.payments[index];
  if (!p) throw notFound('Payment');
  if (p.status === 'paid') throw badRequest('Already marked paid');
  p.status = 'paid';
  p.paidAt = input.paidAt ?? new Date();
  p.reference = input.reference;
  await deal.save();
  await audit(actor, 'deal', deal._id, 'payment', `${p.label}: ${formatINR(p.amount)} received`);
  return deal.toObject();
}

export async function registerSale(dealId: string, actor: Actor) {
  assertCan(actor, 'deal.book');
  const deal = await load(dealId, actor);
  if (deal.status !== 'booked') throw badRequest('Only a booked deal can be registered');
  deal.status = 'registered';
  deal.registeredAt = new Date();
  await deal.save();
  await setAvailability(String(deal.propertyId), 'sold', actor, { system: true, reason: `Registered, deal ${deal.code}` });
  const due = deal.payments.filter((p) => p.status === 'due').length;
  await audit(actor, 'deal', deal._id, 'register', `Sale registered${due ? `; ${due} payment${due > 1 ? 's' : ''} still due` : ''}`);
  return deal.toObject();
}

/** Cancelling: before booking anyone may drop it; a booking needs a manager and releases the unit. */
export async function cancelDeal(dealId: string, input: { reason: string; then: 'negotiation' | 'lost' }, actor: Actor) {
  const deal = await load(dealId, actor);
  if (deal.status === 'cancelled' || deal.status === 'registered') throw badRequest('This deal is already closed');
  const wasBooked = deal.status === 'booked';
  if (wasBooked && !can(actor.role, 'deal.book')) throw forbidden('A manager cancels bookings');
  deal.status = 'cancelled';
  deal.cancelReason = input.reason;
  deal.cancelledAt = new Date();
  await deal.save();
  const property = await Property.findById(deal.propertyId);
  if (property && (wasBooked || (property.availability === 'held' && String(property.heldFor) === String(deal.leadId)))) {
    await setAvailability(String(property._id), 'available', actor, { system: true, reason: `Deal ${deal.code} cancelled` });
  }
  const lead = (await Lead.findById(deal.leadId))!;
  const stillOpen = await Deal.exists({ leadId: lead._id, status: { $in: OPEN } });
  if (input.then === 'lost' && !stillOpen) {
    lead.lostReason = 'Other';
    lead.lostNote = input.reason;
    await setStage(lead, 'lost', actor, input.reason);
  } else if (wasBooked) await setStage(lead, 'negotiation', actor, `booking cancelled: ${input.reason}`);
  await audit(actor, 'deal', deal._id, 'cancel', `${wasBooked ? 'Booking' : 'Negotiation'} cancelled: ${input.reason}`);
  return deal.toObject();
}

export async function listDeals(actor: Actor, opts: { status?: DealStatus[]; leadId?: string } = {}) {
  const scope = leadScope(actor);
  const q: Record<string, unknown> = {};
  if ('ownerId' in scope) q.leadId = { $in: (await Lead.find(scope).select('_id').lean()).map((l) => l._id) };
  if (opts.leadId) q.leadId = new mongoose.Types.ObjectId(opts.leadId);
  if (opts.status?.length) q.status = { $in: opts.status };
  const deals = await Deal.find(q).sort({ updatedAt: -1 }).limit(200);
  return Promise.all(deals.map((d) => shapeDeal(d)));
}

export async function getDeal(dealId: string, actor: Actor) {
  return shapeDeal(await load(dealId, actor));
}

/** What's waiting on this person: price approvals at their level, and bookings to confirm. */
export async function waitingOn(actor: Actor) {
  if (!can(actor.role, 'deal.approve')) return { approvals: [], bookings: [] };
  const levels = actor.role === 'admin' ? ['manager', 'admin'] : ['manager'];
  const [approvals, bookings] = await Promise.all([
    Deal.find({ status: 'approval', 'approval.level': { $in: levels }, 'approval.requestedBy': { $ne: actor.role === 'admin' ? null : new mongoose.Types.ObjectId(actor.id) } }).sort({ 'approval.requestedAt': 1 }),
    Deal.find({ status: 'approved', bookingRequest: { $exists: true } }).sort({ 'bookingRequest.requestedAt': 1 }),
  ]);
  return { approvals: await Promise.all(approvals.map((d) => shapeDeal(d))), bookings: await Promise.all(bookings.map((d) => shapeDeal(d))) };
}

/** Money view: what's being negotiated, what's booked this month, what's due soon. */
export async function dealSummary(actor: Actor) {
  const deals = await listDeals(actor);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const soon = new Date(Date.now() + 30 * 86_400_000);
  const open = deals.filter((d) => OPEN.includes(d.status));
  const bookedThisMonth = deals.filter((d) => (d.status === 'booked' || d.status === 'registered') && d.booking && new Date(d.booking.confirmedAt as unknown as string) >= monthStart);
  const dueSoon = deals.flatMap((d) => d.payments.filter((p) => p.status === 'due' && new Date(p.dueDate as unknown as string) <= soon).map((p) => ({ deal: d.code, dealId: d.id, customer: d.lead?.name, label: p.label, amount: p.amount, dueDate: p.dueDate, overdue: new Date(p.dueDate as unknown as string) < new Date() })));
  return {
    negotiating: { count: open.length, value: open.reduce((s, d) => s + d.currentPrice, 0) },
    bookedThisMonth: { count: bookedThisMonth.length, value: bookedThisMonth.reduce((s, d) => s + (d.agreedPrice ?? 0), 0) },
    dueSoon,
    stuck: open.filter((d) => Date.now() - new Date(d.updatedAt).getTime() > 5 * 86_400_000).map((d) => ({ id: d.id, code: d.code, customer: d.lead?.name, property: d.property?.title, days: Math.floor((Date.now() - new Date(d.updatedAt).getTime()) / 86_400_000) })),
  };
}

export { Deal };
