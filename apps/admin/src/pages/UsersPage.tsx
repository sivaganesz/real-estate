import type { User } from '@real-estate/shared';
import { UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditUserSheet } from '@/features/users/EditUserSheet';
import { InviteUserSheet } from '@/features/users/InviteUserSheet';
import { RolesMatrix } from '@/features/users/RolesMatrix';
import { UsersFilters } from '@/features/users/UsersFilters';
import { UsersList } from '@/features/users/UsersList';

/**
 * Users & Roles (Super Admin only). `tab` comes from the route: /users or /users/roles.
 * No page title: the sidebar and breadcrumbs already say where you are.
 */
export function UsersPage({ tab }: { tab: 'users' | 'roles' }) {
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  return (
    <>
      {/* One compact top row: tabs, then search / filter (Users tab) and Invite on the right. */}
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Tabs
          value={tab}
          onValueChange={(value) => navigate(value === 'roles' ? '/users/roles' : '/users')}
        >
          <TabsList variant="line">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles &amp; permissions</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex min-w-0 flex-[1_1_480px] flex-wrap items-center justify-end gap-2">
          {tab === 'users' && <UsersFilters />}
          <Button className="h-9" onClick={() => setInviteOpen(true)}>
            <UserPlusIcon /> Invite user
          </Button>
        </div>
      </div>

      {tab === 'users' ? (
        <>
          <UsersList onEdit={setEditing} />
          <p className="mt-5 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            Users are never deleted. Deactivate them instead, so their history is kept. You
            can&apos;t deactivate or change your own role, and there is always at least one active
            Super Admin.
          </p>
        </>
      ) : (
        <RolesMatrix />
      )}

      <InviteUserSheet open={inviteOpen} onOpenChange={setInviteOpen} />
      <EditUserSheet
        key={editing?.id ?? 'none'}
        userId={editing?.id ?? null}
        initialUser={editing ?? undefined}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
