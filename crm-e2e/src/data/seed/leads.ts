/**
 * 43 demo leads (foundation-plan §6.4): 23 in the current pipeline and 20 historical (15 converted, 5 lost).
 * Every date is relative to `now`. Temperatures are derived by lib/scoring at runtime; INTENDED_TEMPERATURE records
 * what each lead was designed to score, so tests and reviewers can check the story holds.
 */
import type {
  ActorId, Configuration, FieldMetaMap, ID, Lead, LeadSource, LostReason, PipelineStageKey, PropertyType, Qualification,
  Requirement, ShortlistItem, StageEntry, Temperature,
} from '@/domain/types'
import { STAGES } from '@/domain/catalogue'
import type { Clock } from './dates'
import { ARJUN, FARHAN, KAVYA, SNEHA, VIKRAM } from './users'

const L = 100_000
const CR = 10_000_000

export function req(p: Partial<Requirement> & Pick<Requirement, 'cities'>): Requirement {
  return {
    propertyTypes: ['apartment'], configurations: [], localities: [], budgetFlexPct: 10, possession: 'any', facing: [],
    amenities: [], mustHaves: [], purpose: 'sale', ...p,
  }
}
const qual = (p: Partial<Qualification> = {}): Qualification => ({ decisionMakers: [], loan: 'unknown', ...p })

/** Stage path from `new` to `stage` (lost leads pass through `lostFrom` first). */
function stagePath(stage: PipelineStageKey, lostFrom: PipelineStageKey = 'contacted'): PipelineStageKey[] {
  const upto = stage === 'lost' ? lostFrom : stage
  const path = STAGES.slice(0, STAGES.indexOf(upto) + 1).filter((s) => s !== 'lost')
  return stage === 'lost' ? [...path, 'lost'] : path
}

/** Spreads the stage history evenly between createdAt and stageSince. */
function history(path: PipelineStageKey[], createdAt: string, stageSince: string, by: ActorId): StageEntry[] {
  const a = new Date(createdAt).getTime()
  const b = new Date(stageSince).getTime()
  return path.map((stage, i) => ({
    stage,
    at: new Date(i === 0 ? a : i === path.length - 1 ? b : a + ((b - a) * i) / (path.length - 1)).toISOString(),
    by: i === 0 ? 'system' : by,
  }))
}

type Spec = {
  id: ID; name: string; phone: string; email?: string; source: LeadSource; sourceDetail?: string
  ownerId: ID | null; firstOwnerId?: ID; createdAt: string; stage: PipelineStageKey; stageSince?: string; lostFrom?: PipelineStageKey
  requirement: Requirement; qualification?: Qualification
  engagement?: Partial<Lead['engagement']>; firstContactAt?: string; lastContactAt?: string
  shortlist?: ShortlistItem[]; deal?: Lead['deal']; lost?: Lead['lost']
  isNri?: boolean; nriCountry?: string; preferredLanguage?: string; contactPref?: Lead['contactPref']; familySize?: number
  createdBy?: ActorId; createdVia?: Lead['createdVia']; classification?: Lead['classification']; hni?: Lead['hni']
  tags?: string[]; clientId?: ID; importJobId?: ID; fieldMeta?: FieldMetaMap; altPhone?: string
}

function make(s: Spec): Lead {
  const stageSince = s.stageSince ?? s.createdAt
  const by = s.ownerId ?? 'system'
  return {
    id: s.id, name: s.name, phone: s.phone, altPhone: s.altPhone, email: s.email, source: s.source, sourceDetail: s.sourceDetail,
    isNri: s.isNri ?? false, nriCountry: s.nriCountry, preferredLanguage: s.preferredLanguage, contactPref: s.contactPref, familySize: s.familySize,
    ownerId: s.ownerId, firstOwnerId: s.firstOwnerId ?? s.ownerId ?? undefined,
    createdBy: s.createdBy ?? 'system', createdAt: s.createdAt, updatedAt: s.lastContactAt ?? stageSince, createdVia: s.createdVia ?? 'manual',
    stage: s.stage, stageSince, stageHistory: history(stagePath(s.stage, s.lostFrom), s.createdAt, stageSince, by),
    requirement: s.requirement, qualification: s.qualification ?? qual(),
    engagement: { responded: false, docsRequested: false, siteVisited: false, ...s.engagement },
    firstContactAt: s.firstContactAt, lastContactAt: s.lastContactAt,
    shortlist: s.shortlist ?? [], deal: s.deal, lost: s.lost,
    classification: s.classification, hni: s.hni,
    consent: s.firstContactAt ? { followUp: true, at: s.firstContactAt, how: 'verbalOnCall' } : undefined,
    tags: s.tags ?? [], clientId: s.clientId, importJobId: s.importJobId, fieldMeta: s.fieldMeta,
  }
}

