/** 16 clients: one per historical conversion (CL-1001…CL-1015) plus Swati Chawla, booked yesterday (CL-1016). */
import type { Client, Lead } from '@/domain/types'
import { BANKS } from '@/domain/catalogue'
import type { Clock } from './dates'

const STATUSES: Client['status'][] = [
  'converted', 'converted', 'converted', 'registered', 'converted', 'registered', 'loanProcessing', 'agreement',
  'registered', 'converted', 'registered', 'loanProcessing', 'agreement', 'loanProcessing', 'agreement',
]

const DOCS = ['PAN card', 'Aadhaar', 'Booking form', 'Sale agreement', 'Loan sanction letter']

export function seedClients(c: Clock, leads: Lead[]): Client[] {
  const converted = leads.filter((l) => l.stage === 'converted' && l.clientId)
  const clients: Client[] = converted.map((l, i) => {
    const status = STATUSES[i]
    const done = status === 'converted' || status === 'registered'
    const loan: Client['loan'] = i % 3 === 2
      ? { status: 'notApplied' }
      : { bank: BANKS[i % BANKS.length], status: done ? 'disbursed' : status === 'loanProcessing' ? 'applied' : 'sanctioned', amount: Math.round((l.deal?.value ?? 0) * 0.75) }
    return {
      id: l.clientId!, leadId: l.id, name: l.name, phone: l.phone, email: l.email, ownerId: l.ownerId!, city: l.requirement.cities[0],
      propertyId: l.deal?.propertyId, dealValue: l.deal?.value, bookingAmount: l.deal?.bookingAmount, bookedAt: l.deal!.bookedAt!,
      status, loan, kyc: 'done',
      documents: DOCS.map((name, d) => ({ name, status: done || d < 3 ? 'verified' : d === 3 ? 'received' : 'pending' })),
      createdAt: l.deal!.bookedAt!, updatedAt: l.stageSince,
    }
  })
  const swati = leads.find((l) => l.id === 'LEAD-1015')
  if (swati?.deal) {
    clients.push({
      id: 'CL-1016', leadId: swati.id, name: swati.name, phone: swati.phone, email: swati.email, ownerId: swati.ownerId!, city: 'Mumbai',
      propertyId: swati.deal.propertyId, dealValue: swati.deal.value, bookingAmount: swati.deal.bookingAmount, bookedAt: c.ago(1, 'days'),
      status: 'booked', loan: { bank: 'HDFC Bank', status: 'applied', amount: 8_000_000 }, kyc: 'pending',
      documents: [{ name: 'PAN card', status: 'received' }, { name: 'Aadhaar', status: 'pending' }, { name: 'Booking form', status: 'received' }, { name: 'Token receipt', status: 'verified' }],
      createdAt: c.ago(1, 'days'), updatedAt: c.ago(1, 'days'), notes: 'Token ₹5 L paid by cheque. Agreement signing planned for next week.',
    })
  }
  return clients
}
