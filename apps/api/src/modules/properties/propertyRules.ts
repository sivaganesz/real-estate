import { normalizeLabel, PURPOSE_LABELS } from '@real-estate/shared';
import type { AttributeValue, ExtraAttribute, Purpose, PublishIssue } from '@real-estate/shared';
import type { ErrorDetail } from '../../lib/errors';
import type { AttributeDoc } from '../propertyTypes/propertyTypes.model';
import type { FormDefinition } from '../propertyTypes/propertyTypes.service';

const MAX_TEXT = 500;
const MAX_LONG_TEXT = 5000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDate = (value: string) =>
  DATE_PATTERN.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

/**
 * Checks one value against its attribute. Returns the cleaned value, `undefined` for
 * "empty" (the value is removed), or an error message.
 */
export function checkAttributeValue(
  attribute: Pick<AttributeDoc, 'type' | 'options' | 'label'>,
  raw: AttributeValue | null | undefined,
): { value: AttributeValue | undefined } | { error: string } {
  if (raw === null || raw === undefined) return { value: undefined };
  const { type, options = [] } = attribute;
  switch (type) {
    case 'text':
    case 'long_text': {
      if (typeof raw !== 'string') return { error: 'Enter text' };
      const value = raw.trim();
      const max = type === 'text' ? MAX_TEXT : MAX_LONG_TEXT;
      if (value.length > max) return { error: `Keep it under ${max} characters` };
      return { value: value === '' ? undefined : value };
    }
    case 'number': {
      if (typeof raw === 'string' && raw.trim() === '') return { value: undefined };
      const value = typeof raw === 'string' ? Number(raw) : raw;
      if (typeof value !== 'number' || !Number.isFinite(value)) return { error: 'Enter a number' };
      return { value };
    }
    case 'yes_no':
      return typeof raw === 'boolean' ? { value: raw } : { error: 'Choose yes or no' };
    case 'dropdown': {
      if (typeof raw !== 'string') return { error: 'Choose one of the options' };
      if (raw === '') return { value: undefined };
      const match = options.find((o) => o.toLowerCase() === raw.trim().toLowerCase());
      return match ? { value: match } : { error: `Choose one of: ${options.join(', ')}` };
    }
    case 'multi_select': {
      if (!Array.isArray(raw)) return { error: 'Choose from the options' };
      const picked: string[] = [];
      for (const item of raw) {
        const match = options.find((o) => o.toLowerCase() === String(item).trim().toLowerCase());
        if (!match) return { error: `"${item}" isn't one of the options` };
        if (!picked.includes(match)) picked.push(match);
      }
      return { value: picked.length ? picked : undefined };
    }
    case 'date': {
      if (typeof raw !== 'string') return { error: 'Enter a date' };
      if (raw === '') return { value: undefined };
      return isValidDate(raw) ? { value: raw } : { error: 'Enter a date as YYYY-MM-DD' };
    }
  }
}

/**
 * Merges new attribute values into the stored ones. Only attributes on the subcategory's
 * form can be set; values for attributes it no longer shows are kept untouched.
 */
export function mergeAttributeValues(
  definition: FormDefinition,
  stored: Record<string, AttributeValue>,
  input: Record<string, AttributeValue | null>,
): { values: Record<string, AttributeValue>; errors: ErrorDetail[] } {
  const byKey = new Map(definition.attributes.map((a) => [a.attribute.key, a.attribute]));
  const values = { ...stored };
  const errors: ErrorDetail[] = [];
  for (const [key, raw] of Object.entries(input)) {
    const attribute = byKey.get(key);
    const path = `body.attributeValues.${key}`;
    if (!attribute) {
      errors.push({
        path,
        message: `"${key}" isn't an attribute of ${definition.subcategory.name}`,
      });
      continue;
    }
    const result = checkAttributeValue(attribute, raw);
    if ('error' in result) errors.push({ path, message: `${attribute.label}: ${result.error}` });
    else if (result.value === undefined) delete values[key];
    else values[key] = result.value;
  }
  return { values, errors };
}

