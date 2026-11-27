/** Three open drafts: a brochure PDF property, an owner's WhatsApp message, and a visiting-card lead (OCR). */
import type { Draft } from '@/domain/types'
import type { Clock } from './dates'
import { ADMIN_ID, ARJUN, SNEHA } from './users'

export function seedDrafts(c: Clock): Draft[] {
  return [
    {
      id: 'DRF-1001', kind: 'property', title: 'Neelam Heights 3 BHK (from brochure)', createdBy: ADMIN_ID, createdAt: c.ago(2, 'days'), updatedAt: c.ago(2, 'days'),
      status: 'open', importJobId: 'IMP-1002',
      source: { type: 'pdf', fileName: 'neelam-heights-brochure.pdf' },
      payload: {
        title: 'Neelam Heights 3 BHK', type: 'apartment', configuration: '3BHK', projectName: 'Neelam Heights',
        location: { city: 'Bengaluru', locality: 'Hebbal' }, area: { superBuiltUp: 1720 }, price: 12_500_000,
        rera: { number: 'PRM/KA/RERA/1251/309/PR/2203', verified: false }, amenities: ['clubhouse', 'gym', 'swimmingPool'],
      },
      fieldMeta: {
        title: { origin: 'import', confidence: 0.9 }, configuration: { origin: 'import', confidence: 0.93 },
        'location.locality': { origin: 'import', confidence: 0.88 }, 'area.superBuiltUp': { origin: 'import', confidence: 0.81 },
        price: { origin: 'import', confidence: 0.42 }, 'rera.number': { origin: 'import', confidence: 0.38 },
      },
    },
    {
      id: 'DRF-1002', kind: 'property', title: '2 BHK resale, Velachery (owner WhatsApp)', createdBy: SNEHA, createdAt: c.ago(5, 'hours'), updatedAt: c.ago(5, 'hours'),
      status: 'open',
      source: { type: 'paste', text: 'Hi madam, I want to sell my 2BHK flat in Velachery, 1050 sqft, 3rd floor, east facing, 1 car park. Expecting 78 lakhs. Ready to move. Call me 9841023456. - Ganesh' },
      payload: {
        title: '2 BHK flat, Velachery', type: 'apartment', configuration: '2BHK', transaction: 'resale',
        location: { city: 'Chennai', locality: 'Velachery' }, area: { builtUp: 1050 }, floor: 3, facing: 'E',
        parking: { covered: 1, open: 0 }, price: 7_800_000, possession: { status: 'ready' },
        owner: { name: 'Ganesh', phone: '+919841023456', kind: 'owner' },
      },
      fieldMeta: {
        configuration: { origin: 'ai', confidence: 0.96 }, 'location.locality': { origin: 'ai', confidence: 0.94 },
        'area.builtUp': { origin: 'ai', confidence: 0.7 }, floor: { origin: 'ai', confidence: 0.9 }, facing: { origin: 'ai', confidence: 0.92 },
        price: { origin: 'ai', confidence: 0.88 }, 'owner.phone': { origin: 'ai', confidence: 0.99 },
      },
    },
    {
      id: 'DRF-1003', kind: 'lead', title: 'Ramesh Iyengar (visiting card)', createdBy: ARJUN, createdAt: c.ago(1, 'days'), updatedAt: c.ago(1, 'days'),
      status: 'open',
      source: { type: 'image', fileName: 'visiting-card.jpg', text: 'RAMESH IYENGAR\nSenior Manager, Finance\n+91 99001 23458\nramesh.iyengar@example.com\nBengaluru' },
      payload: { name: 'Ramesh Iyengar', phone: '+919900123458', email: 'ramesh.iyengar@example.com', source: 'walkIn', requirement: { cities: ['Bengaluru'] } },
      fieldMeta: {
        name: { origin: 'ai', confidence: 0.95 }, phone: { origin: 'ai', confidence: 0.83 }, email: { origin: 'ai', confidence: 0.9 },
        'requirement.cities': { origin: 'ai', confidence: 0.6 },
      },
    },
  ]
}
