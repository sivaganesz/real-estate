/**
 * Data shapes for wireframe v3, written the way the MongoDB collections will be:
 * stable ids, references by id (never copied text), and who / when on every change.
 * Reused from the old wireframe (spec-system-wireframe/data.js), reshaped and typed.
 */
import type { AssistantThread } from '@/lib/assistant'

export type Role = 'admin' | 'manager' | 'executive'

export type User = {
  id: string
  name: string
  role: Role
  phone: string
}

/* ---------- properties ---------- */

export type PropertyTypeKey = 'plot' | 'flat' | 'house' | 'commercial' | 'agri' | 'industrial'
export type Category = 'residential' | 'commercial'
export type Purpose = 'sale' | 'rent' | 'lease'
export type PropertyStatus = 'draft' | 'available' | 'negotiation' | 'reserved' | 'booked' | 'onHold' | 'sold'
export type Facing = 'E' | 'N' | 'W' | 'S' | 'NE' | 'NW' | 'SE' | 'SW'

/** A value the AI or a person put in: who, when, and where it came from. */
export type Audit = { by: string; at: string }

export type SpecValue = string | number

export type Media = {
  id: string
  kind: 'photo' | 'video' | 'floorPlan' | 'brochure'
  /** Real file URL once uploads exist; the wireframe draws a placeholder when it is empty. */
  url: string
  caption?: string
  isCover?: boolean
}

export type InfraStatus = 'existing' | 'underConstruction' | 'planned' | 'proposed'

/** A place near a property. The place itself lives in a shared `places` collection; this is the property's link to it. */
export type NearbyPlace = {
  id: string
  categoryId: string
  name: string
  distanceKm: number
  durationMin: number
  status: InfraStatus
  /** A person checked the route (only needed for categories with routeCheck on). */
  routeChecked: boolean
  routeCheckedBy?: string
  routeCheckedAt?: string
  /** How the route was checked: driven, walked, by bus. */
  routeCheckHow?: string
  added?: Audit
  source: 'google' | 'user'
}

export type PropertyLocation = {
  state: string
  city: string
  locality: string
  /** false → the map shows the locality as an approximate area and distances carry "~". */
  exact: boolean
  lat?: number
  lng?: number
  roadType?: string
  roadWidthFt?: number
  nearby: NearbyPlace[]
}

export type ApprovalClaim = {
  approvalId: string
  /** pending = ticked but no document yet (the only legal warning). */
  status: 'pending' | 'uploaded' | 'verified'
  file?: string
  uploaded?: Audit
  verified?: Audit
}

export type PropertyDocument = {
  id: string
  name: string
  kind: string
  file: string
  uploaded: Audit
  verified?: Audit
}

export type Comparable = {
  id: string
  locality: string
  type: string
  areaSqft: number
  pricePerSqft: number
  kind: 'transaction' | 'asking'
  date: string
  source: string
  differences: string
}

export type HistoryEntry = { id: string; at: string; by: string; text: string }

export type Property = {
  id: string
  title: string
  description?: string
  type: PropertyTypeKey
  purpose: Purpose
  status: PropertyStatus
  facing?: Facing
  /** sq.ft. — the basis depends on the type (plot area, built-up area, usable area). */
  areaSqft: number
  /** ₹, total. */
  price: number
  /** Hide the price on the listing ("price on request"); the team still sees it. */
  priceOnRequest?: boolean
  specs: Record<string, SpecValue>
  amenities: string[]
  location: PropertyLocation
  media: Media[]
  approvals: ApprovalClaim[]
  documents: PropertyDocument[]
  comparables: Comparable[]
  listedAt?: string
  created: Audit
  updated: Audit
  history: HistoryEntry[]
  /** Archived: hidden from the list, matching and new bookings; links and history are kept. Restorable. */
  archived?: Audit & { reason?: string }
  /** Our own properties marked "not similar" for this one's price check. */
  dismissedComparables?: string[]
  /** Where each value came from (✨ AI, 🗺 Google, auto, 📄 file, or typed by the team). Keys as in the assistant: `price`, `spec:bhk`… */
  sources?: Record<string, FactSource>
  /** A draft an executive sent to a manager to approve and publish. Cleared when it's published or sent back. */
  submitted?: Audit
  /** The conversation that built this draft with the AI assistant, so it can be picked up again. */
  assistant?: AssistantThread
  /** Details only this property has ("Compound wall: built on all sides") — not a field of its type. */
  extraDetails?: ExtraDetail[]
  /** Every time the brochure was shared (link, PDF or WhatsApp), newest first. */
  shares?: ShareLog[]
}

/** `public`: shown on the customer brochure (they are internal until someone switches them on). */
export type ExtraDetail = { label: string; value: string; added?: Audit; public?: boolean }

export type ShareLog = { at: string; by: string; channel: 'whatsapp' | 'link' | 'pdf'; leadId?: string }

/** A field the team added for every property of a type (from a "new detail" card). The built-in fields are in the catalogue. */
export type ExtraFact = { type: PropertyTypeKey; key: string; label: string; kind: 'number' | 'text'; added: Audit; fromPropertyId?: string }

export type FactSource = 'ai' | 'google' | 'auto' | 'file' | 'team'

/* ---------- leads (needed for matching and sharing) ---------- */

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'recommended'
  | 'visitScheduled'
  | 'negotiation'
  | 'closed'
  | 'lost'

