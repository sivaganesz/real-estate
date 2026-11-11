import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js/min';

/**
 * Phone numbers are stored in E.164 format (+91XXXXXXXXXX). Input without a country
 * code is treated as an Indian number by default.
 */

/** Returns the number in E.164 format, or null if it isn't a valid phone number. */
export function normalizePhone(input: string, defaultCountry: CountryCode = 'IN'): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  return parsed?.isValid() ? parsed.number : null;
}

/** Display format, e.g. "+91 98765 43210". Returns the input unchanged if it can't be parsed. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
