/**
 * How property types are used by properties. The rules that depend on it:
 * - a subcategory's code prefix is locked once it has properties;
 * - a subcategory with properties can't be deleted (deactivate it instead);
 * - an attribute's value type is locked once properties have values for it.
 *
 * Properties arrive in Phase 2.2, which replaces `noPropertiesYet` with a version that
 * counts the `properties` collection.
 */
export interface PropertyUsage {
  /** Number of properties per subcategory id (missing ids = 0). */
  countBySubcategory(subcategoryIds: string[]): Promise<Map<string, number>>;
  /** Whether any property has a value for this attribute key. */
  isAttributeUsed(attributeKey: string): Promise<boolean>;
}

export const noPropertiesYet: PropertyUsage = {
  countBySubcategory: async () => new Map(),
  isAttributeUsed: async () => false,
};
