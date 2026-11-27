/**
 * The global assistant's pure pieces: route → selected record, role prompt chips (ROLE_RESEARCH §5) that the reader
 * understands, proposal edits, the module-assistant registry and the effort-saved counts.
 */
import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { selectionFromRoute, effectiveSelection } from './context'
import { effortSaved } from './effort'
import { MODULE_ASSISTANT_KEYS, relevantAssistants } from './modules'
import { rolePrompts } from './prompts'
import { editableFields, reviseProposal } from './revise'
import { parseCommandSim } from './simulated/commands'
import type { AIContext } from './types'

const now = new Date(2026, 10, 27, 10, 0, 0)
const db = buildSeed(now)
const u = (id: string) => db.users.find((x) => x.id === id)!
const ctx = (id: string): AIContext => ({ actor: u(id), role: u(id).role, route: '/today', now, db: () => db })

describe('context', () => {
  it('reads the record from the path', () => {
    expect(selectionFromRoute('/leads/LEAD-1001')).toEqual({ kind: 'lead', id: 'LEAD-1001' })
    expect(selectionFromRoute('/leads/LEAD-1001/edit')).toEqual({ kind: 'lead', id: 'LEAD-1001' })
    expect(selectionFromRoute('/leads/new')).toBeUndefined()
    expect(selectionFromRoute('/properties/PRP-1003')).toEqual({ kind: 'property', id: 'PRP-1003' })
    expect(selectionFromRoute('/matching', '?lead=LEAD-1002')).toEqual({ kind: 'lead', id: 'LEAD-1002' })
    expect(selectionFromRoute('/today')).toBeUndefined()
    expect(effectiveSelection({ kind: 'task', id: 'T1' }, '/leads/LEAD-1001')).toEqual({ kind: 'task', id: 'T1' })
  })
})

describe('role prompt chips', () => {
  it.each(['u-arjun', 'u-rohit', 'u-admin'])('every chip for %s is understood (never "unknown") and runs without error', (id) => {
    const chips = rolePrompts(db, u(id), now)
    expect(chips.length).toBeGreaterThanOrEqual(6)
    for (const c of chips.filter((x) => !x.prefill)) {
      const plan = parseCommandSim(c.command, ctx(id))
      expect(plan.intent, c.command).not.toBe('unknown')
    }
  })

  it('adds record chips for the open lead', () => {
    const lead = db.leads.find((l) => l.ownerId === 'u-arjun')!
    const chips = rolePrompts(db, u('u-arjun'), now, { kind: 'lead', id: lead.id })
    expect(chips[0].id).toBe('rec-summary')
    expect(chips.some((c) => c.command.includes(lead.name))).toBe(true)
  })
})

describe('proposal edits', () => {
  it('rebuilds the payload and summary', () => {
    const lead = db.leads.find((l) => l.name === 'Priya Sharma')!
    const plan = parseCommandSim('Schedule a site visit with Priya tomorrow 11am', ctx('u-rohit'))
    const p = plan.proposals[0]
    expect(editableFields(p)).toEqual(['type', 'start'])
    const start = new Date(2026, 10, 29, 16, 0).toISOString()
    const next = reviseProposal(p, { start, type: 'officeMeeting' }, db)
    expect((next.payload as { input: { start: string; type: string; leadId: string } }).input).toMatchObject({ start, type: 'officeMeeting', leadId: lead.id })
    expect(next.id).toBe(p.id)
  })

  it('a lost stage gets a reason row; moving back removes it', () => {
    const p = parseCommandSim('move Priya to negotiation', ctx('u-rohit')).proposals[0]
    const lost = reviseProposal(p, { stage: 'lost', lostReason: 'location' }, db)
    expect(lost.payload).toMatchObject({ to: 'lost', lostReason: 'location' })
    expect(lost.summary.some((r) => r.label === 'ai:field.reason')).toBe(true)
    const back = reviseProposal(lost, { stage: 'qualified' }, db)
    expect(back.summary.some((r) => r.label === 'ai:field.reason')).toBe(false)
  })
})

describe('module assistants and effort', () => {
  it('registers the ten assistants of master prompt §12.2', () => {
    expect(MODULE_ASSISTANT_KEYS).toHaveLength(10)
    expect(relevantAssistants('/leads/LEAD-1', { kind: 'lead', id: 'LEAD-1' })).toContain('followUp')
    expect(relevantAssistants('/import', undefined)[0]).toBe('import')
  })

  it('counts AI help from real records only', () => {
    const e = effortSaved(db, u('u-rohit'), now)
    expect(e.actions).toBeGreaterThanOrEqual(0)
    expect(e.minutes).toBe(Math.round((e.fields * 10 + e.actions * 45 + e.autoAssigned * 60 + e.autoTasks * 30) / 60))
  })
})

describe('every answer is fully translated (no raw keys) in English and Tamil', () => {
  const asks = [
    "Show today's pending tasks", 'Who should I call next?', 'My highest-priority leads', 'Leads with no contact in 5 days', 'potential conversions',
    "Summarise today's appointments", 'How am I doing this month?', "What's left for my target this month?", 'Summarise team performance this week',
    'Who is overloaded today?', 'Show stalled deals over 10 days', 'Which source converts best to visits?', 'How many leads did we lose to budget mismatch this month?',
    'Which project has most unsold inventory?', 'Business summary for today', 'Find duplicate leads', 'Import this CSV from 99acres', 'Assign new leads',
    "Reassign Farhan's leads, he's on leave", 'Find matching properties for Priya', 'Match properties for Priya under 2 Cr', 'Summarise Priya Sharma',
    'Draft visit confirmation for Priya', 'Schedule a site visit with Priya tomorrow 11am', 'remind me to call Karthik tomorrow 5pm', 'move Priya to negotiation',
    'Called Priya, no answer, try again tomorrow', "Priya's budget is now 2.5 Cr", 'reassign Sanjay Gupta → Vikram', 'delete lead Priya Sharma', 'help', 'blah blah',
    'Add lead Rahul Verma 9845012345, 3BHK Whitefield, budget 1.2 Cr', '3 bhk flats in Whitefield under 1.5 cr', 'Deactivate Kavya',
  ]
  const raw = /\b(ai|catalogue|leads|today|common):[a-zA-Z]/
  it.each(['en', 'ta'])('%s', async (lng) => {
    const { default: i18n } = await import('@/i18n')
    await i18n.changeLanguage(lng)
    for (const id of ['u-arjun', 'u-rohit', 'u-admin']) {
      for (const q of asks) {
        const p = parseCommandSim(q, ctx(id))
        const texts = [p.reply.text, ...(p.reply.bullets ?? []), ...(p.stats ?? []).flatMap((s) => [s.label, s.display ?? '']),
          ...p.proposals.flatMap((x) => x.summary.map((r) => r.value)), ...(p.followUps ?? []).map((f) => f.label)]
        for (const s of texts) expect(s, `${id}: ${q}`).not.toMatch(raw)
        expect(p.reply.text.length, `${id}: ${q}`).toBeGreaterThan(0)
        for (const r of p.proposals.flatMap((x) => x.summary)) expect(i18n.exists(r.label), r.label).toBe(true)
        for (const n of p.reply.nav ?? []) expect(i18n.exists(n.label), n.label).toBe(true)
      }
    }
    for (const c of rolePrompts(db, u('u-rohit'), now)) expect(c.label).not.toMatch(raw)
    await i18n.changeLanguage('en')
  })
})
