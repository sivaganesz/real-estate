import { zodResolver } from '@hookform/resolvers/zod';
import { nationalNumber, ROLE_LABELS, ROLES, updateUserBodySchema } from '@real-estate/shared';
import type { User } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '@/auth/auth-context';
import { FormField } from '@/components/forms/FormField';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatLastSeen } from '@/lib/format';
import { useDeactivateUser, useUpdateUser, useUser } from './api';
import { RoleBadge, StatusCell } from './UserBadges';
import { useUserActions } from './useUserActions';

const ROLE_ITEMS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
const editFormSchema = updateUserBodySchema.extend({
  name: updateUserBodySchema.shape.name.unwrap(),
  role: z.enum(ROLES),
});

function formValues(user: User) {
  return { name: user.name, phone: nationalNumber(user.phone), role: user.role };
}

/**
 * Edit drawer. It reads the user by id from the shared cache, so actions taken here
 * (reactivate, unlock, resend invite…) show their result immediately.
 */
export function EditUserSheet({
  userId,
  initialUser,
  onClose,
}: {
  userId: string | null;
  initialUser?: User;
  onClose: () => void;
}) {
  const { user: me } = useAuth();
  const { data: user } = useUser(userId, initialUser);
  const isSelf = user?.id === me?.id;
  const update = useUpdateUser();
  const deactivate = useDeactivateUser();
  const actions = useUserActions();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(editFormSchema),
    defaultValues: user ? formValues(user) : { name: '', phone: '', role: 'admin' as const },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  useEffect(() => {
    if (user) form.reset(formValues(user));
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) return null;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        id: user.id,
        body: isSelf ? { name: values.name, phone: values.phone } : values,
      });
      toast.success('Changes saved');
      onClose();
    } catch {
      // Shown in the alert below.
    }
  });

  const onDeactivate = () =>
    deactivate.mutate(user.id, {
      onSuccess: () => {
        toast.success(`${user.name} has been deactivated`);
        setConfirmOpen(false);
        onClose();
      },
      onError: (err) => {
        toast.error(errorMessage(err));
        setConfirmOpen(false);
      },
    });

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{user.name}</SheetTitle>
            <SheetDescription>{user.email}</SheetDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
              <RoleBadge role={user.role} />
              <StatusCell user={user} />
              <span>Last login: {formatLastSeen(user.lastLoginAt)}</span>
            </div>
          </SheetHeader>

          <form id="edit-user" onSubmit={onSubmit} className="grid gap-4 px-4" noValidate>
            {update.error && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(update.error)}</AlertDescription>
              </Alert>
            )}
            <h3 className="text-sm font-semibold">Details</h3>
            <FormField id="edit-name" label="Full name *" error={errors.name?.message}>
              <Input id="edit-name" aria-invalid={!!errors.name} {...form.register('name')} />
            </FormField>
            <FormField
              id="edit-email"
              label="Email"
              hint="The sign-in email can't be changed. Invite a new user instead."
            >
              <Input id="edit-email" value={user.email} readOnly disabled />
            </FormField>
            <FormField id="edit-phone" label="Phone" error={errors.phone?.message}>
              <PhoneInput
                id="edit-phone"
                aria-invalid={!!errors.phone}
                {...form.register('phone')}
              />
            </FormField>
            <FormField
              id="edit-role"
              label="Role *"
              error={errors.role?.message}
              hint={isSelf ? "You can't change your own role." : undefined}
            >
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    items={ROLE_ITEMS}
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                    disabled={isSelf}
                  >
                    <SelectTrigger id="edit-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <Separator />
            <h3 className="text-sm font-semibold">Account</h3>
            <div className="grid gap-3 text-sm">
              {user.status === 'active' && (
                <div className="flex items-center justify-between gap-2">
                  <span>Send a password reset email</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actions.pending}
                    onClick={() => actions.sendPasswordReset(user)}
                  >
                    Send reset link
                  </Button>
                </div>
              )}
              {user.status === 'invited' && (
                <div className="flex items-center justify-between gap-2">
                  <span>Send a new invite link</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actions.pending}
                    onClick={() => actions.resendInvite(user)}
                  >
                    Resend invite
                  </Button>
                </div>
              )}
              {user.locked && (
                <div className="flex items-center justify-between gap-2">
                  <span>Unlock account</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actions.pending}
                    onClick={() => actions.unlock(user)}
                  >
                    Unlock
                  </Button>
                </div>
              )}
              {/* Separate keys: React must not reuse the Reactivate button as the Deactivate
                  button, or the end of a click could land on Deactivate after the status flips. */}
              {user.status === 'inactive' ? (
                <div key="reactivate" className="flex items-center justify-between gap-2">
                  <span>Reactivate this user</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actions.pending}
                    onClick={() => actions.reactivate(user)}
                  >
                    Reactivate
                  </Button>
                </div>
              ) : (
                <div key="deactivate" className="flex items-center justify-between gap-2">
                  <span>Deactivate this user</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isSelf}
                    title={isSelf ? "You can't deactivate your own account" : undefined}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Deactivate
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Added on {formatDate(user.createdAt)}</p>
            </div>
          </form>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user" disabled={isSubmitting || !isDirty}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              Save changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {user.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll be signed out right away and won&apos;t be able to sign in. Their history
              is kept, and you can reactivate them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deactivate.isPending}
              onClick={onDeactivate}
            >
              {deactivate.isPending && <Loader2Icon className="animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
