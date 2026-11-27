import { describe, expect, it } from 'vitest'
import { makeLead, settingsWith, T_NOW } from '@/test/factories'
import { agingOf, agingTone, daysInStage, isStalled, stallAdvice, stalledDeals, stallRatio } from './stalled'

const DAY = 86_400_000
const ago = (days: number) => new Date(T_NOW.getTime() - days * DAY).toISOString()
const settings = settingsWith() // qualified target 5 days, negotiation 10

describe('stalled', () => {
  it('counts whole days in stage', () => {
    expect(daysInStage({ stageSince: ago(3.6) }, T_NOW)).toBe(3)
    expect(daysInStage({ stageSince: ago(-1) }, T_NOW)).toBe(0)
  })

  it('tones: muted below 1×, warning from 1× to 2×, danger above 2×', () => {
    expect(agingTone(4, 5)).toBe('muted')
    expect(agingTone(5, 5)).toBe('warning')
    expect(agingTone(10, 5)).toBe('warning')
    expect(agingTone(11, 5)).toBe('danger')
    expect(agingTone(100, 0)).toBe('muted')
  })

  it('closed stages never age', () => {
    expect(agingOf(makeLead({ stage: 'lost', stageSince: ago(90) }), settings, T_NOW).tone).toBe('muted')
    expect(isStalled(makeLead({ stage: 'qualified', stageSince: ago(11) }), settings, T_NOW)).toBe(true)
  })

  it('recommends a next step per open stage and none for closed ones', () => {
    expect(stallAdvice('qualified')?.key).toBe('bookVisit')
    expect(stallAdvice('negotiation')).toMatchObject({ key: 'closeGap', taskType: 'meeting' })
    expect(stallAdvice('lost')).toBeUndefined()
    expect(stallAdvice('converted')).toBeUndefined()
  })

  it('lists stalled deals worst first, then by value', () => {
    const leads = [
      makeLead({ id: 'a', stage: 'qualified', stageSince: ago(12) }), // 2.4×
      makeLead({ id: 'b', stage: 'negotiation', stageSince: ago(40) }), // 4×
      makeLead({ id: 'c', stage: 'qualified', stageSince: ago(12), requirement: { budgetMax: 9e7 } }), // 2.4×, bigger
      makeLead({ id: 'd', stage: 'qualified', stageSince: ago(6) }), // warning only
      makeLead({ id: 'e', stage: 'lost', stageSince: ago(90) }),
    ]
    const list = stalledDeals(leads, settings, T_NOW, (l) => l.requirement.budgetMax ?? 0)
    expect(list.map((s) => s.lead.id)).toEqual(['b', 'c', 'a'])
    expect(list[0]).toMatchObject({ days: 40, target: 10, ratio: 4 })
    expect(stallRatio(3, 0)).toBe(0)
  })
})
