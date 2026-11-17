/**
 * The lower-case text a property list search matches by prefix (TRD v2 §7.12, M7): code,
 * title, city, locality and pincode. Stored on write so the search can use an index.
 */
export function propertySearchText(p: {
  code: string;
  title: string;
  location: { city?: string; locality?: string; pincode?: string };
}): string {
  return [p.code, p.title, p.location.city, p.location.locality, p.location.pincode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
