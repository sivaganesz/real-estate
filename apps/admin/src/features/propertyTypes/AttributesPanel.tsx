import { PURPOSE_LABELS } from '@real-estate/shared';
import type { Category, CoreAttribute, PlacedAttribute, Subcategory } from '@real-estate/shared';
import { Loader2Icon, PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { errorMessage } from '@/lib/errors';
import type { AttributeTarget } from './api';
import { useRemoveAttribute } from './api';
import type { AttributePlace, AttributeSheetMode } from './AttributeSheet';
import { AttributeSheet } from './AttributeSheet';
import { AttributesTable } from './AttributesTable';
import { CategoryPicker } from './CategoryPicker';
import { count } from './format';
import { PickCard } from './PickCard';
import { SubcategorySheet } from './SubcategorySheet';

const COMMON = 'common';

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
 * "Categories & attributes" tab: category and subcategory cards, then the common
 * attributes and the selected subcategory's own attributes, each with Edit / Delete.
 */
export function AttributesPanel({
  categories,
  coreAttributes,
  category,
  subId,
  onSelectCategory,
  onSelectSub,
}: {
  categories: Category[];
  coreAttributes: CoreAttribute[];
  category: Category;
  subId: string | null;
  onSelectCategory: (key: string) => void;
  onSelectSub: (id: string) => void;
}) {
  const [attributeSheet, setAttributeSheet] = useState<AttributeSheetMode | null>(null);
  const [subSheet, setSubSheet] = useState<{ edit?: Subcategory } | null>(null);
  const [deleting, setDeleting] = useState<{ attribute: PlacedAttribute; place: string } | null>(
    null,
  );
  const remove = useRemoveAttribute();

  const sub = category.subcategories.find((s) => s.id === subId) ?? category.subcategories[0];
  const places = placesFor(category);
  const placeLabel = (value: string) => places.find((p) => p.value === value)?.label ?? '';

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
      <div className="grid gap-5">
        {/* Category and subcategory pickers */}
        <Card className="grid gap-5 p-5">
          <CategoryPicker
            categories={categories}
            selected={category.key}
            onSelect={onSelectCategory}
          />
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
                  onClick={() => onSelectSub(s.id)}
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
            core={coreAttributes}
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
          onCreated={onSelectSub}
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
