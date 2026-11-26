import { formatINR } from './format';
import { PROPERTY_TYPE_LABEL } from './property';
import type { Requirement } from './sales';

export const TEMPERATURES = ['hot', 'warm', 'cold'] as const;
export type Temperature = (typeof TEMPERATURES)[number];
export const TEMPERATURE_LABEL: Record<Temperature, string> = { hot: 'Hot', warm: 'Warm', cold: 'Cold' };

export const TIMELINE_LABEL: Record<string, string> = {
  immediate: 'Ready to buy now',
  '3_months': 'Within 3 months',
  '6_months': 'Within 6 months',
  exploring: 'Just exploring',
};
export const FINANCING_LABEL: Record<string, string> = {
  own_funds: 'Own funds',
  loan: 'Needs a loan',
  loan_approved: 'Loan approved',
  unknown: 'Not discussed',
};
export const INTENT_LABEL: Record<string, string> = { own_use: 'Own use', investment: 'Investment' };

/** "2–3 BHK apartment · ₹60 L–₹80 L · Porur, Valasaravakkam" */
export function requirementSummary(r: Partial<Requirement> | null | undefined): string {
  if (!r) return 'Requirement not captured yet';
  const bits: string[] = [];
  const what = [r.bedrooms ? `${r.bedrooms} BHK` : null, r.types?.length ? r.types.map((t) => PROPERTY_TYPE_LABEL[t].toLowerCase()).join(' / ') : null].filter(Boolean).join(' ');
  if (what) bits.push(what.charAt(0).toUpperCase() + what.slice(1));
  if (r.purpose && r.purpose !== 'sale') bits.push(`for ${r.purpose}`);
  if (r.budgetMin && r.budgetMax) bits.push(`${formatINR(r.budgetMin)}–${formatINR(r.budgetMax)}`);
  else if (r.budgetMax) bits.push(`up to ${formatINR(r.budgetMax)}`);
  else if (r.budgetMin) bits.push(`from ${formatINR(r.budgetMin)}`);
  const where = [...(r.localities ?? []), ...(r.city && !(r.localities ?? []).length ? [r.city] : [])];
  if (where.length) bits.push(where.join(', '));
  return bits.length ? bits.join(' · ') : 'Requirement not captured yet';
}

/** What's still unknown to call a lead qualified. */
export function requirementGaps(r: Partial<Requirement> | null | undefined): string[] {
  const gaps: string[] = [];
  if (!r?.budgetMax && !r?.budgetMin) gaps.push('budget');
  if (!r?.city && !r?.localities?.length) gaps.push('location');
  if (!r?.types?.length) gaps.push('property type');
  return gaps;
}
