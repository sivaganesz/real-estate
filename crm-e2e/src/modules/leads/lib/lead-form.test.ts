import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { extractLeadFields } from '@/ai/simulated/extract-lead'
import { makeLead } from '@/test/factories'
import { editChanges, patchFromChanges } from './ai-edit'
import { answerField, applyExtraction, draftErrors, draftFromLead, draftToInput, emptyDraft, moreCount, setPath, stepOfField, withPlaces } from './lead-form'

const now = new Date(2026, 10, 27, 10, 0)
const db = buildSeed(now)
const RAHUL = "Hi, I'm Rahul Verma, 9845012345. Looking for a 3BHK in Whitefield or Sarjapur, budget around 1.2 Cr, ready to move, need it in 2–3 months. Wife will also decide."

describe('lead form model', () => {
  it('fills the Rahul Verma example completely from paste-and-fill (master prompt §12.3)', () => {
    const x = extractLeadFields(RAHUL, { now, db })
    const { draft, meta } = applyExtraction(emptyDraft(), x)
    expect(draft.name).toBe('Rahul Verma')
    expect(draft.phone).toBe('+919845012345')
    expect(draft.requirement.configurations).toEqual(['3BHK'])
    expect(draft.requirement.localities).toEqual(['Whitefield', 'Sarjapur Road'])
    expect(draft.requirement.cities).toEqual(['Bengaluru'])
    expect(draft.requirement.budgetMax).toBe(12_000_000)
    expect(draft.requirement.possession).toBe('ready')
    expect(draft.qualification.timeline).toBe('m1to3')
    expect(draft.qualification.decisionMakers).toContain('spouse')
    expect(meta.name.origin).toBe('ai')
    // only the source is still missing; answering its chip makes the form valid
    expect(draftErrors(draft).map((e) => e.field)).toEqual(['source'])
    const done = answerField(draft, 'source', 'whatsapp')
    expect(draftErrors(done)).toEqual([])
    expect(draftToInput(done).source).toBe('whatsapp')
  })

  it('never wipes a typed value with a field the AI did not read', () => {
    const typed = { ...emptyDraft(), email: 'kept@example.com', source: 'walkIn' as const }
    const { draft } = applyExtraction(typed, extractLeadFields('3BHK in Hebbal under 90 lakhs', { now }))
    expect(draft.email).toBe('kept@example.com')
    expect(draft.source).toBe('walkIn')
    expect(draft.requirement.localities).toEqual(['Hebbal'])
  })

  it('requires only name, phone or e-mail, and source', () => {
    const keys = draftErrors(emptyDraft()).map((e) => `${e.field}:${e.key}`)
    expect(keys).toEqual(['name:required', 'phone:phoneOrEmail', 'source:required'])
    const ok = { ...emptyDraft(), name: 'A B', email: 'a@b.co', source: 'website' as const }
    expect(draftErrors(ok)).toEqual([])
    expect(draftErrors({ ...ok, phone: '12345' }).map((e) => e.key)).toEqual(['invalidPhone'])
    expect(stepOfField('requirement.budgetMin')).toBe(2)
    expect(stepOfField('requirement.localities')).toBe(1)
    expect(stepOfField('phone')).toBe(0)
  })

  it('keeps cities and localities in step', () => {
    const d = withPlaces(emptyDraft(), { localities: ['Kokapet'] })
    expect(d.requirement.cities).toEqual(['Hyderabad'])
    const d2 = withPlaces(withPlaces(d, { localities: ['Kokapet', 'Whitefield'] }), { cities: ['Bengaluru'] })
    expect(d2.requirement.localities).toEqual(['Whitefield'])
  })

  it('answers chips for lists and scalars, and sets authority from decision makers', () => {
    let d = answerField(emptyDraft(), 'requirement.configurations', ['3BHK'])
    expect(d.requirement.configurations).toEqual(['3BHK'])
    expect(d.requirement.propertyTypes).toEqual(['apartment'])
    d = answerField(d, 'qualification.decisionMakers', ['parents'])
    expect(d.qualification).toMatchObject({ decisionMakers: ['parents'], authority: 'joint' })
    d = answerField(d, 'requirement.budgetMax', 10_000_000)
    expect(d.requirement.budgetMax).toBe(10_000_000)
    expect(setPath({ a: { b: 1 } }, 'a.c', 2)).toEqual({ a: { b: 1, c: 2 } })
  })

  it('round-trips a stored lead and counts optional details', () => {
    const lead = db.leads.find((l) => l.name === 'Priya Sharma')!
    const d = draftFromLead(lead)
    expect(draftErrors(d)).toEqual([])
    expect(draftToInput(d).requirement.cities).toEqual(lead.requirement.cities)
    expect(moreCount({ ...emptyDraft(), email: 'x@y.z', isNri: true }).contact).toBe(2)
  })
})

describe('edit with AI', () => {
  const lead = makeLead({ requirement: { budgetMin: 9_000_000, budgetMax: 12_000_000, cities: ['Bengaluru'], localities: ['Whitefield'], configurations: ['3BHK'], propertyTypes: ['apartment'] } })
  const changesFor = (text: string) => editChanges(lead, text, extractLeadFields(text, { now }))

  it('"change budget to 1.5 Cr and add Hebbal" raises the budget and adds the locality', () => {
    const c = changesFor('change budget to 1.5 Cr and add Hebbal')
    const by = Object.fromEntries(c.map((x) => [x.path, x.to]))
    expect(by['requirement.budgetMax']).toBe(15_000_000)
    expect(by['requirement.localities']).toEqual(['Whitefield', 'Hebbal'])
    expect(by['requirement.cities']).toBeUndefined() // Bengaluru already there
    expect(by.name).toBeUndefined()
    const { patch, fieldMeta } = patchFromChanges(lead, c)
    expect(patch.requirement?.budgetMax).toBe(15_000_000)
    expect(fieldMeta['requirement.budgetMax'].origin).toBe('ai')
  })

  it('replaces without "add", removes with "remove", and keeps the budget order valid', () => {
    expect(Object.fromEntries(changesFor('looking in Hebbal now').map((x) => [x.path, x.to]))['requirement.localities']).toEqual(['Hebbal'])
    const removed = Object.fromEntries(changesFor('remove Whitefield').map((x) => [x.path, x.to]))
    expect(removed['requirement.localities']).toEqual([])
    const { patch } = patchFromChanges(lead, changesFor('budget 80 lakhs max'))
    expect(patch.requirement?.budgetMax).toBe(8_000_000)
    expect('budgetMin' in (patch.requirement ?? {})).toBe(true)
    expect(patch.requirement?.budgetMin).toBeUndefined()
  })

  it('changes timeline and decision makers from plain words', () => {
    const c = Object.fromEntries(changesFor('they now want to buy immediately, parents will also decide').map((x) => [x.path, x.to]))
    expect(c['qualification.timeline']).toBe('immediate')
    expect(c['qualification.decisionMakers']).toContain('parents')
  })
})
