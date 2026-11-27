/**
 * Master data for crm-e2e (foundation-plan §2.2). Ported and extended from wireframe-rebuild/src/data/catalogue.ts.
 * Values only: every label lives in the i18n `catalogue` namespace, keyed by value
 * (e.g. t('catalogue:stage.negotiation'), t('catalogue:spec.roadWidthFt'), t('catalogue:amenity.clubhouse')).
 * Proper nouns (cities, localities, authorities, banks) are shown as stored.
 */
import type {
  AppointmentStatus, AppointmentType, AreaUnit, Authority, BuyerPurpose, Classification, Configuration, DecisionMaker, Facing, Furnishing,
  LeadSource, ListingState, LoanStatus, LostReason, MessagePurpose, MessageTemplate, Need, PipelineStageDef,
  PipelineStageKey, PossessionPref, Priority, PropertyArea, PropertyCategory, PropertyFamily, PropertyStatus,
  PropertyType, Settings, TaskType, Temperature, Timeline,
} from './types'

// ── pipeline
export const STAGES: PipelineStageKey[] = [
  'new', 'contacted', 'qualified', 'siteVisitScheduled', 'siteVisitDone', 'negotiation', 'booked', 'converted', 'lost',
]
/** Every stage a lead is still being worked in (all but converted and lost). */
export const OPEN_STAGES: PipelineStageKey[] = STAGES.filter((s) => s !== 'converted' && s !== 'lost')
export const CLOSED_STAGES: PipelineStageKey[] = ['converted', 'lost']
/** Forward-only automation compares ranks. Lost has its own rank (it can be reached from any open stage). */
export const STAGE_RANK: Record<PipelineStageKey, number> = {
  new: 0, contacted: 1, qualified: 2, siteVisitScheduled: 3, siteVisitDone: 4, negotiation: 5, booked: 6, converted: 7, lost: 8,
}
export const isOpenStage = (s: PipelineStageKey) => OPEN_STAGES.includes(s)

/** Stage defaults: target days in stage and win probability (plan §6.4). */
export const DEFAULT_STAGE_DEFS: PipelineStageDef[] = [
  { key: 'new', order: 0, enabled: true, targetDays: 1, probability: 0.05 },
  { key: 'contacted', order: 1, enabled: true, targetDays: 3, probability: 0.1 },
  { key: 'qualified', order: 2, enabled: true, targetDays: 5, probability: 0.2 },
  { key: 'siteVisitScheduled', order: 3, enabled: true, targetDays: 7, probability: 0.3 },
  { key: 'siteVisitDone', order: 4, enabled: true, targetDays: 5, probability: 0.45 },
  { key: 'negotiation', order: 5, enabled: true, targetDays: 10, probability: 0.65 },
  { key: 'booked', order: 6, enabled: true, targetDays: 30, probability: 0.9 },
  { key: 'converted', order: 7, enabled: true, targetDays: 0, probability: 1 },
  { key: 'lost', order: 8, enabled: true, targetDays: 0, probability: 0 },
]

export const LOST_REASONS: LostReason[] = ['budgetMismatch', 'boughtElsewhere', 'notResponding', 'location', 'loanRejected', 'other']
export const TEMPERATURES: Temperature[] = ['hot', 'warm', 'cold']
export const PRIORITIES: Priority[] = ['high', 'medium', 'low']
export const CLASSIFICATIONS: Classification[] = ['general', 'qualifiedBuyer', 'investor', 'highValue', 'potentialHni', 'verifiedHni']

// ── sources
export const LEAD_SOURCES: LeadSource[] = [
  'phone', 'whatsapp', 'website', 'walkIn', 'acres99', 'magicbricks', 'housing', 'nobroker',
  'facebook', 'instagram', 'googleAds', 'channelPartner', 'referral', 'manual', 'other',
]
/** A 0–1 prior per source, used by scoring (Source quality = SOURCE_QUALITY × 10). */
export const SOURCE_QUALITY: Record<LeadSource, number> = {
  referral: 0.9, walkIn: 0.85, channelPartner: 0.75, website: 0.6, phone: 0.6, whatsapp: 0.6,
  acres99: 0.5, magicbricks: 0.5, housing: 0.5, nobroker: 0.45, googleAds: 0.45,
  facebook: 0.35, instagram: 0.35, manual: 0.5, other: 0.4,
}

