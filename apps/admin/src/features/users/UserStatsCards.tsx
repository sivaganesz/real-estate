import type { UserStats } from '@real-estate/shared';
import { BanIcon, CircleCheckIcon, LockIcon, MailIcon, UsersIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'active' | 'invited' | 'locked' | 'inactive';

const CARDS: {
  key: StatusFilter;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  count: (s: UserStats) => number;
}[] = [
  {
    key: 'all',
    label: 'All users',
    icon: UsersIcon,
    tone: 'bg-muted text-foreground dark:bg-primary/10 dark:text-primary',
    count: (s) => s.active + s.invited + s.inactive,
  },
  {
    key: 'active',
    label: 'Active',
    icon: CircleCheckIcon,
    tone: 'bg-success/10 text-success',
    count: (s) => s.active,
  },
  {
    key: 'invited',
    label: 'Invited',
    icon: MailIcon,
    tone: 'bg-warning/15 text-warning',
    count: (s) => s.invited,
  },
  {
    key: 'locked',
    label: 'Locked',
    icon: LockIcon,
    tone: 'bg-destructive/10 text-destructive',
    count: (s) => s.locked,
  },
  {
    key: 'inactive',
    label: 'Inactive',
    icon: BanIcon,
    tone: 'bg-muted text-muted-foreground',
    count: (s) => s.inactive,
  },
];

/** Status summary; each card is also a filter for the list below. */
export function UserStatsCards({
  stats,
  value,
  onChange,
}: {
  stats: UserStats | undefined;
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      role="group"
      aria-label="Filter by status"
    >
      {CARDS.map(({ key, label, icon: Icon, tone, count }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected && key !== 'all' ? 'all' : key)}
            className={cn(
              'flex items-center gap-3 rounded-xl bg-card p-3 text-left shadow-xs ring-1 ring-foreground/10 transition-all hover:ring-foreground/20 dark:shadow-none',
              selected && 'ring-2 ring-primary hover:ring-primary',
            )}
          >
            <span
              className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone)}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              {stats ? (
                <span className="block text-xl leading-tight font-semibold tabular-nums">
                  {count(stats)}
                </span>
              ) : (
                <Skeleton className="mb-1 h-5 w-8" />
              )}
              <span className="block truncate text-xs text-muted-foreground">{label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
