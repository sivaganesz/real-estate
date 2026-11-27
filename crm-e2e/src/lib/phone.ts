/** Indian phone numbers: stored as E.164 (+919845012345), displayed as +91 98450 12345. */

/** The last 10 digits of any Indian number (+91, spaces, dashes and a leading 0 all compare equal). */
export function last10(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.slice(-10)
}

/** Normalises a typed number to E.164. Returns '' when it is not a valid Indian mobile (10 digits starting 6–9). */
export function toE164(raw: string): string {
  const d = last10(raw)
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : ''
}

export function phoneDisplay(e164: string | undefined): string {
  if (!e164) return ''
  const d = last10(e164)
  if (d.length !== 10) return e164
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`
}

export const isValidIndianMobile = (raw: string) => toE164(raw) !== ''

/** A `tel:` link that dials the number on a phone (E.164 keeps the +91). */
export function telLink(phone: string | undefined): string {
  if (!phone) return ''
  const d = last10(phone)
  return d.length === 10 ? `tel:+91${d}` : `tel:${phone.replace(/[^\d+]/g, '')}`
}
