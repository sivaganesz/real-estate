import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { propertiesForLead } from '@/lib/matching'
import { findLead, findProperty, narrowMatches, readMatchingRequest } from './assistant'

const now = new Date('2026-11-27T10:00:00+05:30')
const db = buildSeed(now)
const priya = db.leads.find((l) => l.name === 'Priya Sharma')!

describe('matching assistant', () => {
  it('finds a lead by full name, first name or possessive', () => {
    expect(findLead('homes for Priya Sharma', db.leads).lead?.id).toBe(priya.id)
    expect(findLead("properties within Priya's budget", db.leads).lead?.id).toBe(priya.id)
    expect(findLead('nothing here', db.leads).lead).toBeUndefined()
  })

  it('offers the other leads with the same first name', () => {
    const leads = [{ id: 'A', name: 'Rahul Verma' }, { id: 'B', name: 'Rahul Mehta' }]
    expect(findLead('match Rahul', leads)).toMatchObject({ lead: { id: 'A' }, also: ['B'] })
    expect(findLead('match Rahul Mehta', leads)).toMatchObject({ lead: { id: 'B' }, also: [] })
  })

  it('finds a property by id or project', () => {
    expect(findProperty('who fits PRP-1002', db.properties).property?.id).toBe('PRP-1002')
    expect(findProperty('buyers for aranya greens', db.properties).property?.id).toBe('PRP-1001')
  })

  it('reads a lead request with extra filters', () => {
    const r = readMatchingRequest("properties within Priya's budget in Whitefield", db.leads, db.properties)
    expect(r.mode).toBe('lead')
    expect(r.leadId).toBe(priya.id)
    expect(r.filters.localities).toEqual(['Whitefield'])
    expect(r.filters.text).toBeUndefined()
    expect(r.criteria).toContain('locality')
  })

  it('reads a property request', () => {
    const r = readMatchingRequest('which leads fit PRP-1001?', db.leads, db.properties)
    expect(r.mode).toBe('property')
    expect(r.propertyId).toBe('PRP-1001')
  })

  it('falls back to a plain search and flags an empty request', () => {
    const r = readMatchingRequest('3 bhk ready to move under 1.2 cr', db.leads, db.properties)
    expect(r.mode).toBe('search')
    expect(r.filters.configurations).toEqual(['3BHK'])
    expect(r.filters.maxPrice).toBe(12_000_000)
    expect(readMatchingRequest('hello there', db.leads, db.properties).empty).toBe(true)
  })

  it('narrows matches by the extra filters only', () => {
    const matches = propertiesForLead(priya, db.properties, db.settings, now)
    expect(narrowMatches(matches, readMatchingRequest('for Priya', db.leads, db.properties).filters)).toHaveLength(matches.length)
    const narrowed = narrowMatches(matches, readMatchingRequest('for Priya in Hebbal', db.leads, db.properties).filters)
    expect(narrowed.every((m) => m.property.location.locality === 'Hebbal')).toBe(true)
  })
})
