import { useQuery } from '@tanstack/react-query';
import {
  AREA_UNIT_LABEL,
  AVAILABILITY_LABEL,
  PROPERTY_TYPE_LABEL,
  formatINR,
  type AreaUnit,
  type Availability,
  type ListingState,
  type PropertyType,
  type Purpose,
  type Readiness,
} from '@estate/shared';
import { api } from './api';
import type { Tone } from '../components/ui';

export type Property = {
  id: string;
  code: string;
  title: string;
  type: PropertyType;
  purpose: Purpose;
  projectId: string | null;
  block?: string | null;
  unitNumber?: string | null;
  price?: number | null;
  priceNegotiable?: boolean;
  area?: number | null;
  areaUnit: AreaUnit;
  areaSqft?: number | null;
  city?: string | null;
  locality?: string | null;
  address?: string | null;
  pincode?: string | null;
  details: Record<string, string | number | boolean | null>;
  extras: { label: string; value: string; internal?: boolean }[];
  amenities: string[];
  description?: string | null;
  highlights: string[];
  media: { url: string; kind: string; caption?: string }[];
  documents: { name: string; url: string; uploadedAt: string }[];
  approvals: { name: string; documentUrl?: string | null; verified?: boolean }[];
  listing: ListingState;
  availability: Availability;
  heldUntil?: string | null;
  sources?: Record<string, string>;
  enquiries?: number;
  readiness: Readiness;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  code: string;
  name: string;
  type: PropertyType;
  status: 'upcoming' | 'under_construction' | 'ready';
  city: string;
  locality: string;
  address?: string;
  reraNumber?: string;
  possessionDate?: string;
  description?: string;
  amenities: string[];
  blocks: { name: string; floors: number }[];
  inventory?: { total: number; draft: number; available: number; held: number; booked: number; sold: number; priceFrom: number | null; priceTo: number | null };
};

export const AVAILABILITY_TONE: Record<Availability, Tone> = { available: 'green', held: 'amber', booked: 'blue', sold: 'slate' };

export function priceLabel(p: Pick<Property, 'price' | 'purpose'>) {
  if (!p.price) return 'Price on request';
  return p.purpose === 'sale' ? formatINR(p.price) : `${formatINR(p.price, { short: false })}/mo`;
}

export function areaLabel(p: Pick<Property, 'area' | 'areaUnit'>) {
  return p.area ? `${p.area.toLocaleString('en-IN')} ${AREA_UNIT_LABEL[p.areaUnit]}` : null;
}

/** The three or four facts a salesperson says first about this type. */
export function keyFacts(p: Pick<Property, 'type' | 'details' | 'area' | 'areaUnit'>): string[] {
  const d = p.details ?? {};
  const out: string[] = [];
  if (d.bedrooms) out.push(`${d.bedrooms} BHK`);
  const a = areaLabel(p);
  if (a) out.push(a);
  if (p.type === 'apartment' && d.floor !== undefined && d.floor !== null) out.push(d.floor === 0 ? 'Ground floor' : `Floor ${d.floor}${d.totalFloors ? `/${d.totalFloors}` : ''}`);
  if (p.type === 'plot' && d.length && d.width) out.push(`${d.width}×${d.length} ft`);
  if (d.facing) out.push(`${d.facing} facing`);
  if (d.usage) out.push(String(d.usage));
  if (d.waterSource) out.push(String(d.waterSource));
  return out.slice(0, 4);
}

export const typeLabel = (t: PropertyType) => PROPERTY_TYPE_LABEL[t];
export const availabilityLabel = (a: Availability) => AVAILABILITY_LABEL[a];

export function usePlaces() {
  return useQuery({ queryKey: ['places'], queryFn: () => api.get<{ cities: string[]; localities: string[] }>('/properties/places'), staleTime: 5 * 60_000 });
}

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: () => api.get<{ items: Project[] }>('/projects'), select: (d) => d.items });
}
