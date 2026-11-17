import type { ExtraAttributeType } from '@real-estate/shared';
import { PlusIcon, RotateCcwIcon } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { useAuth } from '@/auth/auth-context';
import { Chip, NumberedSection } from '@/components/patterns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AttributeField } from './AttributeField';
import { AttributeInput } from './AttributeInput';
import { CreateAttributeDialog } from './CreateAttributeDialog';
import type { FormLayout, PropertyFormValues } from './formModel';

/**
 * Section 2, "Property-specific specifications" (PROP-59): only the fields of this type, so a
 * plot never asks for BHK. Optional fields can be removed from this property; "+ Add
 * attribute" adds one for this property only or, with confirmation, for the whole type.
 */
export function SpecificationsSection({
  layout,
  propertyId,
}: {
  layout: FormLayout;
  /** The property being edited; null while creating one. */
  propertyId: string | null;
}) {
  const { can } = useAuth();
  const form = useFormContext<PropertyFormValues>();
  const { errors } = form.formState;
  const extras = useFieldArray({ control: form.control, name: 'extraAttributes' });
  const removed = useWatch({ control: form.control, name: 'removedAttributeKeys' });
  const [adding, setAdding] = useState(false);

  const visible = layout.own.filter((a) => !removed.includes(a.key));
  const removedAttrs = [...layout.common, ...layout.own].filter((a) => removed.includes(a.key));

  return (
    <NumberedSection
      number={2}
      title="Property-specific specifications"
      aside={<Chip tone="blue">{layout.subcategory.name}</Chip>}
    >
      <p className="-mt-1 mb-3 text-[13px] text-muted-foreground">
        Only the fields relevant to this type are shown. All optional unless marked *; ✕ removes a
        field from this property only.
      </p>
      {visible.length > 0 || extras.fields.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((a) => (
            <AttributeField key={a.id} attribute={a} />
          ))}
          {extras.fields.map((f, i) => (
            <Controller
              key={f.id}
              control={form.control}
              name={`extraAttributes.${i}.value`}
              render={({ field }) => (
                <AttributeInput
                  id={`extra-${i}`}
                  label={f.label}
                  type={f.type}
                  value={field.value}
                  error={errors.extraAttributes?.[i]?.label?.message}
                  onChange={field.onChange}
                  onRemove={() => extras.remove(i)}
                  removeLabel="Delete this attribute"
                  badge={
                    <Badge variant="outline" className="border-dashed text-[10px]">
                      Only this property
                    </Badge>
                  }
                />
              )}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No specifications for {layout.subcategory.name} yet.
        </p>
      )}
      {removedAttrs.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Removed from this property:</span>
          {removedAttrs.map((a) => (
            <button
              key={a.id}
              type="button"
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
              onClick={() =>
                form.setValue(
                  'removedAttributeKeys',
                  removed.filter((k) => k !== a.key),
                  { shouldDirty: true },
                )
              }
              aria-label={`Restore ${a.label}`}
            >
              <RotateCcwIcon className="size-3" /> {a.label}
            </button>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="mt-4 w-fit border-dashed"
        onClick={() => setAdding(true)}
      >
        <PlusIcon /> Add attribute
      </Button>

      {adding && (
        <CreateAttributeDialog
          categoryName={layout.category.name}
          subcategory={{ id: layout.subcategory.id, name: layout.subcategory.name }}
          propertyId={propertyId}
          takenLabels={[...layout.common, ...layout.own]
            .map((a) => a.label)
            .concat(form.getValues('extraAttributes').map((e) => e.label))}
          canEditSettings={can('settings:edit')}
          onAddExtra={(label, type: ExtraAttributeType) =>
            extras.append({ label, type, value: '' })
          }
          onClose={() => setAdding(false)}
        />
      )}
    </NumberedSection>
  );
}
