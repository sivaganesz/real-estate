import type { PropertyUsage } from '../propertyTypes/propertyUsage';
import { PropertyModel } from './property.model';

async function countBy(field: 'subcategoryId' | 'amenityIds', ids: string[]) {
  if (ids.length === 0) return new Map<string, number>();
  const rows = await PropertyModel.aggregate<{ _id: string; n: number }>([
    { $match: { [field]: { $in: ids } } },
    ...(field === 'amenityIds'
      ? [{ $unwind: '$amenityIds' }, { $match: { amenityIds: { $in: ids } } }]
      : []),
    { $group: { _id: `$${field}`, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.n]));
}

/**
 * Counts from the `properties` collection (archived properties included: their codes,
 * values and amenities still exist). Used by the property-type rules.
 */
export const propertyUsage: PropertyUsage = {
  countBySubcategory: (ids) => countBy('subcategoryId', ids),
  countByAmenity: (ids) => countBy('amenityIds', ids),
  isAttributeUsed: async (key) =>
    Boolean(await PropertyModel.exists({ [`attributeValues.${key}`]: { $exists: true } })),
};
