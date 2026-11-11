import { ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useBreadcrumbs } from './use-breadcrumbs';

export function Breadcrumbs() {
  const crumbs = useBreadcrumbs();
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />}
              {crumb.to && !last ? (
                <Link
                  to={crumb.to}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={
                    last ? 'truncate font-medium text-foreground' : 'truncate text-muted-foreground'
                  }
                  aria-current={last ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
