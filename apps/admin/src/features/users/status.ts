import type { User } from '@real-estate/shared';
import { formatExpiry, formatLastSeen } from '@/lib/format';

export type StatusKind = 'active' | 'invited' | 'locked' | 'inactive';

export function statusOf(user: User): StatusKind {
  if (user.status === 'invited') return 'invited';
  if (user.status === 'inactive') return 'inactive';
  return user.locked ? 'locked' : 'active';
}

/** One-line context under the status: last active, invite expiry, lock reason. */
export function statusDetail(user: User): string {
  switch (statusOf(user)) {
    case 'invited':
      return `Invite ${formatExpiry(user.inviteExpiresAt) ?? 'sent'}`;
    case 'locked':
      return 'Locked after failed sign-ins';
    case 'inactive':
      return `Deactivated · Last active ${formatLastSeen(user.lastLoginAt)}`;
    default:
      return `Last active: ${formatLastSeen(user.lastLoginAt)}`;
  }
}
