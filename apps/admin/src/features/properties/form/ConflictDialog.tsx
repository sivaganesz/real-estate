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

/**
 * Someone else saved this property after it was opened (409 VERSION_CONFLICT). Nothing was
 * overwritten: the user loads the latest version, or keeps their edits and saves again on
 * top of it.
 */
export function ConflictDialog({
  code,
  by,
  onLoadLatest,
  onKeepMine,
}: {
  code: string;
  /** Who saved last, when known. */
  by: string | null;
  onLoadLatest: () => void;
  onKeepMine: () => void;
}) {
  return (
    <AlertDialog open onOpenChange={(open) => !open && onKeepMine()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {code} was changed by {by ?? 'someone else'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            They saved it after you opened this page, so your changes were not saved. Load their
            version to see what changed, or keep your edits: saving again will then replace their
            changes with yours.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepMine}>Keep my edits</AlertDialogCancel>
          <AlertDialogAction onClick={onLoadLatest}>Load their version</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
