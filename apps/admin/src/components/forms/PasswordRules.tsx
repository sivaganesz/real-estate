import { PASSWORD_MIN_LENGTH } from '@real-estate/shared';
import { CircleCheckIcon, CircleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Live checklist of the password rules (same rules the API enforces). */
export function PasswordRules({ password, confirm }: { password: string; confirm?: string }) {
  const rules = [
    {
      label: `At least ${PASSWORD_MIN_LENGTH} characters`,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    {
      label: 'Contains a letter and a number',
      ok: /[A-Za-z]/.test(password) && /\d/.test(password),
    },
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
            rule.ok ? 'text-emerald-700' : 'text-muted-foreground',
          )}
        >
          {rule.ok ? <CircleCheckIcon className="size-4" /> : <CircleIcon className="size-4" />}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
