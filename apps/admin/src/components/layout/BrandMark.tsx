import { Building2Icon } from 'lucide-react';

/**
 * Logo + product name. `compact` shows the logo only (collapsed sidebar).
 * The company logo and name come from Settings → Company info (step 1.7).
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
        <Building2Icon className="size-5" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className="truncate font-semibold">Real Estate</div>
          <div className="truncate text-xs text-muted-foreground">Admin Portal</div>
        </div>
      )}
    </div>
  );
}
