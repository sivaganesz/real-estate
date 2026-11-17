import type { PlacedAttribute } from '@real-estate/shared';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { Path } from 'react-hook-form';
import { AttributeInput } from './AttributeInput';
import type { PropertyFormValues } from './formModel';

/** One catalogue attribute on the form; optional ones can be removed from this property. */
export function AttributeField({ attribute: a }: { attribute: PlacedAttribute }) {
  const form = useFormContext<PropertyFormValues>();
  const removed = useWatch({ control: form.control, name: 'removedAttributeKeys' });
  return (
    <Controller
      control={form.control}
      name={`attributeValues.${a.key}` as Path<PropertyFormValues>}
      render={({ field, fieldState }) => (
        <AttributeInput
          id={`attr-${a.key}`}
          label={a.label}
          type={a.type}
          unit={a.unit}
          options={a.options}
          required={a.required}
          value={field.value as string | string[] | undefined}
          error={fieldState.error?.message}
          onChange={field.onChange}
          onRemove={
            a.required
              ? undefined
              : () =>
                  form.setValue('removedAttributeKeys', [...removed, a.key], { shouldDirty: true })
          }
        />
      )}
    />
  );
}
