import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
} as const;

/** Initials in a rounded square (dark mode: orange on a soft orange tint, as in the reference). */
export function UserAvatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-foreground dark:bg-primary/15 dark:text-primary',
        SIZES[size],
        className,
      )}
    >
      {initials(name) || '?'}
    </span>
  );
}
