/**
 * Gaps found by the independent M7 reviewer, exercised in the browser and pinned here: adding a property from the
 * global assistant, buyers for a property whose name looks like a lead's, Hinglish field changes, the "next call"
 * reason age, and tidy notes when the lead's name is cut out of "Called Sanjay Gupta, …".
 */
import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import type { AIContext } from '../types'
import { parseCommandSim } from './commands'
import { fromHinglish } from './hinglish'
import { detectIntent } from './intents'

const now = new Date(2026, 10, 27, 10, 30, 0)
const db = buildSeed(now)
const ctx = (id: string): AIContext => {
  const actor = db.users.find((u) => u.id === id)!
  return { actor, role: actor.role, route: '/today', now, db: () => db }
}

describe('adding a property from the global assistant', () => {
  const listing = 'add property 2.5BHK 1200 sqft east facing in Kondapur, Hyderabad 85 L ready to move owner Ramesh 98450 12345'

  it('is a new listing, not a property search', () => {
    expect(detectIntent(listing)).toBe('createProperty')
    expect(detectIntent('Create a new listing: 3BHK villa in Kokapet 3 Cr')).toBe('createProperty')
    expect(detectIntent('2.5BHK 1200 sqft east facing in Kondapur under 90 L')).toBe('propertySearch')
  })

  it('proposes the property for the admin to confirm', () => {
    const plan = parseCommandSim(listing, ctx('u-admin'))
    expect(plan.intent).toBe('createProperty')
    expect(plan.proposals).toHaveLength(1)
    const input = plan.proposals[0].payload as { input: { price: number; location: { locality: string }; facing: string } }
    expect(input.input.price).toBe(8_500_000)
    expect(input.input.location.locality).toBe('Kondapur')
    expect(input.input.facing).toBe('E')
  })

  it('asks for what is missing instead of guessing', () => {
    const plan = parseCommandSim('add property in Kondapur', ctx('u-admin'))
    expect(plan.proposals).toEqual([])
    expect(plan.reply.nav?.[0]?.to).toBe('/properties/new')
  })
})

describe('buyers for a property', () => {
  it('"Which buyers match Aranya Greens?" lists buyers, not a look-alike lead (Ananya)', () => {
    const plan = parseCommandSim('Which buyers match Aranya Greens?', ctx('u-rohit'))
    expect(plan.results?.kind).toBe('lead')
    expect(plan.reply.links?.[0]?.kind).toBe('property')
  })
})

describe('Hinglish field changes', () => {
  it('"Sanjay ka budget 2 cr kar do" is a lead update', () => {
    const english = fromHinglish('Sanjay ka budget 2 cr kar do')
    expect(english).toMatch(/^change Sanjay's budget to 2 cr/)
    expect(detectIntent(english)).toBe('updateLead')
    const plan = parseCommandSim('Sanjay ka budget 2.5 cr kar do', ctx('u-admin'))
    expect(plan.reply.text, JSON.stringify(plan.reply)).not.toMatch(/understand/)
    expect(plan.proposals.some((p) => p.kind === 'updateLead')).toBe(true)
  })
})

describe('readable replies', () => {
  it('"Who should I call next?" never shows a raw {{placeholder}}', () => {
    for (const id of ['u-arjun', 'u-sneha', 'u-vikram', 'u-rohit']) {
      const plan = parseCommandSim('Who should I call next?', ctx(id))
      expect([plan.reply.text, ...(plan.reply.bullets ?? [])].join(' ')).not.toMatch(/\{\{|\}\}/)
    }
  })

  it('a call note does not keep the gap where the name was', () => {
    const plan = parseCommandSim('Called Sanjay Gupta, he wants a visit on Sunday', ctx('u-admin'))
    const log = plan.proposals.find((p) => p.kind === 'logActivity')!
    expect((log.payload as { text: string }).text).toBe('Called, he wants a visit on Sunday')
  })
})
