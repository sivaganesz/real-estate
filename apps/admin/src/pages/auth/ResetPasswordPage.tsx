import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { FormField } from '@/components/forms/FormField';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { PasswordRules } from '@/components/forms/PasswordRules';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const resetFormSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const [password, confirmPassword] = useWatch({
    control: form.control,
    name: ['password', 'confirmPassword'],
  });

  if (!token) {
    return (
      <AuthLayout title="Link not valid">
        <div className="grid gap-4">
          <Alert variant="destructive">
            <AlertDescription>
              This reset link is incomplete. Please request a new one.
            </AlertDescription>
          </Alert>
          <Button size="lg" nativeButton={false} render={<Link to="/forgot-password" />}>
            Request a new link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setApiError(null);
    try {
      const { message } = await api.post<{ message: string }>(
        '/auth/reset-password',
        { token, password: values.password },
        { auth: false },
      );
      navigate('/login', { replace: true, state: { message } });
    } catch (err) {
      setApiError(errorMessage(err));
    }
  });

  return (
    <AuthLayout title="Set a new password" description="Choose a new password for your account.">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {apiError && (
          <Alert variant="destructive">
            <AlertDescription>
              {apiError}{' '}
              <Link to="/forgot-password" className="font-medium underline underline-offset-4">
                Request a new link
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <FormField id="password" label="New password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
        </FormField>
        <FormField
          id="confirmPassword"
          label="Confirm new password"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            {...form.register('confirmPassword')}
          />
        </FormField>
        <PasswordRules password={password} confirm={confirmPassword} />
        <p className="text-sm text-muted-foreground">
          After saving, you'll be signed out on all devices and can sign in with the new password.
        </p>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Save new password
        </Button>
      </form>
    </AuthLayout>
  );
}
