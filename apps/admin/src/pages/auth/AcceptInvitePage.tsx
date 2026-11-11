import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema, ROLE_LABELS } from '@real-estate/shared';
import type { InviteInfo, SessionResponse } from '@real-estate/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2Icon } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { homePathFor, useAuth } from '@/auth/auth-context';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { FormField } from '@/components/forms/FormField';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { PasswordRules } from '@/components/forms/PasswordRules';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

const acceptFormSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { startSession } = useAuth();

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<InviteInfo>(`/auth/invite?token=${encodeURIComponent(token)}`),
    enabled: token.length > 0,
    retry: false,
  });
  const accept = useMutation({
    mutationFn: (password: string) =>
      api.post<SessionResponse>('/auth/accept-invite', { token, password }, { auth: false }),
  });

  const form = useForm({
    resolver: zodResolver(acceptFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const { errors, isSubmitting } = form.formState;
  const [password, confirmPassword] = useWatch({
    control: form.control,
    name: ['password', 'confirmPassword'],
  });

  if (token && invite.isPending) return <FullPageSpinner />;

  if (!token || invite.isError || !invite.data) {
    return (
      <AuthLayout title="Invite link not valid">
        <div className="grid gap-4">
          <Alert variant="destructive">
            <AlertDescription>
              {token ? errorMessage(invite.error) : 'This invite link is incomplete.'} Ask your
              administrator to send a new invite.
            </AlertDescription>
          </Alert>
          <Link
            to="/login"
            className="text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const info = invite.data;
  const onSubmit = form.handleSubmit(async ({ password: value }) => {
    try {
      const session = await accept.mutateAsync(value);
      const user = startSession(session);
      navigate(homePathFor(user), { replace: true });
    } catch {
      // Shown in the alert below.
    }
  });

  return (
    <AuthLayout
      title={`Welcome, ${info.name}`}
      description={
        <>
          {info.invitedBy ? `${info.invitedBy} invited you` : "You've been invited"} to join as{' '}
          <strong>{ROLE_LABELS[info.role]}</strong>. Set a password to activate your account.
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {accept.error && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(accept.error)}</AlertDescription>
          </Alert>
        )}
        <FormField id="email" label="Email">
          <Input id="email" value={info.email} readOnly disabled />
        </FormField>
        <FormField id="password" label="Password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
        </FormField>
        <FormField
          id="confirmPassword"
          label="Confirm password"
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
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2Icon className="animate-spin" />}
          Activate account
        </Button>
      </form>
    </AuthLayout>
  );
}
