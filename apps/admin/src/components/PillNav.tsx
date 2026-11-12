import { NavLink } from 'react-router';
import { cn } from '@/lib/utils';

/** `exact: false` keeps the tab active on its sub-pages too (e.g. /settings/property-types/amenities). */
export type PillNavItem =
  { label: string; to: string; exact?: boolean } | { label: string; phase: string };

const TAB =
  'flex h-8 flex-none items-center gap-1.5 rounded-md px-4 text-sm font-semibold whitespace-nowrap';

/**
 * Page tabs as a segmented pill bar: the active tab is filled with the primary colour
 * (orange in dark mode). Items with a `phase` are shown greyed out ("available later").
 */
export function PillNav({ label, items }: { label: string; items: PillNavItem[] }) {
  return (
    <nav
      aria-label={label}
      className="flex max-w-full flex-none gap-1 overflow-x-auto rounded-lg border bg-card p-1"
    >
      {items.map((item) =>
        'to' in item ? (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.exact ?? true}
            className={({ isActive }) =>
              cn(
                TAB,
                'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )
            }
          >
            {item.label}
          </NavLink>
        ) : (
          <span
            key={item.label}
            className={cn(TAB, 'cursor-not-allowed text-muted-foreground/60')}
            title={`Available in ${item.phase}`}
            aria-disabled="true"
          >
            {item.label}
            <span className="rounded border border-dashed px-1 text-[10px] font-normal">
              {item.phase}
            </span>
          </span>
        ),
      )}
    </nav>
  );
}
