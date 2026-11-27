/**
 * Test-only builders for leads, properties and users with sensible defaults (never imported by app code).
 */
import type { Lead, Property, Requirement, Settings, User } from '@/domain/types'
import { DEFAULT_SETTINGS, categoryOf } from '@/domain/catalogue'

export const T_NOW = new Date(2026, 10, 27, 10, 0)
const iso = T_NOW.toISOString()

export function makeLead(p: Omit<Partial<Lead>, 'requirement'> & { requirement?: Partial<Requirement> } = {}): Lead {
  const { requirement, ...rest } = p
  return {
    id: 'L1', name: 'Test Lead', phone: '+919800000001', source: 'website', isNri: false, ownerId: 'u-arjun',
    createdBy: 'u-arjun', createdAt: iso, updatedAt: iso, createdVia: 'manual', stage: 'qualified', stageSince: iso,
    stageHistory: [{ stage: 'qualified', at: iso, by: 'u-arjun' }],
    requirement: {
      propertyTypes: [], configurations: [], cities: [], localities: [], budgetFlexPct: 10, possession: 'any', facing: [],
      amenities: [], mustHaves: [], purpose: 'sale', ...requirement,
    },
    qualification: { decisionMakers: [], loan: 'unknown' },
    engagement: { responded: false, docsRequested: false, siteVisited: false },
    shortlist: [], tags: [],
    ...rest,
  }
}

export function makeProperty(p: Partial<Property> = {}): Property {
  const type = p.type ?? 'apartment'
  return {
    id: 'p1', title: 'Test Flat', type, category: categoryOf(type), purpose: 'sale', transaction: 'newBooking', configuration: '2BHK',
    location: { city: 'Chennai', locality: 'Porur' }, price: 6_800_000, area: { carpet: 1080 }, parking: { covered: 1, open: 0 },
    amenities: ['lift', 'coveredParking'], possession: { status: 'ready' }, approvals: [], bankApprovals: [], specs: {},
    status: 'available', listing: 'live', media: [], createdBy: 'u-admin', createdAt: iso, updatedAt: iso, facing: 'E',
    ...p,
  }
}

export function makeUser(p: Partial<User> & Pick<User, 'id'>): User {
  return {
    name: p.id, role: 'executive', email: `${p.id}@example.com`, phone: '+919800000099', managerId: 'u-rohit', status: 'active',
    availability: 'available', languages: ['English'], cities: [], propertyFocus: ['residential'], joinedAt: '2025-01-01', ...p,
  }
}

/** Default settings with an optional matching override (minScore 0 so every non-excluded match is listed). */
export function settingsWith(matching: Partial<Settings['matching']> = {}): Settings {
  return { ...structuredClone(DEFAULT_SETTINGS), matching: { ...DEFAULT_SETTINGS.matching, ...matching } }
}
