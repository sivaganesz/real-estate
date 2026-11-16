import { PASSWORD_RULES } from '@real-estate/shared';
import { CircleCheckIcon, CircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Live checklist of the password rules (the same list the API enforces). */
export function PasswordRules({ password, confirm }: { password: string; confirm?: string }) {
  const rules = [
    ...PASSWORD_RULES.map((rule) => ({ label: rule.label, ok: rule.test(password) })),
    ...(confirm !== undefined
      ? [{ label: 'Both passwords match', ok: password.length > 0 && password === confirm }]
      : []),
  ];
  return (
    <ul className="grid gap-1 text-sm" aria-label="Password rules">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={cn(
            'flex items-center gap-2',
            rule.ok ? 'text-tone-green' : 'text-muted-foreground',
          )}
        >
          {rule.ok ? <CircleCheckIcon className="size-4" /> : <CircleIcon className="size-4" />}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
