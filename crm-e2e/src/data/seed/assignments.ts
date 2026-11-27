/**
 * Assignment history (append-only): one initial assignment per assigned lead, current and historical, plus 7
 * reassignments that show every reason (manual, owner on leave, redistribution from Kavya, rule by location).
 */
import type { Assignment, AssignmentMode, AssignmentReasonKey, ID, Lead } from '@/domain/types'
import { addMinutes } from 'date-fns'
import type { Clock } from './dates'
import { ARJUN, KAVYA, MANAGER_ID, SNEHA } from './users'

type Re = { leadId: ID; from: ID; to: ID; daysAgo: number; mode: AssignmentMode; reason: AssignmentReasonKey; by: ID | 'system'; note?: string }

const REASSIGNMENTS: Re[] = [
  { leadId: 'LEAD-1009', from: ARJUN, to: SNEHA, daysAgo: 9, mode: 'manual', reason: 'manual', by: MANAGER_ID, note: 'Chennai lead; Sneha covers Chennai and speaks Tamil.' },
  { leadId: 'LEAD-1011', from: 'u-farhan', to: 'u-vikram', daysAgo: 2, mode: 'redistribution', reason: 'ownerOnLeave', by: MANAGER_ID },
  { leadId: 'LEAD-1012', from: KAVYA, to: 'u-vikram', daysAgo: 5, mode: 'redistribution', reason: 'ownerDeactivated', by: 'system' },
  { leadId: 'LEAD-1014', from: KAVYA, to: 'u-vikram', daysAgo: 5, mode: 'redistribution', reason: 'ownerDeactivated', by: 'system' },
  { leadId: 'LEAD-1007', from: 'u-vikram', to: SNEHA, daysAgo: 14, mode: 'auto', reason: 'ruleLocation', by: 'system' },
  { leadId: 'LEAD-1010', from: ARJUN, to: SNEHA, daysAgo: 19, mode: 'manual', reason: 'manual', by: MANAGER_ID, note: 'Commercial enquiry; Sneha handles offices.' },
  { leadId: 'LEAD-1017', from: 'u-vikram', to: 'u-farhan', daysAgo: 8, mode: 'manual', reason: 'manual', by: MANAGER_ID, note: 'Noida is Farhan\'s territory.' },
]

export function seedAssignments(c: Clock, leads: Lead[]): Assignment[] {
  let n = 1000
  const id = () => `ASG-${++n}`
  const out: Assignment[] = []
  for (const lead of leads) {
    const first = lead.firstOwnerId ?? lead.ownerId
    if (!first) continue
    const self = lead.createdBy === first
    const mode: AssignmentMode = self ? 'self' : lead.id === 'LEAD-1001' || lead.id === 'LEAD-1002' ? 'manual' : 'auto'
    const reason: AssignmentReasonKey = self ? 'creatorOwns' : mode === 'manual' ? 'manual'
      : lead.requirement.cities.some((ct) => ct === 'Hyderabad' || ct === 'Chennai') && first === SNEHA ? 'ruleLocation'
      : out.length % 3 === 2 ? 'roundRobinTie' : 'lowestWorkload'
    out.push({
      id: id(), leadId: lead.id, fromUserId: null, toUserId: first, at: addMinutes(new Date(lead.createdAt), 1).toISOString(),
      by: mode === 'manual' ? MANAGER_ID : self ? first : 'system', mode, reason: { key: reason },
    })
  }
  for (const r of REASSIGNMENTS) {
    out.push({
      id: id(), leadId: r.leadId, fromUserId: r.from, toUserId: r.to, at: c.ago(r.daysAgo, 'days'), by: r.by, mode: r.mode,
      reason: { key: r.reason }, note: r.note,
    })
  }
  // ids follow time order, like an append-only log
  return out.sort((a, b) => a.at.localeCompare(b.at)).map((a, i) => ({ ...a, id: `ASG-${1001 + i}` }))
}