// ── qualification vocabularies
export const NEEDS: Need[] = ['clear', 'partly', 'exploring']
export const TIMELINES: Timeline[] = ['immediate', 'm1to3', 'm3to6', 'm6to12', 'exploring']
export const AUTHORITIES: Authority[] = ['sole', 'joint', 'needsApproval']
export const DECISION_MAKERS: DecisionMaker[] = ['self', 'spouse', 'parents', 'family', 'partner', 'company']
export const BUYER_PURPOSES: BuyerPurpose[] = ['selfUse', 'investment', 'rental', 'business']
export const LOAN_STATUSES: LoanStatus[] = ['notNeeded', 'needed', 'preApproved', 'unknown']
export const POSSESSION_PREFS: PossessionPref[] = ['ready', 'underConstruction', 'any']

// ── property vocabularies
export const CONFIGURATIONS: Configuration[] = ['1RK', '1BHK', '2BHK', '2.5BHK', '3BHK', '4BHK+']
/** Bedrooms implied by a configuration (1RK counts as 1 so "fewer BHK" comparisons stay simple). */
export const CONFIGURATION_BEDROOMS: Record<Configuration, number> = { '1RK': 1, '1BHK': 1, '2BHK': 2, '2.5BHK': 2.5, '3BHK': 3, '4BHK+': 4 }
export const FACINGS: Facing[] = ['E', 'N', 'W', 'S', 'NE', 'NW', 'SE', 'SW']
export const FURNISHING: Furnishing[] = ['unfurnished', 'semi', 'full']
export const PROPERTY_STATUSES: PropertyStatus[] = ['available', 'onHold', 'booked', 'sold']
export const LISTING_STATES: ListingState[] = ['draft', 'live', 'archived']
export const AREA_UNITS: AreaUnit[] = ['sqft', 'sqyd', 'cents', 'acres', 'guntha']
/** Square feet per unit (Indian conventions: 1 cent = 435.6 sq ft, 1 guntha = 1089 sq ft). */
export const SQFT_PER_UNIT: Record<AreaUnit, number> = { sqft: 1, sqyd: 9, cents: 435.6, acres: 43560, guntha: 1089 }

/** A family-specific extra stored in `Property.specs` (label: `catalogue:spec.<key>`, option label: `catalogue:specOption.<option>`). */
export type FactDef = {
  key: string
  kind: 'number' | 'text' | 'select' | 'boolean' | 'month'
  options?: string[]
  /** A rupee amount, shown as ₹1,23,000. */
  money?: boolean
  /** A number shown as typed (a year: 2025, not 2,025). */
  plain?: boolean
  /** Never shown to customers (share text, brochure). */
  internal?: boolean
}

export type PropertyTypeDef = {
  family: PropertyFamily
  category: PropertyCategory
  /** Has a BHK configuration (flats and houses). */
  configurable: boolean
  /** The area fields the form asks for, in order; the first one is the primary figure. */
  areaFields: (keyof PropertyArea)[]
  /** Smart-required fields beyond title/type/location/price/area. */
  required: string[]
  specs: FactDef[]
}

