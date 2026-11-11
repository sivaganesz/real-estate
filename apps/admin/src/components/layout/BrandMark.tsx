import { ChevronsLeftIcon, ChevronsRightIcon } from 'lucide-react';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const DEFAULT_NAME = 'Real Estate';

const TOGGLE_TILE =
  'flex items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors dark:bg-muted';

/**
 * Logo + company name (from Settings → Company info; defaults until it is set up).
 * `compact` shows the logo only (collapsed sidebar). With `onToggle` (desktop sidebar):
 * - expanded: a collapse button sits at the right end of the logo row;
 * - collapsed: hovering (or focusing) the logo swaps it for the expand button in the same spot.
 */
export function BrandMark({
  compact = false,
  onToggle,
  name,
  logoUrl,
}: {
  compact?: boolean;
  onToggle?: () => void;
  name?: string | null;
  logoUrl?: string | null;
}) {
  const companyName = name || DEFAULT_NAME;
  const logo = <CompanyLogo url={logoUrl} name={companyName} />;

  if (compact && onToggle) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Expand sidebar"
              onClick={onToggle}
              className="group/brand relative size-9 shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <span className="absolute inset-0 transition-opacity duration-150 group-hover/brand:opacity-0 group-focus-visible/brand:opacity-0">
                {logo}
              </span>
              <span
                className={`${TOGGLE_TILE} absolute inset-0 rounded-xl text-foreground opacity-0 transition-opacity duration-150 group-hover/brand:opacity-100 group-focus-visible/brand:opacity-100`}
              >
                <ChevronsRightIcon className="size-[18px]" />
              </span>
            </button>
          }
        />
        <TooltipContent side="right">Expand sidebar</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      {logo}
      {!compact && (
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-semibold" title={companyName}>
            {companyName}
          </div>
          <div className="truncate text-xs text-muted-foreground">Admin Portal</div>
        </div>
      )}
      {!compact && onToggle && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="Collapse sidebar"
                onClick={onToggle}
                className={`${TOGGLE_TILE} size-7 shrink-0 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 dark:hover:bg-accent`}
              >
                <ChevronsLeftIcon className="size-4" />
              </button>
            }
          />
          <TooltipContent side="right">Collapse sidebar</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