/** What each current lead is designed to score (hot/warm/cold), for the seed test and reviewers. */
export const INTENDED_TEMPERATURE: Record<ID, Temperature> = {
  'LEAD-1001': 'hot', 'LEAD-1002': 'hot', 'LEAD-1003': 'warm', 'LEAD-1004': 'warm', 'LEAD-1005': 'warm', 'LEAD-1006': 'hot',
  'LEAD-1007': 'hot', 'LEAD-1008': 'hot', 'LEAD-1009': 'warm', 'LEAD-1010': 'cold',
  'LEAD-1011': 'hot', 'LEAD-1012': 'warm', 'LEAD-1013': 'warm', 'LEAD-1014': 'cold', 'LEAD-1015': 'hot',
  'LEAD-1016': 'warm', 'LEAD-1017': 'cold', 'LEAD-1018': 'cold',
  'LEAD-1019': 'warm', 'LEAD-1020': 'warm', 'LEAD-1021': 'cold', 'LEAD-1022': 'warm', 'LEAD-1023': 'warm',
}

const ai = (confidence: number) => ({ origin: 'ai' as const, confidence })

export function seedCurrentLeads(c: Clock): Lead[] {
  const sl = (propertyId: ID, status: ShortlistItem['status'], at: string, by: ActorId): ShortlistItem => ({ propertyId, status, at, by })
  return [
    // ── Arjun (Bengaluru, residential): 6 open
    make({
      id: 'LEAD-1001', name: 'Priya Sharma', phone: '+919845123401', email: 'priya.sharma@example.com', source: 'referral', sourceDetail: 'Referred by Anil Kapoor (client)',
      ownerId: ARJUN, createdAt: c.ago(12, 'days'), stage: 'siteVisitScheduled', stageSince: c.ago(2, 'days'),
      requirement: req({ cities: ['Bengaluru'], localities: ['Whitefield'], configurations: ['3BHK'], budgetMin: 1.1 * CR, budgetPreferred: 1.25 * CR, budgetMax: 1.35 * CR, budgetBasis: 'propertyOnly', possession: 'ready', facing: ['E', 'N'], vastu: true, parking: 'required', amenities: ['swimmingPool', 'kidsPlayArea', 'coveredParking'], mustHaves: ['Near a good school'], areaMinSqft: 1300 }),
      qualification: qual({ need: 'clear', timeline: 'immediate', authority: 'joint', decisionMakers: ['self', 'spouse'], buyerPurpose: 'selfUse', loan: 'preApproved', fundingReady: 'ready' }),
      engagement: { responded: true, docsRequested: true }, firstContactAt: c.ago(12, 'days'), lastContactAt: c.ago(150, 'minutes'),
      shortlist: [sl('PRP-1001', 'shortlisted', c.ago(2, 'days'), ARJUN), sl('PRP-1002', 'shared', c.ago(5, 'days'), ARJUN)],
      preferredLanguage: 'English', contactPref: 'whatsapp', familySize: 4, classification: 'qualifiedBuyer',
    }),
    make({
      id: 'LEAD-1002', name: 'Karthik Subramanian', phone: '+919880234502', email: 'karthik.s@example.com', source: 'walkIn', sourceDetail: 'Walked into the Koramangala office',
      ownerId: ARJUN, createdAt: c.ago(30, 'days'), stage: 'negotiation', stageSince: c.ago(4, 'days'),
      requirement: req({ cities: ['Bengaluru'], localities: ['HSR Layout', 'Sarjapur Road'], configurations: ['3BHK'], budgetMin: 1.2 * CR, budgetPreferred: 1.35 * CR, budgetMax: 1.45 * CR, budgetBasis: 'withLoan', possession: 'ready', facing: ['NE', 'E'], parking: 'required', amenities: ['clubhouse', 'joggingTrack'], transaction: 'any' }),
      qualification: qual({ need: 'clear', timeline: 'immediate', authority: 'sole', decisionMakers: ['self'], buyerPurpose: 'selfUse', loan: 'preApproved', fundingReady: 'ready' }),
      engagement: { responded: true, docsRequested: true, siteVisited: true }, firstContactAt: c.ago(30, 'days'), lastContactAt: c.ago(1, 'days'),
      shortlist: [sl('PRP-1003', 'liked', c.ago(9, 'days'), ARJUN), sl('PRP-1001', 'visited', c.ago(12, 'days'), ARJUN)],
      deal: { propertyId: 'PRP-1003', value: 14_200_000, offered: 13_500_000, counter: 13_900_000, notes: 'Owner holds at ₹1.39 Cr; buyer wants ₹1.35 Cr. Waiting on manager approval for the discount.' },
      preferredLanguage: 'Tamil', contactPref: 'call', familySize: 3, classification: 'highValue',
    }),
    make({
      id: 'LEAD-1003', name: 'Ananya Iyer', phone: '+919900345603', email: 'ananya.iyer@example.com', source: 'website',
      ownerId: ARJUN, createdAt: c.ago(8, 'days'), stage: 'qualified', stageSince: c.ago(3, 'days'),
      requirement: req({ cities: ['Bengaluru'], localities: ['Hebbal', 'Yelahanka'], configurations: ['2BHK', '3BHK'], budgetMin: 85 * L, budgetPreferred: 92 * L, budgetMax: 1 * CR, budgetBasis: 'withLoan', possession: 'any', amenities: ['gym'] }),
      qualification: qual({ need: 'partly', timeline: 'm3to6', authority: 'needsApproval', decisionMakers: ['parents'], buyerPurpose: 'selfUse', loan: 'needed' }),
      engagement: { responded: true }, firstContactAt: c.ago(8, 'days'), lastContactAt: c.ago(3, 'days'),
      shortlist: [sl('PRP-1002', 'suggested', c.ago(3, 'days'), 'system')],
      preferredLanguage: 'English', contactPref: 'call',
    }),
    make({
      id: 'LEAD-1004', name: 'Mohammed Irfan', phone: '+919845098765', source: 'whatsapp',
      ownerId: ARJUN, createdAt: c.ago(6, 'days'), stage: 'contacted', stageSince: c.ago(5, 'days'),
      requirement: req({ cities: ['Bengaluru'], localities: ['HSR Layout', 'Electronic City'], configurations: ['2BHK', '3BHK'], budgetMin: 75 * L, budgetMax: 95 * L, possession: 'any' }),
      qualification: qual({ need: 'partly', timeline: 'm1to3', buyerPurpose: 'selfUse', loan: 'needed' }),
      engagement: { responded: true }, firstContactAt: c.ago(5, 'days'), lastContactAt: c.ago(5, 'days'),
      preferredLanguage: 'Hindi', contactPref: 'whatsapp',
    }),
    make({
      id: 'LEAD-1005', name: 'Neha Kulkarni', phone: '+918971456705', email: 'neha.k@example.com', source: 'acres99', sourceDetail: '99acres enquiry form',
      ownerId: ARJUN, createdAt: c.ago(25, 'minutes'), stage: 'new', createdVia: 'ai', createdBy: ARJUN,
      requirement: req({ cities: ['Bengaluru'], localities: ['Whitefield'], configurations: ['3BHK'], budgetMax: 1.2 * CR, possession: 'ready' }),
      qualification: qual({ timeline: 'm1to3', need: 'clear' }),
      fieldMeta: { name: ai(0.98), phone: ai(0.99), 'requirement.budgetMax': ai(0.82), 'requirement.localities': ai(0.9), 'requirement.configurations': ai(0.95), 'qualification.timeline': ai(0.6) },
    }),
    make({
      id: 'LEAD-1006', name: 'Deepak Verma', phone: '+919731567806', email: 'deepak.verma@example.com', source: 'magicbricks',
      ownerId: ARJUN, createdAt: c.ago(14, 'days'), stage: 'siteVisitDone', stageSince: c.at(-1, '17:30'),
      requirement: req({ cities: ['Bengaluru'], localities: ['Whitefield', 'Sarjapur Road'], configurations: ['3BHK'], budgetMin: 1.2 * CR, budgetPreferred: 1.3 * CR, budgetMax: 1.4 * CR, possession: 'ready', parking: 'required', amenities: ['clubhouse', 'gym'] }),
      qualification: qual({ need: 'clear', timeline: 'm1to3', authority: 'joint', decisionMakers: ['spouse'], buyerPurpose: 'selfUse', loan: 'needed', fundingReady: 'arranging' }),
      engagement: { responded: true, siteVisited: true }, firstContactAt: c.ago(14, 'days'), lastContactAt: c.at(-1, '17:30'),
      shortlist: [sl('PRP-1001', 'liked', c.at(-1, '17:30'), ARJUN), sl('PRP-1003', 'visited', c.at(-1, '17:30'), ARJUN)],
      fieldMeta: { 'requirement.budgetPreferred': ai(0.74) },
      contactPref: 'call', familySize: 4,
    }),

    // ── Sneha (Hyderabad, Chennai): 4 open
    make({
      id: 'LEAD-1007', name: 'Lakshmi Narayanan', phone: '+919848678907', email: 'lakshmi.n@example.com', source: 'channelPartner', sourceDetail: 'Sai Realty Partners',
      ownerId: SNEHA, firstOwnerId: VIKRAM, createdAt: c.ago(15, 'days'), stage: 'siteVisitScheduled', stageSince: c.ago(1, 'days'),
      requirement: req({ cities: ['Hyderabad'], localities: ['Kokapet', 'Tellapur'], propertyTypes: ['villa'], configurations: ['4BHK+'], budgetMin: 2.8 * CR, budgetPreferred: 3 * CR, budgetMax: 3.2 * CR, budgetBasis: 'allIn', possession: 'ready', facing: ['E'], vastu: true, parking: 'required', amenities: ['swimmingPool', 'clubhouse'] }),
      qualification: qual({ need: 'clear', timeline: 'm1to3', authority: 'sole', decisionMakers: ['self'], buyerPurpose: 'selfUse', loan: 'notNeeded', fundingReady: 'ready' }),
      engagement: { responded: true, docsRequested: true }, firstContactAt: c.ago(15, 'days'), lastContactAt: c.earlier(0.65),
      shortlist: [sl('PRP-1009', 'shortlisted', c.ago(1, 'days'), SNEHA)],
      fieldMeta: { 'requirement.budgetMax': ai(0.88) },
      classification: 'potentialHni', hni: { status: 'potential', signals: { budget: '₹3.2 Cr all-in', funding: 'No loan needed' } },
      preferredLanguage: 'Tamil', contactPref: 'call', familySize: 5,
    }),
    make({
      id: 'LEAD-1008', name: 'Harish Reddy', phone: '+919866789008', email: 'harish.reddy@example.com', source: 'referral',
      ownerId: SNEHA, createdAt: c.ago(40, 'days'), stage: 'negotiation', stageSince: c.ago(21, 'days'),
      requirement: req({ cities: ['Hyderabad'], localities: ['Tellapur', 'Kokapet'], propertyTypes: ['villa'], configurations: ['3BHK'], budgetMin: 1.8 * CR, budgetMax: 2 * CR, possession: 'any' }),
      qualification: qual({ need: 'clear', timeline: 'm1to3', authority: 'joint', decisionMakers: ['spouse'], buyerPurpose: 'selfUse', loan: 'needed', fundingReady: 'arranging' }),
      engagement: { responded: true, docsRequested: true, siteVisited: true }, firstContactAt: c.ago(40, 'days'), lastContactAt: c.ago(6, 'days'),
      shortlist: [sl('PRP-1011', 'liked', c.ago(18, 'days'), SNEHA)],
      deal: { propertyId: 'PRP-1011', value: 19_500_000, offered: 18_200_000, notes: 'Asked for a floor-rise waiver and a ₹10 L discount.' },
      preferredLanguage: 'Telugu', contactPref: 'call',
    }),
    make({
      id: 'LEAD-1009', name: 'Divya Menon', phone: '+919940890109', email: 'divya.menon@example.com', source: 'housing',
      ownerId: SNEHA, firstOwnerId: ARJUN, createdAt: c.ago(10, 'days'), stage: 'qualified', stageSince: c.ago(4, 'days'),
      requirement: req({ cities: ['Chennai'], localities: ['OMR', 'Anna Nagar'], configurations: ['3BHK'], budgetMin: 90 * L, budgetPreferred: 1 * CR, budgetMax: 1.1 * CR, possession: 'ready', amenities: ['swimmingPool'] }),
      qualification: qual({ need: 'clear', timeline: 'm3to6', authority: 'joint', decisionMakers: ['spouse'], buyerPurpose: 'selfUse', loan: 'needed' }),
      engagement: { responded: true }, firstContactAt: c.ago(10, 'days'), lastContactAt: c.ago(4, 'days'),
      shortlist: [sl('PRP-1004', 'shared', c.ago(4, 'days'), SNEHA)],
      preferredLanguage: 'English', contactPref: 'whatsapp',
    }),
    make({
      id: 'LEAD-1010', name: 'Sanjay Gupta', phone: '+919959901210', email: 'sanjay.gupta@example.com', source: 'googleAds', sourceDetail: 'Office space campaign',
      ownerId: SNEHA, firstOwnerId: ARJUN, createdAt: c.ago(20, 'days'), stage: 'contacted', stageSince: c.ago(18, 'days'),
      requirement: req({ cities: ['Hyderabad'], localities: ['Gachibowli'], propertyTypes: ['office'], budgetMax: 2 * CR, areaMinSqft: 2000, possession: 'ready', purpose: 'sale' }),
      qualification: qual({ need: 'exploring', timeline: 'm6to12', buyerPurpose: 'business' }),
      engagement: { responded: true }, firstContactAt: c.ago(18, 'days'), lastContactAt: c.ago(9, 'days'),
      contactPref: 'email',
    }),

    // ── Vikram (Pune, Mumbai, NCR): 5 open
    make({
      id: 'LEAD-1011', name: 'Rohan Deshpande', phone: '+919822012311', email: 'rohan.d@example.com', source: 'website',
      ownerId: VIKRAM, firstOwnerId: FARHAN, createdAt: c.ago(9, 'days'), stage: 'siteVisitScheduled', stageSince: c.ago(2, 'days'),
      requirement: req({ cities: ['Pune'], localities: ['Hinjewadi', 'Wakad'], configurations: ['2BHK'], budgetMin: 70 * L, budgetPreferred: 78 * L, budgetMax: 85 * L, possession: 'ready', parking: 'required', amenities: ['gym', 'kidsPlayArea'] }),
      qualification: qual({ need: 'clear', timeline: 'immediate', authority: 'joint', decisionMakers: ['spouse'], buyerPurpose: 'selfUse', loan: 'preApproved', fundingReady: 'ready' }),
      engagement: { responded: true }, firstContactAt: c.ago(9, 'days'), lastContactAt: c.earlier(0.55),
      shortlist: [sl('PRP-1006', 'shortlisted', c.ago(2, 'days'), VIKRAM)],
      preferredLanguage: 'Marathi', contactPref: 'whatsapp', familySize: 3,
    }),
    make({
      id: 'LEAD-1012', name: 'Pooja Agarwal', phone: '+918805123412', email: 'pooja.agarwal@example.com', source: 'nobroker',
      ownerId: VIKRAM, firstOwnerId: KAVYA, createdAt: c.ago(16, 'days'), stage: 'qualified', stageSince: c.ago(7, 'days'),
      requirement: req({ cities: ['Pune'], localities: ['Kharadi', 'Wakad'], configurations: ['2BHK'], budgetMin: 80 * L, budgetMax: 95 * L, possession: 'any' }),
      qualification: qual({ need: 'clear', timeline: 'm3to6', authority: 'sole', decisionMakers: ['self'], buyerPurpose: 'investment', loan: 'needed' }),
      engagement: { responded: true }, firstContactAt: c.ago(15, 'days'), lastContactAt: c.ago(6, 'days'),
      shortlist: [sl('PRP-1007', 'suggested', c.ago(6, 'days'), 'system')],
      contactPref: 'call',
    }),
    make({
      id: 'LEAD-1013', name: 'Vivek Malhotra', phone: '+919811345613', email: 'vivek.malhotra@example.com', source: 'website', sourceDetail: 'NRI enquiry form',
      ownerId: VIKRAM, createdAt: c.ago(20, 'hours'), stage: 'new',
      requirement: req({ cities: ['NCR'], localities: ['Gurugram', 'Dwarka Expressway'], configurations: ['4BHK+'], budgetMin: 2.8 * CR, budgetMax: 3.2 * CR, budgetBasis: 'allIn', possession: 'ready', amenities: ['clubhouse', 'swimmingPool', 'security'] }),
      qualification: qual({ timeline: 'm3to6', buyerPurpose: 'investment', loan: 'notNeeded' }),
      isNri: true, nriCountry: 'United Arab Emirates', preferredLanguage: 'Hindi', contactPref: 'email',
      classification: 'highValue', hni: { status: 'notDetermined' },
    }),
    make({
      id: 'LEAD-1014', name: 'Amit Joshi', phone: '+917709456714', source: 'facebook', sourceDetail: 'Pune 2 BHK lead ad',
      ownerId: VIKRAM, firstOwnerId: KAVYA, createdAt: c.ago(11, 'days'), stage: 'contacted', stageSince: c.ago(10, 'days'),
      requirement: req({ cities: ['Pune'], localities: ['Kharadi'], configurations: ['2BHK'], budgetMax: 85 * L, possession: 'underConstruction' }),
      qualification: qual({ need: 'exploring', timeline: 'exploring' }),
      engagement: { responded: true }, firstContactAt: c.ago(10, 'days'), lastContactAt: c.ago(2, 'days'),
      contactPref: 'whatsapp',
    }),
    make({
      id: 'LEAD-1015', name: 'Swati Chawla', phone: '+919920567815', email: 'swati.chawla@example.com', source: 'housing',
      ownerId: VIKRAM, createdAt: c.ago(45, 'days'), stage: 'booked', stageSince: c.ago(1, 'days'),
      requirement: req({ cities: ['Mumbai'], localities: ['Thane'], configurations: ['2BHK'], budgetMin: 1 * CR, budgetMax: 1.15 * CR, possession: 'ready' }),
      qualification: qual({ need: 'clear', timeline: 'immediate', authority: 'joint', decisionMakers: ['spouse'], buyerPurpose: 'selfUse', loan: 'needed', fundingReady: 'ready' }),
      engagement: { responded: true, docsRequested: true, siteVisited: true }, firstContactAt: c.ago(45, 'days'), lastContactAt: c.ago(1, 'days'),
      shortlist: [sl('PRP-1008', 'liked', c.ago(10, 'days'), VIKRAM)],
      deal: { propertyId: 'PRP-1008', value: 11_000_000, offered: 10_800_000, counter: 11_000_000, bookingAmount: 5 * L, bookedAt: c.ago(1, 'days') },
      clientId: 'CL-1016', contactPref: 'call', classification: 'qualifiedBuyer',
    }),

    // ── Farhan (on leave): 2 open
    make({
      id: 'LEAD-1016', name: 'Nisha Kapoor', phone: '+919769678916', email: 'nisha.kapoor@example.com', source: 'magicbricks',
      ownerId: FARHAN, createdAt: c.ago(13, 'days'), stage: 'qualified', stageSince: c.ago(6, 'days'),
      requirement: req({ cities: ['Mumbai'], localities: ['Thane'], configurations: ['2BHK'], budgetMin: 1 * CR, budgetMax: 1.15 * CR, possession: 'ready' }),
      qualification: qual({ need: 'clear', timeline: 'm1to3', authority: 'sole', decisionMakers: ['self'], loan: 'needed' }),
      engagement: { responded: true }, firstContactAt: c.ago(13, 'days'), lastContactAt: c.ago(6, 'days'),
    }),
    make({
      id: 'LEAD-1017', name: 'Gaurav Bansal', phone: '+919871789017', source: 'acres99',
      ownerId: FARHAN, firstOwnerId: VIKRAM, createdAt: c.ago(9, 'days'), stage: 'contacted', stageSince: c.ago(8, 'days'),
      requirement: req({ cities: ['NCR'], localities: ['Noida'], configurations: ['3BHK'], budgetMax: 1.2 * CR, possession: 'any' }),
      qualification: qual({ need: 'partly', timeline: 'm6to12' }),
      engagement: { responded: false }, firstContactAt: c.ago(8, 'days'), lastContactAt: c.ago(8, 'days'),
    }),

    // ── Kavya (deactivated 5 days ago): 1 open
    make({
      id: 'LEAD-1018', name: 'Fatima Sheikh', phone: '+918879890118', email: 'fatima.sheikh@example.com', source: 'instagram',
      ownerId: KAVYA, createdAt: c.ago(12, 'days'), stage: 'contacted', stageSince: c.ago(11, 'days'),
      requirement: req({ cities: ['Mumbai'], localities: ['Navi Mumbai', 'Kharghar'], configurations: ['2BHK'], budgetMax: 90 * L, possession: 'any' }),
      qualification: qual({ need: 'partly', timeline: 'm3to6' }),
      engagement: { responded: true }, firstContactAt: c.ago(11, 'days'), lastContactAt: c.ago(7, 'days'),
    }),

    // ── Unassigned queue: 5
    make({
      id: 'LEAD-1019', name: 'Sunita Patil', phone: '+919850901219', source: 'acres99', sourceDetail: '99acres project page',
      ownerId: null, createdAt: c.ago(15, 'minutes'), stage: 'new',
      requirement: req({ cities: ['Pune'], localities: ['Wakad'], configurations: ['2BHK'], budgetMin: 75 * L, budgetMax: 90 * L, possession: 'any' }),
      preferredLanguage: 'Marathi',
    }),
    make({
      id: 'LEAD-1020', name: 'Rajesh Nair', phone: '+919884012320', email: 'rajesh.nair@example.com', source: 'magicbricks',
      ownerId: null, createdAt: c.ago(2, 'hours'), stage: 'new',
      requirement: req({ cities: ['Chennai'], localities: ['OMR'], configurations: ['3BHK'], budgetMin: 90 * L, budgetMax: 1.05 * CR, possession: 'ready' }),
      qualification: qual({ timeline: 'm1to3' }), preferredLanguage: 'Tamil',
    }),
    make({
      id: 'LEAD-1021', name: 'Aditya Rao', phone: '+917019123421', source: 'facebook',
      ownerId: null, createdAt: c.ago(5, 'hours'), stage: 'new',
      requirement: req({ cities: ['Bengaluru'], localities: ['Hebbal'], configurations: ['2BHK'], budgetMax: 80 * L, possession: 'any' }),
      preferredLanguage: 'Kannada',
    }),
    make({
      id: 'LEAD-1022', name: 'Tanvi Shah', phone: '+919810234522', email: 'tanvi.shah@example.com', source: 'website',
      ownerId: null, createdAt: c.ago(40, 'minutes'), stage: 'new', createdVia: 'ai',
      requirement: req({ cities: ['NCR'], localities: ['Gurugram'], configurations: ['4BHK+'], budgetMin: 2.2 * CR, budgetMax: 2.5 * CR, possession: 'ready' }),
      qualification: qual({ timeline: 'm1to3', buyerPurpose: 'selfUse' }),
      fieldMeta: { 'requirement.budgetMax': ai(0.86), 'requirement.localities': ai(0.92), 'qualification.timeline': ai(0.58) },
      classification: 'highValue',
    }),
    make({
      id: 'LEAD-1023', name: 'Mohd Irfan', phone: '+919845098765', source: 'whatsapp', sourceDetail: 'WhatsApp Business inbox',
      ownerId: null, createdAt: c.ago(50, 'minutes'), stage: 'new',
      requirement: req({ cities: ['Bengaluru'], localities: ['Electronic City'], configurations: ['2BHK'], budgetMax: 90 * L }),
      tags: ['possibleDuplicate'],
    }),
  ]
}

