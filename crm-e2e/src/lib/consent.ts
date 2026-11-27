/**
 * Consent to follow up. Changed from the rebuild: consent is a visible badge and a warning, never a blocker
 * (the master prompt asks for one-click follow-ups everywhere; recorded in notes/assumptions-foundation.md).
 */
import type { Lead } from '@/domain/types'

export const hasFollowUpConsent = (l: Pick<Lead, 'consent'>): boolean => !!l.consent?.followUp && !l.consent.withdrawnAt
export const consentWithdrawn = (l: Pick<Lead, 'consent'>): boolean => !!l.consent?.withdrawnAt
