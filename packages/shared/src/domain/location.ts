/**
 * What a listing may claim about the surroundings (PRD v2 PROP-25/26, GEN-03): only places
 * that exist **and** whose route was checked are advertised; planned infrastructure is shown
 * as future, never as existing; unchecked routes are hidden until verified.
 */
interface Place {
  name: string;
  distanceKm: number | null;
  routeChecked: boolean;
  status: 'existing' | 'under_construction' | 'planned' | 'proposed';
}

export type Advertising = 'ok' | 'route_not_checked' | 'not_existing';

/** The advertising chip for one nearby place. */
export function advertising(place: Pick<Place, 'routeChecked' | 'status'>): Advertising {
  if (place.status !== 'existing') return 'not_existing';
  return place.routeChecked ? 'ok' : 'route_not_checked';
}

export const ADVERTISING_LABELS: Record<Advertising, string> = {
  ok: 'OK to advertise',
  route_not_checked: 'Route not checked',
  not_existing: 'Not an existing benefit',
};

/** The customer-facing preview: verified places, future infrastructure, hidden count. */
export function customerPreview<T extends Place>(nearby: T[]) {
  const named = nearby.filter((n) => n.name.trim() !== '');
  return {
    verified: named.filter((n) => advertising(n) === 'ok'),
    future: named.filter((n) => advertising(n) === 'not_existing'),
    hiddenCount: named.filter((n) => advertising(n) === 'route_not_checked').length,
  };
}