/** "This property only" attributes: names unique and different from the form's attributes. */
export function checkExtraAttributes(
  definition: FormDefinition,
  extras: ExtraAttribute[],
): { values: ExtraAttribute[]; errors: ErrorDetail[] } {
  const taken = new Set(definition.attributes.map((a) => normalizeLabel(a.attribute.label)));
  const errors: ErrorDetail[] = [];
  const values: ExtraAttribute[] = [];
  extras.forEach((extra, i) => {
    const path = `body.extraAttributes.${i}`;
    const name = normalizeLabel(extra.label);
    if (taken.has(name)) {
      errors.push({
        path,
        message: `"${extra.label}" is already on the form (or listed twice). Fill it there instead.`,
      });
      return;
    }
    taken.add(name);
    const result = checkAttributeValue(
      { type: extra.type, options: [], label: extra.label },
      extra.value,
    );
    if ('error' in result) errors.push({ path, message: `${extra.label}: ${result.error}` });
    else if (result.value !== undefined)
      values.push({ ...extra, value: result.value as ExtraAttribute['value'] });
  });
  return { values, errors };
}

/** Amenities must be offered for the subcategory; inactive ones only if already ticked. */
export function checkAmenities(
  definition: FormDefinition,
  ids: string[],
  alreadyTicked: string[] = [],
): { values: string[]; errors: ErrorDetail[] } {
  const offered = new Map(definition.amenities.map((a) => [a._id, a]));
  const values: string[] = [];
  const errors: ErrorDetail[] = [];
  for (const id of new Set(ids)) {
    const amenity = offered.get(id);
    if (!amenity) {
      errors.push({
        path: 'body.amenityIds',
        message: `An amenity isn't offered for ${definition.subcategory.name}`,
      });
    } else if (!amenity.isActive && !alreadyTicked.includes(id)) {
      errors.push({ path: 'body.amenityIds', message: `"${amenity.name}" is inactive` });
    } else {
      values.push(id);
    }
  }
  // Keep the checklist order.
  return {
    values: definition.amenities.map((a) => a._id).filter((id) => values.includes(id)),
    errors,
  };
}

export function checkPurpose(definition: FormDefinition, purpose: Purpose): ErrorDetail[] {
  if (definition.subcategory.purposes.includes(purpose)) return [];
  const allowed = definition.subcategory.purposes.map((p) => PURPOSE_LABELS[p]).join(', ');
  return [
    {
      path: 'body.purpose',
      message: `${definition.subcategory.name} can be listed for: ${allowed}`,
    },
  ];
}

interface PublishCheckInput {
  purpose: Purpose;
  price: { amount: number | null; onRequest: boolean };
  area: unknown;
  location: { city: string; locality: string; pincode: string };
  attributeValues: Record<string, AttributeValue>;
  media: { kind: string }[];
}

/** What is still missing before a property can be published (PRD ADM-PROP-08). */
export function publishIssues(definition: FormDefinition, p: PublishCheckInput): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (!definition.subcategory.purposes.includes(p.purpose)) {
    issues.push({
      path: 'purpose',
      message: `${definition.subcategory.name} can't be listed for ${PURPOSE_LABELS[p.purpose]}`,
    });
  }
  if (p.price.amount === null && !p.price.onRequest) {
    issues.push({ path: 'price', message: 'Enter the price, or choose "Price on request"' });
  }
  if (!p.area) issues.push({ path: 'area', message: 'Enter the area' });
  if (!p.location.city) issues.push({ path: 'location.city', message: 'Enter the city' });
  if (!p.location.locality)
    issues.push({ path: 'location.locality', message: 'Enter the area / locality' });
  if (!p.location.pincode) issues.push({ path: 'location.pincode', message: 'Enter the pincode' });
  for (const { attribute, required } of definition.attributes) {
    if (required && p.attributeValues[attribute.key] === undefined) {
      issues.push({
        path: `attributeValues.${attribute.key}`,
        message: `Fill in ${attribute.label}`,
      });
    }
  }
  if (!p.media.some((m) => m.kind === 'image')) {
    issues.push({ path: 'media', message: 'Add at least one photo' });
  }
  return issues;
}
