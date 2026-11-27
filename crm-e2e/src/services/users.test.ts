import { beforeEach, describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { buildSeed } from '@/data/seed'
import type { ID, User } from '@/domain/types'
import { OPEN_STAGES } from '@/domain/catalogue'
import i18n from '@/i18n'
import { useDbStore } from '@/store/db-store'
import { assignLead } from './assignments'
import { clock, runAs } from './core/actor'
import { getDb } from './core/commit'
import { undo } from './core/undo'
import { requestReassign } from './leads'
import { notificationText } from './notifications'
import { pendingReassignRequests } from './queries/today'
import { enabledLostReasons } from './settings'
import { changeRoleWithHandOver, deactivateUser, openLeadCount, updateUser } from './users'

const NOW = new Date(2026, 10, 27, 10, 0)
const user = (id: ID): User => getDb().users.find((u) => u.id === id)!
const as = <T>(id: ID, fn: () => T): T => runAs(user(id), fn)
const openOf = (id: ID) => getDb().leads.filter((l) => l.ownerId === id && OPEN_STAGES.includes(l.stage))

beforeEach(() => {
  clock.now = () => NOW
  useDbStore.setState({ db: buildSeed(NOW) })
})

describe('hand-over notices (ADM-3)', () => {
  it('deactivating to one person sends the receiver one batched notice, and Undo removes it', () => {
    const count = openOf('u-arjun').length
    expect(count).toBeGreaterThan(1)
    const before = getDb().notifications.filter((n) => n.userId === 'u-sneha').length
    const r = as('u-admin', () => deactivateUser('u-arjun', { toUserId: 'u-sneha' }))
    const added = getDb().notifications.filter((n) => n.userId === 'u-sneha').slice(before)
    expect(added).toHaveLength(1)
    expect(added[0].params).toMatchObject({ variant: 'reassignedBatch', count, from: 'Arjun Mehta' })
    expect(undo(r.undoToken)).toBe(true)
    expect(getDb().notifications.filter((n) => n.userId === 'u-sneha')).toHaveLength(before)
    expect(openOf('u-arjun')).toHaveLength(count)
  })
})

describe('role change of an executive with open leads (ADM-5)', () => {
  it('a plain role change is refused while they own open leads', () => {
    expect(openLeadCount(getDb(), 'u-sneha')).toBeGreaterThan(0)
    expect(() => as('u-admin', () => updateUser('u-sneha', { role: 'manager' }))).toThrow(/hand them over/)
    expect(user('u-sneha').role).toBe('executive')
  })

  it('changing the role hands the leads over, drops them from rules and switches off rules left empty', () => {
    const hadRule = getDb().settings.assignment.rules.filter((r) => r.userIds.includes('u-sneha'))
    expect(hadRule.length).toBeGreaterThan(0)
    as('u-admin', () => changeRoleWithHandOver('u-sneha', { role: 'manager' }, 'auto'))
    const db = getDb()
    expect(user('u-sneha').role).toBe('manager')
    expect(user('u-sneha').managerId).toBeUndefined()
    expect(openOf('u-sneha')).toHaveLength(0)
    for (const r of db.settings.assignment.rules) {
      expect(r.userIds).not.toContain('u-sneha')
      if (!r.userIds.length) expect(r.enabled).toBe(false)
    }
  })

  it('unassign leaves the leads in the queue', () => {
    const ids = openOf('u-sneha').map((l) => l.id)
    as('u-admin', () => changeRoleWithHandOver('u-sneha', { role: 'manager' }, 'unassign'))
    expect(getDb().leads.filter((l) => ids.includes(l.id)).every((l) => l.ownerId === null)).toBe(true)
  })
})

describe('single assignment is undoable (MGR-3)', () => {
  it('returns an undo token for one lead', () => {
    const lead = getDb().leads.find((l) => l.ownerId === null && OPEN_STAGES.includes(l.stage))!
    const r = as('u-rohit', () => assignLead(lead.id, 'u-arjun'))
    expect(r.undoToken).toBeTruthy()
    expect(undo(r.undoToken)).toBe(true)
    expect(getDb().leads.find((l) => l.id === lead.id)!.ownerId).toBeNull()
  })
})

describe('reassignment requests (MGR-6)', () => {
  it('the manager sees the reason, and the request stays pending until the lead moves', () => {
    const lead = openOf('u-vikram')[0]
    as('u-vikram', () => requestReassign(lead.id, 'Client prefers a Kannada speaker'))
    const n = getDb().notifications.filter((x) => x.userId === 'u-rohit' && x.params.variant === 'reassignRequest').at(-1)!
    const t = i18n.t.bind(i18n) as TFunction
    expect(notificationText(t, n)).toContain('Client prefers a Kannada speaker')
    expect(pendingReassignRequests(getDb(), user('u-rohit')).map((r) => [r.lead.id, r.note])).toContainEqual([lead.id, 'Client prefers a Kannada speaker'])
    clock.now = () => new Date(NOW.getTime() + 60_000)
    as('u-rohit', () => assignLead(lead.id, 'u-arjun'))
    expect(pendingReassignRequests(getDb(), user('u-rohit')).map((r) => r.lead.id)).not.toContain(lead.id)
  })
})

describe('notification text (MGR-11 / EXE-4)', () => {
  it('reads escalation minutes as hours', () => {
    const t = i18n.t.bind(i18n) as TFunction
    expect(notificationText(t, { kind: 'escalation', params: { name: 'Vivek Malhotra', owner: 'Vikram Singh', mins: 1200 } })).toBe('Vikram Singh has not called Vivek Malhotra for 20 h 0 min')
  })
})

describe('lost reasons from Settings (ADM-7)', () => {
  it('offers only the enabled reasons in the saved order', () => {
    expect(enabledLostReasons({ pipeline: { stages: [], lostReasons: ['other', 'budgetMismatch'] } })).toEqual(['other', 'budgetMismatch'])
    expect(enabledLostReasons({ pipeline: { stages: [], lostReasons: [] } })).toHaveLength(6)
    expect(enabledLostReasons({ pipeline: { stages: [], lostReasons: ['other'] } }, 'loanRejected')).toEqual(['other', 'loanRejected'])
  })
})
