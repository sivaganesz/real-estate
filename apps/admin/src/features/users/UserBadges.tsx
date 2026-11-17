import type { User } from '@real-estate/shared';
import { TONE_CHIP } from '@/components/patterns/tone';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusDetail, statusOf } from './status';
import type { StatusKind } from './status';

/** One colour per system role; custom roles share a neutral chip. */
const ROLE_STYLE: Record<string, string> = {
  admin: TONE_CHIP.amber,
  sales_manager: TONE_CHIP.purple,
  sales_executive: TONE_CHIP.blue,
};
const CUSTOM_ROLE_STYLE = TONE_CHIP.grey;

/** Role chip: Admin amber, Sales Manager purple, Sales Executive blue, custom roles grey. */
export function RoleBadge({
  role,
  name,
  className,
}: {
  role: string;
  name: string;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      data-role={role}
      className={cn('rounded-md font-medium', ROLE_STYLE[role] ?? CUSTOM_ROLE_STYLE, className)}
    >
      {name}
    </Badge>
  );
}

const STATUS_STYLE: Record<StatusKind, { label: string; dot: string; text: string }> = {
  active: { label: 'Active', dot: 'bg-success', text: 'text-success' },
  invited: { label: 'Invited', dot: 'bg-warning', text: 'text-foreground' },
  locked: { label: 'Locked', dot: 'bg-destructive', text: 'text-destructive' },
  inactive: { label: 'Inactive', dot: 'bg-muted-foreground/50', text: 'text-muted-foreground' },
};

/** Status as a coloured dot + label (green active, amber invited, red locked, grey inactive). */
export function UserStatus({ user, className }: { user: User; className?: string }) {
  const style = STATUS_STYLE[statusOf(user)];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-sm font-medium', style.text, className)}
    >
      <span aria-hidden className={cn('size-2 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}

/** Status with its detail line (used in the edit drawer header). */
export function StatusCell({ user }: { user: User }) {
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <UserStatus user={user} />
      <span className="text-xs text-muted-foreground">{statusDetail(user)}</span>
    </span>
  );
}
