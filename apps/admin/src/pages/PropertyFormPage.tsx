import { zodResolver } from '@hookform/resolvers/zod';
import { canChangeStatus } from '@real-estate/shared';
import type { Category, Property } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { NumberedSection, Note } from '@/components/patterns';
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
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useChangeStatus,
  useCreateProperty,
  useProperty,
  useUpdateProperty,
} from '@/features/properties/api';
import { AmenitiesSection } from '@/features/properties/form/AmenitiesSection';
import { ChangeSubcategoryDialog } from '@/features/properties/form/ChangeSubcategoryDialog';
import { ConflictDialog } from '@/features/properties/form/ConflictDialog';
import { FormSidePanel } from '@/features/properties/form/FormSidePanel';
import type { PropertyFormValues } from '@/features/properties/form/formModel';
import {
  bodyFromValues,
  emptyValues,
  layoutFor,
  propertyFormSchema,
  splitErrors,
  valuesFromProperty,
} from '@/features/properties/form/formModel';
import { MainInfoSection } from '@/features/properties/form/MainInfoSection';
import { MediaManager } from '@/features/properties/form/MediaManager';
import { SpecificationsSection } from '@/features/properties/form/SpecificationsSection';
import { usePropertyTypes } from '@/features/propertyTypes/api';
import { ApiError } from '@/lib/api';
import { errorMessage } from '@/lib/errors';

/** Add property (/properties/new) and Edit property (/properties/:id/edit). */
export function PropertyFormPage() {
  const { id } = useParams();
  const types = usePropertyTypes();
  const property = useProperty(id);

  if (types.isPending || (id && property.isPending)) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  const error = types.error ?? property.error;
  if (error || !types.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
    );
  }
  if (property.data?.status === 'archived') {
    return (
      <Card className="mx-auto grid max-w-lg gap-3 p-6 text-center">
        <p className="font-medium">{property.data.code} is archived</p>
        <p className="text-sm text-muted-foreground">Restore it as a draft first to edit it.</p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to={`/properties/${property.data.id}`} />}
        >
          Open the property
        </Button>
      </Card>
    );
  }
  return (
    <PropertyForm
      key={property.data?.id ?? 'new'}
      categories={types.data.categories}
      property={property.data}
      reload={() => property.refetch().then((r) => r.data)}
    />
  );
}

/**
 * The property form as one card with numbered sections (PROP-59): 1 main information,
 * 2 type-specific specifications, 3 amenities, 4 media (after the first save), 5 a pointer to
 * the detail tabs. Actions stay in a sticky bar at the bottom.
 */
