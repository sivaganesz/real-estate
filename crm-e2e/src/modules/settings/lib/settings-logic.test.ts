import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_STAGE_DEFS, LOST_REASONS } from '@/domain/catalogue'
import {
  draftTemplate, fillTemplate, lostReasonRows, moveItem, normaliseWeights, placeholdersIn, readRule, smsParts, unknownPlaceholders,
  validateScoring, validateSla, validateStages, weightsSum, weightsValid,
} from './settings-logic'

const users = [
  { id: 'u-arjun', name: 'Arjun Mehta' }, { id: 'u-sneha', name: 'Sneha Reddy' }, { id: 'u-vikram', name: 'Vikram Singh' },
]

describe('match weights', () => {
  const w = DEFAULT_SETTINGS.matching.weights
  it('sums to 1.00 by default', () => {
    expect(weightsSum(w)).toBe(1)
    expect(weightsValid(w)).toBe(true)
    expect(weightsValid({ ...w, budget: 0.4 })).toBe(false)
  })
  it('normalises the others around the one being edited', () => {
    const n = normaliseWeights({ ...w, budget: 0.5 }, 'budget')
    expect(n.budget).toBe(0.5)
    expect(weightsSum(n)).toBe(1)
    expect(n.location).toBeGreaterThan(n.preferences)
  })
  it('shares the rest equally when everything else is zero, and clamps', () => {
    const n = normaliseWeights({ budget: 0.2, location: 0, size: 0, amenities: 0, preferences: 0 }, 'budget')
    expect(n).toEqual({ budget: 0.2, location: 0.2, size: 0.2, amenities: 0.2, preferences: 0.2 })
    expect(weightsSum(normaliseWeights({ ...w, size: 3 }, 'size'))).toBe(1)
    expect(weightsSum(normaliseWeights({ budget: 0.33, location: 0.33, size: 0.33, amenities: 0.33, preferences: 0.33 }))).toBe(1)
  })
})

describe('field checks', () => {
  it('SLA: whole numbers in range and escalation after the first response', () => {
    expect(validateSla(DEFAULT_SETTINGS.sla)).toEqual([])
    expect(validateSla({ ...DEFAULT_SETTINGS.sla, firstResponseMins: 0 })[0]).toMatchObject({ field: 'firstResponseMins', key: 'range' })
    expect(validateSla({ ...DEFAULT_SETTINGS.sla, firstResponseMins: 30, escalateAfterMins: 30 })[0].key).toBe('escalateAfter')
    expect(validateSla({ ...DEFAULT_SETTINGS.sla, staleDays: 2.5 })[0].field).toBe('staleDays')
  })
  it('scoring: warm below hot', () => {
    expect(validateScoring({ hotAt: 70, warmAt: 45 })).toEqual([])
    expect(validateScoring({ hotAt: 50, warmAt: 60 })[0].key).toBe('warmBelowHot')
    expect(validateScoring({ hotAt: 120, warmAt: 60 })[0].key).toBe('range')
  })
  it('stages: target days, probability and label length', () => {
    expect(validateStages(DEFAULT_STAGE_DEFS)).toEqual([])
    const bad = DEFAULT_STAGE_DEFS.map((s) => (s.key === 'qualified' ? { ...s, targetDays: -1, probability: 1.5, label: 'x'.repeat(41) } : s))
    expect(validateStages(bad).map((e) => e.field)).toEqual(['qualified.targetDays', 'qualified.probability', 'qualified.label'])
  })
})

describe('readRule (simulated rule writer)', () => {
  it('reads a location rule with two people', () => {
    const r = readRule('Send Chennai and Hyderabad leads to Sneha and Vikram', users)
    expect(r.rule).toEqual({ kind: 'location', values: ['Chennai', 'Hyderabad'], userIds: ['u-sneha', 'u-vikram'] })
    expect(r.missing).toEqual([])
  })
  it('reads localities, languages, sources and property types', () => {
    expect(readRule('Whitefield enquiries go to Arjun', users).rule).toMatchObject({ kind: 'location', values: ['Whitefield'], userIds: ['u-arjun'] })
    expect(readRule('Hindi speaking buyers to Vikram', users).rule).toMatchObject({ kind: 'language', values: ['Hindi'] })
    expect(readRule('99acres and Magicbricks leads → Arjun', users).rule).toMatchObject({ kind: 'source', values: ['acres99', 'magicbricks'] })
    expect(readRule('channel partner leads for Vikram Singh', users).rule).toMatchObject({ kind: 'source', values: ['channelPartner'], userIds: ['u-vikram'] })
    expect(readRule('villas and plots to arjun', users).rule).toMatchObject({ kind: 'propertyType', values: ['villa', 'plot'], userIds: ['u-arjun'] })
  })
  it('reports a second condition it cannot fit into one rule', () => {
    const r = readRule('Leads from Chennai who speak Tamil go to Sneha', users)
    expect(r.rule).toMatchObject({ kind: 'language', values: ['Tamil'], userIds: ['u-sneha'] })
    expect(r.alsoFound).toEqual(['location'])
    expect(readRule('Send Chennai and Hyderabad leads to Sneha', users).alsoFound).toEqual([])
  })
  it('says what is missing instead of guessing', () => {
    expect(readRule('Pune leads', users).missing).toEqual(['userIds'])
    expect(readRule('give everything to Sneha', users).missing).toEqual(['kind', 'values'])
  })
})

describe('templates', () => {
  it('lists placeholders and spots unknown ones', () => {
    expect(placeholdersIn('Hi {{firstName}}, {{ property }} at {{time}} {{firstName}}')).toEqual(['firstName', 'property', 'time'])
    expect(unknownPlaceholders('Hi {{firstName}} {{budget}}')).toEqual(['budget'])
  })
  it('fills a preview and counts SMS parts', () => {
    expect(fillTemplate('Hi {{firstName}}, see {{property}} {{x}}', { firstName: 'Priya', property: 'Prestige Lakeside' })).toBe('Hi Priya, see Prestige Lakeside {{x}}')
    expect(smsParts('a'.repeat(161))).toBe(2)
    expect(smsParts('')).toBe(1)
  })
  it('drafts per purpose, channel and tone', () => {
    expect(draftTemplate('visitConfirm', 'whatsapp', 'english')).toContain('{{property}}')
    expect(draftTemplate('intro', 'whatsapp', 'hinglish')).toMatch(/^Namaste/)
    expect(draftTemplate('followUp', 'email', 'english')).toMatch(/Warm regards,\n\{\{agent\}\}/)
    const sms = draftTemplate('visitConfirm', 'sms', 'english')
    expect(sms.length).toBeLessThanOrEqual(160)
    expect(sms).toContain('{{map}}')
  })
})

describe('lists', () => {
  it('lost reasons: saved order first, then the switched-off ones', () => {
    const rows = lostReasonRows(LOST_REASONS, ['other', 'budgetMismatch'])
    expect(rows.slice(0, 2)).toEqual([{ reason: 'other', on: true }, { reason: 'budgetMismatch', on: true }])
    expect(rows).toHaveLength(LOST_REASONS.length)
    expect(rows.filter((r) => !r.on)).toHaveLength(LOST_REASONS.length - 2)
  })
  it('moves an item and ignores moves off the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  })
})
