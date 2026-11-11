import { ROLE_LABELS, ROLES } from '@real-estate/shared';
import type { User } from '@real-estate/shared';
import {
  BanIcon,
  KeyRoundIcon,
  LockOpenIcon,
  MailIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { IconButton } from '@/components/IconButton';
import { UserAvatar } from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/errors';
import { useUsers, useUserStats } from './api';
import { DeactivateUserDialog } from './DeactivateUserDialog';
import { statusDetail, statusOf } from './status';
import { RoleBadge, UserStatus } from './UserBadges';
import { UserStatsCards } from './UserStatsCards';
import type { StatusFilter } from './UserStatsCards';
import { useUserActions } from './useUserActions';

const PAGE_SIZE = 20;
const ROLE_ITEMS = [
  { value: 'all', label: 'All roles' },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

/** Filters live in the URL so a filtered list can be bookmarked or shared. */
function useFilters() {
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
  return {
    q: params.get('q') ?? '',
    role: params.get('role') ?? 'all',
    status: (['active', 'invited', 'locked', 'inactive'].includes(status ?? '')
      ? status
      : 'all') as StatusFilter,
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
    update,
  };
}

function UserRow({
  user,
  isSelf,
  onEdit,
  onDeactivate,
}: {
  user: User;
  isSelf: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
}) {
  const actions = useUserActions();
  const status = statusOf(user);

  return (
    <li className="group flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-card p-3 shadow-xs ring-1 ring-foreground/10 transition-colors hover:ring-foreground/20 sm:p-4 dark:shadow-none">
      <UserAvatar name={user.name} size="lg" />

      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold">{user.name}</span>
          <RoleBadge role={user.role} />
          {isSelf && (
            <Badge variant="outline" className="text-[10px]">
              You
            </Badge>
          )}
        </div>
        <div className="truncate text-sm text-muted-foreground">{user.email}</div>
      </div>

      <div className="flex min-w-40 flex-col items-start sm:items-end">
        <UserStatus user={user} />
        <span className="text-xs text-muted-foreground">{statusDetail(user)}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {status === 'invited' && (
          <IconButton
            label="Resend invite"
            disabled={actions.pending}
            onClick={() => actions.resendInvite(user)}
          >
            <MailIcon />
          </IconButton>
        )}
        {status === 'active' && !isSelf && (
          <IconButton
            label="Send password reset"
            disabled={actions.pending}
            onClick={() => actions.sendPasswordReset(user)}
          >
            <KeyRoundIcon />
          </IconButton>
        )}
        {status === 'locked' && (
          <IconButton
            label="Unlock account"
            disabled={actions.pending}
            onClick={() => actions.unlock(user)}
          >
            <LockOpenIcon />
          </IconButton>
        )}
        {status === 'inactive' && (
          <IconButton
            label="Reactivate"
            disabled={actions.pending}
            onClick={() => actions.reactivate(user)}
          >
            <RotateCcwIcon />
          </IconButton>
        )}
        {status !== 'inactive' && !isSelf && (
          <IconButton
            label="Deactivate"
            onClick={onDeactivate}
            className="text-muted-foreground hover:text-destructive"
          >
            <BanIcon />
          </IconButton>
        )}
      </div>
    </li>
  );
}

function RowSkeleton() {
  return (
    <li className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <Skeleton className="size-11 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="hidden h-8 w-28 sm:block" />
    </li>
  );
}

export function UsersList({ onEdit }: { onEdit: (user: User) => void }) {
  const { user: me } = useAuth();
  const filters = useFilters();
  const [search, setSearch] = useState(filters.q);
  const [deactivating, setDeactivating] = useState<User | null>(null);

  // Debounce typing in the search box.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (search.trim() !== filters.q) filters.update({ q: search.trim() || undefined });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const users = useUsers({
    page: filters.page,
    limit: PAGE_SIZE,
    ...(filters.q && { q: filters.q }),
    ...(filters.role !== 'all' && { role: filters.role as User['role'] }),
    ...(filters.status !== 'all' && { status: filters.status }),
  });
  const stats = useUserStats();
  const meta = users.data?.meta;
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;
  const hasFilters = Boolean(filters.q) || filters.role !== 'all' || filters.status !== 'all';

  const clearFilters = () => {
    setSearch('');
    filters.update({ q: undefined, role: undefined, status: undefined });
  };

  return (
    <div className="grid gap-5">
      <UserStatsCards
        stats={stats.data}
        value={filters.status}
        onChange={(status) => filters.update({ status })}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
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
          <SelectTrigger className="h-9 w-40 bg-card" aria-label="Filter by role">
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
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <ul className="grid gap-2.5" aria-label="Users" aria-busy={users.isFetching}>
        {users.isPending && Array.from({ length: 4 }, (_, i) => <RowSkeleton key={i} />)}

        {users.isError && (
          <li className="rounded-xl bg-card p-8 text-center ring-1 ring-foreground/10">
            <p className="text-sm text-destructive">{errorMessage(users.error)}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void users.refetch()}
            >
              Try again
            </Button>
          </li>
        )}

        {users.data?.items.length === 0 && (
          <li className="flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <SearchXIcon className="size-5 text-muted-foreground" />
            </span>
            <p className="font-medium">No users match</p>
            <p className="text-sm text-muted-foreground">
              Try a different search or clear the filters.
            </p>
            {hasFilters && (
              <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </li>
        )}

        {users.data?.items.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isSelf={user.id === me?.id}
            onEdit={() => onEdit(user)}
            onDeactivate={() => setDeactivating(user)}
          />
        ))}
      </ul>

      {meta && meta.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {from}–{to} of {meta.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => filters.update({ page: String(meta.page - 1) })}
            >
              ‹ Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => filters.update({ page: String(meta.page + 1) })}
            >
              Next ›
            </Button>
          </div>
        </div>
      )}

      {deactivating && (
        <DeactivateUserDialog
          user={deactivating}
          open
          onOpenChange={(open) => !open && setDeactivating(null)}
        />
      )}
    </div>
  );
}
