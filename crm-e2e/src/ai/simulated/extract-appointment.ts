/**
 * Paste-and-fill for appointments: "Site visit with Priya Sharma tomorrow 11am at Prestige Lakeside" → type, lead,
 * properties, start, duration, location. Names are matched fuzzily against the leads and properties the user can see.
 * Smart-required (master prompt §12.6): lead/client + type + date + time (+ property for a site visit).
 */
import type { AppointmentInput, AppointmentType, DB, FieldMetaMap, Lead, Property } from '@/domain/types'
import { DEFAULT_DURATION_MIN } from '@/domain/catalogue'
import { localDay } from '@/lib/dates'
import { mapsLink, propertyAddress } from '@/lib/whatsapp'
import type { AIQuestion, Extraction } from '../types'
import { atLocal, dateIn, named, norm, propertyNamed, timeIn } from './parse'

const TYPE_WORDS: [RegExp, AppointmentType][] = [
  [/\b(site ?visit|property visit|visit the (?:site|property|flat|villa|plot)|show(?:ing)? (?:the )?(?:flat|property|villa|plot)|site tour|visit)\b/, 'siteVisit'],
  [/\b(video call|zoom|google meet|gmeet|teams call|video)\b/, 'videoCall'],
  [/\b(registration|agreement signing|sign(?:ing)? (?:the )?agreement|documentation|paperwork|documents?|sale deed)\b/, 'documentation'],
  [/\b(office meeting|meet(?:ing)? at (?:the|our) office|office visit|come to (?:the|our) office|meeting|meet)\b/, 'officeMeeting'],
  [/\b(phone call|call(?:back)?|ring)\b/, 'phoneCall'],
]
export const appointmentTypeIn = (text: string): AppointmentType | undefined => {
  const t = norm(text).toLowerCase()
  return TYPE_WORDS.find(([re]) => re.test(t))?.[1]
}

export const APPOINTMENT_QUESTIONS: Record<string, AIQuestion> = {
  lead: { field: 'leadId', prompt: 'ai:question.appointment.lead', essential: true },
  type: {
    field: 'type', prompt: 'ai:question.appointment.type', essential: true,
    chips: (['siteVisit', 'officeMeeting', 'phoneCall', 'videoCall', 'documentation'] as const).map((v) => ({ label: `catalogue:appointmentType.${v}`, value: v })),
  },
  date: {
    field: 'date', prompt: 'ai:question.appointment.date', essential: true,
    chips: [{ label: 'ai:chip.date.today', value: 0 }, { label: 'ai:chip.date.tomorrow', value: 1 }, { label: 'ai:chip.date.dayAfter', value: 2 }],
  },
  time: {
    field: 'time', prompt: 'ai:question.appointment.time', essential: true,
    chips: ['10:00', '11:00', '15:00', '17:00'].map((v) => ({ label: `ai:chip.time.${v.replace(':', '')}`, value: v })),
  },
  property: { field: 'propertyIds', prompt: 'ai:question.appointment.property', essential: true },
}

const RELATIVE_RE = /\bin\s+(\d{1,3}(?:\.\d)?|an?|half an?)\s*(hours?|hrs?|minutes?|mins?)\b/i

/** "in 2 hours", "in 45 mins", "in an hour", "in half an hour" → now + that, rounded up to the next 5 minutes. */
export function relativeStartIn(text: string, now: Date): Date | undefined {
  const m = RELATIVE_RE.exec(text)
  if (!m) return undefined
  const n = /^half/i.test(m[1]) ? 0.5 : /^an?$/i.test(m[1]) ? 1 : parseFloat(m[1])
  const mins = /^h/i.test(m[2]) ? n * 60 : n
  const step = 5 * 60_000
  return new Date(Math.ceil((now.getTime() + mins * 60_000) / step) * step)
}

