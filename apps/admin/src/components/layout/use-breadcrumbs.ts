import { useMatches } from 'react-router';

export interface Crumb {
  label: string;
  to?: string;
}

/** Routes declare `handle: { breadcrumbs: [...] }`; the deepest match wins. */
export function useBreadcrumbs(): Crumb[] {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle as { breadcrumbs?: Crumb[] } | undefined;
    if (handle?.breadcrumbs) return handle.breadcrumbs;
  }
  return [];
}
