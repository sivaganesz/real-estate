import { describe, expect, it } from 'vitest'
import { buildSeed } from '@/data/seed'
import { bookingsByMonth, clientKpis, clientTodos, docsProgress, matchesClient, missingStandardDocs, nextStatus, sortClients } from './client-queries'

const now = new Date(2026, 10, 27, 10, 0)
const db = buildSeed(now)
const swati = db.clients.find((c) => c.name === 'Swati Chawla')!

describe('client journey', () => {
  it('moves forward one step at a time and stops at the end', () => {
    expect(nextStatus('booked')).toBe('agreement')
    expect(nextStatus('registered')).toBe('converted')
    expect(nextStatus('converted')).toBeUndefined()
    expect(nextStatus('cancelled')).toBeUndefined()
  })

  it('tracks documents and what is left to do', () => {
    const p = docsProgress(swati)
    expect(p.total).toBe(4)
    expect(p.verified).toBe(1)
    expect(p.pending).toBe(1)
    expect(clientTodos(swati)).toEqual(['kyc', 'documents', 'loan', 'agreement'])
    expect(missingStandardDocs(swati)).toContain('Sale agreement')
    expect(missingStandardDocs(swati)).not.toContain('PAN card')
  })

  it('filters, sorts and sums', () => {
    expect(db.clients.filter((c) => matchesClient(c, { q: 'swati' }, {}))).toHaveLength(1)
    expect(db.clients.filter((c) => matchesClient(c, { statuses: ['booked'] }, {})).map((c) => c.name)).toEqual(['Swati Chawla'])
    const byValue = sortClients(db.clients, 'value')
    expect(byValue[0].dealValue ?? 0).toBeGreaterThanOrEqual(byValue.at(-1)!.dealValue ?? 0)
    const k = clientKpis(db.clients)
    expect(k.total).toBe(db.clients.length)
    expect(k.byStatus.booked).toBe(1)
    expect(k.value).toBeGreaterThan(0)
    const months = bookingsByMonth(db.clients, now)
    expect(months).toHaveLength(6)
    expect(months.reduce((a, b) => a + b, 0)).toBeGreaterThan(0)
  })
})
