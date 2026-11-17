import { PROPERTY_STATUS_LABELS } from '@real-estate/shared';
import type { PropertyStatus } from '@real-estate/shared';
import { TONE_CHIP } from '@/components/patterns/tone';
import { cn } from '@/lib/utils';

/**
 * Status chips with the wireframe's tones: Available green, Under negotiation purple,
 * Reserved and Booked blue, On hold amber, closed grey, Draft dashed.
 */
const STYLE: Record<PropertyStatus, string> = {
  draft: 'border border-dashed border-foreground/25 text-muted-foreground',
  available: TONE_CHIP.green,
  under_negotiation: TONE_CHIP.purple,
  reserved: TONE_CHIP.blue,
  booked: TONE_CHIP.blue,
  on_hold: TONE_CHIP.amber,
  sold: TONE_CHIP.grey,
  rented: TONE_CHIP.grey,
  leased: TONE_CHIP.grey,
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
