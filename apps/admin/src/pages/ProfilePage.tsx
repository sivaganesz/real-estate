import { zodResolver } from '@hookform/resolvers/zod';
import { nationalNumber, passwordSchema, updateProfileBodySchema } from '@real-estate/shared';
import type { Profile } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/auth/auth-context';
import { FormField } from '@/components/forms/FormField';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { PasswordRules } from '@/components/forms/PasswordRules';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RoleBadge } from '@/features/users/UserBadges';
import { useChangePassword, useProfile, useUpdateProfile } from '@/features/profile/api';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatLastSeen } from '@/lib/format';

const detailsSchema = updateProfileBodySchema.extend({
  name: updateProfileBodySchema.shape.name.unwrap(),
});

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'Choose a password different from your current one',
  });

const detailsValues = (p: Profile) => ({
  name: p.name,
  phone: nationalNumber(p.phone),
});

function DetailsCard({ profile }: { profile: Profile }) {
  const { updateUser } = useAuth();
  const update = useUpdateProfile();
  const form = useForm({
    resolver: zodResolver(detailsSchema),
    defaultValues: detailsValues(profile),
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  useEffect(() => {
    form.reset(detailsValues(profile));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      updateUser({ name: saved.name, phone: saved.phone });
      form.reset(detailsValues(saved));
      toast.success('Your details were saved');
    } catch {
      // Shown in the alert below.
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal details</CardTitle>
        <CardDescription>
          Member since {formatDate(profile.createdAt)} · Last sign-in{' '}
          {formatLastSeen(profile.lastLoginAt)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {update.error && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(update.error)}</AlertDescription>
            </Alert>
          )}
          <FormField id="profile-name" label="Full name *" error={errors.name?.message}>
            <Input
              id="profile-name"
              autoComplete="name"
              aria-invalid={!!errors.name}
              {...form.register('name')}
            />
          </FormField>
          <FormField
            id="profile-email"
            label="Email"
            hint="Used to sign in. Ask a Super Admin to change it."
          >
            <Input id="profile-email" value={profile.email} readOnly disabled />
          </FormField>
          <FormField id="profile-phone" label="Phone" error={errors.phone?.message}>
            <PhoneInput
              id="profile-phone"
              aria-invalid={!!errors.phone}
              {...form.register('phone')}
            />
          </FormField>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Role</span>
            <div>
              <RoleBadge role={profile.role} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Save details
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const { startSession } = useAuth();
  const change = useChangePassword();
  const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const form = useForm({ resolver: zodResolver(passwordFormSchema), defaultValues: empty });
  const { errors, isSubmitting } = form.formState;
  const [newPassword, confirmPassword] = useWatch({
    control: form.control,
    name: ['newPassword', 'confirmPassword'],
  });

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword: next }) => {
    try {
      const session = await change.mutateAsync({ currentPassword, newPassword: next });
      startSession(session);
      form.reset(empty);
      change.reset();
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CURRENT_PASSWORD') {
        form.setError('currentPassword', { message: err.message });
      }
    }
  });

  const otherError =
    change.error &&
    !(change.error instanceof ApiError && change.error.code === 'INVALID_CURRENT_PASSWORD');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          You&apos;ll stay signed in here. Other devices will be signed out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          {otherError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(change.error)}</AlertDescription>
            </Alert>
          )}
          <FormField
            id="current-password"
            label="Current password *"
            error={errors.currentPassword?.message}
          >
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              aria-invalid={!!errors.currentPassword}
              {...form.register('currentPassword')}
            />
          </FormField>
          <FormField id="new-password" label="New password *" error={errors.newPassword?.message}>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...form.register('newPassword')}
            />
          </FormField>
          <FormField
            id="confirm-password"
            label="Confirm new password *"
            error={errors.confirmPassword?.message}
          >
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...form.register('confirmPassword')}
            />
          </FormField>
          <PasswordRules password={newPassword} confirm={confirmPassword} />
          <p className="text-sm text-muted-foreground">
            You&apos;ll also get a confirmation email.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** My Profile. No page title: the breadcrumbs and account menu already say where you are. */
export function ProfilePage() {
  const profile = useProfile();

  return (
    <>
      {profile.isPending && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      )}
      {profile.isError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(profile.error)}</AlertDescription>
        </Alert>
      )}
      {profile.data && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <DetailsCard profile={profile.data} />
          <PasswordCard />
        </div>
      )}
    </>
  );
}
