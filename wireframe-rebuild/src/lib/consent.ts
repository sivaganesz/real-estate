/**
 * Consent to follow up (spec, Module B · A): without the customer's consent no follow-up can be scheduled.
 * A withdrawn consent counts as none. Booking a site visit the customer asked for is still allowed; it just doesn't set a follow-up.
 */
import type { Lead } from '@/data/types'

export const hasFollowUpConsent = (l: Lead): boolean => !!l.consent?.followUp && !l.consent.withdrawnAt
