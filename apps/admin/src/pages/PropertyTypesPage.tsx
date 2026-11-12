import { PURPOSE_LABELS } from '@real-estate/shared';
import type { Category, PlacedAttribute, Subcategory } from '@real-estate/shared';
import { Loader2Icon, PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AttributeTarget } from '@/features/propertyTypes/api';
import { usePropertyTypes, useRemoveAttribute } from '@/features/propertyTypes/api';
import type { AttributePlace, AttributeSheetMode } from '@/features/propertyTypes/AttributeSheet';
import { AttributeSheet } from '@/features/propertyTypes/AttributeSheet';
import { AttributesTable } from '@/features/propertyTypes/AttributesTable';
import { PickCard } from '@/features/propertyTypes/PickCard';
import { SubcategorySheet } from '@/features/propertyTypes/SubcategorySheet';
import { SettingsNav } from '@/features/settings/SettingsNav';
import { errorMessage } from '@/lib/errors';

const COMMON = 'common';
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Places an attribute can be added to: the category's common attributes and each subcategory. */
function placesFor(category: Category): AttributePlace[] {
  const commonIds = category.commonAttributes.map((a) => a.id);
  return [
    {
      value: COMMON,
      label: `All ${category.name} (common)`,
      target: { kind: 'category', key: category.key },
      attributeIds: commonIds,
    },
    ...category.subcategories.map((s) => ({
      value: s.id,
      label: s.name,
      target: { kind: 'subcategory', id: s.id } as AttributeTarget,
      // Common attributes are already on every subcategory's form.
      attributeIds: [...commonIds, ...s.attributes.map((a) => a.id)],
    })),
  ];
}

/**
 * Settings → Property types & amenities → Categories & attributes.
 * Pick a category and a subcategory; the common attributes and that subcategory's own
 * attributes are listed below, each with Edit / Delete. The selection is kept in the URL.
 */
