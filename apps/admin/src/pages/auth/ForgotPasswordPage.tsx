import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordBodySchema } from '@real-estate/shared';
import { ArrowLeftIcon, Loader2Icon, MailCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { FormField } from '@/components/forms/FormField';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

export function ForgotPasswordPage() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(forgotPasswordBodySchema),
    defaultValues: { email: '' },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setApiError(null);
    try {
      const { message } = await api.post<{ message: string }>(
        '/auth/forgot-password',
        { email },
        { auth: false },
      );
      setSentMessage(message);
    } catch (err) {
      setApiError(errorMessage(err));
    }
  });

  return (
    <AuthLayout
      title="Forgot password"
      description="Enter your email and we'll send you a link to reset your password."
    >
      <div className="grid gap-4">
        {sentMessage ? (
          <Alert>
            <MailCheckIcon />
            <AlertTitle>Check your email</AlertTitle>
            <AlertDescription>{sentMessage} The link expires in 1 hour.</AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
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
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}
        <Link
          to="/login"
          className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" /> Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
