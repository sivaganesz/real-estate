import { formatPhone, ROLE_LABELS, ROLES } from '@real-estate/shared';
import type { User } from '@real-estate/shared';
import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/errors';
import { formatLastSeen } from '@/lib/format';
import { useUsers, useUserStats } from './api';
import { RoleBadge, StatusCell } from './UserBadges';
import { useUserActions } from './useUserActions';

const PAGE_SIZE = 20;

const ROLE_ITEMS = [
  { value: 'all', label: 'All roles' },
  ...ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];
const STATUS_ITEMS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited' },
  { value: 'locked', label: 'Locked' },
  { value: 'inactive', label: 'Inactive' },
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
  return {
    q: params.get('q') ?? '',
    role: params.get('role') ?? 'all',
    status: params.get('status') ?? 'all',
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
    update,
  };
}

export function UsersTable({ onEdit }: { onEdit: (user: User) => void }) {
  const { user: me } = useAuth();
  const filters = useFilters();
  const [search, setSearch] = useState(filters.q);
  const actions = useUserActions();

  // Debounce typing in the search box.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (search.trim() !== filters.q) filters.update({ q: search.trim() || undefined });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = {
    page: filters.page,
    limit: PAGE_SIZE,
    ...(filters.q && { q: filters.q }),
    ...(filters.role !== 'all' && { role: filters.role as User['role'] }),
    ...(filters.status !== 'all' && { status: filters.status as 'active' }),
  };
  const users = useUsers(query);
  const stats = useUserStats();
  const meta = users.data?.meta;
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or phone…"
              className="pl-8"
              aria-label="Search users"
            />
          </div>
          <Select
            items={ROLE_ITEMS}
            value={filters.role}
            onValueChange={(value) => filters.update({ role: value ?? undefined })}
          >
            <SelectTrigger className="w-40" aria-label="Filter by role">
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
          <Select
            items={STATUS_ITEMS}
            value={filters.status}
            onValueChange={(value) => filters.update({ status: value ?? undefined })}
          >
            <SelectTrigger className="w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {stats.data && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">{stats.data.active} active</Badge>
            <Badge variant="outline" className="border-dashed">
              {stats.data.invited} invited
            </Badge>
            <Badge variant={stats.data.locked > 0 ? 'destructive' : 'secondary'}>
              {stats.data.locked} locked
            </Badge>
            <Badge variant="secondary">{stats.data.inactive} inactive</Badge>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isPending &&
                Array.from({ length: 4 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }, (__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full max-w-36" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {users.isError && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <p className="text-sm text-destructive">{errorMessage(users.error)}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => void users.refetch()}
                    >
                      Try again
                    </Button>
                  </TableCell>
                </TableRow>
              )}

              {users.data?.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No users match these filters.
                  </TableCell>
                </TableRow>
              )}

              {users.data?.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {user.name}
                      {user.id === me?.id && (
                        <Badge variant="outline" className="text-[10px]">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {user.phone ? formatPhone(user.phone) : '—'}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={user.role} />
                  </TableCell>
                  <TableCell>
                    <StatusCell user={user} />
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                    {formatLastSeen(user.lastLoginAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {user.status === 'invited' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actions.pending}
                          onClick={() => actions.resendInvite(user)}
                        >
                          Resend invite
                        </Button>
                      )}
                      {user.status === 'active' && user.locked && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actions.pending}
                          onClick={() => actions.unlock(user)}
                        >
                          Unlock
                        </Button>
                      )}
                      {user.status === 'inactive' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actions.pending}
                          onClick={() => actions.reactivate(user)}
                        >
                          Reactivate
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => onEdit(user)}>
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
      </CardContent>
    </Card>
  );
}
