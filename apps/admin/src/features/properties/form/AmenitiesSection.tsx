import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { NumberedSection } from '@/components/patterns';
import { AmenityIcon } from '@/features/propertyTypes/AmenityIcon';
import { cn } from '@/lib/utils';
import type { FormLayout, PropertyFormValues } from './formModel';

/** Section 3, "Features & amenities": the amenities this type offers, tap to select. */
export function AmenitiesSection({ layout }: { layout: FormLayout }) {
  const form = useFormContext<PropertyFormValues>();
  const [subcategoryId, amenityIds] = useWatch({
    control: form.control,
    name: ['subcategoryId', 'amenityIds'],
  });
  const offered = layout.category.amenities.filter(
    (a) =>
      (a.appliesToAll || a.subcategoryIds.includes(subcategoryId)) &&
      (a.isActive || amenityIds.includes(a.id)),
  );

  return (
    <NumberedSection number={3} title="Features & amenities">
      {offered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No amenities are set up for {layout.subcategory.name}.
        </p>
      ) : (
        <Controller
          control={form.control}
          name="amenityIds"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Amenities">
              {offered.map((a) => {
                const on = field.value.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      field.onChange(
                        on ? field.value.filter((x) => x !== a.id) : [...field.value, a.id],
                      )
                    }
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors',
                      on ? 'border-primary bg-primary-soft font-medium' : 'hover:bg-muted',
                    )}
                  >
                    <AmenityIcon icon={a.icon} className="size-6 rounded-full" />
                    {a.name}
                    {!a.isActive && (
                      <span className="text-xs text-muted-foreground">(inactive)</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        />
      )}
    </NumberedSection>
  );
}
