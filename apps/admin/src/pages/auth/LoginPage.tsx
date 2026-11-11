import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { homePathFor, useAuth } from '@/auth/auth-context';
import { FormField } from '@/components/forms/FormField';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/errors';

interface LocationState {
  from?: string;
  message?: string;
}

const SIGN_OUT_MESSAGES = {
  idle: 'You were signed out after 30 minutes of inactivity. Please sign in again.',
  expired: 'Your session has expired. Please sign in again.',
} as const;

export function LoginPage() {
  const { login, signOutReason } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as LocationState;
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setApiError(null);
    try {
      const user = await login(email, password);
      navigate(state.from && state.from !== '/' ? state.from : homePathFor(user), {
        replace: true,
      });
    } catch (err) {
      setApiError(errorMessage(err));
    }
  });

  const info = state.message ?? (signOutReason ? SIGN_OUT_MESSAGES[signOutReason] : null);

  return (
    <AuthLayout title="Sign in" description="Use your staff email and password">
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {info && !apiError && (
          <Alert>
            <AlertDescription>{info}</AlertDescription>
          </Alert>
        )}
        {apiError && (
          <Alert variant="destructive">
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            aria-invalid={!!errors.email}
            {...form.register('email')}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          action={
            <Link to="/forgot-password" className="text-sm underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
        </FormField>

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