const FLAT_SPECS: FactDef[] = [
  { key: 'lifts', kind: 'number' },
  { key: 'udsSqft', kind: 'number' },
  { key: 'towerName', kind: 'text' },
  { key: 'unitNumber', kind: 'text', internal: true },
  { key: 'powerBackup', kind: 'select', options: ['full', 'partial', 'none'] },
]
const HOUSE_SPECS: FactDef[] = [
  { key: 'floors', kind: 'number' },
  { key: 'constructionYear', kind: 'number', plain: true },
  { key: 'quality', kind: 'select', options: ['premium', 'standard', 'basic'] },
  { key: 'condition', kind: 'select', options: ['new', 'good', 'minorRepair', 'majorRepair'] },
  { key: 'privateGarden', kind: 'boolean' },
  { key: 'water', kind: 'select', options: ['municipal', 'borewell', 'municipalBorewell', 'tanker'] },
  { key: 'power', kind: 'select', options: ['eb', 'ebInverter', 'ebGenerator', 'ebSolar'] },
]
const PLOT_SPECS: FactDef[] = [
  { key: 'roadAccess', kind: 'select', options: ['publicRoad', 'layoutRoad', 'privatePath'] },
  { key: 'topography', kind: 'select', options: ['level', 'gentleSlope', 'elevated', 'lowLying'] },
  { key: 'surveyNo', kind: 'text', internal: true },
  { key: 'layoutApproval', kind: 'text', internal: true },
  { key: 'landUse', kind: 'select', options: ['residential', 'mixed', 'commercialUse', 'agriConversion'] },
  { key: 'water', kind: 'select', options: ['municipal', 'borewell', 'municipalBorewell', 'notAvailable'] },
  { key: 'electricity', kind: 'select', options: ['atSite', 'lineNearby', 'notAvailable'] },
  { key: 'drainage', kind: 'select', options: ['underground', 'openDrain', 'notAvailable'] },
  { key: 'boundaryWall', kind: 'boolean' },
]
const LAND_SPECS: FactDef[] = [
  { key: 'soil', kind: 'select', options: ['red', 'black', 'alluvial', 'sandy', 'mixedSoil'] },
  { key: 'waterSource', kind: 'select', options: ['borewell', 'openWell', 'canal', 'river', 'rainFed'] },
  { key: 'crops', kind: 'text' },
  { key: 'electricity', kind: 'select', options: ['threePhase', 'singlePhase', 'notAvailable'] },
  { key: 'fencing', kind: 'select', options: ['full', 'partial', 'none'] },
  { key: 'surveyNo', kind: 'text', internal: true },
]
const COMMERCIAL_SPECS: FactDef[] = [
  { key: 'washrooms', kind: 'number' },
  { key: 'frontageFt', kind: 'number' },
  { key: 'seats', kind: 'number' },
  { key: 'cabins', kind: 'number' },
  { key: 'permittedUsage', kind: 'text' },
  { key: 'occupancy', kind: 'select', options: ['vacant', 'tenanted', 'ownerOccupied'] },
  { key: 'rentalIncome', kind: 'number', money: true },
  { key: 'leaseTenureYears', kind: 'number' },
  { key: 'powerKva', kind: 'number' },
]
const WAREHOUSE_SPECS: FactDef[] = [
  { key: 'powerKva', kind: 'number' },
  { key: 'clearHeightFt', kind: 'number' },
  { key: 'dockDoors', kind: 'number' },
  { key: 'truckAccess', kind: 'select', options: ['container', 'smallTrucks', 'noTrucks'] },
  { key: 'floorLoadTonnes', kind: 'number' },
  { key: 'estateZone', kind: 'text' },
  { key: 'fireNoc', kind: 'boolean' },
]

export const PROPERTY_TYPES: Record<PropertyType, PropertyTypeDef> = {
  apartment: { family: 'flat', category: 'residential', configurable: true, areaFields: ['carpet', 'builtUp', 'superBuiltUp'], required: ['configuration', 'floor'], specs: FLAT_SPECS },
  villa: { family: 'house', category: 'residential', configurable: true, areaFields: ['builtUp', 'plot', 'carpet'], required: ['configuration'], specs: HOUSE_SPECS },
  independentHouse: { family: 'house', category: 'residential', configurable: true, areaFields: ['builtUp', 'plot', 'carpet'], required: ['configuration'], specs: HOUSE_SPECS },
  rowHouse: { family: 'house', category: 'residential', configurable: true, areaFields: ['builtUp', 'plot', 'carpet'], required: ['configuration'], specs: HOUSE_SPECS },
  plot: { family: 'plot', category: 'land', configurable: false, areaFields: ['plot', 'plotLengthFt', 'plotWidthFt'], required: ['roadWidthFt'], specs: PLOT_SPECS },
  agriLand: { family: 'land', category: 'land', configurable: false, areaFields: ['plot'], required: [], specs: LAND_SPECS },
  office: { family: 'commercial', category: 'commercial', configurable: false, areaFields: ['carpet', 'builtUp', 'superBuiltUp'], required: [], specs: COMMERCIAL_SPECS },
  shop: { family: 'commercial', category: 'commercial', configurable: false, areaFields: ['carpet', 'builtUp'], required: [], specs: COMMERCIAL_SPECS },
  showroom: { family: 'commercial', category: 'commercial', configurable: false, areaFields: ['carpet', 'builtUp'], required: [], specs: COMMERCIAL_SPECS },
  coworking: { family: 'commercial', category: 'commercial', configurable: false, areaFields: ['carpet', 'builtUp'], required: [], specs: COMMERCIAL_SPECS },
  warehouse: { family: 'warehouse', category: 'commercial', configurable: false, areaFields: ['builtUp', 'plot'], required: [], specs: WAREHOUSE_SPECS },
}
export const PROPERTY_TYPE_ORDER: PropertyType[] = [
  'apartment', 'villa', 'independentHouse', 'rowHouse', 'plot', 'agriLand', 'office', 'shop', 'showroom', 'coworking', 'warehouse',
]
export const PROPERTY_FAMILIES: PropertyFamily[] = ['flat', 'house', 'plot', 'land', 'commercial', 'warehouse']
export const categoryOf = (type: PropertyType): PropertyCategory => PROPERTY_TYPES[type].category
export const familyOf = (type: PropertyType): PropertyFamily => PROPERTY_TYPES[type].family

