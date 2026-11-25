/**
 * The "known facts" catalogue: property types and the facts each type has — the same fields, labels and options as
 * spec-system-wireframe/data.js (PROPERTY_TYPES). In the product this is master data edited in Settings → Property types.
 * Labels carry their unit, as in the current wireframe ("Length (ft)"); screens translate them through i18n keys (`fact.<key>`).
 * Option values are stored data and are shown as stored.
 */
import type { Category, Facing, LeadStage, PropertyStatus, PropertyTypeKey, Purpose, Settings } from './types'

export type FactDef = {
  key: string
  label: string
  kind: 'number' | 'text' | 'select' | 'month'
  options?: string[]
  hint?: string
  /** A rupee amount: shown as ₹1,23,000. */
  money?: boolean
  /** A number shown as typed, without the thousands comma: a year (2025, not 2,025). */
  plain?: boolean
  /** Never shown to customers (Share page, website). */
  internal?: boolean
  /** Added by the team for this type (Settings → extraFacts), not built in. */
  added?: boolean
}

export type PropertyTypeDef = {
  key: PropertyTypeKey
  label: string
  category: Category
  /** What the main area figure measures for this type. */
  areaBasis: 'plotArea' | 'builtUpArea' | 'usableArea' | 'landArea'
  /** The name of the main area figure, e.g. "Plot / land area". */
  areaLabel: string
  purposes: Purpose[]
  /** The two key details required to publish (CTO-approved rule). */
  required: [string, string]
  /** The key details counted in the listing's completion score (15%). */
  core: string[]
  facts: FactDef[]
}

