import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A large selectable card (category / subcategory). */
export function PickCard({
  title,
  subtitle,
  selected = false,
  disabled = false,
  dashed = false,
  badge,
  onClick,
}: {
  title: string;
  subtitle?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  dashed?: boolean;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={onClick && !dashed ? selected : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-16 w-full flex-col items-start justify-center gap-0.5 rounded-xl border bg-card px-4 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:border-foreground/30 hover:bg-muted/60',
        dashed && 'border-dashed',
        disabled &&
          'cursor-not-allowed border-dashed text-muted-foreground hover:border-border hover:bg-card',
      )}
    >
      <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
        <span className="truncate">{title}</span>
        {badge}
      </span>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </button>
  );
}
