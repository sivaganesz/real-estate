import { describe, expect, it } from 'vitest'
import { EMPTY_USER_DRAFT, extractUser, mergeExtraction, validateUserDraft } from './user-input'

const managers = [{ id: 'u-rohit', name: 'Rohit Khanna' }, { id: 'u-asha', name: 'Asha Pillai' }]

describe('validateUserDraft', () => {
  const users = [{ id: 'u-a', email: 'taken@example.com' }]
  it('needs a name, a valid email and (for executives) a manager', () => {
    const keys = validateUserDraft(EMPTY_USER_DRAFT, users).map((e) => `${e.field}:${e.key}`)
    expect(keys).toEqual(['name:required', 'email:required', 'managerId:managerRequired'])
  })
  it('rejects a bad email, a taken email and a bad phone; managers need no manager', () => {
    const base = { ...EMPTY_USER_DRAFT, name: 'X', role: 'manager' as const }
    expect(validateUserDraft({ ...base, email: 'nope' }, users)[0].key).toBe('invalidEmail')
    expect(validateUserDraft({ ...base, email: 'Taken@example.com ' }, users)[0].key).toBe('duplicateEmail')
    expect(validateUserDraft({ ...base, email: 'taken@example.com' }, users, 'u-a')).toEqual([])
    expect(validateUserDraft({ ...base, email: 'ok@example.com', phone: '12345' }, users)[0].key).toBe('invalidPhone')
    expect(validateUserDraft({ ...base, email: 'ok@example.com', phone: '+91 98450 12345' }, users)).toEqual([])
  })
})

describe('extractUser (simulated paste-and-fill)', () => {
  it('reads a full onboarding line', () => {
    const x = extractUser('Add Priya Nair as a sales executive under Rohit, priya.nair@example.com, 98450 11122, Chennai and Bangalore, speaks Tamil and English', managers)
    expect(x.fields).toMatchObject({ name: 'Priya Nair', role: 'executive', managerId: 'u-rohit', email: 'priya.nair@example.com', phone: '+919845011122' })
    expect(x.fields.cities).toEqual(['Chennai', 'Bengaluru'])
    expect(x.fields.languages).toEqual(['English', 'Tamil'])
    expect(x.missing).toEqual([])
  })

  it('reads labelled fields and a team lead', () => {
    const x = extractUser('Name: Karan Bose\nRole: Team lead\nMobile: +91 99001 23456\nEmail: karan@example.com\nCities: Pune, Hinjewadi', managers)
    expect(x.fields).toMatchObject({ name: 'Karan Bose', role: 'manager', phone: '+919900123456' })
    expect(x.fields.cities).toEqual(['Pune'])
    expect(x.fields.managerId).toBeUndefined()
    expect(x.missing).toEqual([])
  })

  it('treats "reports to" as an executive and maps a locality to its city', () => {
    const x = extractUser("I'm Deepak Rao, reports to Asha. deepak@example.com. Covers Whitefield and Gurugram. Kannada, Hindi", managers)
    expect(x.fields).toMatchObject({ name: 'Deepak Rao', role: 'executive', managerId: 'u-asha' })
    expect(x.fields.cities).toEqual(['Bengaluru', 'NCR'])
    expect(x.fields.languages).toEqual(['Hindi', 'Kannada'])
  })

  it('asks for what it could not read and never invents a manager', () => {
    const x = extractUser('new joinee, executive, 9988776655', managers)
    expect(x.fields.phone).toBe('+919988776655')
    expect(x.missing).toEqual(['name', 'email', 'managerId'])
    expect(extractUser('Add Neha Gupta, reports to Sanjay', managers).fields.managerId).toBeUndefined()
  })

  it('reads an admin and merges over a draft without dropping typed values', () => {
    const x = extractUser('Onboard Farah Ali as CRM admin, farah.ali@example.com', managers)
    expect(x.fields).toMatchObject({ name: 'Farah Ali', role: 'admin' })
    const merged = mergeExtraction({ ...EMPTY_USER_DRAFT, phone: '9845012345' }, x)
    expect(merged).toMatchObject({ name: 'Farah Ali', role: 'admin', phone: '9845012345', languages: ['English'] })
  })
})
