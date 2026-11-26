import clsx from 'clsx';
import { PROPERTY_TYPE_LABEL, STAGE_META, formatINR, type ScoreBand, type Stage } from '@estate/shared';
import { STAGE_TONE, type Lead } from '../lib/leads';
import type { Property } from '../lib/property';
import type { Tone } from './ui';

/** Small pieces shared by the Leads list and the lead page. */

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** Whole days from today to that date: 0 today, 1 tomorrow, -2 two days ago. */
export const daysFromToday = (iso: string) => Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
/** "6 Nov", or "6 Nov 2026" with the year. */
export const shortDate = (d: string, year = false) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });

export const STAGE_DOT: Record<Tone, string> = { slate: 'bg-slate-500', blue: 'bg-sky-500', brand: 'bg-brand-500', ai: 'bg-ai-500', amber: 'bg-amber-600', green: 'bg-emerald-500', red: 'bg-rose-500' };

export function StageLabel({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', STAGE_DOT[STAGE_TONE[stage]])} />
      {STAGE_META[stage].label}
    </span>
  );
}

/** "₹30 L–₹40 L", "up to ₹95 L"; rent per month. `spaced` puts spaces round the dash. */
export function budgetText(l: Pick<Lead, 'requirement'>, spaced = false) {
  const r = l.requirement;
  const rent = r.purpose && r.purpose !== 'sale';
  const f = (n: number) => (rent ? `${formatINR(n, { short: false })}/mo` : formatINR(n));
  if (r.budgetMin && r.budgetMax) return `${f(r.budgetMin)}${spaced ? ' – ' : '–'}${f(r.budgetMax)}`;
  if (r.budgetMax) return `up to ${f(r.budgetMax)}`;
  if (r.budgetMin) return `from ${f(r.budgetMin)}`;
  return null;
}

/** "Plot · K.K. Nagar / Anna Nagar · 1,200 sq.ft. · 2 BHK": what and where. */
export function whatAndWhere(l: Pick<Lead, 'requirement'>) {
  const r = l.requirement;
  return [
    r.types?.length ? r.types.map((t) => PROPERTY_TYPE_LABEL[t]).join(' / ') : null,
    r.localities?.length ? r.localities.join(' / ') : r.city,
    r.areaMin ? `${r.areaMin.toLocaleString('en-IN')} sq.ft.` : null,
    r.bedrooms ? `${r.bedrooms} BHK` : null,
  ].filter(Boolean) as string[];
}

export const BAND_STYLE: Record<ScoreBand, { text: string; stroke: string }> = {
  high: { text: 'text-emerald-700', stroke: 'stroke-emerald-600' },
  qualified: { text: 'text-blue-700', stroke: 'stroke-blue-600' },
  nurture: { text: 'text-amber-700', stroke: 'stroke-amber-500' },
  early: { text: 'text-slate-600', stroke: 'stroke-slate-400' },
  closed: { text: 'text-slate-600', stroke: 'stroke-slate-400' },
};

/** A score out of 100 as a ring, like a progress dial. */
export function ScoreRing({ score, band, size = 'md', label = 'Lead score' }: { score: number; band: ScoreBand; size?: 'xs' | 'sm' | 'md'; label?: string }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  return (
    <span className={clsx('relative inline-flex shrink-0 items-center justify-center', size === 'xs' ? 'h-8 w-8' : size === 'sm' ? 'h-12 w-12' : 'h-14 w-14')} role="img" aria-label={`${label} ${score} of 100`} title={`${label}, out of 100`}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth={size === 'xs' ? 7 : 6} className="stroke-slate-200/70" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth={size === 'xs' ? 7 : 6} strokeLinecap="round" className={BAND_STYLE[band].stroke} strokeDasharray={`${(c * score) / 100} ${c}`} />
      </svg>
      <span className={clsx('font-semibold text-slate-900', size === 'xs' ? 'text-[11px]' : size === 'sm' ? 'text-base' : 'text-lg')}>{score}</span>
    </span>
  );
}

/** Match scores: green for strong, blue for good, amber for the rest. */
export const matchTone = (s: number) => (s >= 85 ? 'text-emerald-700' : s >= 70 ? 'text-blue-700' : 'text-amber-700');

/** A property match as the API sends it (the score is out of about 100). */
export type MatchItem = { property: Property; score: number; fit: 'strong' | 'good' | 'partial' };
