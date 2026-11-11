import { ROLE_LABELS } from '@real-estate/shared';
import type { Role, User } from '@real-estate/shared';
import { Badge } from '@/components/ui/badge';
import { formatExpiry } from '@/lib/format';

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === 'super_admin' ? 'default' : 'secondary'} className="font-medium">
      {ROLE_LABELS[role]}
    </Badge>
  );
}

/** Status chip with a short explanation underneath (wireframe: Users table). */
export function StatusCell({ user }: { user: User }) {
  if (user.status === 'invited') {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="outline" className="border-dashed">
          Invited
        </Badge>
        <span className="text-xs text-muted-foreground">{formatExpiry(user.inviteExpiresAt)}</span>
      </div>
    );
  }
  if (user.status === 'inactive') {
    return <Badge variant="secondary">Inactive</Badge>;
  }
  if (user.locked) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="destructive">Locked</Badge>
        <span className="text-xs text-muted-foreground">too many failed logins</span>
      </div>
    );
  }
  return <span className="text-sm">Active</span>;
}
