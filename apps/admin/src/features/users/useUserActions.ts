import type { User } from '@real-estate/shared';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { useReactivateUser, useResendInvite, useSendPasswordReset, useUnlockUser } from './api';

/** Quick row actions shared by the table and the edit drawer, with toast feedback. */
export function useUserActions() {
  const resend = useResendInvite();
  const unlock = useUnlockUser();
  const reactivate = useReactivateUser();
  const sendReset = useSendPasswordReset();

  return {
    pending: resend.isPending || unlock.isPending || reactivate.isPending || sendReset.isPending,

    resendInvite: (user: User) =>
      resend.mutate(user.id, {
        onSuccess: ({ emailSent }) =>
          emailSent
            ? toast.success(`New invite sent to ${user.email}`)
            : toast.warning("The invite email couldn't be sent. Please try again."),
        onError: (err) => toast.error(errorMessage(err)),
      }),

    unlock: (user: User) =>
      unlock.mutate(user.id, {
        onSuccess: () => toast.success(`${user.name} can sign in again`),
        onError: (err) => toast.error(errorMessage(err)),
      }),

    reactivate: (user: User) =>
      reactivate.mutate(user.id, {
        onSuccess: (updated) =>
          toast.success(
            updated.status === 'invited'
              ? `${user.name} is back as invited. Send a new invite so they can set a password.`
              : `${user.name} has been reactivated`,
          ),
        onError: (err) => toast.error(errorMessage(err)),
      }),

    sendPasswordReset: (user: User) =>
      sendReset.mutate(user.id, {
        onSuccess: ({ emailSent }) =>
          emailSent
            ? toast.success(`Password reset link sent to ${user.email}`)
            : toast.warning("The reset email couldn't be sent. Please try again."),
        onError: (err) => toast.error(errorMessage(err)),
      }),
  };
}
