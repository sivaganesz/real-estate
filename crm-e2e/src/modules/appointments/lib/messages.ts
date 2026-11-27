/**
 * WhatsApp confirmations for appointments that are not site visits (site visits use the AI service's `visitConfirm`
 * template, which already carries the map link). Message bodies are data sent to the client, so they stay in English
 * or Hinglish like the stored templates (Settings → Templates) and are not translated with the UI.
 */
import type { Appointment, AppointmentType } from '@/domain/types'
import { firstName } from '@/lib/format'

const WHAT: Record<AppointmentType, { english: string; hinglish: string }> = {
  siteVisit: { english: 'site visit', hinglish: 'site visit' },
  officeMeeting: { english: 'meeting at our office', hinglish: 'office meeting' },
  phoneCall: { english: 'call', hinglish: 'call' },
  videoCall: { english: 'video call', hinglish: 'video call' },
  documentation: { english: 'documentation appointment', hinglish: 'documentation appointment' },
}

export function confirmationMessage(input: {
  appointment: Pick<Appointment, 'type' | 'location'>
  leadName: string
  agent: string
  when: string
  property?: string
  tone?: 'english' | 'hinglish'
}): string {
  const { appointment: a, leadName, agent, when, property, tone = 'english' } = input
  const first = firstName(leadName)
  const what = WHAT[a.type][tone]
  const about = property ? (tone === 'english' ? ` about ${property}` : ` ${property} ke baare mein`) : ''
  const where = a.location?.text ? (tone === 'english' ? `\nVenue: ${a.location.text}` : `\nJagah: ${a.location.text}`) : ''
  const map = a.location?.mapUrl ? `\nLocation: ${a.location.mapUrl}` : ''
  const body = tone === 'english'
    ? `Hi ${first}, this is ${firstName(agent)} from RealSpec. Confirming our ${what}${about} on ${when}.`
    : `Hi ${first}, main ${firstName(agent)} RealSpec se. Hamara ${what}${about} ${when} ko confirm hai.`
  const close = tone === 'english' ? '\nPlease reply YES to confirm, or tell me a better time.' : '\nConfirm karne ke liye YES bhejiye, ya koi aur time bataiye.'
  return `${body}${where}${map}${close}`
}
