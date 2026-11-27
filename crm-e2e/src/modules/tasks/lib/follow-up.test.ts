import { describe, expect, it } from 'vitest'
import type { Appointment, Lead, Task } from '@/domain/types'
import { differsFromDue, intoWorkingHours, missedAttempts, suggestFollowUp } from './follow-up'

const now = new Date(2026, 10, 27, 12, 0)
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString()
const lead = (p: Partial<Lead> = {}) => ({ id: 'L1', stage: 'qualified' as const, engagement: { responded: true, docsRequested: false, siteVisited: false }, lastContactAt: at(26, 11), ...p })
const task = { id: 'T1', type: 'call' as const, dueAt: at(27, 15) }
const done = (completedAt: string, callResult: Task['callResult']) => ({ leadId: 'L1', status: 'done' as const, callResult, completedAt })
const visit = (start: string, status: Appointment['status'] = 'scheduled') => ({ leadId: 'L1', status, start, type: 'siteVisit' as const })

describe('intoWorkingHours', () => {
  it('keeps calls between 10:00 and 19:30, rounding to 15 minutes', () => {
    expect(intoWorkingHours(at(27, 21))).toBe(at(28, 10, 30))
    expect(intoWorkingHours(at(27, 8))).toBe(at(27, 10, 30))
    expect(intoWorkingHours(at(27, 13, 7))).toBe(at(27, 13, 15))
  })
})

describe('suggestFollowUp', () => {
  it('confirms an upcoming visit on WhatsApp two hours before', () => {
    const s = suggestFollowUp({ task, lead: lead(), tasks: [], appointments: [visit(at(28, 11))], now })
    expect(s).toMatchObject({ channel: 'whatsapp', purpose: 'visitConfirm', reasonKey: 'confirmVisit', at: at(28, 10, 30) })
  })
  it('switches to an evening WhatsApp after two unanswered calls', () => {
    const s = suggestFollowUp({ task, lead: lead(), tasks: [done(at(26, 11), 'notReachable'), done(at(27, 10), 'busy')], appointments: [], now })
    expect(s).toMatchObject({ channel: 'whatsapp', reasonKey: 'switchChannel', params: { count: 2 }, at: at(27, 18, 30) })
  })
  it('retries at the other half of the day after one unanswered call', () => {
    expect(suggestFollowUp({ task, lead: lead(), tasks: [done(at(27, 10), 'notReachable')], appointments: [], now })).toMatchObject({ reasonKey: 'retryEvening', at: at(27, 17, 30) })
    expect(suggestFollowUp({ task, lead: lead(), tasks: [done(at(26, 16), 'busy')], appointments: [], now })).toMatchObject({ reasonKey: 'retryMorning', at: at(28, 11) })
  })
  it('calls the same evening after a site visit', () => {
    const s = suggestFollowUp({ task: { ...task, autoReason: 'postVisitCall' }, lead: lead(), tasks: [], appointments: [visit(at(27, 10), 'completed')], now })
    expect(s).toMatchObject({ purpose: 'postVisit', reasonKey: 'postVisit', at: at(27, 18, 30) })
  })
  it('calls a new lead within minutes', () => {
    const s = suggestFollowUp({ task, lead: lead({ stage: 'new' }), tasks: [], appointments: [], now })
    expect(s).toMatchObject({ purpose: 'intro', reasonKey: 'firstContact', channel: 'call' })
    expect(new Date(s.at).getTime() - now.getTime()).toBeLessThanOrEqual(30 * 60_000)
  })
  it('follows the temperature: hot within the hour, cold in three days, warm tomorrow', () => {
    expect(suggestFollowUp({ task, lead: lead(), temperature: 'hot', tasks: [], appointments: [], now })).toMatchObject({ reasonKey: 'hot', at: at(27, 13) })
    expect(suggestFollowUp({ task, lead: lead(), temperature: 'cold', tasks: [], appointments: [], now })).toMatchObject({ reasonKey: 'cold', channel: 'whatsapp', at: at(30, 11) })
    expect(suggestFollowUp({ task, lead: lead(), temperature: 'warm', tasks: [], appointments: [], now })).toMatchObject({ reasonKey: 'warm', at: at(28, 11) })
  })
  it('flags a lead that has gone silent and respects a WhatsApp preference', () => {
    const s = suggestFollowUp({ task, lead: lead({ lastContactAt: at(20, 10), contactPref: 'whatsapp' }), temperature: 'warm', tasks: [], appointments: [], now })
    expect(s).toMatchObject({ reasonKey: 'silent', channel: 'whatsapp', params: { days: 7 } })
  })
  it('handles a task without a lead', () => {
    expect(suggestFollowUp({ task, tasks: [], appointments: [], now }).reasonKey).toBe('noLead')
  })
})

describe('helpers', () => {
  it('counts only recent unanswered calls of the lead', () => {
    expect(missedAttempts([done(at(26, 11), 'notReachable'), done(at(10, 11), 'busy'), done(at(26, 12), 'connected'), { ...done(at(26, 11), 'busy'), leadId: 'L2' }], 'L1', now)).toHaveLength(1)
  })
  it('only proposes moving a task when the time really changes', () => {
    expect(differsFromDue({ at: at(27, 15, 20) }, at(27, 15))).toBe(false)
    expect(differsFromDue({ at: at(27, 18) }, at(27, 15))).toBe(true)
  })
})
