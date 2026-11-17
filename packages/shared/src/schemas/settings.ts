import { z } from 'zod';
import { emailSchema, idSchema, phoneSchema } from './common';

/** Logo files: PNG, JPG or WebP up to 2 MB (SVG is not accepted: it can carry scripts). */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp';

export const officeLocationSchema = z
  .object({
    lat: z
      .number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90'),
    lng: z
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180'),
  })
  .meta({ description: 'Office map pin', example: { lat: 12.9716, lng: 77.5946 } });

/** Settings → Company info, as returned by GET /admin/settings/company. */
export const companySettingsSchema = z.object({
  name: z.string(),
  shortDescription: z.string(),
  logoUrl: z.string().nullable().meta({ example: '/uploads/company/logo/3f9a1c.png' }),
  address: z.string(),
  officeLocation: officeLocationSchema.nullable(),
  phone: z.string().nullable().meta({ example: '+919876543210' }),
  email: z.string().nullable().meta({ example: 'info@company.com' }),
  /** False until an admin saves Company info for the first time. */
  isConfigured: z.boolean(),
  updatedAt: z.string().nullable(),
  updatedBy: z.object({ id: idSchema, name: z.string() }).nullable(),
  /** Send it back in If-Match when saving (0 before the first save). */
  version: z.number().int(),
});
export type CompanySettings = z.infer<typeof companySettingsSchema>;

/** PUT /admin/settings/company. The logo has its own upload endpoint. */
export const updateCompanySettingsBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name must be at most 100 characters'),
  shortDescription: z
    .string()
    .trim()
    .max(300, 'Keep the description under 300 characters')
    .default(''),
  address: z
    .string()
    .trim()
    .min(5, 'Enter the office address')
    .max(500, 'Address must be at most 500 characters'),
  officeLocation: officeLocationSchema.nullable().default(null),
  phone: phoneSchema,
  email: emailSchema,
});
export type UpdateCompanySettingsBody = z.input<typeof updateCompanySettingsBodySchema>;
export type UpdateCompanySettings = z.output<typeof updateCompanySettingsBodySchema>;

/**
 * Transaction cost assumptions (PRD v2 SET-04), used for the illustrative cost breakdown on
 * a property's Pricing & valuation tab. Defaults 7 / 4 / 1 are placeholders until the
 * client confirms current rates (D8).
 */
const percent = (label: string) =>
  z
    .number(`${label} must be a number`)
    .min(0, `${label} can't be negative`)
    .max(25, `${label} looks too high`);

export const valuationCostsBodySchema = z.object({
  stampDutyPct: percent('Stamp duty'),
  registrationPct: percent('Registration fee'),
  otherPct: percent('Other costs'),
});
export type ValuationCostsBody = z.infer<typeof valuationCostsBodySchema>;

export const DEFAULT_VALUATION_COSTS: ValuationCostsBody = {
  stampDutyPct: 7,
  registrationPct: 4,
  otherPct: 1,
};

export const valuationCostsSchema = valuationCostsBodySchema.extend({
  updatedAt: z.string().nullable(),
  /** Send it back in If-Match when saving (0 before the first save). */
  version: z.number().int(),
});
export type ValuationCosts = z.infer<typeof valuationCostsSchema>;
