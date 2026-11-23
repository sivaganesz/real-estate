import type { DealStatus } from '@estate/shared';
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
