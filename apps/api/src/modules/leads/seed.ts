import mongoose from 'mongoose';
import type { Requirement, Stage } from '@estate/shared';
import { registerSeeder } from '../../db/seed';
import { Activity, Lead } from '../../models/lead';
import { Audit } from '../../models/audit';
import { nextCode } from '../../models/property';

const L = 100_000;
const CR = 10_000_000;
const day = (n: number) => new Date(Date.now() - n * 86_400_000);

type Who = 'priya' | 'arun' | 'divya' | null;
type SeedLead = {
  name: string;
  phone: string;
  source: string;
  owner: Who;
  stage: Stage;
  temp: 'hot' | 'warm' | 'cold';
  req: Partial<Requirement>;
  created: number;
  inStage: number;
  contact?: number;
  lost?: string;
  log?: [number, 'call' | 'whatsapp' | 'note' | 'meeting' | 'site_visit', string | undefined, string?][];
};

/** Fictional customers, spread across stages, owners and sources the way a real month looks. */
export const SEED_LEADS: SeedLead[] = [
  { name: 'Ramesh Krishnan', phone: '9840011001', source: 'portal', owner: 'priya', stage: 'negotiation', temp: 'hot', req: { intent: 'own_use', areaMin: 1000, types: ['apartment'], bedrooms: 2, budgetMin: 65 * L, budgetMax: 75 * L, city: 'Chennai', localities: ['Porur'], timeline: '3_months', financing: 'loan_approved', mustHaves: ['Lift', 'Car parking'] }, created: 24, inStage: 2, contact: 1, log: [[22, 'call', 'Interested', 'Works at DLF IT park, wants Porur or nearby. Loan pre-approved with SBI.'], [15, 'site_visit', 'Visited Green Meadows', 'Liked A-block east facing, worried about possession date.'], [3, 'meeting', 'Price discussion', 'Asked for ₹1.5 L off on A402.']] },
  { name: 'Lakshmi Narayanan', phone: '9840011002', source: 'referral', owner: 'priya', stage: 'visit', temp: 'hot', req: { intent: 'own_use', areaMin: 2400, types: ['villa'], bedrooms: 3, budgetMin: 1.2 * CR, budgetMax: 1.45 * CR, city: 'Chennai', localities: ['Medavakkam'], timeline: '6_months', financing: 'own_funds', mustHaves: ['Gated community'] }, created: 12, inStage: 3, contact: 3, log: [[11, 'call', 'Interested', 'Referred by Ramesh. Wants a gated villa, two kids, school nearby matters.'], [3, 'call', 'Interested', 'Fixed visit to Palm Grove for Saturday.']] },
  { name: 'Mohammed Irfan', phone: '9840011003', source: 'website', owner: 'priya', stage: 'qualified', temp: 'warm', req: { intent: 'own_use', areaMin: 1400, types: ['apartment'], bedrooms: 3, budgetMax: 95 * L, city: 'Chennai', localities: ['Porur', 'Valasaravakkam'], timeline: '3_months', financing: 'loan' }, created: 9, inStage: 7, contact: 7, log: [[8, 'call', 'Interested', 'Moving from Bengaluru in Feb. 3 BHK, budget up to 95 L.'], [7, 'whatsapp', undefined, 'Sent Green Meadows B-block brochure.']] },
  { name: 'Sangeetha Raman', phone: '9840011004', source: 'walk_in', owner: 'priya', stage: 'contacted', temp: 'warm', req: { intent: 'investment', areaMin: 1200, types: ['plot'], budgetMax: 40 * L, city: 'Chennai', localities: ['Guduvanchery'] }, created: 5, inStage: 4, contact: 4, log: [[4, 'meeting', 'Walk-in at office', 'Looking for a plot to build later; budget 35-40 L. Not decided on location.']] },
  { name: 'Vignesh Babu', phone: '9840011005', source: 'campaign', owner: 'priya', stage: 'new', temp: 'warm', req: { types: ['apartment'], bedrooms: 2 }, created: 1, inStage: 1 },
  { name: 'Deepa Srinivasan', phone: '9840011006', source: 'portal', owner: 'priya', stage: 'lost', temp: 'cold', req: { intent: 'own_use', types: ['apartment'], bedrooms: 2, budgetMax: 55 * L, city: 'Chennai', localities: ['Velachery'] }, created: 40, inStage: 10, contact: 11, lost: 'Budget mismatch', log: [[38, 'call', 'Interested'], [20, 'site_visit', 'Visited', 'Liked Velachery flat but 72 L is too high.'], [11, 'call', 'Not interested', 'Bought a resale flat for 52 L through a friend.']] },

  { name: 'Suresh Kumar', phone: '9840011007', source: 'portal', owner: 'arun', stage: 'visit', temp: 'warm', req: { intent: 'investment', areaMin: 1200, types: ['plot'], budgetMin: 30 * L, budgetMax: 40 * L, city: 'Chennai', localities: ['Guduvanchery', 'Tambaram'], timeline: 'immediate', financing: 'own_funds', mustHaves: ['East facing'] }, created: 16, inStage: 9, contact: 9, log: [[15, 'call', 'Interested', 'Wants east-facing plot, cash buyer.'], [9, 'site_visit', 'Visited Sunrise Enclave', 'Liked plots near the park. Asked about road width.']] },
  { name: 'Anitha Joseph', phone: '9840011008', source: 'whatsapp', owner: 'arun', stage: 'qualified', temp: 'hot', req: { intent: 'own_use', areaMin: 1100, types: ['apartment'], bedrooms: 2, budgetMin: 60 * L, budgetMax: 80 * L, city: 'Chennai', localities: ['Sholinganallur'], timeline: 'immediate', financing: 'loan_approved', mustHaves: ['Swimming pool', 'Gym'] }, created: 6, inStage: 2, contact: 2, log: [[5, 'whatsapp', undefined, 'Asked for OMR options with pool.'], [2, 'call', 'Interested', 'Works at Sholinganallur, loan approved with HDFC, ready to book this month.']] },
  { name: 'Karthik Subramanian', phone: '9840011009', source: 'phone', owner: 'arun', stage: 'contacted', temp: 'warm', req: { intent: 'investment', areaMin: 3000, types: ['commercial'], budgetMax: 2 * CR, city: 'Chennai' }, created: 8, inStage: 7, contact: 7, log: [[7, 'call', 'Call back later', 'Wants office space, will share exact size needs.']] },
  { name: 'Priyanka Venkatesh', phone: '9840011010', source: 'website', owner: 'arun', stage: 'new', temp: 'warm', req: {}, created: 3, inStage: 3 },
  { name: 'Balaji Rajendran', phone: '9840011011', source: 'channel_partner', owner: 'arun', stage: 'negotiation', temp: 'hot', req: { intent: 'investment', areaMin: 1500, types: ['plot'], budgetMax: 40 * L, city: 'Chennai', localities: ['Guduvanchery'], financing: 'own_funds' }, created: 30, inStage: 6, contact: 6, log: [[28, 'call', 'Interested'], [18, 'site_visit', 'Visited Sunrise Enclave', 'Shortlisted plot 26 and 27.'], [6, 'meeting', 'Offer', 'Offered 34 L for plot 26.']] },
  { name: 'Meena Arumugam', phone: '9840011012', source: 'portal', owner: 'arun', stage: 'lost', temp: 'cold', req: { types: ['villa'], budgetMax: 90 * L }, created: 45, inStage: 20, contact: 21, lost: 'Not reachable', log: [[44, 'call', 'Not reachable'], [30, 'call', 'Not reachable'], [21, 'call', 'Not reachable']] },

  { name: 'Gopinath Iyer', phone: '9840011013', source: 'referral', owner: 'divya', stage: 'qualified', temp: 'warm', req: { intent: 'own_use', areaMin: 1800, types: ['apartment'], bedrooms: 3, budgetMin: 1.4 * CR, budgetMax: 1.8 * CR, city: 'Chennai', localities: ['Anna Nagar'], timeline: '6_months', financing: 'own_funds' }, created: 14, inStage: 11, contact: 11, log: [[13, 'call', 'Interested', 'Retired banker, wants Anna Nagar only, near Tower Park.'], [11, 'whatsapp', undefined, 'Sent the Anna Nagar West 3 BHK details.']] },
  { name: 'Fathima Begum', phone: '9840011014', source: 'walk_in', owner: 'divya', stage: 'visit', temp: 'hot', req: { intent: 'own_use', areaMin: 950, types: ['apartment'], bedrooms: 2, budgetMax: 70 * L, city: 'Chennai', localities: ['Porur', 'Chromepet'], timeline: '3_months', financing: 'loan' }, created: 10, inStage: 4, contact: 1, log: [[9, 'meeting', 'Walk-in', 'Husband works in Guindy. 2 BHK under 70 L.'], [4, 'site_visit', 'Visited Green Meadows', 'Liked the clubhouse. Wants a higher floor.'], [1, 'call', 'Interested', 'Asking about loan tie-ups.']] },
  { name: 'Arjun Mehta', phone: '9840011015', source: 'portal', owner: 'divya', stage: 'contacted', temp: 'cold', req: { purpose: 'rent', types: ['apartment'], bedrooms: 2, budgetMax: 40_000, city: 'Chennai', localities: ['Nungambakkam'] }, created: 7, inStage: 6, contact: 6, log: [[6, 'call', 'Interested', 'Relocating from Mumbai, needs a rental near Nungambakkam.']] },
  { name: 'Revathi Shankar', phone: '9840011016', source: 'campaign', owner: 'divya', stage: 'new', temp: 'warm', req: { types: ['villa'] }, created: 2, inStage: 2 },
  { name: 'Senthil Murugan', phone: '9840011017', source: 'phone', owner: 'divya', stage: 'qualified', temp: 'warm', req: { intent: 'investment', types: ['agricultural'], budgetMax: 1 * CR, city: 'Chennai', localities: ['Thiruporur'], mustHaves: ['Borewell'] }, created: 20, inStage: 12, contact: 12, log: [[19, 'call', 'Interested', 'Wants farm land with water, weekend home later.'], [12, 'call', 'Call back later', 'Busy with harvest season, call in two weeks.']] },
  { name: 'Kavya Prakash', phone: '9840011018', source: 'website', owner: 'divya', stage: 'booked', temp: 'hot', req: { intent: 'own_use', types: ['apartment'], bedrooms: 3, budgetMax: 1 * CR, city: 'Chennai', localities: ['Porur'], financing: 'loan_approved' }, created: 35, inStage: 5, contact: 5, log: [[33, 'call', 'Interested'], [25, 'site_visit', 'Visited Green Meadows'], [12, 'meeting', 'Negotiation', 'Agreed ₹94 L for B302.'], [5, 'meeting', 'Booking', 'Booking amount paid by cheque.']] },

  { name: 'Hariharan V', phone: '9840011019', source: 'portal', owner: null, stage: 'new', temp: 'warm', req: { areaMin: 900, types: ['apartment'], bedrooms: 2, budgetMax: 60 * L, city: 'Chennai', localities: ['Chromepet'] }, created: 0, inStage: 0 },
  { name: 'Nisha Thomas', phone: '9840011020', source: 'website', owner: null, stage: 'new', temp: 'warm', req: { types: ['plot'], city: 'Chennai' }, created: 1, inStage: 1 },
  { name: 'Prakash Raj', phone: '9840011021', source: 'campaign', owner: null, stage: 'new', temp: 'warm', req: {}, created: 0, inStage: 0 },
  { name: 'Divakar S', phone: '9840011022', source: 'whatsapp', owner: null, stage: 'new', temp: 'hot', req: { intent: 'own_use', areaMin: 2000, types: ['villa'], bedrooms: 3, budgetMax: 1.4 * CR, city: 'Chennai', localities: ['Medavakkam'] }, created: 2, inStage: 2 },

  { name: 'Usha Rani', phone: '9840011023', source: 'referral', owner: 'priya', stage: 'qualified', temp: 'warm', req: { intent: 'own_use', areaMin: 1000, types: ['apartment'], bedrooms: 2, budgetMin: 45 * L, budgetMax: 55 * L, city: 'Coimbatore', localities: ['Saravanampatti'], financing: 'loan' }, created: 11, inStage: 9, contact: 9, log: [[9, 'call', 'Interested', 'Daughter works at Saravanampatti IT park.']] },
  { name: 'Tarun Agarwal', phone: '9840011024', source: 'portal', owner: 'arun', stage: 'qualified', temp: 'hot', req: { intent: 'investment', areaMin: 8000, types: ['industrial'], budgetMax: 2.5 * CR, city: 'Chennai', localities: ['Ambattur'], mustHaves: ['75 kVA power'] }, created: 13, inStage: 8, contact: 8, log: [[12, 'call', 'Interested', 'Garment unit, needs shed with 75 kVA.']] },
  { name: 'Shalini George', phone: '9840011025', source: 'walk_in', owner: 'divya', stage: 'lost', temp: 'cold', req: { types: ['apartment'], bedrooms: 3 }, created: 50, inStage: 30, contact: 31, lost: 'Plan postponed', log: [[31, 'call', 'Not interested', 'Postponed purchase to next year.']] },
  { name: 'Abdul Rahman', phone: '9840011026', source: 'channel_partner', owner: 'priya', stage: 'booked', temp: 'hot', req: { intent: 'investment', types: ['plot'], budgetMax: 40 * L, city: 'Chennai', localities: ['Guduvanchery'] }, created: 42, inStage: 15, contact: 15, log: [[40, 'call', 'Interested'], [30, 'site_visit', 'Visited Sunrise Enclave'], [15, 'meeting', 'Booking', 'Booked plot 3.']] },
];

