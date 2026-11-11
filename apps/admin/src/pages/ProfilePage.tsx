import { ROLE_LABELS } from '@real-estate/shared';
import { useAuth } from '@/auth/auth-context';
import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      <PageHeader title="My Profile" description="Your account details and password" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Signed in as</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user.email}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{user.phone ?? '—'}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>
                <Badge>{ROLE_LABELS[user.role]}</Badge>
              </dd>
            </dl>
          </CardContent>
        </Card>
        <ComingSoon
          step="Step 1.6"
          summary="Editing your details comes with the My Profile step."
          items={['Edit name and phone', 'Change password (needs your current password)']}
        />
      </div>
    </>
  );
}
