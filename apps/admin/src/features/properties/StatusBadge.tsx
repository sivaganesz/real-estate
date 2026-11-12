import { PROPERTY_STATUS_LABELS } from '@real-estate/shared';
import type { PropertyStatus } from '@real-estate/shared';
import { cn } from '@/lib/utils';

/** Soft colour per status: green = live, amber = booked, blue = closed, grey = not live. */
const STYLE: Record<PropertyStatus, string> = {
  draft: 'border border-dashed border-foreground/25 text-muted-foreground',
  published: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400',
  unpublished: 'bg-muted text-muted-foreground',
  booked: 'bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400',
  sold: 'bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-400',
  rented: 'bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-400',
  leased: 'bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-400',
  archived: 'bg-muted text-muted-foreground line-through decoration-foreground/30',
};

export function StatusBadge({ status, className }: { status: PropertyStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        STYLE[status],
        className,
      )}
    >
      {PROPERTY_STATUS_LABELS[status]}
    </span>
  );
}