export type Requirement = {
  type: PropertyTypeKey
  cities: string[]
  localities: string[]
  sizeSqft?: number
  facing?: Facing
  minRoadFt?: number
  corner?: 'any' | 'corner' | 'nonCorner'
  bhk?: string
  bedrooms?: number
  landAreaSqft?: number
  parking?: 'required' | 'preferred' | 'notNeeded'
  possession?: 'any' | 'ready' | 'underConstruction'
  commCategory?: string
  occupancy?: 'any' | 'vacant' | 'tenanted'
  amenities: string[]
  approvalRequired: boolean
}

/** What the budget covers — ask before recommending: ₹30 L may mean the property only, all-in with registration, or with a loan. */
export type BudgetBasis = 'propertyOnly' | 'withCosts' | 'withLoan'
export type Budget = { min: number; preferred: number; max: number; flexPct: number; /** Not set: not clarified yet. */ basis?: BudgetBasis }

export type LeadActivity = {
  id: string
  at: string
  by: string
  type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'visit' | 'note' | 'shared' | 'recommended'
  text: string
  propertyId?: string
  /** Written by the assistant (✨ on the timeline); a person applied it. */
  ai?: boolean
}

export type SiteVisit = {
  id: string
  propertyId: string
  date: string
  time?: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'noShow'
  feedback?: string
  /** How interested the customer was after a completed visit. */
  interest?: 'high' | 'medium' | 'low'
}

export type Lead = {
  id: string
  name: string
  phone: string
  email?: string
  source: string
  enquiryDate: string
  ownerId: string | null
  /** Why they're buying — it changes what to tell them about a property. */
  purpose?: BuyerPurpose
  /** How ready they are to buy — the inputs to the "ready to buy" score (never shown as BANT labels). */
  qualification: {
    need: 'clear' | 'partly' | 'exploring'
    timeline: 'm1' | 'm1to3' | 'm3to6' | 'm6to12' | 'undecided'
    authority: 'sole' | 'joint' | 'needsApproval' | 'unknown'
    funding: 'own' | 'loan' | 'combination'
    fundingReady: 'ready' | 'arranging' | 'undecided'
  }
  engagement: { responded: boolean; docsRequested: boolean; siteVisited: boolean }
  purposeNote?: string
  budget: Budget
  requirement: Requirement
  stage: LeadStage
  stageSince: string
  nextFollowUp?: string
  recommendedPropertyIds: string[]
  visits: SiteVisit[]
  activity: LeadActivity[]
  /** The deal under way: their offer against the asking price, and the seller's counter. */
  negotiation?: { propertyId: string; offered?: number; counter?: number; notes?: string }
  /** A manager's choice of classification; without it the suggested one is used (lib/classification.ts). */
  classification?: Classification
  /** HNI status — recorded only from what the customer chose to share; verified only with their consent. */
  hni?: { status: HniStatus; potential: boolean; /** What they chose to tell us, in their words (never documents). */ signals?: Partial<Record<HniSignal, string>> }
  /** Consent to be followed up (DPDP): when and how it was given; withdrawn stops follow-ups. */
  consent?: { followUp: boolean; at: string; how: string; withdrawnAt?: string }
  /** How they prefer to be contacted. */
  contactPref?: 'call' | 'whatsapp' | 'email'
  /** Why the lead was lost (set with the Lost stage). */
  lost?: { reason: LostReason; note?: string; at: string; by: string }
}

export type LostReason = 'boughtElsewhere' | 'budget' | 'noInventory' | 'notResponding' | 'postponed' | 'loan' | 'other'

/** What kind of customer this is — separate from how ready they are to buy. A high budget never makes someone an HNI. */
export type Classification = 'general' | 'qualifiedBuyer' | 'investor' | 'highValue' | 'potentialHni' | 'verifiedHni'
/** The questions a manager may ask about investment capacity (old wireframe HNI_SIGNALS); answers are as stated. */
export type HniSignal = 'prevInvestment' | 'portfolio' | 'objective' | 'range' | 'fundingReadiness' | 'decisionProcess' | 'timeline'
export type HniStatus = 'notDetermined' | 'notVerified' | 'potential' | 'consentInProgress' | 'verified' | 'declined'

export type BuyerPurpose = 'ownUse' | 'investment' | 'rentalIncome' | 'businessUse' | 'secondHome' | 'other'

/* ---------- settings (master data) ---------- */

export type PlaceCategory = {
  id: string
  name: string
  icon: string
  group: 'commute' | 'schools' | 'health' | 'shop' | 'other'
  /** Everyday places close by: a person must check the route before it is advertised. */
  routeCheck: boolean
  /** Shown on every new property by default. */
  shownByDefault: boolean
}

export type ApprovalType = { id: string; label: string; documentName: string }

export type Settings = {
  matchWeights: { budget: number; location: number; size: number; amenities: number; preferences: number }
  buyerCostsPct: { stampDuty: number; registration: number; other: number }
  stuckDays: number
  placeCategories: PlaceCategory[]
  approvalTypes: ApprovalType[]
  /** Amenities the team added to the list (after the built-in ones). */
  amenities?: string[]
  /** Fields the team added to a property type. */
  extraFacts?: ExtraFact[]
}

export type Database = {
  version: number
  users: User[]
  properties: Property[]
  leads: Lead[]
  settings: Settings
  /** Demo leads added to the seed later that this data already has (data/seed.ts → addMissingSeedLeads). */
  seedAdded?: string[]
}
