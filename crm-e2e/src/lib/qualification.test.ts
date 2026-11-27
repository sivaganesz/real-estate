import { describe, expect, it } from 'vitest'
import { makeLead } from '@/test/factories'
import { answerPatch, extraQuestions, qualificationCard } from './qualification'

describe('qualification card answers', () => {
  it('asks the Indian-context questions only while they are unknown', () => {
    const fresh = makeLead({ requirement: { propertyTypes: ['apartment'] } })
    expect(extraQuestions(fresh).map((q) => q.field)).toEqual(['qualification.loan', 'qualification.buyerPurpose', 'requirement.possession'])
    const known = makeLead({ requirement: { propertyTypes: ['plot'], possession: 'any' }, qualification: { decisionMakers: [], loan: 'needed', buyerPurpose: 'investment' } })
    expect(extraQuestions(known)).toEqual([])
    expect(extraQuestions(fresh).every((q) => !q.essential)).toBe(true)
  })

  it('turns a chip into a patch that completes the check', () => {
    const lead = makeLead({ requirement: { budgetMin: 9_000_000 } })
    const budget = answerPatch(lead, 'requirement.budgetMax', 7_500_000)
    expect(budget?.requirement).toMatchObject({ budgetMax: 7_500_000, budgetMin: undefined })
    const dm = answerPatch(lead, 'qualification.decisionMakers', ['spouse'])
    expect(dm?.qualification).toEqual({ decisionMakers: ['spouse'], authority: 'joint' })
    expect(answerPatch(lead, 'qualification.decisionMakers', 'self')?.qualification?.authority).toBe('sole')
    const timed = { ...lead, qualification: { ...lead.qualification, ...answerPatch(lead, 'qualification.timeline', 'm1to3')?.qualification } }
    expect(qualificationCard(timed).known).toContain('timeline')
    expect(answerPatch(lead, 'unknown.field', 1)).toBeNull()
    expect(answerPatch(lead, 'requirement.budgetMax', 0)).toBeNull()
  })
})
