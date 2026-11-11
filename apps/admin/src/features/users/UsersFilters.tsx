import { ROLE_LABELS, ROLES } from '@real-estate/shared';
import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserFilters } from './useUserFilters';

const ROLE_ITEMS = [
  { value: 'all', label: 'All roles' },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

/** Search box + role filter for the users list (top row of Users & Roles). */
export function UsersFilters() {
  const filters = useUserFilters();
  const [search, setSearch] = useState(filters.q);

  // Debounce typing in the search box.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (search.trim() !== filters.q) filters.update({ q: search.trim() || undefined });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Filters cleared elsewhere (e.g. "Clear filters" in the empty list): empty the box too.
  useEffect(() => {
    if (filters.q === '' && search.trim() !== '') setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q]);

  return (
    // `contents`: the search, filter and Clear join the page's top row, so they wrap with the
    // Invite button (on phones: search on one line, filter + Invite on the next).
    <div className="contents">
      <div className="relative min-w-52 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone…"
          className="h-9 bg-card pl-8"
          aria-label="Search users"
        />
      </div>
      <Select
        items={ROLE_ITEMS}
        value={filters.role}
        onValueChange={(value) => filters.update({ role: value ?? undefined })}
      >
        <SelectTrigger className="h-9 w-36 bg-card" aria-label="Filter by role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filters.hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            filters.clear();
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
