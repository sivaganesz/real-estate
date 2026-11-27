/**
 * WhatsApp, call and email links plus the ready-to-send messages (foundation-plan §7.5).
 * Sending is a click on a wa.me link: the CRM logs it, delivery cannot be confirmed (Known limitation K5).
 * The share message follows estate-platform `shareWithLead`: "Hi {{first}}, as discussed, here are N options…".
 */
import type { MessageTemplate, Property } from '@/domain/types'
import { firstName, inrShort } from './format'
import { last10, telLink } from './phone'

export { telLink }

/** https://wa.me/91XXXXXXXXXX?text=… (text URL-encoded). */
export function waLink(phone: string | undefined, text?: string): string {
  const d = last10(phone ?? '')
  if (d.length !== 10) return ''
  return `https://wa.me/91${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

export function mailtoLink(email: string | undefined, subject?: string, body?: string): string {
  if (!email) return ''
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join('&')
  return `mailto:${email}${q ? `?${q}` : ''}`
}

/** Google Maps search URL for an address (no key, no embed). */
export function mapsLink(query: string | undefined): string {
  if (!query) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export const propertyAddress = (p: Pick<Property, 'title' | 'location'>) =>
  [p.location.address, p.location.locality, p.location.city].filter(Boolean).join(', ') || p.title

/** Fills {{placeholders}} in a stored template; unknown placeholders become empty. */
export function fillTemplate(body: string, values: Record<string, string | number | undefined>): string {
  return body
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => (values[k] == null ? '' : String(values[k])))
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** One line per property for a share message: "• Aranya Greens 3 BHK, Whitefield: ₹1.28 Cr, Whitefield". */
export const propertyLine = (p: Pick<Property, 'title' | 'price' | 'location'>) =>
  `• ${p.title}: ${p.price ? inrShort(p.price) : 'price on request'}${p.location.locality ? `, ${p.location.locality}` : ''}`

/**
 * The share message. Uses the settings template for the tone when one exists, else the built-in English wording
 * from estate-platform.
 */
export function shareMessage(
  lead: { name: string },
  properties: Pick<Property, 'title' | 'price' | 'location'>[],
  opts: { templates?: MessageTemplate[]; tone?: 'english' | 'hinglish'; agent?: string } = {},
): string {
  const first = firstName(lead.name)
  const list = properties.map(propertyLine).join('\n')
  const tpl = opts.templates?.find((t) => t.purpose === 'share' && t.tone === (opts.tone ?? 'english'))
  // the stored templates say "here are {{count}} options"; with one property that must read "here is 1 option"
  const body = tpl && properties.length === 1
    ? tpl.body.replace(/\bare \{\{count\}\} options\b/g, 'is {{count}} option').replace(/\{\{count\}\} options\b/g, '{{count}} option')
    : tpl?.body
  if (body) return fillTemplate(body, { firstName: first, count: properties.length, list, agent: opts.agent })
  const intro = properties.length === 1 ? 'here is an option' : `here are ${properties.length} options`
  return `Hi ${first}, as discussed, ${intro} that fit what you're looking for:\n\n${list}\n\nHappy to arrange a visit at your convenience.`
}
