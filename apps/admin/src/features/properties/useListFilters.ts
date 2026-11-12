import { PROPERTY_STATUSES, PURPOSES } from '@real-estate/shared';
import type { ListPropertiesQuery, PropertyStatus, Purpose } from '@real-estate/shared';
import { useSearchParams } from 'react-router';

/** Price filter presets (rupees). */
export const PRICE_RANGES = [
  { value: 'any', label: 'Any price' },
  { value: 'u25l', label: 'Under ₹25 L', max: 2_500_000 },
  { value: '25l-50l', label: '₹25 L – ₹50 L', min: 2_500_000, max: 5_000_000 },
  { value: '50l-1cr', label: '₹50 L – ₹1 Cr', min: 5_000_000, max: 10_000_000 },
  { value: 'o1cr', label: 'Above ₹1 Cr', min: 10_000_000 },
] as const;

export const SORTS = [
  { value: '-updatedAt', label: 'Recently updated' },
  { value: '-createdAt', label: 'Newest first' },
  { value: 'price.amount', label: 'Price: low to high' },
  { value: '-price.amount', label: 'Price: high to low' },
  { value: '-area.sqft', label: 'Largest first' },
] as const;

export const PAGE_SIZE = 20;

/** Property list filters live in the URL, so a filtered list can be bookmarked or shared. */
export function usePropertyFilters() {
  const [params, setParams] = useSearchParams();
  const update = (changes: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value && value !== 'all' && value !== 'any') next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  const pick = <T extends string>(key: string, allowed: readonly T[]): T | 'all' => {
    const value = params.get(key);
    return value && (allowed as readonly string[]).includes(value) ? (value as T) : 'all';
  };
  const status = pick<PropertyStatus>('status', PROPERTY_STATUSES);
  const purpose = pick<Purpose>('purpose', PURPOSES);
  const price = PRICE_RANGES.find((r) => r.value === params.get('price')) ?? PRICE_RANGES[0];
  const sort = SORTS.find((s) => s.value === params.get('sort')) ?? SORTS[0];
  const q = params.get('q') ?? '';
  const subcategoryId = params.get('type') ?? 'all';
  const city = params.get('city') ?? '';
  const featured = params.get('featured') === '1';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const query: Partial<ListPropertiesQuery> = {
    page,
    limit: PAGE_SIZE,
    sort: sort.value,
    ...(status !== 'all' && { status }),
    ...(purpose !== 'all' && { purpose }),
    ...(subcategoryId !== 'all' && { subcategoryId }),
    ...(q && { q }),
    ...(city && { city }),
    ...(featured && { featured: true }),
    ...('min' in price && { minPrice: price.min }),
    ...('max' in price && { maxPrice: price.max }),
  };

  return {
    status,
    purpose,
    price: price.value,
    sort: sort.value,
    q,
    subcategoryId,
    city,
    featured,
    page,
    query,
    hasFilters:
      Boolean(q || city || featured) ||
      purpose !== 'all' ||
      subcategoryId !== 'all' ||
      price.value !== 'any',
    update,
    clear: () =>
      update({
        q: undefined,
        purpose: undefined,
        type: undefined,
        city: undefined,
        price: undefined,
        featured: undefined,
      }),
  };
}
