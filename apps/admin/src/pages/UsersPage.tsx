import type { User } from '@real-estate/shared';
import { UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditUserSheet } from '@/features/users/EditUserSheet';
import { InviteUserSheet } from '@/features/users/InviteUserSheet';
import { RolesMatrix } from '@/features/users/RolesMatrix';
import { UsersTable } from '@/features/users/UsersTable';

/** Users & Roles (Super Admin only). `tab` comes from the route: /users or /users/roles. */
export function UsersPage({ tab }: { tab: 'users' | 'roles' }) {
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Staff accounts and what each role can do"
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlusIcon /> Invite user
          </Button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) => navigate(value === 'roles' ? '/users/roles' : '/users')}
        className="mb-4"
      >
        <TabsList variant="line">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles &amp; permissions</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'users' ? (
        <>
          <UsersTable onEdit={setEditing} />
          <p className="mt-4 rounded-lg border border-dashed bg-background p-3 text-xs text-muted-foreground">
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
