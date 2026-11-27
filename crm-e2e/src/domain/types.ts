/**
 * All entity types for crm-e2e, complete up front (foundation-plan §2.1).
 * Modules never edit this file: a new field goes through notes/requests-<module>.md.
 * Derived values (score, temperature unless overridden, priority, next follow-up, days in stage, stalled) are never stored.
 */

// ── primitives
export type ID = string
export type ISODate = string        // 'YYYY-MM-DD', local calendar day (build with lib/dates, never toISOString().slice)
export type ISODateTime = string    // full ISO from Date#toISOString()
export type Money = number          // whole rupees
export type Role = 'admin' | 'manager' | 'executive'
export type EntityKind = 'lead' | 'client' | 'property' | 'appointment' | 'task' | 'user' | 'importJob' | 'draft' | 'settings'
export type EntityRef = { kind: EntityKind; id: ID }
export type ActorId = ID | 'system'
export type Origin = 'manual' | 'ai' | 'import' | 'automation'
export type FieldMeta = { origin: Origin; confidence?: number /* 0–1 */ }
export type FieldMetaMap = Record<string, FieldMeta>          // keyed by field path, e.g. 'requirement.budgetMax'

// ── users
export type Availability = 'available' | 'inVisit' | 'onLeave'
export type UserStatus = 'active' | 'deactivated'
export type MonthlyTargets = { calls: number; siteVisits: number; bookings: number; revenue: Money }
export interface User {
  id: ID; name: string; role: Role; email: string; phone: string
  managerId?: ID                      // executives → their manager
  status: UserStatus; availability: Availability; leaveUntil?: ISODate
  languages: string[]                 // 'English' | 'Hindi' | 'Tamil' | 'Kannada' | 'Telugu' | 'Marathi' …
  cities: string[]; propertyFocus: PropertyCategory[]
  targets?: MonthlyTargets
  joinedAt: ISODate; deactivatedAt?: ISODateTime
}

// ── catalogue keys (labels in i18n 'catalogue' ns)
export type LeadSource = 'phone' | 'whatsapp' | 'website' | 'walkIn' | 'acres99' | 'magicbricks' | 'housing' | 'nobroker'
  | 'facebook' | 'instagram' | 'googleAds' | 'channelPartner' | 'referral' | 'manual' | 'other'
export type PipelineStageKey = 'new' | 'contacted' | 'qualified' | 'siteVisitScheduled' | 'siteVisitDone'
  | 'negotiation' | 'booked' | 'converted' | 'lost'
export type Temperature = 'hot' | 'warm' | 'cold'
export type Priority = 'high' | 'medium' | 'low'
export type LostReason = 'budgetMismatch' | 'boughtElsewhere' | 'notResponding' | 'location' | 'loanRejected' | 'other'
export type BuyerPurpose = 'selfUse' | 'investment' | 'rental' | 'business'
export type LoanStatus = 'notNeeded' | 'needed' | 'preApproved' | 'unknown'
export type Timeline = 'immediate' | 'm1to3' | 'm3to6' | 'm6to12' | 'exploring'
export type DecisionMaker = 'self' | 'spouse' | 'parents' | 'family' | 'partner' | 'company'
export type Authority = 'sole' | 'joint' | 'needsApproval'
export type Need = 'clear' | 'partly' | 'exploring'
export type PossessionPref = 'ready' | 'underConstruction' | 'any'
export type Furnishing = 'unfurnished' | 'semi' | 'full'
export type Facing = 'N' | 'E' | 'S' | 'W' | 'NE' | 'NW' | 'SE' | 'SW'
export type Configuration = '1RK' | '1BHK' | '2BHK' | '2.5BHK' | '3BHK' | '4BHK+'
export type PropertyType = 'apartment' | 'villa' | 'independentHouse' | 'rowHouse' | 'plot' | 'agriLand'
  | 'office' | 'shop' | 'showroom' | 'warehouse' | 'coworking'
