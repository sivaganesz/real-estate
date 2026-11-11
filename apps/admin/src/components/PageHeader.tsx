import type { ComponentType, ReactNode } from 'react';

/** Page title with an icon, a short description and optional actions on the right. */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-foreground/5 dark:bg-primary/10 dark:text-primary">
            <Icon className="size-5" />
          </span>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
