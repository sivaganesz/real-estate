/**
 * Matching actions on a lead's shortlist: shortlist, not interested (never offered again), share on WhatsApp (E11).
 * Reads are pure helpers over lib/matching so pages and the AI rank the same way.
 */
import type { DB, ID, Origin, ShortlistStatus } from '@/domain/types'
import { closeOnBudgetForLead, excludedForLead, leadsForProperty, propertiesForLead, upsertShortlist, type Match } from '@/lib/matching'
import { isMatchable } from '@/lib/property'
import { shareMessage, waLink } from '@/lib/whatsapp'
import { assertActorCan } from './core/actor'
import { commit, getDb, must } from './core/commit'
import type { ContactChannel } from './core/events'

/* ---------- reads ---------- */

export function matchesForLead(db: DB, leadId: ID, now: Date, opts: { limit?: number; includeShared?: boolean } = {}) {
  const lead = db.leads.find((l) => l.id === leadId)
  if (!lead) return { matches: [] as Match[], close: [] as Match[], notShown: [] as Match[] }
  return {
    matches: propertiesForLead(lead, db.properties, db.settings, now, opts),
    close: closeOnBudgetForLead(lead, db.properties, db.settings, now),
    notShown: excludedForLead(lead, db.properties, db.settings, now),
  }
}

export function matchesForProperty(db: DB, propertyId: ID, now: Date, leads = db.leads) {
  const p = db.properties.find((x) => x.id === propertyId)
  return p ? leadsForProperty(p, leads, db.settings, now) : []
}

/* ---------- writes ---------- */

export function setShortlistStatus(leadId: ID, propertyId: ID, status: ShortlistStatus, opts: { via?: Origin; note?: string } = {}) {
  return commit('matching.shortlist', (tx) => {
    const lead = must(tx.db.leads, leadId, 'lead')
    assertActorCan(tx.actor, 'lead.edit', lead, tx.db)
    must(tx.db.properties, propertyId, 'property')
    upsertShortlist(lead, propertyId, status, tx.now, tx.actor.id)
    if (opts.note) {
      const item = lead.shortlist.find((s) => s.propertyId === propertyId)
      if (item) item.note = opts.note
    }
    lead.updatedAt = tx.now
    tx.emit({ type: 'lead.shortlisted', leadId, propertyId, status })
  }, { via: opts.via, undoable: status === 'notInterested' })
}

export const shortlistProperty = (leadId: ID, propertyId: ID) => setShortlistStatus(leadId, propertyId, 'shortlisted')
export const markNotInterested = (leadId: ID, propertyId: ID, note?: string) => setShortlistStatus(leadId, propertyId, 'notInterested', { note })

/**
 * Shares properties with a lead: they go on the shortlist as shared, the share is logged, and the ready WhatsApp
 * message and link come back for the user to send (sending is their click: Known limitation K5).
 */
export function shareProperties(leadId: ID, propertyIds: ID[], opts: { channel?: ContactChannel; tone?: 'english' | 'hinglish'; via?: Origin } = {}) {
  const db = getDb()
  const props = propertyIds.map((id) => db.properties.find((p) => p.id === id)).filter((p) => !!p)
  const lead = db.leads.find((l) => l.id === leadId)
  if (!lead || !props.length) throw new Error('Choose at least one property to share')
  if (props.some((p) => !isMatchable(p))) throw new Error('Only live, available properties can be shared')
  const channel = opts.channel ?? 'whatsapp'
  commit('matching.share', (tx) => {
    const l = must(tx.db.leads, leadId, 'lead')
    assertActorCan(tx.actor, 'lead.edit', l, tx.db)
    tx.emit({ type: 'lead.shared', leadId, propertyIds: props.map((p) => p.id), channel })
  }, { via: opts.via })
  const owner = db.users.find((u) => u.id === lead.ownerId)
  const message = shareMessage(lead, props, { templates: db.settings.templates, tone: opts.tone, agent: owner?.name })
  return { message, link: waLink(lead.phone, message), phone: lead.phone }
}