export type PropertyFamily = 'flat' | 'house' | 'plot' | 'land' | 'commercial' | 'warehouse'  // drives the dynamic form
export type PropertyCategory = 'residential' | 'commercial' | 'land'
export type PropertyStatus = 'available' | 'onHold' | 'booked' | 'sold'
export type ListingState = 'draft' | 'live' | 'archived'
export type AreaUnit = 'sqft' | 'sqyd' | 'cents' | 'acres' | 'guntha'
export type Classification = 'general' | 'qualifiedBuyer' | 'investor' | 'highValue' | 'potentialHni' | 'verifiedHni'

// ── leads
export interface Requirement {
  propertyTypes: PropertyType[]; configurations: Configuration[]
  cities: string[]; localities: string[]
  budgetMin?: Money; budgetPreferred?: Money; budgetMax?: Money; budgetFlexPct: number   // default 10
  budgetBasis?: 'propertyOnly' | 'allIn' | 'withLoan'
  areaMinSqft?: number; areaMaxSqft?: number
  possession: PossessionPref; possessionBy?: ISODate
  furnishing?: Furnishing | 'any'; facing: Facing[]; vastu?: boolean
  parking?: 'required' | 'preferred' | 'notNeeded'; floorPref?: 'low' | 'mid' | 'high' | 'any'
  transaction?: 'newBooking' | 'resale' | 'any'
  amenities: string[]; mustHaves: string[]          // must-haves: free text ("covered parking", "near metro")
  purpose: 'sale' | 'rent' | 'lease'
}
export interface Qualification {                     // Budget/Authority/Need/Timeline internally; never labelled "BANT"
  need?: Need; timeline?: Timeline; authority?: Authority; decisionMakers: DecisionMaker[]
  buyerPurpose?: BuyerPurpose; loan: LoanStatus; fundingReady?: 'ready' | 'arranging' | 'undecided'
}
export type ShortlistStatus = 'suggested' | 'shortlisted' | 'shared' | 'visited' | 'liked' | 'notInterested'
export interface ShortlistItem { propertyId: ID; status: ShortlistStatus; at: ISODateTime; by: ActorId; note?: string }
export interface StageEntry { stage: PipelineStageKey; at: ISODateTime; by: ActorId }
export interface Deal { propertyId?: ID; value?: Money; offered?: Money; counter?: Money; bookingAmount?: Money; bookedAt?: ISODateTime; notes?: string }
export interface Lead {
  id: ID                                  // 'LEAD-1001' (also the display code)
  name: string; phone: string             // E.164 '+919845012345'; display via lib/phone
  altPhone?: string; email?: string
  source: LeadSource; sourceDetail?: string           // campaign, CP firm, referrer
  isNri: boolean; nriCountry?: string; preferredLanguage?: string
  contactPref?: 'call' | 'whatsapp' | 'email'; familySize?: number
  ownerId: ID | null; firstOwnerId?: ID              // first owner never changes (attribution)
  createdBy: ActorId; createdAt: ISODateTime; updatedAt: ISODateTime; createdVia: Origin
  stage: PipelineStageKey; stageSince: ISODateTime; stageHistory: StageEntry[]
  temperatureOverride?: Temperature; priorityOverride?: Priority
  requirement: Requirement; qualification: Qualification
  engagement: { responded: boolean; docsRequested: boolean; siteVisited: boolean }
  firstContactAt?: ISODateTime; lastContactAt?: ISODateTime
  shortlist: ShortlistItem[]; deal?: Deal
  lost?: { reason: LostReason; note?: string; at: ISODateTime; by: ActorId }
  classification?: Classification                   // manager override; else suggested (lib/classification)
  hni?: { status: 'notDetermined' | 'potential' | 'consentInProgress' | 'verified' | 'declined'; signals?: Record<string, string> }
  consent?: { followUp: boolean; at: ISODateTime; how: string; withdrawnAt?: ISODateTime }
  tags: string[]; clientId?: ID; importJobId?: ID
  fieldMeta?: FieldMetaMap                           // AI-filled / imported markers
}
// Not stored, always derived: score, temperature (unless override), priority, nextFollowUp (earliest open task), daysInStage, stalled.