export const PROPERTY_TYPES: Record<PropertyTypeKey, PropertyTypeDef> = {
  plot: {
    key: "plot", label: "Residential plot", category: "residential", areaBasis: "plotArea", areaLabel: "Plot / land area",
    purposes: ["sale","lease"], required: ["length","width"], core: ["length","width","roadWidth","corner"],
    facts: [
      { key: "length", label: "Length (ft)", kind: "number" },
      { key: "width", label: "Width (ft)", kind: "number" },
      { key: "roadWidth", label: "Road width (ft)", kind: "number" },
      { key: "roadAccess", label: "Road access", kind: "select", options: ["Public road","Layout road","Private / pathway access"] },
      { key: "corner", label: "Corner / non-corner", kind: "select", options: ["Non-corner","Corner"] },
      { key: "topography", label: "Topography", kind: "select", options: ["Level","Gentle slope","Elevated","Low-lying"] },
      { key: "surveyNo", label: "Survey number", kind: "text", internal: true },
      { key: "subdivision", label: "Subdivision", kind: "text", internal: true },
      { key: "layoutApproval", label: "Layout approval details", kind: "text", hint: "Authority + approval number as stated on the document", internal: true },
      { key: "landUse", label: "Land-use classification", kind: "select", options: ["Residential","Mixed residential","Commercial","Agricultural (conversion required)"] },
      { key: "water", label: "Water availability", kind: "select", options: ["Municipal supply","Borewell","Municipal + borewell","Not available"] },
      { key: "electricity", label: "Electricity", kind: "select", options: ["Available at site","Line nearby — connection to apply","Not available"] },
      { key: "drainage", label: "Drainage", kind: "select", options: ["Underground drainage","Open drain","Not available"] },
      { key: "roadInfra", label: "Road infrastructure", kind: "select", options: ["Tar road","Concrete road","Gravel road","Mud road"] },
    ],
  },
  flat: {
    key: "flat", label: "Flat / Apartment", category: "residential", areaBasis: "builtUpArea", areaLabel: "Built-up area",
    purposes: ["sale","rent","lease"], required: ["bhk","floor"], core: ["bhk","floor","parking","possession"],
    facts: [
      { key: "bhk", label: "BHK configuration", kind: "select", options: ["1 BHK","2 BHK","3 BHK","4 BHK","4+ BHK"] },
      { key: "carpet", label: "Carpet area (sq.ft.)", kind: "number" },
      { key: "superBuiltup", label: "Super built-up area (sq.ft.)", kind: "number", hint: "If applicable" },
      { key: "floor", label: "Floor number", kind: "number" },
      { key: "totalFloors", label: "Total floors", kind: "number" },
      { key: "lifts", label: "Number of lifts", kind: "number" },
      { key: "parking", label: "Parking allocation", kind: "select", options: ["None","1 covered","2 covered","1 open","Shared"] },
      { key: "uds", label: "UDS — undivided share of land (sq.ft.)", kind: "number" },
      { key: "maintenance", label: "Monthly maintenance (₹)", kind: "number", money: true },
      { key: "possession", label: "Possession status", kind: "select", options: ["Ready to move","Under construction"] },
      { key: "possessionDate", label: "Expected possession", kind: "month" },
    ],
  },
  house: {
    key: "house", label: "Independent house / Villa", category: "residential", areaBasis: "builtUpArea", areaLabel: "Built-up area",
    purposes: ["sale","rent","lease"], required: ["subType","bedrooms"], core: ["subType","bedrooms","bathrooms","parking"],
    facts: [
      { key: "subType", label: "House or villa", kind: "select", options: ["Independent house","Villa (gated community)","Row house"] },
      { key: "landArea", label: "Land area (sq.ft.)", kind: "number" },
      { key: "floors", label: "Number of floors", kind: "number" },
      { key: "bedrooms", label: "Bedrooms", kind: "number" },
      { key: "bathrooms", label: "Bathrooms", kind: "number" },
      { key: "parking", label: "Parking", kind: "select", options: ["None","1 car","2 cars","3+ cars"] },
      { key: "constructionYear", label: "Construction year", kind: "number", plain: true },
      { key: "quality", label: "Construction quality", kind: "select", options: ["Premium","Standard","Basic"] },
      { key: "condition", label: "Condition", kind: "select", options: ["New","Good","Needs minor repair","Needs major repair"] },
      { key: "garden", label: "Private garden / amenities", kind: "text" },
      { key: "water", label: "Water arrangement", kind: "select", options: ["Municipal supply","Borewell","Municipal + borewell","Tanker dependent"] },
      { key: "power", label: "Power arrangement", kind: "select", options: ["EB connection","EB + inverter","EB + generator backup","EB + solar"] },
      { key: "approvalDocs", label: "Approval & completion documentation", kind: "select", options: ["Approval + completion available","Approval only","Not available"] },
    ],
  },
  commercial: {
    key: "commercial", label: "Office / shop / warehouse", category: "commercial", areaBasis: "usableArea", areaLabel: "Carpet / usable area",
    purposes: ["sale","rent","lease"], required: ["commCategory","occupancy"], core: ["commCategory","floor","occupancy"],
    facts: [
      { key: "commCategory", label: "Commercial category", kind: "select", options: ["Office space","Shop / Showroom","Warehouse / Godown","Commercial building","Industrial shed"] },
      { key: "floor", label: "Floor", kind: "text" },
      { key: "frontage", label: "Frontage (ft)", kind: "number" },
      { key: "roadWidth", label: "Road access — width (ft)", kind: "number" },
      { key: "parking", label: "Parking", kind: "select", options: ["None","Street parking","Dedicated 1–5","Dedicated 5+"] },
      { key: "permittedUsage", label: "Permitted usage", kind: "text" },
      { key: "occupancy", label: "Occupancy status", kind: "select", options: ["Vacant","Tenanted","Owner-occupied"] },
      { key: "rentalIncome", label: "Rental income (₹ / month)", kind: "number", hint: "If tenanted", money: true },
      { key: "leaseDuration", label: "Lease duration", kind: "text" },
      { key: "leaseTerms", label: "Lease terms", kind: "text" },
      { key: "maintenance", label: "Maintenance (₹ / month)", kind: "number", money: true },
      { key: "opex", label: "Operating expenses (₹ / year)", kind: "number", money: true },
    ],
  },
  agri: {
    key: "agri", label: "Agricultural land", category: "commercial", areaBasis: "landArea", areaLabel: "Land area",
    purposes: ["sale","lease"], required: ["acres","waterSource"], core: ["acres","waterSource","roadAccess"],
    facts: [
      { key: "acres", label: "Land area (acres)", kind: "number" },
      { key: "soil", label: "Soil type", kind: "select", options: ["Red soil","Black soil","Alluvial","Sandy","Mixed"] },
      { key: "waterSource", label: "Water source", kind: "select", options: ["Borewell","Open well","Canal","River / channel","Rain-fed only"] },
      { key: "crops", label: "Current crops / trees", kind: "text" },
      { key: "roadAccess", label: "Road access", kind: "select", options: ["Tar road","Gravel road","Mud road / cart track","No direct road"] },
      { key: "electricity", label: "EB connection", kind: "select", options: ["Three-phase","Single-phase","Not available"] },
      { key: "fencing", label: "Fencing", kind: "select", options: ["Fully fenced","Partly fenced","Not fenced"] },
      { key: "surveyNo", label: "Survey number", kind: "text", internal: true },
    ],
  },
  industrial: {
    key: "industrial", label: "Industrial land / shed", category: "commercial", areaBasis: "plotArea", areaLabel: "Plot / shed area",
    purposes: ["sale","lease"], required: ["subType","powerKva"], core: ["subType","powerKva","roadWidth"],
    facts: [
      { key: "subType", label: "Industrial type", kind: "select", options: ["Industrial plot","Factory / shed","Industrial building"] },
      { key: "shedArea", label: "Built-up shed area (sq.ft.)", kind: "number" },
      { key: "powerKva", label: "Power load (kVA)", kind: "number" },
      { key: "clearHeight", label: "Clear height (ft)", kind: "number" },
      { key: "estate", label: "Industrial estate / zone", kind: "text", hint: "e.g. SIPCOT, SIDCO" },
      { key: "roadWidth", label: "Road width (ft)", kind: "number" },
      { key: "truckAccess", label: "Truck access", kind: "select", options: ["Container trucks","Small trucks only","No truck access"] },
      { key: "water", label: "Water supply", kind: "select", options: ["Municipal supply","Borewell","Industrial supply","Not available"] },
    ],
  },
}

