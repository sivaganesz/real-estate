import { zodResolver } from '@hookform/resolvers/zod';
import type { Category, Property } from '@real-estate/shared';
import { Loader2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Note, NumberedSection, PageHeader } from '@/components/patterns';
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
 * The property form as in the wireframe: one card with numbered sections (PROP-59):
 * 1 main information, 2 type-specific specifications, 3 features & amenities, 4 a pointer to
 * the Location, Legal, Pricing and Media tabs. Cancel and Save at the bottom.
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

  const save = () =>
    form.handleSubmit(async (values) => {
      if (!layout) return;
      setFormProblems([]);
      try {
        const body = bodyFromValues(values, layout);
        if (!property) {
          const created = await create.mutateAsync(body);
          leaving.current = true;
          form.reset(valuesFromProperty(created, layoutFor(categories, created.subcategoryId)));
          // Like the wireframe: next, the Location, Legal and Pricing tabs (PROP-61).
          toast.success(`Property ${created.code} created. Now add the location and photos.`);
          navigate(`/properties/${created.id}/location`, { replace: true });
          return;
        }
        const listingDate =
          values.listingDate && values.listingDate !== form.formState.defaultValues?.listingDate
            ? { listingDate: values.listingDate }
            : {};
        let saved = await update.mutateAsync({
          id: property.id,
          version: property.version,
          body: { ...body, ...listingDate },
        });
        // A new status goes through the status rules (e.g. the Available checklist).
        if (values.status !== property.status) {
          saved = await changeStatus.mutateAsync({ id: property.id, status: values.status });
        }
        form.reset(valuesFromProperty(saved, layoutFor(categories, saved.subcategoryId)));
        toast.success('Property saved');
        leaving.current = true;
        navigate(`/properties/${property.id}`);
      } catch (err) {
        await showError(err);
      }
    })();

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        {property && (
          <PageHeader
            title={`Edit ${property.title}`}
            description="Main information is common to all properties. The specification section below changes with the property type."
          />
        )}
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

        {/* One card with numbered sections (wireframe `form.card`) */}
        {/* overflow-visible: the action bar is sticky, which a clipped card would break. */}
        <Card className="gap-0 overflow-visible py-0">
          <div className="grid gap-[18px] p-5">
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
            <NumberedSection number={4} title="Location, legal documents and valuation">
              <Note tone="blue">
                After saving, complete the <b>Location</b> (GPS, measured distances, existing vs
                planned infrastructure), <b>Legal &amp; documents</b> (three-status verification)
                and <b>Pricing &amp; valuation</b> (comparables) tabs on the property page. Photos
                are added on its <b>Media</b> tab.
              </Note>
            </NumberedSection>
          </div>

          {/* Wireframe `.form-actions`: stays in view at the bottom while scrolling. */}
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
            <Button type="submit" disabled={isSubmitting || (Boolean(property) && !isDirty)}>
              {isSubmitting && <Loader2Icon className="animate-spin" />}
              {property ? 'Save changes' : 'Save property'}
            </Button>
          </div>
        </Card>

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