// ── clients (created when a lead is Booked)
export interface Client {
  id: ID; leadId: ID; name: string; phone: string; email?: string; ownerId: ID; city?: string
  propertyId?: ID; dealValue?: Money; bookingAmount?: Money; bookedAt: ISODateTime
  status: 'booked' | 'agreement' | 'loanProcessing' | 'registered' | 'converted' | 'cancelled'
  loan?: { bank?: string; status: 'notApplied' | 'applied' | 'sanctioned' | 'disbursed'; amount?: Money }
  kyc: 'pending' | 'done'; documents: { name: string; status: 'pending' | 'received' | 'verified' }[]
  createdAt: ISODateTime; updatedAt: ISODateTime; notes?: string
}

// ── properties
export interface PropertyArea { carpet?: number; builtUp?: number; superBuiltUp?: number; plot?: number; plotUnit?: AreaUnit; plotLengthFt?: number; plotWidthFt?: number }
export interface Media { id: ID; kind: 'photo' | 'floorPlan' | 'brochure'; url: string /* /demo-photos/x.jpg or data: URL */; caption?: string; isCover?: boolean }
export interface Property {
  id: ID                                  // 'PRP-1001'
  title: string; description?: string
  type: PropertyType; category: PropertyCategory          // category derived from type at write time
  purpose: 'sale' | 'rent' | 'lease'; transaction: 'newBooking' | 'resale'
  configuration?: Configuration; projectName?: string; builderName?: string
  location: { city: string; locality: string; address?: string; landmark?: string; pincode?: string; lat?: number; lng?: number }
  price: Money; priceNegotiable?: boolean; maintenancePerMonth?: Money
  area: PropertyArea                       // primary sqft via lib/property.primaryAreaSqft()
  bedrooms?: number; bathrooms?: number; balconies?: number; floor?: number; totalFloors?: number
  facing?: Facing; vastuCompliant?: boolean; corner?: boolean
  parking: { covered: number; open: number }; furnishing?: Furnishing; gatedCommunity?: boolean
  amenities: string[]
  possession: { status: 'ready' | 'underConstruction'; date?: ISODate }
  rera?: { number: string; verified: boolean }
  approvals: { authority: string; docStatus: 'pending' | 'uploaded' | 'verified' }[]
  khata?: 'A' | 'B' | 'E'; pattaAvailable?: boolean
  bankApprovals: string[]; loanEligible?: boolean; roadWidthFt?: number
  specs: Record<string, string | number | boolean>    // family-specific extras from catalogue (washrooms, powerKva, dockDoors, soil…)
  status: PropertyStatus; listing: ListingState; heldUntil?: ISODateTime; heldForLeadId?: ID
  media: Media[]
  owner?: { name: string; phone: string; kind: 'builder' | 'owner' | 'channelPartner' }
  commissionPct?: number
  createdBy: ActorId; createdAt: ISODateTime; updatedAt: ISODateTime; listedAt?: ISODateTime
  importJobId?: ID; fieldMeta?: FieldMetaMap
}

// ── appointments
export type AppointmentType = 'siteVisit' | 'officeMeeting' | 'phoneCall' | 'videoCall' | 'documentation'
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'noShow' | 'cancelled' | 'rescheduled'
export interface VisitOutcome {
  result: 'interested' | 'thinking' | 'notInterested' | 'readyToBook'
  interest?: 'high' | 'medium' | 'low'; likedPropertyIds: ID[]; objections?: string
  decisionMakerPresent?: boolean; nextStep?: string; nextFollowUpAt?: ISODateTime; summary?: string
  at: ISODateTime; by: ActorId
}
export interface Appointment {
  id: ID; type: AppointmentType; status: AppointmentStatus
  leadId?: ID; clientId?: ID; propertyIds: ID[]; ownerId: ID
  start: ISODateTime; durationMin: number
  location?: { text: string; mapUrl?: string }        // site visit defaults to the property address + Google Maps search URL
  reminderMins: number                                // default 60
  notes?: string; outcome?: VisitOutcome; rescheduledFrom?: ISODateTime; cancelReason?: string
  createdBy: ActorId; createdAt: ISODateTime; updatedAt: ISODateTime; fieldMeta?: FieldMetaMap
}

