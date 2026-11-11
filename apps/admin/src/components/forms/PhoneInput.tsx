import type { ChangeEvent, ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const MAX_DIGITS = 10;

/**
 * Indian mobile number field: a fixed "+91" prefix and digits only. Letters, spaces and
 * symbols are removed as you type or paste (works with react-hook-form's `register`).
 */
export function PhoneInput({
  className,
  onChange,
  ...props
}: Omit<ComponentProps<typeof Input>, 'type'>) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS);
    if (digits !== event.target.value) event.target.value = digits;
    onChange?.(event);
  };

  return (
    <div className="flex">
      <span
        className="inline-flex h-8 items-center rounded-l-lg border border-r-0 border-input bg-muted px-2.5 text-sm text-muted-foreground"
        aria-hidden
      >
        +91
      </span>
      <Input
        {...props}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={MAX_DIGITS}
        placeholder={props.placeholder ?? '9876543210'}
        onChange={handleChange}
        className={cn('rounded-l-none', className)}
      />
    </div>
  );
}
