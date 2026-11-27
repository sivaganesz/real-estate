/**
 * Logging what happened with a lead: calls, WhatsApp, emails and notes. A logged call or message is a
 * `lead.contacted` event, so the contact dates, the new → contacted move and the no-answer retry follow (E4).
 */
import type { ID, Origin, Task } from '@/domain/types'
import { assertActorCan } from './core/actor'
import { commit, must } from './core/commit'
import type { ContactChannel } from './core/events'

export function logContact(leadId: ID, c: { channel: ContactChannel; result?: Task['callResult']; text?: string }, opts: { via?: Origin } = {}) {
  return commit('activity.contact', (tx) => {
    const lead = must(tx.db.leads, leadId, 'lead')
    assertActorCan(tx.actor, 'lead.edit', lead, tx.db)
    tx.emit({ type: 'lead.contacted', leadId, channel: c.channel, result: c.result, text: c.text?.trim() || undefined })
  }, opts)
}

export function addNote(leadId: ID, text: string, opts: { via?: Origin } = {}) {
  const clean = text.trim()
  if (!clean) return { result: undefined }
  return commit('activity.note', (tx) => {
    const lead = must(tx.db.leads, leadId, 'lead')
    assertActorCan(tx.actor, 'lead.edit', lead, tx.db)
    lead.updatedAt = tx.now
    tx.emit({ type: 'lead.noted', leadId, text: clean })
  }, opts)
}