export function PropertyTypesPage() {
  const { data, isLoading, error } = usePropertyTypes();
  const [params, setParams] = useSearchParams();
  const [attributeSheet, setAttributeSheet] = useState<AttributeSheetMode | null>(null);
  const [subSheet, setSubSheet] = useState<{ edit?: Subcategory } | null>(null);
  const [deleting, setDeleting] = useState<{ attribute: PlacedAttribute; place: string } | null>(
    null,
  );
  const remove = useRemoveAttribute();

  if (isLoading) {
    return (
      <>
        <SettingsNav />
        <div className="grid gap-5">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <SettingsNav />
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      </>
    );
  }

  const active = data.categories.filter((c) => c.isActive);
  const category = active.find((c) => c.key === params.get('category')) ?? active[0];
  if (!category) {
    return (
      <>
        <SettingsNav />
        <p className="text-sm text-muted-foreground">No property categories are set up yet.</p>
      </>
    );
  }
  const sub =
    category.subcategories.find((s) => s.id === params.get('sub')) ?? category.subcategories[0];
  const places = placesFor(category);
  const placeLabel = (value: string) => places.find((p) => p.value === value)?.label ?? '';

  const select = (next: { category?: string; sub?: string }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next.category) {
          p.set('category', next.category);
          p.delete('sub');
        }
        if (next.sub) p.set('sub', next.sub);
        return p;
      },
      { replace: true },
    );

  const confirmDelete = () => {
    if (!deleting) return;
    const target = places.find((p) => p.value === deleting.place)!.target;
    remove.mutate(
      { target, id: deleting.attribute.id },
      {
        onSuccess: () => {
          toast.success(`"${deleting.attribute.label}" deleted from ${placeLabel(deleting.place)}`);
          setDeleting(null);
        },
        onError: (err) => {
          toast.error(errorMessage(err));
          setDeleting(null);
        },
      },
    );
  };

  return (
    <>
      <SettingsNav />

      <Tabs value="attributes" className="mb-5">
        <TabsList variant="line">
          <TabsTrigger value="attributes">Categories &amp; attributes</TabsTrigger>
          <TabsTrigger value="amenities" disabled title="Coming next">
            Amenities
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-5">
        {/* Category and subcategory pickers */}
        <Card className="grid gap-5 p-5">
          <section className="grid gap-2" aria-labelledby="pt-category">
            <h2 id="pt-category" className="text-sm font-medium">
              Category
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.categories.map((c) => (
                <PickCard
                  key={c.key}
                  title={c.name}
                  subtitle={
                    c.isActive
                      ? count(c.subcategories.length, 'subcategory', 'subcategories')
                      : 'Set up later'
                  }
                  selected={c.key === category.key}
                  disabled={!c.isActive}
                  onClick={() => select({ category: c.key })}
                />
              ))}
            </div>
          </section>
          <section className="grid gap-2" aria-labelledby="pt-sub">
            <h2 id="pt-sub" className="text-sm font-medium">
              Subcategory
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {category.subcategories.map((s) => (
                <PickCard
                  key={s.id}
                  title={s.name}
                  subtitle={`${count(s.attributes.length, 'attribute', 'attributes')} · ${count(s.propertyCount, 'property', 'properties')}`}
                  badge={!s.isActive && <Badge variant="outline">Inactive</Badge>}
                  selected={s.id === sub?.id}
                  onClick={() => select({ sub: s.id })}
                />
              ))}
              <PickCard
                dashed
                title="+ Add subcategory"
                subtitle="e.g. Farm house"
                onClick={() => setSubSheet({})}
              />
            </div>
          </section>
        </Card>

        {/* Common attributes: shared by every subcategory in the category */}
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Common attributes</h2>
              <p className="text-sm text-muted-foreground">
                On every {category.name} property. A change here applies to all subcategories.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setAttributeSheet({ kind: 'add', place: COMMON })}
            >
              <PlusIcon /> Add common attribute
            </Button>
          </div>
          <AttributesTable
            label="Common attributes"
            core={data.coreAttributes}
            attributes={category.commonAttributes}
            onEdit={(attribute) => setAttributeSheet({ kind: 'edit', place: COMMON, attribute })}
            onDelete={(attribute) => setDeleting({ attribute, place: COMMON })}
          />
          <p className="text-xs text-muted-foreground">
            The locked attributes are needed to publish a property and for search. Photos and
            amenities are always on the property form.
          </p>
        </Card>

        {/* The selected subcategory's own attributes */}
        {sub ? (
          <Card className="grid gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex flex-wrap items-center gap-2 font-semibold">
                  {sub.name} attributes
                  {!sub.isActive && <Badge variant="outline">Inactive</Badge>}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Code RE-{sub.codePrefix}-… ·{' '}
                  {sub.purposes.map((p) => PURPOSE_LABELS[p]).join(', ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setSubSheet({ edit: sub })}>
                  <PencilIcon /> Edit subcategory
                </Button>
                <Button onClick={() => setAttributeSheet({ kind: 'add', place: sub.id })}>
                  <PlusIcon /> Add attribute
                </Button>
              </div>
            </div>
            {sub.attributes.length > 0 ? (
              <AttributesTable
                label={`${sub.name} attributes`}
                attributes={sub.attributes}
                onEdit={(attribute) =>
                  setAttributeSheet({ kind: 'edit', place: sub.id, attribute })
                }
                onDelete={(attribute) => setDeleting({ attribute, place: sub.id })}
              />
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No attributes yet. Add the details {sub.name} properties need, such as BHK or plot
                dimensions.
              </p>
            )}
          </Card>
        ) : (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            {category.name} has no subcategories yet. Add one to start.
          </Card>
        )}

        <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          Attributes are optional unless marked Required. Deleting an attribute removes it from that
          form only: properties that already have a value keep it. An attribute used in several
          places (e.g. BHK) has one name and one set of options everywhere.
        </p>
      </div>

      {attributeSheet && (
        <AttributeSheet
          mode={attributeSheet}
          places={places}
          onClose={() => setAttributeSheet(null)}
        />
      )}
      {subSheet && (
        <SubcategorySheet
          key={subSheet.edit?.id ?? 'new'}
          categoryKey={category.key}
          categoryName={category.name}
          subcategory={subSheet.edit}
          onClose={() => setSubSheet(null)}
          onCreated={(id) => select({ sub: id })}
        />
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{deleting?.attribute.label}&rdquo; from{' '}
              {deleting && placeLabel(deleting.place)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              It won&apos;t appear on the property form any more. Properties that already have a
              value keep it.
              {deleting &&
                deleting.attribute.usedIn.length > 0 &&
                ` It stays in ${deleting.attribute.usedIn.join(', ')}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={confirmDelete}
            >
              {remove.isPending && <Loader2Icon className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
