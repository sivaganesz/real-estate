import type { User } from '@real-estate/shared';
import {
  BanIcon,
  KeyRoundIcon,
  LockOpenIcon,
  MailIcon,
  RotateCcwIcon,
  SearchXIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/auth/auth-context';
import { IconButton } from '@/components/IconButton';
import { UserAvatar } from '@/components/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/errors';
import { useUsers, useUserStats } from './api';
import { DeactivateUserDialog } from './DeactivateUserDialog';
import { statusDetail, statusOf } from './status';
import { RoleBadge, UserStatus } from './UserBadges';
import { UserStatsCards } from './UserStatsCards';
import { useUserActions } from './useUserActions';
import { useUserFilters } from './useUserFilters';

const PAGE_SIZE = 20;
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
  const filters = useUserFilters();
  const [deactivating, setDeactivating] = useState<User | null>(null);

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
  const { hasFilters, clear: clearFilters } = filters;

  return (
    <div className="grid gap-5">
      <UserStatsCards
        stats={stats.data}
        value={filters.status}
        onChange={(status) => filters.update({ status })}
      />

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