// ── historical (closed) leads: 15 converted, 5 lost
type Hist = [id: ID, name: string, phone: string, source: LeadSource, owner: ID, city: string, locality: string,
  type: PropertyType, config: Configuration | undefined, createdDaysAgo: number, closedDaysAgo: number,
  dealValue: number, propertyId: ID | undefined, outcome: 'converted' | LostReason]

export const HISTORICAL: Hist[] = [
  ['LEAD-1024', 'Anil Kapoor', '+919845234524', 'referral', ARJUN, 'Bengaluru', 'Sarjapur Road', 'villa', '4BHK+', 175, 150, 21_000_000, 'PRP-1010', 'converted'],
  ['LEAD-1025', 'Revathi Krishnan', '+919840345625', 'phone', SNEHA, 'Chennai', 'Velachery', 'apartment', '2BHK', 170, 140, 7_400_000, undefined, 'converted'],
  ['LEAD-1026', 'Srinivas Rao', '+919848456726', 'channelPartner', SNEHA, 'Hyderabad', 'Kondapur', 'apartment', '3BHK', 160, 125, 11_200_000, 'PRP-1005', 'converted'],
  ['LEAD-1027', 'Meenakshi Sundaram', '+919444567827', 'walkIn', SNEHA, 'Chennai', 'Porur', 'apartment', '2BHK', 150, 110, 6_800_000, undefined, 'converted'],
  ['LEAD-1028', 'Ravi Teja', '+919866678928', 'website', SNEHA, 'Hyderabad', 'Miyapur', 'apartment', '2BHK', 140, 95, 6_200_000, undefined, 'converted'],
  ['LEAD-1029', 'Sameer Kulkarni', '+919822789029', 'manual', VIKRAM, 'Pune', 'Baner', 'shop', undefined, 135, 100, 9_200_000, 'PRP-1018', 'converted'],
  ['LEAD-1030', 'Prakash Shetty', '+919880890130', 'other', ARJUN, 'Bengaluru', 'Hoskote', 'warehouse', undefined, 120, 75, 20_500_000, 'PRP-1019', 'converted'],
  ['LEAD-1031', 'Shalini Desai', '+919850901231', 'referral', KAVYA, 'Pune', 'Wakad', 'rowHouse', '3BHK', 110, 60, 13_200_000, 'PRP-1013', 'converted'],
  ['LEAD-1032', 'Harini Venkatesh', '+919940012332', 'acres99', SNEHA, 'Chennai', 'Perungudi', 'apartment', '3BHK', 100, 55, 9_100_000, undefined, 'converted'],
  ['LEAD-1033', 'Manish Arora', '+919811123433', 'googleAds', VIKRAM, 'NCR', 'Noida', 'apartment', '3BHK', 95, 50, 10_500_000, undefined, 'converted'],
  ['LEAD-1034', 'Kiran Gowda', '+919731234534', 'magicbricks', ARJUN, 'Bengaluru', 'Electronic City', 'apartment', '2BHK', 90, 40, 6_900_000, undefined, 'converted'],
  ['LEAD-1035', 'Pallavi Joshi', '+919890345635', 'housing', KAVYA, 'Pune', 'Hadapsar', 'apartment', '1BHK', 80, 35, 4_800_000, undefined, 'converted'],
  ['LEAD-1036', 'Naveen Kumar', '+919845456736', 'website', ARJUN, 'Bengaluru', 'Yelahanka', 'plot', undefined, 70, 25, 6_600_000, undefined, 'converted'],
  ['LEAD-1037', 'Sowmya Reddy', '+919849567837', 'instagram', SNEHA, 'Hyderabad', 'Gachibowli', 'apartment', '3BHK', 60, 18, 12_800_000, undefined, 'converted'],
  ['LEAD-1038', 'Rakesh Sharma', '+919920678938', 'nobroker', VIKRAM, 'Mumbai', 'Powai', 'apartment', '2BHK', 50, 9, 17_500_000, undefined, 'converted'],
  ['LEAD-1039', 'Vinod Pillai', '+919884789039', 'acres99', ARJUN, 'Bengaluru', 'Whitefield', 'apartment', '3BHK', 120, 90, 0, undefined, 'budgetMismatch'],
  ['LEAD-1040', 'Geeta Bhat', '+919900890140', 'facebook', ARJUN, 'Bengaluru', 'Hebbal', 'apartment', '2BHK', 100, 70, 0, undefined, 'boughtElsewhere'],
  ['LEAD-1041', 'Imran Khan', '+919867901241', 'whatsapp', VIKRAM, 'Mumbai', 'Andheri East', 'apartment', '2BHK', 85, 60, 0, undefined, 'notResponding'],
  ['LEAD-1042', 'Snehal Patwardhan', '+919860012342', 'housing', KAVYA, 'Pune', 'Hinjewadi', 'apartment', '2BHK', 75, 45, 0, undefined, 'location'],
  ['LEAD-1043', 'Bhavana Rao', '+919959123443', 'website', SNEHA, 'Hyderabad', 'Kokapet', 'villa', '4BHK+', 65, 30, 0, undefined, 'loanRejected'],
]