function PropertyForm({
  categories,
  property,
  reload,
}: {
  categories: Category[];
  property?: Property;
  reload: () => Promise<Property | undefined>;
}) {
  const navigate = useNavigate();
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const changeStatus = useChangeStatus();
  const [formProblems, setFormProblems] = useState<string[]>([]);
  const [changingType, setChangingType] = useState(false);
  const [conflict, setConflict] = useState<Property | null>(null);
  const leaving = useRef(false);

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: property
      ? valuesFromProperty(property, layoutFor(categories, property.subcategoryId))
      : emptyValues(),
  });
  const { isDirty, isSubmitting } = form.formState;
  const subcategoryId = useWatch({ control: form.control, name: 'subcategoryId' });
  const layout = layoutFor(categories, subcategoryId);

  // After "Change type", show the new type's form.
  useEffect(() => {
    if (property && property.subcategoryId !== form.getValues('subcategoryId')) {
      form.reset(valuesFromProperty(property, layoutFor(categories, property.subcategoryId)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.subcategoryId]);

  // Unsaved changes: ask before leaving the page or closing the tab.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaving.current &&
      form.formState.isDirty &&
      currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  /** New property: picking a type swaps section 2 and keeps the main information (PROP-60). */
  const pickType = (id: string) => {
    const next = layoutFor(categories, id);
    form.setValue('subcategoryId', id, { shouldDirty: true, shouldValidate: true });
    if (!next) return;
    if (!next.subcategory.purposes.includes(form.getValues('purpose'))) {
      form.setValue('purpose', next.subcategory.purposes[0]!, { shouldDirty: true });
    }
    // Amenities the new type doesn't offer are dropped.
    const offered = new Set(
      next.category.amenities
        .filter((a) => a.appliesToAll || a.subcategoryIds.includes(id))
        .map((a) => a.id),
    );
    form.setValue(
      'amenityIds',
      form.getValues('amenityIds').filter((a) => offered.has(a)),
    );
  };

  const showError = async (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.code === 'VERSION_CONFLICT' && property) {
        setConflict((await reload()) ?? property);
        return;
      }
      if (err.code === 'PUBLISH_BLOCKED') {
        setFormProblems([err.message, ...(err.details ?? []).map((d) => d.message)]);
        return;
      }
      // Server messages go next to their fields (PROP-63).
      const { fields, other } = splitErrors(err.details);
      for (const f of fields)
        form.setError(f.name as Path<PropertyFormValues>, { message: f.message });
      setFormProblems(fields.length || other.length ? other : [err.message]);
      if (fields.length) toast.error('Some details need fixing');
      return;
    }
    setFormProblems([errorMessage(err)]);
  };

  const save = (then?: 'available') =>
    form.handleSubmit(async (values) => {
      if (!layout) return;
      setFormProblems([]);
      try {
        const body = bodyFromValues(values, layout);
        const saved = property
          ? await update.mutateAsync({ id: property.id, version: property.version, body })
          : await create.mutateAsync(body);
        form.reset(valuesFromProperty(saved, layoutFor(categories, saved.subcategoryId)));
        if (!property) {
          toast.success(`Saved as draft ${saved.code}. Add photos next.`);
          leaving.current = true;
          navigate(`/properties/${saved.id}/edit#photos`, { replace: true });
          return;
        }
        if (then === 'available') {
          await changeStatus.mutateAsync({ id: property.id, status: 'available' });
          toast.success(`${saved.code} is now Available`);
          leaving.current = true;
          navigate(`/properties/${property.id}`);
          return;
        }
        toast.success('Changes saved');
      } catch (err) {
        await showError(err);
      }
    })();

  const canMakeAvailable =
    property &&
    property.status !== 'available' &&
    canChangeStatus(property.status, 'available', property.purpose);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        {formProblems.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              <ul className="grid gap-1">
                {formProblems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-start gap-5">
          {/* overflow-visible: the action bar is sticky, which a clipped card would break. */}
          <Card className="min-w-0 flex-[3_1_640px] gap-0 overflow-visible py-0">
            <div className="grid gap-6 p-5">
              <MainInfoSection
                categories={categories}
                property={property}
                layout={layout}
                onPickType={pickType}
                onChangeType={() => setChangingType(true)}
              />
              {layout ? (
                <>
                  <SpecificationsSection layout={layout} propertyId={property?.id ?? null} />
                  <AmenitiesSection layout={layout} />
                </>
              ) : (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Choose a property type to see its specifications and amenities.
                </p>
              )}
              <div id="photos" className="scroll-mt-20">
                <NumberedSection number={4} title="Media">
                  {property ? (
                    <MediaManager property={property} />
                  ) : (
                    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Save the draft first, then add photos, floor plans and brochures here.
                    </p>
                  )}
                </NumberedSection>
              </div>
              <NumberedSection number={5} title="Location, legal documents and valuation">
                <Note tone="blue">
                  After saving, complete the <b>Location</b> (GPS, measured distances, existing vs
                  planned infrastructure), <b>Legal &amp; documents</b> (three-status verification)
                  and <b>Pricing &amp; valuation</b> (comparables) tabs on the property page.
                </Note>
              </NumberedSection>
            </div>

            {/* Sticky action bar (wireframe `.form-actions`) */}
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t bg-card/95 px-5 py-3 backdrop-blur">
              {isDirty && (
                <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(property ? `/properties/${property.id}` : '/properties')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={canMakeAvailable ? 'outline' : 'default'}
                disabled={isSubmitting || (Boolean(property) && !isDirty)}
              >
                {isSubmitting && !changeStatus.isPending && (
                  <Loader2Icon className="animate-spin" />
                )}
                {property ? 'Save changes' : 'Save draft'}
              </Button>
              {canMakeAvailable && (
                <Button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void save('available')}
                >
                  {changeStatus.isPending && <Loader2Icon className="animate-spin" />}
                  {isDirty ? 'Save & make Available' : 'Make Available'}
                </Button>
              )}
            </div>
          </Card>

          <FormSidePanel property={property} />
        </div>

        {changingType && property && layout && (
          <ChangeSubcategoryDialog
            property={property}
            category={layout.category}
            onClose={() => setChangingType(false)}
          />
        )}
        {conflict && property && (
          <ConflictDialog
            code={property.code}
            by={conflict.updatedBy?.name ?? null}
            onLoadLatest={() => {
              form.reset(
                valuesFromProperty(conflict, layoutFor(categories, conflict.subcategoryId)),
              );
              setConflict(null);
            }}
            onKeepMine={() => setConflict(null)}
          />
        )}

        <AlertDialog open={blocker.state === 'blocked'}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes on this property.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    </FormProvider>
  );
}
