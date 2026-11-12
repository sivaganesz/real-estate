import { zodResolver } from '@hookform/resolvers/zod';
import { AMENITY_ICONS, createAmenityBodySchema } from '@real-estate/shared';
import type { Amenity, Category } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/forms/FormField';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { cn } from '@/lib/utils';
import { useCreateAmenity, useUpdateAmenity } from './api';
import { AmenityIcon } from './AmenityIcon';
import { AMENITY_ICON_LABELS } from './format';

const formSchema = z
  .object({
    name: createAmenityBodySchema.shape.name,
    icon: z.enum(AMENITY_ICONS).nullable(),
    appliesToAll: z.boolean(),
    subcategoryIds: z.array(z.string()),
    isActive: z.boolean(),
  })
  // `when` shows this together with other errors (e.g. a missing name).
  .refine((v) => v.appliesToAll || v.subcategoryIds.length > 0, {
    path: ['subcategoryIds'],
    message: 'Choose at least one subcategory, or "All"',
    when: () => true,
  });
type FormValues = z.infer<typeof formSchema>;

/** Add or edit an amenity: name, icon, which subcategories offer it, active. */
export function AmenitySheet({
  category,
  amenity,
  onClose,
}: {
  category: Category;
  /** Set when editing. */
  amenity?: Amenity;
  onClose: () => void;
}) {
  const create = useCreateAmenity();
  const update = useUpdateAmenity();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: amenity
      ? {
          name: amenity.name,
          icon: amenity.icon,
          appliesToAll: amenity.appliesToAll,
          subcategoryIds: amenity.subcategoryIds,
          isActive: amenity.isActive,
        }
      : { name: '', icon: null, appliesToAll: true, subcategoryIds: [], isActive: true },
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const appliesToAll = useWatch({ control: form.control, name: 'appliesToAll' });
  const error = create.error ?? update.error;

  const onSubmit = form.handleSubmit(async (values) => {
    const body = { ...values, subcategoryIds: values.appliesToAll ? [] : values.subcategoryIds };
    try {
      if (amenity) {
        await update.mutateAsync({ id: amenity.id, body });
        toast.success('Amenity saved');
      } else {
        await create.mutateAsync({ categoryKey: category.key, body });
        toast.success(`${values.name} added`);
      }
      onClose();
    } catch {
      // Shown in the alert.
    }
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>{amenity ? `Edit ${amenity.name}` : 'Add amenity'}</SheetTitle>
          <SheetDescription>
            Amenities are a checklist on the {category.name} property form.
          </SheetDescription>
        </SheetHeader>

        <form id="amenity-form" onSubmit={onSubmit} className="grid gap-5 px-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage(error)}</AlertDescription>
            </Alert>
          )}
          <FormField id="amenity-name" label="Name *" error={errors.name?.message}>
            <Input
              id="amenity-name"
              placeholder="e.g. Swimming pool"
              aria-invalid={!!errors.name}
              {...form.register('name')}
            />
          </FormField>

          <Controller
            control={form.control}
            name="icon"
            render={({ field }) => (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">Icon</legend>
                <div className="grid grid-cols-7 gap-2" role="radiogroup" aria-label="Icon">
                  {[null, ...AMENITY_ICONS].map((icon) => (
                    <button
                      key={icon ?? 'none'}
                      type="button"
                      role="radio"
                      aria-checked={field.value === icon}
                      aria-label={icon ? AMENITY_ICON_LABELS[icon] : 'No icon'}
                      title={icon ? AMENITY_ICON_LABELS[icon] : 'No icon'}
                      onClick={() => field.onChange(icon)}
                      className={cn(
                        'flex items-center justify-center rounded-lg border p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                        field.value === icon
                          ? 'border-primary ring-1 ring-primary'
                          : 'border-transparent hover:border-border',
                      )}
                    >
                      <AmenityIcon icon={icon} />
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          />

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Offered for *</legend>
            <Controller
              control={form.control}
              name="appliesToAll"
              render={({ field }) => (
                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="mt-0.5"
                  />
                  <span>
                    All {category.name} subcategories
                    <span className="block text-xs text-muted-foreground">
                      Including ones added later
                    </span>
                  </span>
                </label>
              )}
            />
            {!appliesToAll && (
              <Controller
                control={form.control}
                name="subcategoryIds"
                render={({ field }) => (
                  <div className="grid gap-2 border-l-2 pl-4">
                    {category.subcategories.map((s) => (
                      <label key={s.id} className="flex items-center gap-2.5 text-sm">
                        <Checkbox
                          checked={field.value.includes(s.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, s.id]
                                : field.value.filter((id) => id !== s.id),
                            )
                          }
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                )}
              />
            )}
            {errors.subcategoryIds && (
              <p className="text-sm text-destructive" role="alert">
                {errors.subcategoryIds.message}
              </p>
            )}
          </fieldset>

          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4">
                <Label htmlFor="amenity-active" className="grid gap-0.5">
                  <span>Active</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Inactive amenities stay on existing properties but aren&apos;t offered for new
                    ones
                  </span>
                </Label>
                <Switch
                  id="amenity-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </div>
            )}
          />
        </form>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="amenity-form"
            disabled={isSubmitting || (Boolean(amenity) && !isDirty)}
          >
            {isSubmitting && <Loader2Icon className="animate-spin" />}
            {amenity ? 'Save changes' : 'Add amenity'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
