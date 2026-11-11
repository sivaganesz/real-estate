import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from '@real-estate/shared';
import type { Role } from '@real-estate/shared';
import { cn } from '@/lib/utils';

/** Role cards with a short description each (wireframe: Invite user). */
export function RolePicker({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: Role | undefined;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {ROLES.map((role) => (
        <label
          key={role}
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
            value === role ? 'border-primary bg-muted' : 'hover:bg-muted/50',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name={name}
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
            disabled={disabled}
            className="mt-1 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">{ROLE_LABELS[role]}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
