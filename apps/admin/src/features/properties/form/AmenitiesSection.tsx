import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { NumberedSection } from '@/components/patterns';
import { Checkbox } from '@/components/ui/checkbox';
import type { FormLayout, PropertyFormValues } from './formModel';

/** Section 3, "Features & amenities": a checkbox per amenity this type offers (wireframe). */
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
            <div className="flex flex-wrap gap-x-4 gap-y-1.5" role="group" aria-label="Amenities">
              {offered.map((a) => {
                const on = field.value.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className="inline-flex cursor-pointer items-center gap-[7px] text-[13px]"
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() =>
                        field.onChange(
                          on ? field.value.filter((x) => x !== a.id) : [...field.value, a.id],
                        )
                      }
                    />
                    {a.name}
                    {!a.isActive && <span className="text-muted-foreground">(inactive)</span>}
                  </label>
                );
              })}
            </div>
          )}
        />
      )}
    </NumberedSection>
  );
}
