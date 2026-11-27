/**
 * Clients are created automatically when a lead is Booked (E5). These functions edit them afterwards: status,
 * loan, KYC, documents, notes. A client can also be added by hand for a lead that was booked outside the CRM.
 */
import type { Client, ID } from '@/domain/types'
import { assertActorCan } from './core/actor'
import { commit, must } from './core/commit'

export type NewClient = Pick<Client, 'leadId'> & Partial<Omit<Client, 'id' | 'leadId' | 'createdAt' | 'updatedAt'>>

export function createClient(input: NewClient): { id: ID } {
  const { result: id } = commit('client.create', (tx) => {
    const lead = must(tx.db.leads, input.leadId, 'lead')
    assertActorCan(tx.actor, 'client.edit', lead, tx.db)
    if (lead.clientId) return lead.clientId
    const id = tx.id('CL')
    tx.db.clients.push({
      id, leadId: lead.id, name: input.name ?? lead.name, phone: input.phone ?? lead.phone, email: input.email ?? lead.email,
      ownerId: input.ownerId ?? lead.ownerId ?? tx.actor.id, city: input.city ?? lead.requirement.cities[0],
      propertyId: input.propertyId ?? lead.deal?.propertyId, dealValue: input.dealValue ?? lead.deal?.value, bookingAmount: input.bookingAmount ?? lead.deal?.bookingAmount,
      bookedAt: input.bookedAt ?? lead.deal?.bookedAt ?? tx.now, status: input.status ?? 'booked', loan: input.loan, kyc: input.kyc ?? 'pending',
      documents: input.documents ?? [], notes: input.notes, createdAt: tx.now, updatedAt: tx.now,
    })
    tx.emit({ type: 'client.created', id })
    return id
  })
  return { id }
}

export type ClientPatch = Partial<Pick<Client, 'name' | 'phone' | 'email' | 'city' | 'status' | 'loan' | 'kyc' | 'documents' | 'notes' | 'dealValue' | 'bookingAmount' | 'propertyId'>>

export function updateClient(id: ID, patch: ClientPatch) {
  return commit('client.update', (tx) => {
    const c = must(tx.db.clients, id, 'client')
    assertActorCan(tx.actor, 'client.edit', c, tx.db)
    const fields = Object.keys(patch).filter((k) => patch[k as keyof ClientPatch] !== undefined)
    Object.assign(c, patch)
    c.updatedAt = tx.now
    tx.emit({ type: 'client.updated', id, fields })
  })
}

export function setClientDocument(id: ID, name: string, status: Client['documents'][number]['status']) {
  return commit('client.document', (tx) => {
    const c = must(tx.db.clients, id, 'client')
    assertActorCan(tx.actor, 'client.edit', c, tx.db)
    const doc = c.documents.find((d) => d.name === name)
    if (doc) doc.status = status
    else c.documents.push({ name, status })
    c.updatedAt = tx.now
    tx.emit({ type: 'client.updated', id, fields: ['documents'] })
  })
}

/** Removes a client record (the lead stays). Managers and admins; undoable. */
export function deleteClient(id: ID) {
  return commit('client.delete', (tx) => {
    const c = must(tx.db.clients, id, 'client')
    assertActorCan(tx.actor, 'lead.delete', c, tx.db)
    tx.db.clients = tx.db.clients.filter((x) => x.id !== id)
    const lead = tx.db.leads.find((l) => l.clientId === id)
    if (lead) lead.clientId = undefined
  }, { undoable: true })
}
