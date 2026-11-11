import type { User } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
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
import { errorMessage } from '@/lib/errors';
import { useDeactivateUser } from './api';

/** Confirmation before deactivating a user (from the list or the edit drawer). */
export function DeactivateUserDialog({
  user,
  open,
  onOpenChange,
  onDeactivated,
}: {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeactivated?: () => void;
}) {
  const deactivate = useDeactivateUser();

  const confirm = () =>
    deactivate.mutate(user.id, {
      onSuccess: () => {
        toast.success(`${user.name} has been deactivated`);
        onOpenChange(false);
        onDeactivated?.();
      },
      onError: (err) => {
        toast.error(errorMessage(err));
        onOpenChange(false);
      },
    });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
            onClick={confirm}
          >
            {deactivate.isPending && <Loader2Icon className="animate-spin" />}
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
