import { z } from 'zod';
import { PROPERTY_TYPES, PURPOSES } from './property';

export const LEAD_SOURCES = ['walk_in', 'phone', 'website', 'whatsapp', 'portal', 'referral', 'campaign', 'channel_partner', 'other'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  walk_in: 'Walk-in',
  phone: 'Phone call',
  website: 'Website',
  whatsapp: 'WhatsApp',
  portal: 'Property portal',
  referral: 'Referral',
  campaign: 'Ad campaign',
  channel_partner: 'Channel partner',
  other: 'Other',
};

/**
 * Pipeline stages follow what actually happens in an Indian residential sale.
 * Each stage has an entry condition, so a lead's stage always means something.
 */
export const STAGES = ['new', 'contacted', 'qualified', 'visit', 'negotiation', 'booked', 'lost'] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ['new', 'contacted', 'qualified', 'visit', 'negotiation'];

export const STAGE_META: Record<Stage, { label: string; entry: string; staleAfterDays: number }> = {
  new: { label: 'New', entry: 'Enquiry received, nobody has spoken to them yet', staleAfterDays: 1 },
  contacted: { label: 'Contacted', entry: 'A call or meeting is logged', staleAfterDays: 3 },
  qualified: { label: 'Qualified', entry: 'Budget, location and type are known', staleAfterDays: 5 },
  visit: { label: 'Site visit', entry: 'A site visit is scheduled or done', staleAfterDays: 5 },
  negotiation: { label: 'Negotiation', entry: 'An offer is being discussed on a property', staleAfterDays: 4 },
  booked: { label: 'Booked', entry: 'Booking amount received', staleAfterDays: 9999 },
  lost: { label: 'Lost', entry: 'Closed with a reason', staleAfterDays: 9999 },
};

export const LOST_REASONS = [
  'Budget mismatch',
  'Bought elsewhere',
  'Location not suitable',
  'Loan not approved',
  'Plan postponed',
  'Not reachable',
  'Not a genuine enquiry',
  'Other',
] as const;

export const Requirement = z.object({
  purpose: z.enum(PURPOSES).default('sale'),
  types: z.array(z.enum(PROPERTY_TYPES)).default([]),
  budgetMin: z.number().nonnegative().nullish(),
  budgetMax: z.number().positive().nullish(),
  city: z.string().trim().nullish(),
  localities: z.array(z.string().trim()).default([]),
  bedrooms: z.number().int().min(1).max(10).nullish(),
  areaMin: z.number().positive().nullish(),
  mustHaves: z.array(z.string()).default([]),
  timeline: z.enum(['immediate', '3_months', '6_months', 'exploring']).nullish(),
  financing: z.enum(['own_funds', 'loan', 'loan_approved', 'unknown']).nullish(),
  /** Buying to live in or as an investment. */
  intent: z.enum(['own_use', 'investment']).nullish(),
  notes: z.string().max(2000).nullish(),
});
export type Requirement = z.infer<typeof Requirement>;

export const LeadInput = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(20),
  email: z.string().email().nullish().or(z.literal('')),
  source: z.enum(LEAD_SOURCES).default('phone'),
  ownerId: z.string().nullish(),
  requirement: Requirement.partial().default({}),
  note: z.string().max(2000).nullish(),
});
export type LeadInput = z.infer<typeof LeadInput>;

export function isQualified(r: Partial<Requirement> | undefined | null): boolean {
  if (!r) return false;
  const hasBudget = !!(r.budgetMax || r.budgetMin);
  const hasWhere = !!(r.city || r.localities?.length);
  const hasType = !!r.types?.length;
  return hasBudget && hasWhere && hasType;
}

export const ACTIVITY_TYPES = ['call', 'meeting', 'site_visit', 'whatsapp', 'email', 'note', 'task'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: 'Call',
  meeting: 'Meeting',
  site_visit: 'Site visit',
  whatsapp: 'WhatsApp',
  email: 'Email',
  note: 'Note',
  task: 'Task',
};

export const ACTIVITY_STATUSES = ['planned', 'done', 'cancelled', 'missed'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const CALL_OUTCOMES = ['Interested', 'Call back later', 'Not interested', 'Not reachable', 'Wrong number'] as const;
export const VISIT_INTEREST = ['Very interested', 'Interested', 'Neutral', 'Not interested'] as const;

export const ActivityInput = z.object({
  leadId: z.string(),
  type: z.enum(ACTIVITY_TYPES),
  propertyIds: z.array(z.string()).default([]),
  scheduledAt: z.string().datetime({ offset: true }).nullish(),
  durationMin: z.number().int().min(5).max(480).default(30),
  status: z.enum(ACTIVITY_STATUSES).default('planned'),
  notes: z.string().max(4000).nullish(),
  outcome: z.string().max(200).nullish(),
  ownerId: z.string().nullish(),
});
export type ActivityInput = z.infer<typeof ActivityInput>;

export const DEAL_STATUSES = ['negotiating', 'approval', 'approved', 'booked', 'registered', 'cancelled'] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];
export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  negotiating: 'Negotiating',
  approval: 'Waiting for approval',
  approved: 'Price approved',
  booked: 'Booked',
  registered: 'Registered',
  cancelled: 'Cancelled',
};

/** Typical construction-linked payment plan, editable per deal. */
export const DEFAULT_PAYMENT_PLAN = [
  { label: 'Booking amount', pct: 10 },
  { label: 'Agreement for sale', pct: 20 },
  { label: 'Loan disbursement / construction milestones', pct: 60 },
  { label: 'On registration & handover', pct: 10 },
] as const;
