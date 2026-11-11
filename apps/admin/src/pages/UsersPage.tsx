import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/PageHeader';

export function UsersPage() {
  return (
    <>
      <PageHeader title="Users & Roles" description="Staff accounts and what each role can do" />
      <ComingSoon
        step="Step 1.5"
        summary="This screen follows the approved Phase 1 wireframe."
        items={[
          'User list with search, role and status filters',
          'Invite user (email with a 72-hour link), resend invite',
          'Edit user, change role, deactivate / reactivate',
          'Send password reset, unlock a locked account',
          'Read-only roles & permissions table',
        ]}
      />
    </>
  );
}