/** Client ids for the 15 converted historical leads, in HISTORICAL order (CL-1001…CL-1015). */
export const historicalClientId = (index: number) => `CL-${1001 + index}`

export function seedHistoricalLeads(c: Clock): Lead[] {
  let clientIndex = 0
  return HISTORICAL.map(([id, name, phone, source, owner, city, locality, type, config, createdDaysAgo, closedDaysAgo, dealValue, propertyId, outcome]) => {
    const createdAt = c.ago(createdDaysAgo, 'days')
    const closedAt = c.ago(closedDaysAgo, 'days')
    const converted = outcome === 'converted'
    const budget = converted ? Math.round(dealValue * 1.08) : 95 * L
    const base = {
      id, name, phone, source, ownerId: owner, createdAt, stageSince: closedAt,
      requirement: req({ cities: [city], localities: [locality], propertyTypes: [type], configurations: config ? [config] : [], budgetMax: budget, possession: 'any' }),
      qualification: qual({ need: 'clear', timeline: 'm1to3', authority: 'joint', decisionMakers: ['spouse'], buyerPurpose: 'selfUse', loan: converted ? 'preApproved' : 'unknown' }),
      firstContactAt: c.ago(createdDaysAgo - 0.02, 'days'), lastContactAt: closedAt,
    }
    if (converted) {
      const clientId = historicalClientId(clientIndex++)
      return make({
        ...base, stage: 'converted', engagement: { responded: true, docsRequested: true, siteVisited: true },
        deal: { propertyId, value: dealValue, offered: dealValue, bookingAmount: Math.round(dealValue * 0.05 / L) * L, bookedAt: c.ago(closedDaysAgo + 12, 'days') },
        shortlist: propertyId ? [{ propertyId, status: 'liked', at: c.ago(closedDaysAgo + 15, 'days'), by: owner }] : [],
        clientId,
      })
    }
    return make({
      ...base, stage: 'lost', lostFrom: outcome === 'loanRejected' ? 'negotiation' : outcome === 'notResponding' ? 'contacted' : 'siteVisitDone',
      engagement: { responded: outcome !== 'notResponding', siteVisited: outcome !== 'notResponding' },
      lost: { reason: outcome, at: closedAt, by: owner, note: outcome === 'boughtElsewhere' ? 'Bought a resale flat through another agent.' : undefined },
    })
  })
}
