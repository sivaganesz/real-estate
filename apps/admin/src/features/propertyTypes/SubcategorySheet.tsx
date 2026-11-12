import { zodResolver } from '@hookform/resolvers/zod';
import { createSubcategoryBodySchema, PURPOSE_LABELS, PURPOSES } from '@real-estate/shared';
import type { CategoryKey, Purpose, Subcategory } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/forms/FormField';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { errorMessage } from '@/lib/errors';
import { useCreateSubcategory, useDeleteSubcategory, useUpdateSubcategory } from './api';

const formSchema = createSubcategoryBodySchema.omit({ categoryKey: true }).extend({
  isActive: z.boolean(),
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

/** Add a subcategory to a category, or edit / delete one. */
export function SubcategorySheet({
  categoryKey,
  categoryName,
  subcategory,
  onClose,
  onCreated,
}: {
  categoryKey: CategoryKey;
  categoryName: string;
  /** Set when editing. */
  subcategory?: Subcategory;
  onClose: () => void;
  /** Called with the new subcategory's id, so the page can select it. */
  onCreated?: (id: string) => void;
}) {
  const create = useCreateSubcategory();
  const update = useUpdateSubcategory();
  const remove = useDeleteSubcategory();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEdit = Boolean(subcategory);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: subcategory
      ? {
          name: subcategory.name,
          codePrefix: subcategory.codePrefix,
          purposes: subcategory.purposes,
          isActive: subcategory.isActive,
        }
      : { name: '', codePrefix: '', purposes: ['sale'], isActive: true },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const error = create.error ?? update.error;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (subcategory) {
        await update.mutateAsync({ id: subcategory.id, body: values });
        toast.success('Subcategory saved');
      } else {
        const result = await create.mutateAsync({ categoryKey, ...values });
        toast.success(`${values.name} added`);
        const created = result.categories
          .find((c) => c.key === categoryKey)
          ?.subcategories.find((s) => s.codePrefix === values.codePrefix);
        if (created) onCreated?.(created.id);
      }
      onClose();
    } catch {
      // Shown in the alert.
    }
  });

  const onDelete = () => {
    if (!subcategory) return;
    remove.mutate(subcategory.id, {
      onSuccess: () => {
        toast.success(`${subcategory.name} deleted`);
        setConfirmDelete(false);
        onClose();
      },
      onError: (err) => {
        toast.error(errorMessage(err));
        setConfirmDelete(false);
      },
    });
  };

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>{subcategory ? `Edit ${subcategory.name}` : 'Add subcategory'}</SheetTitle>
            <SheetDescription>
              {subcategory
                ? `${categoryName} subcategory`
                : `It starts with the ${categoryName} common attributes. Add its own attributes after saving.`}
            </SheetDescription>
          </SheetHeader>

          <form id="subcategory-form" onSubmit={onSubmit} className="grid gap-4 px-4" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage(error)}</AlertDescription>
              </Alert>
            )}
            <FormField id="sub-category" label="Category">
              <Input id="sub-category" value={categoryName} readOnly disabled />
            </FormField>
            <FormField id="sub-name" label="Subcategory name *" error={errors.name?.message}>
              <Input
                id="sub-name"
                placeholder="e.g. Farm house"
                aria-invalid={!!errors.name}
                {...form.register('name')}
              />
            </FormField>
            <FormField
              id="sub-prefix"
              label="Code prefix *"
              error={errors.codePrefix?.message}
              hint={
                subcategory?.prefixLocked
                  ? `Locked: ${subcategory.propertyCount} properties already use RE-${subcategory.codePrefix}-…`
                  : '3 letters, used in property codes (e.g. RE-FRM-000001). Locked once it has properties.'
              }
            >
              <Input
                id="sub-prefix"
                maxLength={3}
                placeholder="FRM"
                className="uppercase read-only:bg-muted read-only:text-muted-foreground"
                readOnly={subcategory?.prefixLocked}
                aria-invalid={!!errors.codePrefix}
                {...form.register('codePrefix')}
              />
            </FormField>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">Allowed purposes *</legend>
              <Controller
                control={form.control}
                name="purposes"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-5">
                    {PURPOSES.map((purpose) => {
                      const list = (field.value ?? []) as Purpose[];
                      return (
                        <label key={purpose} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={list.includes(purpose)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked ? [...list, purpose] : list.filter((p) => p !== purpose),
                              )
                            }
                          />
                          {PURPOSE_LABELS[purpose]}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
              {errors.purposes && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.purposes.message}
                </p>
              )}
            </fieldset>

            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4">
                  <Label htmlFor="sub-active" className="grid gap-0.5">
                    <span>Active</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Offered when adding a property
                    </span>
                  </Label>
                  <Switch id="sub-active" checked={field.value} onCheckedChange={field.onChange} />
                </div>
              )}
            />

            {subcategory && (
              <div className="flex items-center justify-between gap-3 border-t pt-4 text-sm">
                <span className="text-muted-foreground">
                  {subcategory.propertyCount > 0
                    ? `Has ${subcategory.propertyCount} properties: deactivate it instead of deleting.`
                    : 'No properties use it yet.'}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={subcategory.propertyCount > 0}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              </div>
            )}
          </form>

          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="subcategory-form"
              disabled={isSubmitting || (isEdit && !isDirty)}
            >
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Add subcategory'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {subcategory && (
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {subcategory.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                It is removed from {categoryName}, together with its attribute list. Attributes also
                used elsewhere are kept there.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={remove.isPending}
                onClick={onDelete}
              >
                {remove.isPending && <Loader2Icon className="animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
