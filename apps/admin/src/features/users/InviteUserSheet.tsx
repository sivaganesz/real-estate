import { zodResolver } from '@hookform/resolvers/zod';
import { inviteUserBodySchema } from '@real-estate/shared';
import type { InviteUserBody } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField } from '@/components/forms/FormField';
import { PhoneInput } from '@/components/forms/PhoneInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useInviteUser } from './api';
import { RolePicker } from './RolePicker';

const EMPTY: InviteUserBody = {
  name: '',
  email: '',
  phone: '',
  role: undefined as unknown as InviteUserBody['role'],
};

export function InviteUserSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invite = useInviteUser();
  const form = useForm({ resolver: zodResolver(inviteUserBodySchema), defaultValues: EMPTY });
  const { errors, isSubmitting } = form.formState;

  const close = () => {
    onOpenChange(false);
    form.reset(EMPTY);
    invite.reset();
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const { user, emailSent } = await invite.mutateAsync(values);
      if (emailSent) toast.success(`Invite sent to ${user.email}`);
      else
        toast.warning(
          `${user.name} was added, but the invite email couldn't be sent. Use "Resend invite".`,
        );
      close();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE') {
        form.setError('email', { message: err.message });
      }
    }
  });

  const apiError =
    invite.error && !(invite.error instanceof ApiError && invite.error.code === 'DUPLICATE');

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Invite user</SheetTitle>
          <SheetDescription>
            They&apos;ll get an email with a link to set their password.
          </SheetDescription>
        </SheetHeader>

        <form id="invite-user" onSubmit={onSubmit} className="grid gap-4 px-4" noValidate>
          {apiError && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(invite.error)}</AlertDescription>
            </Alert>
          )}
          <FormField id="invite-name" label="Full name *" error={errors.name?.message}>
            <Input
              id="invite-name"
              placeholder="e.g. Priya Kumar"
              aria-invalid={!!errors.name}
              {...form.register('name')}
            />
          </FormField>
          <FormField id="invite-email" label="Email *" error={errors.email?.message}>
            <Input
              id="invite-email"
              type="email"
              placeholder="name@company.com"
              aria-invalid={!!errors.email}
              {...form.register('email')}
            />
          </FormField>
          <FormField
            id="invite-phone"
            label="Phone"
            error={errors.phone?.message}
            hint="Optional. 10-digit mobile number."
          >
            <PhoneInput
              id="invite-phone"
              aria-invalid={!!errors.phone}
              {...form.register('phone')}
            />
          </FormField>
          <FormField id="invite-role" label="Role *" error={errors.role?.message}>
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <RolePicker name="invite-role" value={field.value} onChange={field.onChange} />
              )}
            />
          </FormField>
          <Alert>
            <AlertDescription>
              The invite link is valid for <strong>72 hours</strong>. Until it&apos;s accepted, the
              user shows as <strong>Invited</strong>.
            </AlertDescription>
          </Alert>
        </form>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="invite-user" disabled={isSubmitting}>
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            Send invite
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
