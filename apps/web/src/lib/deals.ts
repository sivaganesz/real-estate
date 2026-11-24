import { formatINR, relativeDay, type DealStatus } from '@estate/shared';
import type { Tone } from '../components/ui';

export type Deal = {
  id: string;
  code: string;
  status: DealStatus;
  listPrice: number;
  agreedPrice: number | null;
  currentPrice: number;
  discountPct: number | null;
  offers: { by: 'customer' | 'us'; amount: number; note?: string; at: string; byName?: string }[];
  approval: {
    price: number;
    discountPct: number;
    level?: 'manager' | 'admin';
    note?: string;
    requestedByName: string;
    requestedAt: string;
    decision?: 'approved' | 'rejected' | 'countered';
    decidedByName?: string;
    decidedAt?: string;
    decisionNote?: string;
    counterPrice?: number;
  } | null;
  bookingRequest: { amount: number; date: string; mode: string; reference?: string; requestedByName: string; requestedAt: string } | null;
  booking: { amount: number; date: string; mode: string; reference?: string; confirmedByName: string; confirmedAt: string } | null;
  payments: { label: string; pct: number; amount: number; dueDate: string; status: 'due' | 'paid'; paidAt?: string; reference?: string }[];
  paid: number;
  due: number;
  registeredAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  lead: { id: string; name: string; phone: string; stage: string; owner: string | null } | null;
  property: { id: string; title: string; code: string; price: number; availability: string; heldUntil?: string; locality?: string; type: string; media: { url: string; kind: string }[] } | null;
};

export const DEAL_TONE: Record<DealStatus, Tone> = {
  negotiating: 'amber',
  approval: 'ai',
  approved: 'brand',
  booked: 'green',
  registered: 'slate',
  cancelled: 'red',
};

export const PAYMENT_MODES = ['Cheque', 'NEFT / RTGS', 'UPI', 'Demand draft', 'Cash'] as const;

/** Lakhs in, rupees out: "67.5" → 6,750,000. */
export const fromLakhs = (s: string) => Math.round(Number(s) * 100_000);

/** The five steps every deal goes through, in plain words. Cancelled deals sit outside them. */
export const DEAL_STEPS = [
  { label: 'Agree the price', short: 'Price', explain: 'The customer and we trade offers until both sides accept a price.' },
  { label: 'Approval', short: 'Approval', explain: "Only when the discount is above the salesperson's limit: a manager (or admin) says yes, no or counters." },
  { label: 'Booking amount', short: 'Booking', explain: 'The customer pays the booking amount; once confirmed the unit is reserved for them.' },
  { label: 'Payments', short: 'Payments', explain: 'Instalments as per the payment plan, each marked when the money arrives.' },
  { label: 'Registered', short: 'Done', explain: 'The sale deed is registered. The unit is sold and the deal is complete.' },
] as const;

const STEP_OF: Record<DealStatus, number> = { negotiating: 0, approval: 1, approved: 2, booked: 3, registered: 4, cancelled: -1 };
export const dealStep = (d: Pick<Deal, 'status'>) => STEP_OF[d.status];

export type NextStep = { text: string; owner: 'you' | 'others' | 'done'; urgent?: boolean };

/** What has to happen next on this deal, and whether it's on the person looking at it. */
export function dealNextStep(d: Deal, viewer: { canApprove: boolean; canBook: boolean; isAdmin: boolean; name?: string }): NextStep {
  switch (d.status) {
    case 'negotiating': {
      const last = d.offers.at(-1);
      if (!last) return { text: "Record the customer's first offer, or agree at the list price.", owner: 'you' };
      return { text: `${last.by === 'customer' ? 'Customer offered' : 'We offered'} ${formatINR(last.amount)}. Agree a price or make a counter-offer.`, owner: 'you' };
    }
    case 'approval': {
      const a = d.approval;
      const level = a?.level === 'admin' ? 'an admin' : 'a manager';
      const mine = viewer.canApprove && (a?.level !== 'admin' || viewer.isAdmin) && a?.requestedByName !== viewer.name;
      return mine
        ? { text: `${a?.requestedByName} wants to agree ${formatINR(a?.price)} (${a?.discountPct}% off). Approve, reject or counter.`, owner: 'you', urgent: true }
        : { text: `${formatINR(a?.price)} (${a?.discountPct}% off) is waiting for ${level} to approve.`, owner: 'others' };
    }
    case 'approved':
      if (d.bookingRequest) return viewer.canBook ? { text: `${formatINR(d.bookingRequest.amount)} booking amount received by ${d.bookingRequest.mode}. Check it and confirm the booking.`, owner: 'you', urgent: true } : { text: 'Booking amount recorded. Waiting for a manager to confirm.', owner: 'others' };
      return { text: `Price agreed at ${formatINR(d.agreedPrice)}. Collect the booking amount (usually about ${formatINR(Math.round((d.agreedPrice ?? 0) * 0.1))}).`, owner: 'you' };
    case 'booked': {
      const next = d.payments.find((p) => p.status === 'due');
      if (!next) return { text: 'Everything is paid. Register the sale deed to finish.', owner: viewer.canBook ? 'you' : 'others' };
      const late = new Date(next.dueDate) < new Date();
      return { text: `${next.label}: ${formatINR(next.amount)} ${late ? 'was due' : 'due'} ${relativeDay(next.dueDate).toLowerCase()}.`, owner: viewer.canBook ? 'you' : 'others', urgent: late };
    }
    case 'registered':
      return { text: `Sale registered${d.registeredAt ? ` ${relativeDay(d.registeredAt).toLowerCase()}` : ''}. Nothing more to do.`, owner: 'done' };
    case 'cancelled':
      return { text: `Dropped${d.cancelReason ? `: ${d.cancelReason}` : ''}.`, owner: 'done' };
  }
}
