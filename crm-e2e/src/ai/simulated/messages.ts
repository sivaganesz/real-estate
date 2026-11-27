/**
 * Follow-up and share messages (master prompt §12.7 "draft follow-ups"): the stored template for the purpose, channel and
 * tone (Settings → Templates), filled with the lead's first name, the property, the visit time and the agent. Message
 * bodies are data the user sends to a client, so they stay in the template's language (English or Hinglish).
 */
import type { DB, User } from '@/domain/types'
import { firstName, fmtDateTime, inrShort } from '@/lib/format'
import { fillTemplate, mapsLink, propertyAddress, shareMessage } from '@/lib/whatsapp'
import type { AIText, MessageRequest } from '../types'

/** Visit messages need a visit: the next scheduled one (confirmation, reminder) or the last completed one (after the visit). */
function visitFor(db: DB, leadId: string, purpose: MessageRequest['purpose']) {
  const mine = db.appointments.filter((a) => a.leadId === leadId)
  if (purpose === 'postVisit') return mine.filter((a) => a.status === 'completed').sort((a, b) => b.start.localeCompare(a.start))[0]
  return mine.filter((a) => a.status === 'scheduled' || a.status === 'confirmed').sort((a, b) => a.start.localeCompare(b.start))[0]
}

export function generateMessageSim(req: MessageRequest, db: DB, actor: Pick<User, 'name'>): AIText {
  const lead = db.leads.find((l) => l.id === req.leadId)
  if (!lead) return { mode: 'simulated', text: '' }
  const properties = (req.propertyIds ?? []).map((id) => db.properties.find((p) => p.id === id)).filter((p) => !!p)
  const needsVisit = req.purpose === 'visitConfirm' || req.purpose === 'reminder' || req.purpose === 'postVisit'
  const appointment = req.appointmentId ? db.appointments.find((a) => a.id === req.appointmentId) : needsVisit ? visitFor(db, lead.id, req.purpose) : undefined
  // no visit to confirm or follow up on: a plain follow-up reads better than "your visit to at ."
  if (needsVisit && !appointment) return generateMessageSim({ ...req, purpose: 'followUp' }, db, actor)
  const property = properties[0] ?? (appointment ? db.properties.find((p) => p.id === appointment.propertyIds[0]) : undefined)
    ?? (lead.deal?.propertyId ? db.properties.find((p) => p.id === lead.deal?.propertyId) : undefined)
  const agent = firstName(actor.name)
  const links = [{ kind: 'lead' as const, id: lead.id }]

  if (req.purpose === 'share' && properties.length) {
    return {
      mode: 'simulated',
      text: shareMessage(lead, properties, { templates: db.settings.templates, tone: req.tone, agent }),
      links: [...links, ...properties.map((p) => ({ kind: 'property' as const, id: p.id }))],
    }
  }
  const templates = db.settings.templates
  const tpl = templates.find((x) => x.purpose === req.purpose && x.channel === req.channel && x.tone === req.tone)
    ?? templates.find((x) => x.purpose === req.purpose && x.tone === req.tone)
    ?? templates.find((x) => x.purpose === req.purpose)
  const values = {
    firstName: firstName(lead.name),
    agent,
    property: property?.title ?? '',
    time: appointment ? fmtDateTime(appointment.start) : '',
    map: appointment?.location?.mapUrl ?? (property ? mapsLink(propertyAddress(property)) : ''),
    price: lead.deal?.counter ? inrShort(lead.deal.counter) : property ? inrShort(property.price) : '',
    date: '',
    count: properties.length,
  }
  const body = tpl ? fillTemplate(tpl.body, values) : `Hi ${values.firstName}, ${agent} here. Just checking in. When is a good time to talk?`
  return { mode: 'simulated', text: body, links: property ? [...links, { kind: 'property', id: property.id }] : links }
}