// ── places: six metros with real localities
export const CITIES: Record<string, string[]> = {
  Bengaluru: ['Whitefield', 'Sarjapur Road', 'Hebbal', 'Electronic City', 'HSR Layout', 'Yelahanka', 'Hoskote'],
  Chennai: ['OMR', 'Porur', 'Tambaram', 'Velachery', 'Anna Nagar', 'Perungudi'],
  Hyderabad: ['Gachibowli', 'Kokapet', 'Kondapur', 'Miyapur', 'Tellapur'],
  Pune: ['Hinjewadi', 'Wakad', 'Baner', 'Kharadi', 'Hadapsar'],
  Mumbai: ['Thane', 'Navi Mumbai', 'Powai', 'Andheri East', 'Kharghar'],
  NCR: ['Gurugram', 'Noida', 'Greater Noida West', 'Dwarka Expressway'],
}
export const CITY_NAMES = Object.keys(CITIES)
export const cityOfLocality = (locality: string): string | undefined =>
  CITY_NAMES.find((c) => CITIES[c].some((l) => l.toLowerCase() === locality.toLowerCase()))

// ── amenities (label: catalogue:amenity.<key>)
export const AMENITIES = [
  'gatedCommunity', 'security', 'parkOpenSpace', 'powerBackup', 'lift', 'gym', 'swimmingPool', 'clubhouse',
  'rainwaterHarvesting', 'cctv', 'visitorParking', 'loadingBay',
  'coveredParking', 'kidsPlayArea', 'joggingTrack', 'evCharging', 'water24x7',
] as const
export type Amenity = (typeof AMENITIES)[number]