export function extractAppointmentFields(
  text: string,
  ctx: { now: Date; leads: Lead[]; properties: Property[]; db?: Pick<DB, 'users'>; selectedLeadId?: string },
): Extraction<AppointmentInput> & { date?: string; time?: string } {
  const meta: FieldMetaMap = {}
  const fields: Partial<AppointmentInput> = {}
  const notes: string[] = []
  const ai = (path: string, confidence: number) => { meta[path] = { origin: 'ai', confidence } }
  const t = norm(text)

  const type = appointmentTypeIn(t)
  if (type) { fields.type = type; ai('type', 0.85) }

  const leads = named(t, ctx.leads.map((l) => ({ id: l.id, name: l.name })))
  const leadId = leads[0]?.id ?? ctx.selectedLeadId
  if (leadId) { fields.leadId = leadId; ai('leadId', leads[0] ? (leads.length > 1 ? 0.6 : 0.9) : 0.7) }
  if (leads.length > 1) notes.push('ai:note.severalLeads')

  const props: Property[] = []
  const p = propertyNamed(t, ctx.properties)
  if (p) props.push(p)
  if (!p && leadId && type === 'siteVisit') {
    // "visit tomorrow" on a lead with a shortlist: the shortlisted properties are the likely ones
    const lead = ctx.leads.find((l) => l.id === leadId)
    const listed = lead?.shortlist.filter((s) => s.status === 'shortlisted' || s.status === 'liked').map((s) => ctx.properties.find((x) => x.id === s.propertyId)).filter((x): x is Property => !!x) ?? []
    if (listed.length) { props.push(...listed.slice(0, 2)); notes.push('ai:note.shortlistUsed') }
  }
  if (props.length) {
    fields.propertyIds = props.map((x) => x.id)
    ai('propertyIds', p ? 0.85 : 0.6)
    if (type === 'siteVisit') {
      fields.location = { text: propertyAddress(props[0]), mapUrl: mapsLink(propertyAddress(props[0])) }
      ai('location', 0.8)
    }
  }

  // "in 2 hours" / "in 30 mins" / "in an hour": a start relative to now (not a duration)
  const rel = relativeStartIn(t, ctx.now)
  const date = rel ? localDay(rel) : dateIn(t, localDay(ctx.now))
  const time = rel ? `${String(rel.getHours()).padStart(2, '0')}:${String(rel.getMinutes()).padStart(2, '0')}` : timeIn(t)
  if (date) ai('date', 0.85)
  if (time) ai('time', 0.85)
  if (date && time) { fields.start = atLocal(date, time); ai('start', 0.85) }
  const durText = rel ? t.replace(RELATIVE_RE, ' ') : t
  const dur = /\b(\d{1,3})\s*(?:min(?:ute)?s?|mins)\b/i.exec(durText) ?? /\b(\d(?:\.\d)?)\s*(?:hours?|hrs?)\b/i.exec(durText)
  if (dur) { fields.durationMin = /h/i.test(dur[0]) ? Math.round(parseFloat(dur[1]) * 60) : Number(dur[1]); ai('durationMin', 0.85) }
  else if (type) fields.durationMin = DEFAULT_DURATION_MIN[type]
  if (!fields.location && /\b(office|at our office)\b/i.test(t) && type === 'officeMeeting') { fields.location = { text: 'Office' }; ai('location', 0.6) }
  const note = /\b(?:note|notes|remarks?|agenda)\s*[:-]\s*(.+)$/im.exec(t)
  if (note) { fields.notes = note[1].trim(); ai('notes', 0.8) }

  const missing: string[] = []
  if (!fields.leadId) missing.push('lead')
  if (!fields.type) missing.push('type')
  if (!date) missing.push('date')
  if (!time) missing.push('time')
  if (fields.type === 'siteVisit' && !fields.propertyIds?.length) missing.push('property')
  const questions = missing.map((m) => APPOINTMENT_QUESTIONS[m])

  return { mode: 'simulated', fields, meta, missing, questions, filledCount: Object.keys(meta).length, notes, date, time }
}
