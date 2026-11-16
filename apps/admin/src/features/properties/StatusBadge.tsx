import { PROPERTY_STATUS_LABELS } from '@real-estate/shared';
import type { PropertyStatus } from '@real-estate/shared';
import { TONE_CHIP } from '@/components/patterns/tone';
import { cn } from '@/lib/utils';

/** Soft colour per status: green = live, amber = booked, blue = closed, grey = not live. */
const STYLE: Record<PropertyStatus, string> = {
  draft: 'border border-dashed border-foreground/25 text-muted-foreground',
  published: TONE_CHIP.green,
  unpublished: TONE_CHIP.grey,
  booked: TONE_CHIP.amber,
  sold: TONE_CHIP.blue,
  rented: TONE_CHIP.blue,
  leased: TONE_CHIP.blue,
  archived: `${TONE_CHIP.grey} line-through decoration-foreground/30`,
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
