/**
 * Clients after booking (master prompt §7 "Clients"): the post-booking journey Booked → Agreement → Loan processing →
 * Registered → Converted (or Cancelled), the documents checklist and simple list filters. Pure: no React, no store.
 */
import type { Client, ID, Lead, Property } from '@/domain/types'

export type ClientStatus = Client['status']
export const CLIENT_FLOW: ClientStatus[] = ['booked', 'agreement', 'loanProcessing', 'registered', 'converted']
export const CLIENT_STATUSES: ClientStatus[] = [...CLIENT_FLOW, 'cancelled']
export const LOAN_STATUSES: NonNullable<Client['loan']>['status'][] = ['notApplied', 'applied', 'sanctioned', 'disbursed']
export const DOC_STATUSES: Client['documents'][number]['status'][] = ['pending', 'received', 'verified']

/** The usual paperwork after a booking in India. Stored by name (data); the UI translates names it knows. */
export const STANDARD_DOCS = ['PAN card', 'Aadhaar', 'Booking form', 'Token receipt', 'Sale agreement', 'Loan sanction letter', 'Bank statements (6 months)']
/** i18n keys for the standard names (`clients:doc.<key>`); other names are shown as typed. */
export const DOC_KEY: Record<string, string> = {
  'PAN card': 'pan', Aadhaar: 'aadhaar', 'Booking form': 'bookingForm', 'Token receipt': 'tokenReceipt', 'Sale agreement': 'saleAgreement',
  'Loan sanction letter': 'loanSanction', 'Bank statements (6 months)': 'bankStatements',
}

/** Position in the journey (0–4), or -1 when cancelled. */
export const flowStep = (s: ClientStatus) => CLIENT_FLOW.indexOf(s)

/** The next step a user can move the client to (none at the end or when cancelled). */
export function nextStatus(s: ClientStatus): ClientStatus | undefined {
  const i = flowStep(s)
  return i >= 0 && i < CLIENT_FLOW.length - 1 ? CLIENT_FLOW[i + 1] : undefined
}

export function docsProgress(c: Pick<Client, 'documents'>): { verified: number; received: number; pending: number; total: number; pct: number } {
  const total = c.documents.length
  const verified = c.documents.filter((d) => d.status === 'verified').length
  const received = c.documents.filter((d) => d.status === 'received').length
  return { verified, received, pending: total - verified - received, total, pct: total ? Math.round(((verified + received * 0.5) / total) * 100) : 0 }
}

/** Documents in the standard list the client does not have yet. */
export const missingStandardDocs = (c: Pick<Client, 'documents'>) => STANDARD_DOCS.filter((n) => !c.documents.some((d) => d.name.toLowerCase() === n.toLowerCase()))

/** What still needs doing, most urgent first: KYC, pending documents, loan, then the next journey step. */
export type ClientTodo = 'kyc' | 'documents' | 'loan' | 'agreement' | 'registration' | 'handover'
export function clientTodos(c: Client): ClientTodo[] {
  if (c.status === 'cancelled' || c.status === 'converted') return []
  const out: ClientTodo[] = []
  if (c.kyc === 'pending') out.push('kyc')
  if (c.documents.some((d) => d.status === 'pending')) out.push('documents')
  if (c.loan && (c.loan.status === 'applied' || c.loan.status === 'notApplied') && c.loan.bank) out.push('loan')
  if (c.status === 'booked') out.push('agreement')
  else if (c.status === 'agreement' || c.status === 'loanProcessing') out.push('registration')
  else if (c.status === 'registered') out.push('handover')
  return out
}

export type ClientFilters = { q?: string; statuses?: ClientStatus[]; owners?: ID[]; loan?: NonNullable<Client['loan']>['status'][] }

export function matchesClient(c: Client, f: ClientFilters, look: { property?: Property; ownerName?: string }): boolean {
  if (f.q) {
    const hay = [c.id, c.leadId, c.name, c.phone, c.email, c.city, look.property?.title, look.property?.projectName, look.ownerName].join(' ').toLowerCase()
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false
  }
  if (f.statuses?.length && !f.statuses.includes(c.status)) return false
  if (f.owners?.length && !f.owners.includes(c.ownerId)) return false
  if (f.loan?.length && !f.loan.includes(c.loan?.status ?? 'notApplied')) return false
  return true
}

export type ClientSort = 'recent' | 'value' | 'name'
export function sortClients(list: Client[], by: ClientSort): Client[] {
  const out = [...list]
  if (by === 'value') return out.sort((a, b) => (b.dealValue ?? 0) - (a.dealValue ?? 0))
  if (by === 'name') return out.sort((a, b) => a.name.localeCompare(b.name))
  return out.sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
}

/** Headline numbers for the list (active = not converted / cancelled). */
export function clientKpis(clients: Client[]) {
  const active = clients.filter((c) => c.status !== 'converted' && c.status !== 'cancelled')
  return {
    total: clients.length,
    active: active.length,
    value: clients.filter((c) => c.status !== 'cancelled').reduce((n, c) => n + (c.dealValue ?? 0), 0),
    loanInProgress: active.filter((c) => c.loan && (c.loan.status === 'applied' || c.loan.status === 'sanctioned')).length,
    pendingDocs: active.filter((c) => c.documents.some((d) => d.status === 'pending') || c.kyc === 'pending').length,
    byStatus: Object.fromEntries(CLIENT_STATUSES.map((s) => [s, clients.filter((c) => c.status === s).length])) as Record<ClientStatus, number>,
  }
}

/** Monthly booking value for the last `months` months (oldest first) for the list sparkline. */
export function bookingsByMonth(clients: Pick<Client, 'bookedAt' | 'dealValue' | 'status'>[], now: Date, months = 6): number[] {
  const out = Array.from({ length: months }, () => 0)
  for (const c of clients) {
    if (c.status === 'cancelled') continue
    const d = new Date(c.bookedAt)
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth()
    if (diff >= 0 && diff < months) out[months - 1 - diff] += c.dealValue ?? 0
  }
  return out
}

/** A client with no linked lead left (deleted) still shows; the lead link is hidden. */
export const leadOf = (leads: Lead[], c: Pick<Client, 'leadId'>) => leads.find((l) => l.id === c.leadId)