export const TYPE_ORDER: PropertyTypeKey[] = ['plot', 'flat', 'house', 'commercial', 'agri', 'industrial']

/** Required to publish, for every type (plus the type's two key details). */
export const REQUIRED_CORE = ['title', 'purpose', 'type', 'city', 'locality', 'price', 'area'] as const

export const STATUS_ORDER: PropertyStatus[] = ['draft', 'available', 'negotiation', 'reserved', 'onHold', 'booked', 'sold']
/** Statuses an executive can see: anything listed. */
export const LISTED_STATUSES: PropertyStatus[] = ['available', 'negotiation', 'reserved', 'onHold', 'booked', 'sold']
export const PURPOSES: Purpose[] = ['sale', 'rent', 'lease']
export const FACINGS: Facing[] = ['E', 'N', 'W', 'S', 'NE', 'NW', 'SE', 'SW']

export const STAGE_ORDER: LeadStage[] = ['new', 'contacted', 'qualified', 'recommended', 'visitScheduled', 'negotiation', 'closed']

export const CITIES: Record<string, string[]> = {
  Madurai: ['Vilangudi', 'K.K. Nagar', 'Anna Nagar', 'Thiruparankundram', 'Ponmeni', 'Othakadai', 'Kappalur', 'Thirunagar'],
  Chennai: ['Sholinganallur (OMR)', 'Velachery', 'Porur', 'Tambaram'],
  Coimbatore: ['Peelamedu', 'Vadavalli', 'Saravanampatti'],
  Tiruchirappalli: ['Thillai Nagar', 'K.K. Nagar (Trichy)', 'Srirangam'],
  Salem: ['Fairlands', 'Hasthampatti', 'Alagapuram'],
}

export const AMENITIES = [
  'Gated community', 'Security', 'Park / open space', 'Power backup', 'Lift', 'Gym', 'Swimming pool', 'Clubhouse',
  'Rainwater harvesting', 'CCTV', 'Visitor parking', 'Loading bay',
]

/** Every amenity on the list: the built-in ones, then the ones the team added. */
export const amenityList = (s: Settings): string[] => [...AMENITIES, ...(s.amenities ?? []).filter((a) => !AMENITIES.includes(a))]

/** A type's fields: the built-in ones, then the ones the team added for it. */
export const typeFacts = (type: PropertyTypeKey, s: Settings): FactDef[] => [
  ...PROPERTY_TYPES[type].facts,
  ...(s.extraFacts ?? []).filter((f) => f.type === type).map((f) => ({ key: f.key, label: f.label, kind: f.kind, added: true })),
]

/** The one document suggested on the Legal tab: the EC. Any other document can be uploaded by name when the team wants. */
export const DOC_KINDS = ['ec'] as const
export const USUAL_DOCS: Record<PropertyTypeKey, string[]> = {
  plot: ['ec'], flat: ['ec'], house: ['ec'], commercial: ['ec'], agri: ['ec'], industrial: ['ec'],
}
