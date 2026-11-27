/**
 * 24 notifications (foundation-plan §6.4): Arjun 5, Sneha 4, Vikram 4, Rohit 6, Meera 5; about 60% unread.
 * Rendered by the i18n `notifications` namespace from `kind` (+ `params.variant` for system messages).
 */
import type { ID, Notification } from '@/domain/types'
import type { Clock } from './dates'
import { ADMIN_ID, ARJUN, MANAGER_ID, SNEHA, VIKRAM } from './users'

type Spec = Omit<Notification, 'id' | 'priority' | 'readAt'> & { priority?: Notification['priority']; read?: boolean }

export function seedNotifications(c: Clock): Notification[] {
  const lead = (id: ID) => ({ kind: 'lead' as const, id })
  const specs: Spec[] = [
    // Arjun
    { userId: ARJUN, kind: 'assignment', at: c.ago(24, 'minutes'), params: { name: 'Neha Kulkarni', count: 1 }, ref: lead('LEAD-1005') },
    { userId: ARJUN, kind: 'slaBreach', at: c.ago(10, 'minutes'), params: { name: 'Neha Kulkarni', mins: 15 }, ref: lead('LEAD-1005'), priority: 'high', dedupeKey: 'sla:LEAD-1005' },
    { userId: ARJUN, kind: 'appointmentReminder', at: c.ago(30, 'minutes'), params: { name: 'Priya Sharma', property: 'Aranya Greens', time: '11:00' }, ref: { kind: 'appointment', id: 'APT-1001' }, dedupeKey: 'reminder:APT-1001' },
    { userId: ARJUN, kind: 'taskOverdue', at: c.at(-1, '16:05'), params: { title: 'Call Mohammed Irfan back about Electronic City options', name: 'Mohammed Irfan' }, ref: { kind: 'task', id: 'TSK-1001' }, dedupeKey: 'overdue:TSK-1001' },
    { userId: ARJUN, kind: 'propertyUnavailable', at: c.ago(3, 'days'), params: { property: 'Kaveri Enclave 3 BHK, HSR Layout', status: 'onHold', name: 'Deepak Verma' }, ref: { kind: 'property', id: 'PRP-1003' }, read: true },
    // Sneha
    { userId: SNEHA, kind: 'appointmentReminder', at: c.ago(15, 'minutes'), params: { name: 'Lakshmi Narayanan', property: 'Orchid Villas', time: '16:00' }, ref: { kind: 'appointment', id: 'APT-1004' }, dedupeKey: 'reminder:APT-1004' },
    { userId: SNEHA, kind: 'taskOverdue', at: c.at(-4, '15:05'), params: { title: 'Call Harish about the revised Tellapur offer', name: 'Harish Reddy' }, ref: { kind: 'task', id: 'TSK-1010' }, dedupeKey: 'overdue:TSK-1010' },
    { userId: SNEHA, kind: 'reassignment', at: c.ago(9, 'days'), params: { name: 'Divya Menon', from: 'Arjun Mehta' }, ref: lead('LEAD-1009'), read: true },
    { userId: SNEHA, kind: 'taskOverdue', at: c.at(-2, '11:05'), params: { title: 'Follow up with Divya on the OMR flat', name: 'Divya Menon' }, ref: { kind: 'task', id: 'TSK-1009' }, dedupeKey: 'overdue:TSK-1009', read: true },
    // Vikram
    { userId: VIKRAM, kind: 'appointmentReminder', at: c.ago(5, 'minutes'), params: { name: 'Rohan Deshpande', property: 'Sahyadri Heights', time: '12:30' }, ref: { kind: 'appointment', id: 'APT-1005' }, dedupeKey: 'reminder:APT-1005' },
    { userId: VIKRAM, kind: 'taskOverdue', at: c.at(-3, '12:05'), params: { title: 'Follow up with Pooja on Kharadi options', name: 'Pooja Agarwal' }, ref: { kind: 'task', id: 'TSK-1016' }, dedupeKey: 'overdue:TSK-1016' },
    { userId: VIKRAM, kind: 'assignment', at: c.ago(20, 'hours'), params: { name: 'Vivek Malhotra', count: 1 }, ref: lead('LEAD-1013'), read: true },
    { userId: VIKRAM, kind: 'reassignment', at: c.ago(5, 'days'), params: { name: 'Pooja Agarwal', from: 'Kavya Joshi' }, ref: lead('LEAD-1012'), read: true },
    // Rohit (manager)
    { userId: MANAGER_ID, kind: 'slaBreach', at: c.ago(5, 'minutes'), params: { count: 5, mins: 15 }, priority: 'high', dedupeKey: `unassigned-queue:${c.day(0)}` },
    { userId: MANAGER_ID, kind: 'leaveReassign', at: c.ago(2, 'days'), params: { name: 'Farhan Qureshi', count: 2 }, ref: { kind: 'user', id: 'u-farhan' } },
    { userId: MANAGER_ID, kind: 'stalledDeal', at: c.ago(3, 'hours'), params: { name: 'Harish Reddy', days: 21, stage: 'negotiation' }, ref: lead('LEAD-1008'), dedupeKey: `stalled:LEAD-1008:${c.day(0)}` },
    { userId: MANAGER_ID, kind: 'escalation', at: c.ago(2, 'minutes'), params: { name: 'Neha Kulkarni', owner: 'Arjun Mehta', mins: 25 }, ref: lead('LEAD-1005'), priority: 'high', dedupeKey: 'escalation:LEAD-1005' },
    { userId: MANAGER_ID, kind: 'booking', at: c.ago(1, 'days'), params: { name: 'Swati Chawla', property: 'Bayview Residences 2 BHK, Thane', amount: 500000, owner: 'Vikram Singh' }, ref: lead('LEAD-1015'), read: true },
    { userId: MANAGER_ID, kind: 'system', at: c.ago(12, 'days'), params: { variant: 'readyToBook', name: 'Karthik Subramanian', owner: 'Arjun Mehta' }, ref: lead('LEAD-1002'), read: true },
    // Meera (admin)
    { userId: ADMIN_ID, kind: 'importFinished', at: c.ago(1, 'days'), params: { fileName: '99acres-leads.csv', imported: 34, duplicates: 4, errors: 2 }, ref: { kind: 'importJob', id: 'IMP-1003' }, read: true },
    { userId: ADMIN_ID, kind: 'deactivatedOwner', at: c.ago(5, 'days'), params: { name: 'Kavya Joshi', count: 1 }, ref: { kind: 'user', id: 'u-kavya' } },
    { userId: ADMIN_ID, kind: 'duplicateFound', at: c.ago(50, 'minutes'), params: { name: 'Mohd Irfan', other: 'Mohammed Irfan' }, ref: lead('LEAD-1023') },
    { userId: ADMIN_ID, kind: 'booking', at: c.ago(1, 'days'), params: { name: 'Swati Chawla', property: 'Bayview Residences 2 BHK, Thane', amount: 500000, owner: 'Vikram Singh' }, ref: lead('LEAD-1015'), read: true },
    { userId: ADMIN_ID, kind: 'system', at: c.ago(6, 'days'), params: { variant: 'welcome' }, read: true },
  ]
  return specs
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(({ read, priority, ...s }, i) => ({ ...s, id: `NTF-${1001 + i}`, priority: priority ?? 'normal', readAt: read ? s.at : undefined }))
}