registerSeeder('leads', async ({ users }) => {
  const id = (w: Who) => (w ? users[w]._id : null);
  for (const s of SEED_LEADS) {
    const created = day(s.created);
    const lead = await Lead.create({
      code: await nextCode('LD'),
      name: s.name,
      phone: `+91${s.phone}`,
      source: s.source,
      ownerId: id(s.owner),
      assignedAt: s.owner ? created : undefined,
      stage: s.stage,
      stageChangedAt: day(s.inStage),
      temperature: s.temp,
      requirement: { purpose: 'sale', ...s.req },
      lostReason: s.lost,
      enquiries: [{ at: created, source: s.source }],
      lastContactAt: s.contact !== undefined ? day(s.contact) : undefined,
      createdBy: users.manager._id,
      createdAt: created,
    });
    await Audit.create({ actorId: users.manager._id, actorName: users.manager.name, entity: 'lead', entityId: lead._id, action: 'create', summary: 'New lead', createdAt: created });
    for (const [ago, type, outcome, notes] of s.log ?? []) {
      await Activity.create({
        leadId: lead._id,
        type,
        status: 'done',
        outcome: type === 'note' ? undefined : outcome,
        title: type === 'site_visit' || type === 'meeting' ? outcome : undefined,
        notes,
        completedAt: day(ago),
        scheduledAt: type === 'site_visit' || type === 'meeting' ? day(ago) : undefined,
        ownerId: id(s.owner) ?? users.manager._id,
        createdBy: id(s.owner) ?? users.manager._id,
        createdAt: day(ago),
      });
    }
  }
  void mongoose;
});
