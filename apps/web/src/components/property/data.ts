import { useQuery } from '@tanstack/react-query';
import { AREA_UNIT_LABEL, formatINR, toSqft, type AreaUnit, type Stage } from '@estate/shared';
import { api } from '../../lib/api';
import type { Property } from '../../lib/property';
import type { Fit, Reason } from '../../features/matching';

export type Buyer = { lead: { id: string; name: string; phone: string; stage: Stage; temperature: 'hot' | 'warm' | 'cold'; owner: string | null }; fit: Fit; reasons: Reason[] };
export type Comparables = {
  rate: number | null;
  items: { id: string; title: string; code: string; locality?: string | null; price: number; areaSqft: number; rate: number; availability: string; open: boolean }[];
  stats: { min: number; max: number; median: number; count: number } | null;
  verdict: 'in_line' | 'above' | 'below' | null;
};
export type HistoryKind = 'details' | 'price' | 'status' | 'documents' | 'photos' | 'buyers' | 'deal';
export type HistoryItem = { id: string; at: string; kind: HistoryKind; text: string; by?: string | null; viaAI?: boolean; leadId?: string };

/** Buyers can only be matched to live listings that are still for sale. */
export const canMatch = (p: Property) => p.listing === 'live' && p.availability !== 'sold' && p.availability !== 'booked';

export function useBuyers(p: Property) {
  return useQuery({ queryKey: ['buyers', p.id], queryFn: () => api.get<{ items: Buyer[] }>(`/matching/property/${p.id}`), enabled: canMatch(p), select: (d) => d.items });
}

export function useComparables(id: string) {
  return useQuery({ queryKey: ['property', id, 'comparables'], queryFn: () => api.get<Comparables>(`/properties/${id}/comparables`) });
}

export function usePropertyHistory(id: string) {
  return useQuery({ queryKey: ['property', id, 'history'], queryFn: () => api.get<{ items: HistoryItem[] }>(`/properties/${id}/history`), select: (d) => d.items });
}

export const VERDICT: Record<NonNullable<Comparables['verdict']>, { label: string; tone: string }> = {
  in_line: { label: 'In line with similar properties', tone: 'bg-emerald-50 text-emerald-700' },
  above: { label: 'Above similar properties', tone: 'bg-amber-50 text-amber-800' },
  below: { label: 'Below similar properties', tone: 'bg-sky-50 text-sky-700' },
};

/** A per-sq.ft rate in whole rupees (the API can send 4705.88). */
export const perSqft = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const LAND_UNITS: readonly AreaUnit[] = ['acre', 'cent', 'ground'];

/**
 * How to show a rate for this property. Rates come from the API per sq.ft;
 * land sold by the acre, cent or ground reads in that unit ("₹34 L/acre").
 */
export function rateIn(p: Pick<Property, 'areaUnit'>): { unit: string; format: (perSqftRate: number) => string } {
  if (LAND_UNITS.includes(p.areaUnit)) {
    const sqftPerUnit = toSqft(1, p.areaUnit);
    return { unit: AREA_UNIT_LABEL[p.areaUnit], format: (n) => formatINR(Math.round(n * sqftPerUnit)) };
  }
  return { unit: 'sq.ft', format: perSqft };
}
