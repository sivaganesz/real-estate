/**
 * 22 appointments (foundation-plan §6.4): 7 today (with one deliberate clash for Vikram), 6 upcoming,
 * 5 completed, 2 past still needing an outcome, 1 no-show and 1 cancelled. Every type appears.
 */
import type { Appointment, AppointmentType, ID, Property, VisitOutcome } from '@/domain/types'
import type { Clock } from './dates'
import { ARJUN, SNEHA, VIKRAM } from './users'

export const mapsSearchUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

const OFFICE = { text: 'RealSpec office, 80 Feet Road, Koramangala, Bengaluru', mapUrl: mapsSearchUrl('80 Feet Road Koramangala Bengaluru') }

type Spec = {
  id: ID; type: AppointmentType; ownerId: ID; leadId?: ID; clientId?: ID; propertyIds?: ID[]; start: string; durationMin?: number
  status?: Appointment['status']; notes?: string; outcome?: VisitOutcome; cancelReason?: string; createdAgoDays?: number; location?: Appointment['location']
}

export function seedAppointments(c: Clock, properties: Property[]): Appointment[] {
  const prop = (id: ID) => properties.find((p) => p.id === id)
  const make = (s: Spec): Appointment => {
    const first = s.propertyIds?.[0] ? prop(s.propertyIds[0]) : undefined
    const location = s.location ?? (s.type === 'siteVisit' && first
      ? { text: `${first.title} · ${first.location.address ?? first.location.locality}`, mapUrl: mapsSearchUrl(`${first.location.address ?? ''} ${first.location.locality} ${first.location.city}`) }
      : s.type === 'officeMeeting' || s.type === 'documentation' ? OFFICE : undefined)
    const createdAt = c.ago(s.createdAgoDays ?? 3, 'days')
    return {
      id: s.id, type: s.type, status: s.status ?? 'scheduled', leadId: s.leadId, clientId: s.clientId, propertyIds: s.propertyIds ?? [], ownerId: s.ownerId,
      start: s.start, durationMin: s.durationMin ?? (s.type === 'phoneCall' ? 15 : s.type === 'videoCall' ? 30 : s.type === 'officeMeeting' ? 45 : 60),
      location, reminderMins: 60, notes: s.notes, outcome: s.outcome, cancelReason: s.cancelReason,
      createdBy: s.ownerId, createdAt, updatedAt: s.outcome?.at ?? createdAt,
    }
  }
  return [
    // ── today
    make({ id: 'APT-1001', type: 'siteVisit', ownerId: ARJUN, leadId: 'LEAD-1001', propertyIds: ['PRP-1001'], start: c.at(0, '11:00'), status: 'confirmed', notes: 'Priya and her husband. Show the east-facing unit on the 9th floor and the clubhouse.', createdAgoDays: 2 }),
    make({ id: 'APT-1002', type: 'phoneCall', ownerId: ARJUN, leadId: 'LEAD-1003', start: c.at(0, '15:00'), notes: 'Discuss loan eligibility and the Hebbal shortlist with her parents on the line.', createdAgoDays: 3 }),
    make({ id: 'APT-1003', type: 'officeMeeting', ownerId: SNEHA, leadId: 'LEAD-1008', propertyIds: ['PRP-1011'], start: c.at(0, '12:00'), notes: 'Price discussion with Harish and his wife. Bring the floor-rise waiver note.', createdAgoDays: 5, location: { text: 'RealSpec office, Hitech City, Hyderabad', mapUrl: mapsSearchUrl('Hitech City Hyderabad') } }),
    make({ id: 'APT-1004', type: 'siteVisit', ownerId: SNEHA, leadId: 'LEAD-1007', propertyIds: ['PRP-1009'], start: c.at(0, '16:00'), status: 'confirmed', notes: 'Corner villa. Lakshmi wants to see the garden and the Vastu layout.', createdAgoDays: 1 }),
    make({ id: 'APT-1005', type: 'siteVisit', ownerId: VIKRAM, leadId: 'LEAD-1011', propertyIds: ['PRP-1006'], start: c.at(0, '12:30'), status: 'confirmed', createdAgoDays: 2 }),
    make({ id: 'APT-1006', type: 'siteVisit', ownerId: VIKRAM, leadId: 'LEAD-1014', propertyIds: ['PRP-1007'], start: c.at(0, '12:45'), notes: 'Rebooked after last week\'s no-show.', createdAgoDays: 1 }),
    make({ id: 'APT-1007', type: 'videoCall', ownerId: VIKRAM, leadId: 'LEAD-1012', start: c.at(0, '17:00'), notes: 'Walk Pooja through the Kharadi floor plans on video.', createdAgoDays: 2 }),

    // ── upcoming
    make({ id: 'APT-1008', type: 'officeMeeting', ownerId: ARJUN, leadId: 'LEAD-1002', propertyIds: ['PRP-1003'], start: c.at(1, '11:00'), notes: 'Final price meeting with the owner.', createdAgoDays: 2 }),
    make({ id: 'APT-1009', type: 'siteVisit', ownerId: ARJUN, leadId: 'LEAD-1003', propertyIds: ['PRP-1002', 'PRP-1014'], start: c.at(3, '10:00'), createdAgoDays: 1 }),
    make({ id: 'APT-1010', type: 'siteVisit', ownerId: SNEHA, leadId: 'LEAD-1009', propertyIds: ['PRP-1004'], start: c.at(2, '11:00'), createdAgoDays: 1 }),
    make({ id: 'APT-1011', type: 'documentation', ownerId: VIKRAM, leadId: 'LEAD-1015', clientId: 'CL-1016', propertyIds: ['PRP-1008'], start: c.at(4, '15:00'), durationMin: 90, notes: 'Sale agreement signing. Collect Aadhaar copy.', createdAgoDays: 1, location: { text: 'Konkan Shore Developers site office, Ghodbunder Road, Thane', mapUrl: mapsSearchUrl('Ghodbunder Road Thane') } }),
    make({ id: 'APT-1012', type: 'siteVisit', ownerId: VIKRAM, leadId: 'LEAD-1012', propertyIds: ['PRP-1007'], start: c.at(5, '11:30'), createdAgoDays: 1 }),
    make({ id: 'APT-1013', type: 'videoCall', ownerId: SNEHA, leadId: 'LEAD-1010', propertyIds: ['PRP-1017'], start: c.at(6, '18:00'), notes: 'Show the Gachibowli office space over video.', createdAgoDays: 1 }),

    // ── completed
    make({
      id: 'APT-1014', type: 'siteVisit', ownerId: ARJUN, leadId: 'LEAD-1006', propertyIds: ['PRP-1001', 'PRP-1003'], start: c.at(-1, '16:00'), status: 'completed', createdAgoDays: 4,
      outcome: { result: 'interested', interest: 'high', likedPropertyIds: ['PRP-1001'], objections: 'Wants a lower floor; worried about the maintenance charge.', decisionMakerPresent: true, nextStep: 'Call tomorrow with the floor options and a maintenance breakup.', summary: 'Liked Aranya Greens a lot. Wife joined. Ready to move is a must.', at: c.at(-1, '17:30'), by: ARJUN },
    }),
    make({
      id: 'APT-1015', type: 'siteVisit', ownerId: ARJUN, leadId: 'LEAD-1002', propertyIds: ['PRP-1001', 'PRP-1003'], start: c.at(-12, '11:00'), status: 'completed', createdAgoDays: 15,
      outcome: { result: 'readyToBook', interest: 'high', likedPropertyIds: ['PRP-1003'], decisionMakerPresent: true, nextStep: 'Negotiate with the owner.', at: c.at(-12, '12:30'), by: ARJUN },
    }),
    make({
      id: 'APT-1016', type: 'siteVisit', ownerId: SNEHA, leadId: 'LEAD-1008', propertyIds: ['PRP-1011'], start: c.at(-18, '10:30'), status: 'completed', createdAgoDays: 20,
      outcome: { result: 'interested', interest: 'high', likedPropertyIds: ['PRP-1011'], objections: 'Floor-rise charges.', decisionMakerPresent: true, at: c.at(-18, '12:00'), by: SNEHA },
    }),
    make({
      id: 'APT-1017', type: 'siteVisit', ownerId: VIKRAM, leadId: 'LEAD-1015', propertyIds: ['PRP-1008'], start: c.at(-10, '11:00'), status: 'completed', createdAgoDays: 12,
      outcome: { result: 'readyToBook', interest: 'high', likedPropertyIds: ['PRP-1008'], decisionMakerPresent: true, nextStep: 'Collect the token cheque.', at: c.at(-10, '12:15'), by: VIKRAM },
    }),
    make({
      id: 'APT-1018', type: 'phoneCall', ownerId: SNEHA, leadId: 'LEAD-1007', start: c.at(-3, '17:00'), status: 'completed', createdAgoDays: 4,
      outcome: { result: 'interested', interest: 'high', likedPropertyIds: [], nextStep: 'Book a site visit at Orchid Villas.', at: c.at(-3, '17:20'), by: SNEHA },
    }),

    // ── past, outcome still needed
    make({ id: 'APT-1019', type: 'siteVisit', ownerId: ARJUN, leadId: 'LEAD-1001', propertyIds: ['PRP-1002'], start: c.at(-4, '11:00'), status: 'confirmed', createdAgoDays: 6 }),
    make({ id: 'APT-1020', type: 'phoneCall', ownerId: VIKRAM, leadId: 'LEAD-1011', start: c.at(-2, '18:00'), createdAgoDays: 3 }),

    // ── no-show and cancelled
    make({ id: 'APT-1021', type: 'siteVisit', ownerId: VIKRAM, leadId: 'LEAD-1014', propertyIds: ['PRP-1006'], start: c.at(-3, '11:00'), status: 'noShow', createdAgoDays: 5 }),
    make({ id: 'APT-1022', type: 'siteVisit', ownerId: SNEHA, leadId: 'LEAD-1009', propertyIds: ['PRP-1004'], start: c.at(-5, '11:00'), status: 'cancelled', cancelReason: 'Customer travelling to Kochi that week.', createdAgoDays: 7 }),
  ]
}
