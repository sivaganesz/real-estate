import { useSearchParams } from 'react-router';
import type { StatusFilter } from './UserStatsCards';

/** Users list filters live in the URL, so a filtered list can be bookmarked or shared. */
export function useUserFilters() {
  const [params, setParams] = useSearchParams();
  const update = (changes: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value && value !== 'all') next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page');
        return next;
      },
      { replace: true },
    );
  const status = params.get('status');
  const q = params.get('q') ?? '';
  const role = params.get('role') ?? 'all';
  const normalizedStatus = (
    ['active', 'invited', 'locked', 'inactive'].includes(status ?? '') ? status : 'all'
  ) as StatusFilter;
  return {
    q,
    role,
    status: normalizedStatus,
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
    hasFilters: Boolean(q) || role !== 'all' || normalizedStatus !== 'all',
    update,
    clear: () => update({ q: undefined, role: undefined, status: undefined }),
  };
}
