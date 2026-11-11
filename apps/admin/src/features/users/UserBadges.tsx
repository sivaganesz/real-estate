import { ROLE_LABELS } from '@real-estate/shared';
import type { Role, User } from '@real-estate/shared';
import { Badge } from '@/components/ui/badge';
import { formatExpiry } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Role chip. Dark mode: orange on a soft orange tint (Super Admin solid orange). */
export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge
      variant={role === 'super_admin' ? 'default' : 'secondary'}
      className={cn(
        'font-medium',
        role === 'super_admin' ? 'dark:bg-primary' : 'dark:bg-primary/15 dark:text-primary',
      )}
    >
      {ROLE_LABELS[role]}
    </Badge>
  );
}

/** Dark mode shows status as a coloured dot + label (green = active, amber = invited). */
function Dot({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('hidden size-2 rounded-full dark:inline-block', className)} />
  );
}

/** Status chip with a short explanation underneath (wireframe: Users table). */
export function StatusCell({ user }: { user: User }) {
  if (user.status === 'invited') {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="outline" className="border-dashed dark:hidden">
          Invited
        </Badge>
        <span className="hidden items-center gap-1.5 text-sm dark:inline-flex">
          <Dot className="bg-warning" /> Invited
        </span>
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
  return (
    <span className="inline-flex items-center gap-1.5 text-sm dark:text-success">
      <Dot className="bg-success" /> Active
    </span>
  );
}