// ── tasks / follow-ups
export type TaskType = 'call' | 'whatsapp' | 'followUp' | 'email' | 'meeting' | 'document' | 'other'
export type TaskStatus = 'open' | 'done' | 'cancelled'
export type AutoTaskReason = 'slaFirstCall' | 'postVisitCall' | 'noAnswerRetry' | 'noShowReschedule' | 'visitCancelledReschedule' | 'bookingDocs'
export interface Task {
  id: ID; title: string; type: TaskType; status: TaskStatus; priority: Priority
  leadId?: ID; clientId?: ID; appointmentId?: ID; ownerId: ID
  dueAt: ISODateTime; completedAt?: ISODateTime; outcome?: string
  callResult?: 'connected' | 'notReachable' | 'busy' | 'wrongNumber'
  createdBy: ActorId; createdAt: ISODateTime; origin: Origin; autoReason?: AutoTaskReason; notes?: string
}

// ── activity (one global log; timelines filter by ref)
export type ActivityKind =
  | 'lead.created' | 'lead.updated' | 'lead.stageChanged' | 'lead.assigned' | 'lead.reassigned' | 'lead.deleted' | 'lead.qualified' | 'lead.merged'
  | 'comm.call' | 'comm.whatsapp' | 'comm.email' | 'comm.sms' | 'note'
  | 'appointment.created' | 'appointment.rescheduled' | 'appointment.completed' | 'appointment.cancelled' | 'appointment.noShow'
  | 'task.created' | 'task.completed' | 'task.cancelled'
  | 'property.created' | 'property.updated' | 'property.statusChanged' | 'property.deleted' | 'property.shared' | 'property.shortlisted'
  | 'client.created' | 'client.updated' | 'import.completed' | 'draft.saved'
  | 'user.created' | 'user.updated' | 'user.deactivated' | 'user.activated' | 'user.availability' | 'settings.changed'
export interface Activity {
  id: ID; kind: ActivityKind; at: ISODateTime; actorId: ActorId
  refs: EntityRef[]                       // primary record first; a lead's timeline = activities with a ref to it
  params: Record<string, string | number | boolean | null>   // rendered by i18n 'activity' ns: t(`activity:${kind}`, params)
  text?: string                           // user-typed note/outcome (never translated)
  via: Origin                             // 'ai' entries show ✦ on timelines
}

// ── notifications
export type NotificationKind = 'assignment' | 'reassignment' | 'appointmentCreated' | 'appointmentReminder' | 'taskOverdue'
  | 'slaBreach' | 'escalation' | 'importFinished' | 'stageChanged' | 'booking' | 'propertyUnavailable'
  | 'leaveReassign' | 'stalledDeal' | 'deactivatedOwner' | 'duplicateFound' | 'system'
export interface Notification {
  id: ID; userId: ID; kind: NotificationKind; at: ISODateTime
  params: Record<string, string | number>; ref?: EntityRef
  priority: 'normal' | 'high'; readAt?: ISODateTime; dedupeKey?: string
}

// ── assignment history (append-only)
export type AssignmentMode = 'auto' | 'manual' | 'self' | 'import' | 'redistribution'
export type AssignmentReasonKey = 'lowestWorkload' | 'roundRobinTie' | 'ruleLocation' | 'rulePropertyType' | 'ruleLanguage'
  | 'ruleSource' | 'manual' | 'creatorOwns' | 'ownerDeactivated' | 'ownerOnLeave' | 'unassigned'
export interface Assignment {
  id: ID; leadId: ID; fromUserId: ID | null; toUserId: ID | null; at: ISODateTime; by: ActorId
  mode: AssignmentMode; reason: { key: AssignmentReasonKey; params?: Record<string, string | number> }
  workload?: Record<ID, number>           // snapshot of active-lead counts used for the decision
  note?: string
}

// ── import
export type ImportKind = 'leads' | 'apartments' | 'villas' | 'plots' | 'commercial' | 'document'
export interface ColumnMapping { column: string; field: string | null; confidence: number; method: 'template' | 'saved' | 'synonym' | 'fuzzy' | 'value' | 'manual' }
export interface MappingProfile { id: ID; name: string; kind: ImportKind; columns: Record<string, string>; createdBy: ID; createdAt: ISODateTime }
export interface ImportJob {
  id: ID; kind: ImportKind; fileName: string; fileType: 'xlsx' | 'csv' | 'pdf' | 'image' | 'text'
  template: 'default' | 'custom' | 'document'; createdBy: ID; createdAt: ISODateTime; finishedAt?: ISODateTime
  status: 'completed' | 'partial' | 'failed' | 'cancelled'
  mapping?: ColumnMapping[]; mappingProfileId?: ID
  counts: { total: number; imported: number; updated: number; skipped: number; duplicates: number; errors: number; drafts: number }
  createdIds: ID[]; draftIds: ID[]; errorRows: { row: number; messages: string[] }[]
}
// (A job in progress lives in the Import page's local state; only finished jobs are stored.)

