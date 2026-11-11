/** Starting values for Settings → Company info, until an admin saves it (Phase 1 step 1.7). */
export const DEFAULT_COMPANY_SETTINGS = {
  name: 'Your Company Name',
  shortDescription: '',
  logoPath: null as string | null,
  address: '',
  officeLocation: null as { lat: number; lng: number } | null,
  phone: '',
  email: '',
};
