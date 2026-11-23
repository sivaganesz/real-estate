/**
 * Data shapes for wireframe v3, written the way the MongoDB collections will be:
 * stable ids, references by id (never copied text), and who / when on every change.
 * Reused from the old wireframe (spec-system-wireframe/data.js), reshaped and typed.
 */

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
}

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

export type Budget = { min: number; preferred: number; max: number; flexPct: number }

export type LeadActivity = {
  id: string
  at: string
  by: string
  type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'visit' | 'note' | 'shared'
  text: string
  propertyId?: string
}

export type SiteVisit = {
  id: string
  propertyId: string
  date: string
  time?: string
  status: 'scheduled' | 'completed' | 'cancelled' | 'noShow'
  feedback?: string
}

export type Lead = {
  id: string
  name: string
  phone: string
  email?: string
  source: string
  enquiryDate: string
  ownerId: string | null
  purposeNote?: string
  budget: Budget
  requirement: Requirement
  stage: LeadStage
  stageSince: string
  nextFollowUp?: string
  recommendedPropertyIds: string[]
  visits: SiteVisit[]
  activity: LeadActivity[]
}

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
}

export type Database = {
  version: number
  users: User[]
  properties: Property[]
  leads: Lead[]
  settings: Settings
}