// ── drafts (low-confidence or unfinished AI/import extractions)
export interface Draft {
  id: ID; kind: 'lead' | 'property' | 'appointment'; title: string
  payload: Record<string, unknown>        // partial LeadInput / PropertyInput / AppointmentInput
  fieldMeta: FieldMetaMap                 // confidence per field → low ones highlighted
  source: { type: 'paste' | 'voice' | 'pdf' | 'image' | 'import' | 'assistant'; fileName?: string; text?: string }
  createdBy: ID; createdAt: ISODateTime; updatedAt: ISODateTime
  status: 'open' | 'saved' | 'discarded'; savedAs?: EntityRef; importJobId?: ID
}

// ── settings
export interface PipelineStageDef { key: PipelineStageKey; order: number; enabled: boolean; targetDays: number; probability: number /* 0–1 */; label?: string /* admin rename (Settings → Pipeline); shown as typed, else catalogue:stage.<key> */ }
export interface AssignmentRule {
  id: ID; kind: 'location' | 'propertyType' | 'language' | 'source'; values: string[]; userIds: ID[]; enabled: boolean
  scope: 'global' | { managerId: ID }
}
export type MessagePurpose = 'intro' | 'followUp' | 'visitConfirm' | 'postVisit' | 'offer' | 'share' | 'reminder'
export interface MessageTemplate { id: ID; purpose: MessagePurpose; channel: 'whatsapp' | 'sms' | 'email'; tone: 'english' | 'hinglish'; body: string /* {{firstName}} {{property}} {{time}} {{agent}} */ }
export interface Settings {
  assignment: { autoAssign: boolean; rules: AssignmentRule[]; rrCursor: ID | null; maxActivePerExec?: number }
  pipeline: { stages: PipelineStageDef[]; lostReasons: LostReason[] }
  sla: { firstResponseMins: number; escalateAfterMins: number; staleDays: number; hotNoContactDays: number }
  matching: { weights: { budget: number; location: number; size: number; amenities: number; preferences: number }; minScore: number; perProjectCap: number }
  scoring: { hotAt: number; warmAt: number }
  templates: MessageTemplate[]
  costs: { stampDutyPct: number; registrationPct: number; otherPct: number }
  extraAmenities: string[]; mappingProfiles: MappingProfile[]
}
export interface SavedView { id: ID; userId: ID; module: 'leads' | 'properties' | 'appointments' | 'tasks' | 'pipeline'; name: string; filters: Record<string, unknown>; sort?: { key: string; dir: 'asc' | 'desc' } }

// ── the database
export interface DB {
  meta: { schemaVersion: number; anchorDate: ISODate; seededAt: ISODateTime; counters: Record<string, number> }
  users: User[]; leads: Lead[]; clients: Client[]; properties: Property[]; appointments: Appointment[]
  tasks: Task[]; activities: Activity[]; notifications: Notification[]; assignments: Assignment[]
  importJobs: ImportJob[]; drafts: Draft[]; savedViews: SavedView[]; settings: Settings
}

// ── service input shapes (forms, AI extraction and import all produce these)
export type LeadInput = Omit<Lead, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'stageSince' | 'stageHistory' | 'shortlist' | 'engagement' | 'firstOwnerId' | 'createdVia' | 'tags' | 'stage'> & Partial<Pick<Lead, 'stage' | 'tags'>>
export type PropertyInput = Omit<Property, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'category'>
export type AppointmentInput = Omit<Appointment, 'id' | 'status' | 'createdBy' | 'createdAt' | 'updatedAt' | 'outcome'> & { status?: AppointmentStatus }
export type TaskInput = Omit<Task, 'id' | 'status' | 'createdBy' | 'createdAt' | 'completedAt'>
