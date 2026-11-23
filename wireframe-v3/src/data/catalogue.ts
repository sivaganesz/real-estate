/**
 * The "known facts" catalogue: property types and the facts each type has.
 * In the product this is master data edited in Settings → Property types; here it is the seed.
 * Labels are English defaults — screens translate them through i18n keys (`fact.<key>`), falling back to these.
 * Option values are stored data and are shown as stored.
 */
import type { Category, Facing, LeadStage, PropertyStatus, PropertyTypeKey, Purpose } from './types'

export type FactDef = {
  key: string
  label: string
  kind: 'number' | 'text' | 'select' | 'month'
  unit?: string
  options?: string[]
  /** Never shown to customers (Share page, website). */
  internal?: boolean
}

export type PropertyTypeDef = {
  key: PropertyTypeKey
  label: string
  category: Category
  /** What the main area figure measures for this type. */
  areaBasis: 'plotArea' | 'builtUpArea' | 'usableArea' | 'landArea'
  purposes: Purpose[]
  /** The two key details required to publish (CTO-approved rule). */
  required: [string, string]
  facts: FactDef[]
}

export const PROPERTY_TYPES: Record<PropertyTypeKey, PropertyTypeDef> = {
  plot: {
    key: 'plot', label: 'Residential plot', category: 'residential', areaBasis: 'plotArea', purposes: ['sale', 'lease'],
    required: ['length', 'width'],
    facts: [
      { key: 'length', label: 'Length', kind: 'number', unit: 'ft' },
      { key: 'width', label: 'Width', kind: 'number', unit: 'ft' },
      { key: 'roadWidth', label: 'Road width', kind: 'number', unit: 'ft' },
      { key: 'roadAccess', label: 'Road access', kind: 'select', options: ['Public road', 'Layout road', 'Private / pathway access'] },
      { key: 'corner', label: 'Corner plot', kind: 'select', options: ['Non-corner', 'Corner'] },
      { key: 'topography', label: 'Topography', kind: 'select', options: ['Level', 'Gentle slope', 'Elevated', 'Low-lying'] },
      { key: 'landUse', label: 'Land use', kind: 'select', options: ['Residential', 'Mixed residential', 'Commercial', 'Agricultural (conversion required)'] },
      { key: 'water', label: 'Water', kind: 'select', options: ['Municipal supply', 'Borewell', 'Municipal + borewell', 'Not available'] },
      { key: 'electricity', label: 'Electricity', kind: 'select', options: ['Available at site', 'Line nearby — connection to apply', 'Not available'] },
      { key: 'drainage', label: 'Drainage', kind: 'select', options: ['Underground drainage', 'Open drain', 'Not available'] },
      { key: 'roadInfra', label: 'Road surface', kind: 'select', options: ['Tar road', 'Concrete road', 'Gravel road', 'Mud road'] },
      { key: 'surveyNo', label: 'Survey number', kind: 'text', internal: true },
      { key: 'subdivision', label: 'Subdivision', kind: 'text', internal: true },
    ],
  },
  flat: {
    key: 'flat', label: 'Flat / apartment', category: 'residential', areaBasis: 'builtUpArea', purposes: ['sale', 'rent', 'lease'],
    required: ['bhk', 'floor'],
    facts: [
      { key: 'bhk', label: 'BHK', kind: 'select', options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK'] },
      { key: 'floor', label: 'Floor', kind: 'number' },
      { key: 'totalFloors', label: 'Total floors', kind: 'number' },
      { key: 'carpet', label: 'Carpet area', kind: 'number', unit: 'sq.ft.' },
      { key: 'superBuiltup', label: 'Super built-up area', kind: 'number', unit: 'sq.ft.' },
      { key: 'lifts', label: 'Lifts', kind: 'number' },
      { key: 'parking', label: 'Parking', kind: 'select', options: ['None', '1 covered', '2 covered', '1 open', 'Shared'] },
      { key: 'uds', label: 'UDS (share of land)', kind: 'number', unit: 'sq.ft.' },
      { key: 'maintenance', label: 'Maintenance', kind: 'number', unit: '₹/month' },
      { key: 'possession', label: 'Possession', kind: 'select', options: ['Ready to move', 'Under construction'] },
      { key: 'possessionDate', label: 'Expected possession', kind: 'month' },
    ],
  },
  house: {
    key: 'house', label: 'House / villa', category: 'residential', areaBasis: 'builtUpArea', purposes: ['sale', 'rent', 'lease'],
    required: ['subType', 'bedrooms'],
    facts: [
      { key: 'subType', label: 'House or villa', kind: 'select', options: ['Independent house', 'Villa (gated community)', 'Row house'] },
      { key: 'bedrooms', label: 'Bedrooms', kind: 'number' },
      { key: 'bathrooms', label: 'Bathrooms', kind: 'number' },
      { key: 'landArea', label: 'Land area', kind: 'number', unit: 'sq.ft.' },
      { key: 'floors', label: 'Floors', kind: 'number' },
      { key: 'parking', label: 'Parking', kind: 'select', options: ['None', '1 car', '2 cars', '3+ cars'] },
      { key: 'constructionYear', label: 'Built in', kind: 'number' },
      { key: 'condition', label: 'Condition', kind: 'select', options: ['New', 'Good', 'Needs minor repair', 'Needs major repair'] },
      { key: 'garden', label: 'Garden', kind: 'text' },
      { key: 'water', label: 'Water', kind: 'select', options: ['Municipal supply', 'Borewell', 'Municipal + borewell', 'Tanker dependent'] },
      { key: 'power', label: 'Power', kind: 'select', options: ['EB connection', 'EB + inverter', 'EB + generator backup', 'EB + solar'] },
    ],
  },
  commercial: {
    key: 'commercial', label: 'Office / shop / warehouse', category: 'commercial', areaBasis: 'usableArea', purposes: ['sale', 'rent', 'lease'],
    required: ['commCategory', 'occupancy'],
    facts: [
      { key: 'commCategory', label: 'Category', kind: 'select', options: ['Office space', 'Shop / Showroom', 'Warehouse / Godown', 'Commercial building', 'Industrial shed'] },
      { key: 'occupancy', label: 'Occupancy', kind: 'select', options: ['Vacant', 'Tenanted', 'Owner-occupied'] },
      { key: 'floor', label: 'Floor', kind: 'text' },
      { key: 'frontage', label: 'Frontage', kind: 'number', unit: 'ft' },
      { key: 'roadWidth', label: 'Road width', kind: 'number', unit: 'ft' },
      { key: 'parking', label: 'Parking', kind: 'select', options: ['None', 'Street parking', 'Dedicated 1–5', 'Dedicated 5+'] },
      { key: 'permittedUsage', label: 'Permitted use', kind: 'text' },
      { key: 'rentalIncome', label: 'Rental income', kind: 'number', unit: '₹/month' },
      { key: 'leaseDuration', label: 'Lease duration', kind: 'text' },
      { key: 'maintenance', label: 'Maintenance', kind: 'number', unit: '₹/month' },
    ],
  },
  agri: {
    key: 'agri', label: 'Agricultural land', category: 'commercial', areaBasis: 'landArea', purposes: ['sale', 'lease'],
    required: ['acres', 'waterSource'],
    facts: [
      { key: 'acres', label: 'Acres', kind: 'number' },
      { key: 'waterSource', label: 'Water source', kind: 'select', options: ['Borewell', 'Open well', 'Canal', 'River / channel', 'Rain-fed only'] },
      { key: 'soil', label: 'Soil', kind: 'select', options: ['Red soil', 'Black soil', 'Alluvial', 'Sandy', 'Mixed'] },
      { key: 'crops', label: 'Crops / trees', kind: 'text' },
      { key: 'electricity', label: 'EB connection', kind: 'select', options: ['Three-phase', 'Single-phase', 'Not available'] },
      { key: 'fencing', label: 'Fencing', kind: 'select', options: ['Fully fenced', 'Partly fenced', 'Not fenced'] },
    ],
  },
  industrial: {
    key: 'industrial', label: 'Industrial land / shed', category: 'commercial', areaBasis: 'plotArea', purposes: ['sale', 'lease'],
    required: ['subType', 'powerKva'],
    facts: [
      { key: 'subType', label: 'Industrial type', kind: 'select', options: ['Industrial plot', 'Factory / shed', 'Industrial building'] },
      { key: 'powerKva', label: 'Power load', kind: 'number', unit: 'kVA' },
      { key: 'shedArea', label: 'Shed area', kind: 'number', unit: 'sq.ft.' },
      { key: 'clearHeight', label: 'Clear height', kind: 'number', unit: 'ft' },
      { key: 'estate', label: 'Industrial estate', kind: 'text' },
      { key: 'truckAccess', label: 'Truck access', kind: 'select', options: ['Container trucks', 'Small trucks only', 'No truck access'] },
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
