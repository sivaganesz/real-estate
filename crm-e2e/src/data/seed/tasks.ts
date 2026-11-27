/**
 * 28 tasks / follow-ups (foundation-plan §6.4). Per switchable executive: 2 overdue, 2–3 due today, 2 upcoming and
 * 1–2 done today. Farhan has 2 overdue (he is on leave), Rohit 2, Meera 1. Includes Neha's SLA first-call and
 * Deepak's post-visit call (auto tasks).
 */
import type { ActorId, ID, Priority, Task, TaskType } from '@/domain/types'
import type { Clock } from './dates'
import { ADMIN_ID, ARJUN, FARHAN, MANAGER_ID, SNEHA, VIKRAM } from './users'

type Spec = {
  id: ID; title: string; type: TaskType; ownerId: ID; dueAt: string; priority?: Priority; leadId?: ID; clientId?: ID; appointmentId?: ID
  done?: { at: string; outcome?: string; callResult?: Task['callResult'] }; origin?: Task['origin']; autoReason?: Task['autoReason']
  createdAt?: string; createdBy?: ActorId; notes?: string
}

export function seedTasks(c: Clock): Task[] {
  const make = (s: Spec): Task => ({
    id: s.id, title: s.title, type: s.type, status: s.done ? 'done' : 'open', priority: s.priority ?? 'medium',
    leadId: s.leadId, clientId: s.clientId, appointmentId: s.appointmentId, ownerId: s.ownerId, dueAt: s.dueAt,
    completedAt: s.done?.at, outcome: s.done?.outcome, callResult: s.done?.callResult,
    createdBy: s.createdBy ?? (s.origin === 'automation' ? 'system' : s.ownerId), createdAt: s.createdAt ?? c.ago(2, 'days'),
    origin: s.origin ?? 'manual', autoReason: s.autoReason, notes: s.notes,
  })
  return [
    // ── Arjun: 2 overdue, 3 today, 2 upcoming, 1 done today
    make({ id: 'TSK-1001', title: 'Call Mohammed Irfan back about Electronic City options', type: 'call', ownerId: ARJUN, leadId: 'LEAD-1004', dueAt: c.at(-1, '16:00'), priority: 'high' }),
    make({ id: 'TSK-1002', title: 'Collect PAN copy from Karthik for the offer letter', type: 'document', ownerId: ARJUN, leadId: 'LEAD-1002', dueAt: c.at(-2, '12:00') }),
    make({ id: 'TSK-1003', title: 'Follow up with Ananya on the Hebbal shortlist', type: 'followUp', ownerId: ARJUN, leadId: 'LEAD-1003', dueAt: c.at(0, '13:00') }),
    make({ id: 'TSK-1004', title: 'Call Neha Kulkarni (new lead)', type: 'call', ownerId: ARJUN, leadId: 'LEAD-1005', dueAt: c.in(-10, 'minutes'), priority: 'high', origin: 'automation', autoReason: 'slaFirstCall', createdAt: c.ago(25, 'minutes') }),
    make({ id: 'TSK-1005', title: 'Post-visit call: Deepak Verma', type: 'call', ownerId: ARJUN, leadId: 'LEAD-1006', appointmentId: 'APT-1014', dueAt: c.at(0, '17:30'), priority: 'high', origin: 'automation', autoReason: 'postVisitCall', createdAt: c.at(-1, '17:30') }),
    make({ id: 'TSK-1006', title: 'Send Priya the maintenance breakup for Aranya Greens', type: 'whatsapp', ownerId: ARJUN, leadId: 'LEAD-1001', dueAt: c.at(1, '10:00') }),
    make({ id: 'TSK-1007', title: 'Call Karthik after the owner meeting', type: 'call', ownerId: ARJUN, leadId: 'LEAD-1002', dueAt: c.at(2, '12:00'), priority: 'high' }),
    make({ id: 'TSK-1008', title: 'Confirm today\'s site visit with Priya', type: 'call', ownerId: ARJUN, leadId: 'LEAD-1001', appointmentId: 'APT-1001', dueAt: c.at(0, '09:30'), done: { at: c.earlier(0.6), outcome: 'Confirmed for 11:00, husband joining.', callResult: 'connected' } }),

    // ── Sneha: 2 overdue, 2 today, 2 upcoming, 1 done today
    make({ id: 'TSK-1009', title: 'Follow up with Divya on the OMR flat', type: 'followUp', ownerId: SNEHA, leadId: 'LEAD-1009', dueAt: c.at(-2, '11:00') }),
    make({ id: 'TSK-1010', title: 'Call Harish about the revised Tellapur offer', type: 'call', ownerId: SNEHA, leadId: 'LEAD-1008', dueAt: c.at(-4, '15:00'), priority: 'high' }),
    make({ id: 'TSK-1011', title: 'Share the Orchid Villas brochure with Lakshmi', type: 'whatsapp', ownerId: SNEHA, leadId: 'LEAD-1007', dueAt: c.at(0, '14:00') }),
    make({ id: 'TSK-1012', title: 'WhatsApp Sanjay the Gachibowli office photos', type: 'whatsapp', ownerId: SNEHA, leadId: 'LEAD-1010', dueAt: c.at(0, '18:00'), priority: 'low' }),
    make({ id: 'TSK-1013', title: 'Send Harish the price sheet with the floor-rise waiver', type: 'email', ownerId: SNEHA, leadId: 'LEAD-1008', dueAt: c.at(1, '11:00') }),
    make({ id: 'TSK-1014', title: 'Call Sanjay to fix the video walkthrough', type: 'call', ownerId: SNEHA, leadId: 'LEAD-1010', dueAt: c.at(3, '12:00'), priority: 'low' }),
    make({ id: 'TSK-1015', title: 'Call Lakshmi to confirm the 4 pm visit', type: 'call', ownerId: SNEHA, leadId: 'LEAD-1007', appointmentId: 'APT-1004', dueAt: c.at(0, '10:00'), done: { at: c.earlier(0.65), outcome: 'Confirmed. Coming with her son.', callResult: 'connected' } }),

    // ── Vikram: 2 overdue, 2 today, 2 upcoming, 2 done today
    make({ id: 'TSK-1016', title: 'Follow up with Pooja on Kharadi options', type: 'followUp', ownerId: VIKRAM, leadId: 'LEAD-1012', dueAt: c.at(-3, '12:00') }),
    make({ id: 'TSK-1017', title: 'WhatsApp Amit to reconfirm the visit', type: 'whatsapp', ownerId: VIKRAM, leadId: 'LEAD-1014', dueAt: c.at(-1, '18:00') }),
    make({ id: 'TSK-1018', title: 'Reminder call to Rohan before the visit', type: 'call', ownerId: VIKRAM, leadId: 'LEAD-1011', appointmentId: 'APT-1005', dueAt: c.at(0, '11:30') }),
    make({ id: 'TSK-1019', title: 'Email Vivek the Gurugram shortlist (NRI)', type: 'email', ownerId: VIKRAM, leadId: 'LEAD-1013', dueAt: c.at(0, '16:00'), priority: 'high' }),
    make({ id: 'TSK-1020', title: 'Collect booking documents from Swati', type: 'document', ownerId: VIKRAM, leadId: 'LEAD-1015', clientId: 'CL-1016', dueAt: c.at(2, '17:00'), priority: 'high', origin: 'automation', autoReason: 'bookingDocs', createdAt: c.ago(1, 'days') }),
    make({ id: 'TSK-1021', title: 'Call Pooja after the video call', type: 'call', ownerId: VIKRAM, leadId: 'LEAD-1012', dueAt: c.at(2, '11:00') }),
    make({ id: 'TSK-1022', title: 'Send Swati the token receipt', type: 'whatsapp', ownerId: VIKRAM, leadId: 'LEAD-1015', clientId: 'CL-1016', dueAt: c.at(0, '10:00'), done: { at: c.earlier(0.5), outcome: 'Receipt sent on WhatsApp.' } }),
    make({ id: 'TSK-1023', title: 'Confirm Rohan\'s visit time', type: 'call', ownerId: VIKRAM, leadId: 'LEAD-1011', dueAt: c.at(0, '09:30'), done: { at: c.earlier(0.55), outcome: 'Confirmed 12:30.', callResult: 'connected' } }),

    // ── Farhan (on leave): 2 overdue
    make({ id: 'TSK-1024', title: 'Follow up with Nisha on Thane 2 BHK options', type: 'followUp', ownerId: FARHAN, leadId: 'LEAD-1016', dueAt: c.at(-2, '12:00') }),
    make({ id: 'TSK-1025', title: 'Call Gaurav about Noida projects', type: 'call', ownerId: FARHAN, leadId: 'LEAD-1017', dueAt: c.at(-1, '15:00') }),

    // ── Rohit (manager): 2
    make({ id: 'TSK-1026', title: 'Approve Karthik\'s discount request (₹1.35 Cr vs ₹1.39 Cr)', type: 'other', ownerId: MANAGER_ID, leadId: 'LEAD-1002', dueAt: c.at(0, '13:00'), priority: 'high', createdBy: ARJUN }),
    make({ id: 'TSK-1027', title: 'Weekly pipeline review with the team', type: 'meeting', ownerId: MANAGER_ID, dueAt: c.at(2, '10:00') }),

    // ── Meera (admin): 1
    make({ id: 'TSK-1028', title: 'Clean up duplicate leads from the WhatsApp inbox', type: 'other', ownerId: ADMIN_ID, leadId: 'LEAD-1023', dueAt: c.at(0, '17:00'), priority: 'low' }),
  ]
}