export const APPROVAL_AUTHORITIES = [
  'BBMP', 'BDA', 'BMRDA', 'BIAAPA', 'CMDA', 'DTCP', 'HMDA', 'GHMC', 'PMRDA', 'PMC', 'MHADA', 'CIDCO', 'MMRDA', 'GMDA',
  'DTCP Haryana', 'Noida Authority', 'YEIDA', 'Other',
]
export const BANKS = ['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'LIC HFL', 'Kotak', 'Bank of Baroda']
export const LANGUAGES_SPOKEN = ['English', 'Hindi', 'Tamil', 'Kannada', 'Telugu', 'Marathi', 'Malayalam', 'Bengali', 'Urdu', 'Gujarati']

// ── appointments and tasks
export const APPOINTMENT_TYPES: AppointmentType[] = ['siteVisit', 'officeMeeting', 'phoneCall', 'videoCall', 'documentation']
/** Booked and still to happen (a rescheduled appointment keeps its new time). */
export const UPCOMING_APPOINTMENT_STATUSES: AppointmentStatus[] = ['scheduled', 'confirmed', 'rescheduled']
export const DEFAULT_DURATION_MIN: Record<AppointmentType, number> = { siteVisit: 60, officeMeeting: 45, phoneCall: 15, videoCall: 30, documentation: 60 }
export const TASK_TYPES: TaskType[] = ['call', 'whatsapp', 'followUp', 'email', 'meeting', 'document', 'other']
export const MESSAGE_PURPOSES: MessagePurpose[] = ['intro', 'followUp', 'visitConfirm', 'postVisit', 'offer', 'share', 'reminder']

// ── message templates (stored data, editable in Settings; placeholders {{firstName}} {{property}} {{time}} {{agent}})
const T = (id: string, purpose: MessagePurpose, tone: 'english' | 'hinglish', body: string): MessageTemplate =>
  ({ id, purpose, channel: 'whatsapp', tone, body })
export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  T('tpl-intro-en', 'intro', 'english', 'Hi {{firstName}}, this is {{agent}} from RealSpec. Thanks for your enquiry. When is a good time for a quick call about the homes you are looking at?'),
  T('tpl-intro-hi', 'intro', 'hinglish', 'Hi {{firstName}}, main {{agent}} RealSpec se. Aapki enquiry ke liye thanks! Kab baat kar sakte hain options ke baare mein?'),
  T('tpl-follow-en', 'followUp', 'english', 'Hi {{firstName}}, just following up on our conversation. Shall I share a few more options that fit your budget?'),
  T('tpl-follow-hi', 'followUp', 'hinglish', 'Hi {{firstName}}, pichli baat ka follow-up. Aapke budget mein kuch aur options bhejun?'),
  T('tpl-visit-en', 'visitConfirm', 'english', 'Hi {{firstName}}, confirming your site visit to {{property}} at {{time}}. I will meet you at the site office. Location: {{map}}'),
  T('tpl-visit-hi', 'visitConfirm', 'hinglish', 'Hi {{firstName}}, {{property}} ka site visit {{time}} pe confirm hai. Main site office pe milunga. Location: {{map}}'),
  T('tpl-post-en', 'postVisit', 'english', 'Hi {{firstName}}, thank you for visiting {{property}} today. What did you and your family think? Happy to answer any questions.'),
  T('tpl-post-hi', 'postVisit', 'hinglish', 'Hi {{firstName}}, aaj {{property}} visit karne ke liye thanks. Family ko kaisa laga? Koi bhi sawaal ho toh batayiye.'),
  T('tpl-offer-en', 'offer', 'english', 'Hi {{firstName}}, good news: the builder has agreed to {{price}} for {{property}}. This offer holds until {{date}}. Shall we block the unit?'),
  T('tpl-offer-hi', 'offer', 'hinglish', 'Hi {{firstName}}, achhi khabar! Builder {{property}} ke liye {{price}} pe maan gaye hain. Offer {{date}} tak valid hai. Unit block karein?'),
  T('tpl-share-en', 'share', 'english', 'Hi {{firstName}}, as discussed, here are {{count}} options that match what you are looking for:\n{{list}}\nTell me which ones you would like to visit.'),
  T('tpl-share-hi', 'share', 'hinglish', 'Hi {{firstName}}, jaisa baat hui thi, yeh rahe {{count}} options aapke liye:\n{{list}}\nBataiye kaunse dekhna chahenge.'),
]

export const SCHEMA_VERSION = 1

/** Settings before the seed adds its demo rules (the seed sets rules and the round-robin cursor). */
export const DEFAULT_SETTINGS: Settings = {
  assignment: { autoAssign: true, rules: [], rrCursor: null },
  pipeline: { stages: DEFAULT_STAGE_DEFS, lostReasons: LOST_REASONS },
  sla: { firstResponseMins: 15, escalateAfterMins: 60, staleDays: 7, hotNoContactDays: 3 },
  matching: { weights: { budget: 0.3, location: 0.25, size: 0.2, amenities: 0.15, preferences: 0.1 }, minScore: 40, perProjectCap: 2 },
  scoring: { hotAt: 70, warmAt: 45 },
  templates: DEFAULT_TEMPLATES,
  costs: { stampDutyPct: 6, registrationPct: 1, otherPct: 1 },
  extraAmenities: [],
  mappingProfiles: [],
}
