import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useRoleOptions } from './api';

/** Role cards with a short description each (wireframe: Invite user). Roles come from the API. */
export function RolePicker({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: string | undefined;
  onChange: (role: string) => void;
  disabled?: boolean;
}) {
  const roles = useRoleOptions();
  if (roles.isPending) return <Skeleton className="h-40 w-full" />;
  if (roles.isError) {
    return (
      <p className="text-sm text-destructive">Roles couldn&apos;t be loaded. Reload the page.</p>
    );
  }
  return (
    <div role="radiogroup" className="grid gap-2">
      {roles.data.map((role) => (
        <label
          key={role.key}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
            value === role.key ? 'border-primary bg-muted dark:bg-primary/10' : 'hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name={name}
            value={role.key}
            checked={value === role.key}
            onChange={() => onChange(role.key)}
            disabled={disabled}
            className="mt-1 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">{role.name}</span>
            {role.description && (
              <span className="block text-xs text-muted-foreground">{role.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
