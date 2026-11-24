/**
 * Seed data — reused from the old wireframe (spec-system-wireframe/data.js) and reshaped to the v3 types.
 * ALL DATA IS FICTIONAL. Prices, schools, hospitals, distances and comparables are illustrative only.
 * Added in v3: two drafts (PROP-1013, PROP-1014), descriptions, and "exact location" flags.
 * Dropped in v3: HNI and classification (out of scope).
 */
import type {
  ApprovalClaim, Comparable, Database, Facing, Lead, LeadActivity, Media, NearbyPlace, Property, PropertyDocument, Settings, User,
} from './types'

/** The wireframe's "today": the seed's follow-ups and visits are dated around it. */
export const DEMO_TODAY = '2026-11-16'

export const USERS: User[] = [
  { id: 'u-admin', name: 'Anand V', role: 'admin', phone: '+91 98xxxxxx90' },
  { id: 'u-mgr', name: 'Vasanth K', role: 'manager', phone: '+91 98xxxxxx91' },
  { id: 'u-ex01', name: 'Priya S', role: 'executive', phone: '+91 98xxxxxx92' },
  { id: 'u-ex02', name: 'Karthik R', role: 'executive', phone: '+91 98xxxxxx93' },
  { id: 'u-ex03', name: 'Divya M', role: 'executive', phone: '+91 98xxxxxx94' },
  { id: 'u-ex04', name: 'Naveen P', role: 'executive', phone: '+91 98xxxxxx95' },
]

export const DEFAULT_SETTINGS: Settings = {
  matchWeights: { budget: 0.3, location: 0.25, size: 0.2, amenities: 0.15, preferences: 0.1 },
  buyerCostsPct: { stampDuty: 7, registration: 4, other: 1 },
  stuckDays: 14,
  placeCategories: [
    { id: 'busStop', name: 'Bus stop', icon: 'bus', group: 'commute', routeCheck: true, shownByDefault: true },
    { id: 'railway', name: 'Railway station', icon: 'train-front', group: 'commute', routeCheck: false, shownByDefault: true },
    { id: 'metro', name: 'Metro station', icon: 'train-track', group: 'commute', routeCheck: true, shownByDefault: false },
    { id: 'airport', name: 'Airport', icon: 'plane', group: 'commute', routeCheck: false, shownByDefault: false },
    { id: 'highway', name: 'Highway', icon: 'milestone', group: 'commute', routeCheck: false, shownByDefault: false },
    { id: 'school', name: 'School', icon: 'school', group: 'schools', routeCheck: true, shownByDefault: true },
    { id: 'college', name: 'College', icon: 'graduation-cap', group: 'schools', routeCheck: false, shownByDefault: false },
    { id: 'hospital', name: 'Hospital', icon: 'hospital', group: 'health', routeCheck: true, shownByDefault: true },
    { id: 'market', name: 'Market', icon: 'shopping-basket', group: 'shop', routeCheck: true, shownByDefault: true },
    { id: 'other', name: 'Other', icon: 'map-pin', group: 'other', routeCheck: true, shownByDefault: false },
  ],
  approvalTypes: [
    { id: 'dtcp', label: 'DTCP approval', documentName: 'DTCP approval order' },
    { id: 'rera', label: 'RERA approval', documentName: 'RERA registration certificate' },
  ],
}

/* ---------- small builders ---------- */

let seq = 0
const nextId = (p: string) => `${p}-${String(++seq).padStart(3, '0')}`

/** The demo photos live in public/demo-photos/ (see README). One cover photo per property. */
function coverPhoto(propId: string, file?: string): Media[] {
  return file ? [{ id: `${propId}-ph1`, kind: 'photo', url: `${import.meta.env.BASE_URL}demo-photos/${file}.jpg`, isCover: true }] : []
}

function place(categoryId: string, name: string, km: number, status: NearbyPlace['status'] = 'existing', routeChecked = true): NearbyPlace {
  return { id: nextId('nb'), categoryId, name, distanceKm: km, durationMin: Math.round(km * 2.6 + 3), status, routeChecked, source: 'user' }
}

const DOC_NAMES: Record<string, string> = { ec: 'Encumbrance certificate (EC)' }
function docs(propId: string, at: string, verified: string[], uploaded: string[] = []): PropertyDocument[] {
  const one = (kind: string, isVerified: boolean): PropertyDocument => ({
    id: `${propId}-doc-${kind}`, name: DOC_NAMES[kind], kind, file: `${kind}.pdf`, uploaded: { by: 'u-mgr', at },
    ...(isVerified ? { verified: { by: 'u-mgr', at } } : {}),
  })
  return [...verified.map((k) => one(k, true)), ...uploaded.map((k) => one(k, false))]
}

function approval(approvalId: string, status: ApprovalClaim['status'], at: string): ApprovalClaim {
  if (status === 'pending') return { approvalId, status }
  return {
    approvalId, status, file: `${approvalId}-approval.pdf`, uploaded: { by: 'u-mgr', at },
    ...(status === 'verified' ? { verified: { by: 'u-mgr', at } } : {}),
  }
}

function comp(locality: string, type: string, areaSqft: number, pricePerSqft: number, kind: Comparable['kind'], date: string, source: string, differences: string): Comparable {
  return { id: nextId('cmp'), locality, type, areaSqft, pricePerSqft, kind, date, source, differences }
}

type PropInput = Omit<Property, 'created' | 'updated' | 'history' | 'media' | 'location'> & {
  /** file name in public/demo-photos/, without .jpg */
  photo?: string
  location: Omit<Property['location'], 'state'>
  historyText?: string
}
function prop(p: PropInput): Property {
  const at = p.listedAt ?? '2026-11-15'
  const { photo, historyText, ...rest } = p
  return {
    ...rest,
    location: { state: 'Tamil Nadu', ...p.location },
    media: coverPhoto(p.id, photo),
    created: { by: 'u-mgr', at },
    updated: { by: 'u-mgr', at },
    history: [{ id: `${p.id}-h1`, at, by: 'u-mgr', text: historyText ?? (p.status === 'draft' ? 'Draft created' : 'Property listed') }],
  }
}

/* ---------- properties ---------- */

export function seedProperties(): Property[] {
  return [
    prop({
      id: 'PROP-1001', title: 'Premium residential plot', type: 'plot', purpose: 'sale', status: 'available', facing: 'E',
      description: 'A level, east-facing plot in a DTCP-approved layout, on a 30 ft tar road with underground drainage, municipal water and a borewell. Ready for construction.',
      areaSqft: 1200, price: 2800000, listedAt: '2026-11-16', photo: 'plot-vilangudi', amenities: ['Park / open space', 'Rainwater harvesting'],
      specs: {length: 40,width: 30,roadWidth: 30,roadAccess: "Layout road",corner: "Non-corner",topography: "Level",surveyNo: "112/3B",subdivision: "Plot 14",layoutApproval: "DTCP approval (sample no. 245/2024)",landUse: "Residential",water: "Municipal + borewell",electricity: "Available at site",drainage: "Underground drainage",roadInfra: "Tar road"},
      location: { city: 'Madurai', locality: 'Vilangudi', exact: true, lat: 9.962, lng: 78.091, roadType: 'Tar road', roadWidthFt: 30, nearby: [
        place('school', 'Green Valley Matriculation School (sample)', 1.4), place('hospital', 'City Care Multispeciality Hospital (sample)', 2.8),
        place('busStop', 'Vilangudi bus stop', 0.6), place('railway', 'Madurai Junction', 9.5), place('airport', 'Madurai Airport', 21),
        place('highway', 'NH-44 (Madurai–Dindigul)', 3.2), place('other', 'Outer ring road extension', 1.8, 'planned', false)] },
      approvals: [approval('dtcp', 'verified', '2026-11-05'), approval('rera', 'uploaded', '2026-11-10')],
      documents: docs('PROP-1001', '2026-11-05', ['ec']),
      comparables: [
        comp('Vilangudi, Madurai', 'Residential plot', 1200, 2400, 'transaction', '2026-09-20', 'Registered sale (sample)', 'Older layout, 23 ft road'),
        comp('Vilangudi, Madurai', 'Residential plot', 1500, 2550, 'asking', '2026-11-01', 'Property portal listing', 'Corner plot, asking price only'),
        comp('Thirunagar, Madurai', 'Residential plot', 1100, 2450, 'transaction', '2026-08-14', 'Channel partner', 'Similar approval, 1.5 km away')],
    }),
    prop({
      id: 'PROP-1002', title: 'Large plot near ring road', type: 'plot', purpose: 'sale', status: 'available', facing: 'E',
      areaSqft: 1500, price: 3000000, listedAt: '2026-11-08', photo: 'plot-ring-road', amenities: [],
      specs: {length: 50,width: 30,roadWidth: 30,roadAccess: "Layout road",corner: "Corner",topography: "Level",surveyNo: "87/1A",subdivision: "Plot 3",layoutApproval: "Approval number awaited from seller",landUse: "Residential",water: "Borewell",electricity: "Line nearby — connection to apply",drainage: "Open drain",roadInfra: "Gravel road"},
      location: { city: 'Madurai', locality: 'Thiruparankundram', exact: true, lat: 9.881, lng: 78.07, roadType: 'Gravel road', roadWidthFt: 30, nearby: [
        place('school', 'Sunrise Public School (sample)', 2.2), place('hospital', 'Primary Health Centre (sample)', 3.5),
        place('busStop', 'Thiruparankundram bus stand', 1.9), place('highway', 'Madurai Ring Road', 1.1),
        place('other', 'Proposed metro corridor', 4, 'proposed', false)] },
      approvals: [approval('dtcp', 'pending', '2026-11-08')],
      documents: docs('PROP-1002', '2026-11-08', ['ec']),
      comparables: [
        comp('Thiruparankundram, Madurai', 'Residential plot', 1500, 1950, 'asking', '2026-10-30', 'Property portal listing', 'Mud road access'),
        comp('Thiruparankundram, Madurai', 'Residential plot', 1200, 2100, 'transaction', '2026-09-02', 'Registered sale (sample)', 'Approved layout'),
        comp('Pasumalai, Madurai', 'Residential plot', 1350, 2050, 'transaction', '2026-07-18', 'Channel partner', 'Closer to main road')],
    }),
    prop({
      id: 'PROP-1003', title: 'East-facing plot in gated layout', type: 'plot', purpose: 'sale', status: 'available', facing: 'E',
      description: 'Gated layout with security, CCTV and a park. 33 ft concrete roads, underground drainage and municipal water. Schools and the K.K. Nagar bus stop are within a kilometre.',
      areaSqft: 1200, price: 3500000, listedAt: '2026-11-02', photo: 'plot-gated-layout', amenities: ['Gated community', 'Security', 'Park / open space', 'CCTV'],
      specs: {length: 40,width: 30,roadWidth: 33,roadAccess: "Layout road",corner: "Non-corner",topography: "Level",surveyNo: "45/2",subdivision: "Plot 22",layoutApproval: "DTCP approval (sample no. 118/2023)",landUse: "Residential",water: "Municipal supply",electricity: "Available at site",drainage: "Underground drainage",roadInfra: "Concrete road"},
      location: { city: 'Madurai', locality: 'K.K. Nagar', exact: true, lat: 9.93, lng: 78.145, roadType: 'Concrete road', roadWidthFt: 33, nearby: [
        place('school', 'Lakeview Senior Secondary School (sample)', 0.9), place('hospital', 'Meenakshi Care Hospital (sample)', 1.6),
        place('busStop', 'K.K. Nagar arch', 0.4), place('market', 'Mattuthavani market', 3.0), place('highway', 'NH-38 (Madurai–Trichy)', 4.5)] },
      approvals: [approval('dtcp', 'verified', '2026-10-28'), approval('rera', 'verified', '2026-10-28')],
      documents: docs('PROP-1003', '2026-10-28', ['ec']),
      comparables: [
        comp('K.K. Nagar, Madurai', 'Residential plot', 1200, 2850, 'transaction', '2026-10-05', 'Registered sale (sample)', 'Non-gated'),
        comp('K.K. Nagar, Madurai', 'Residential plot', 1000, 3050, 'asking', '2026-10-28', 'Property portal listing', 'Gated, smaller plot'),
        comp('Anna Nagar, Madurai', 'Residential plot', 1200, 2900, 'transaction', '2026-08-21', 'Channel partner', 'Similar approval')],
    }),
    prop({
      id: 'PROP-1004', title: 'Budget plot near bypass', type: 'plot', purpose: 'sale', status: 'sold', facing: 'E',
      areaSqft: 1200, price: 2600000, listedAt: '2026-09-10', photo: 'plot-bypass', amenities: [], historyText: 'Status changed to Sold',
      specs: {length: 40,width: 30,roadWidth: 30,roadAccess: "Public road",corner: "Non-corner",topography: "Level",surveyNo: "201/4",subdivision: "",layoutApproval: "DTCP approval (sample no. 77/2022)",landUse: "Residential",water: "Borewell",electricity: "Available at site",drainage: "Open drain",roadInfra: "Tar road"},
      location: { city: 'Madurai', locality: 'Othakadai', exact: true, lat: 9.955, lng: 78.19, roadType: 'Tar road', roadWidthFt: 30, nearby: [
        place('school', 'Government Higher Secondary School (sample)', 1.2), place('highway', 'Madurai–Melur road', 0.8)] },
      approvals: [approval('dtcp', 'verified', '2026-09-10')],
      documents: docs('PROP-1004', '2026-09-10', ['ec']),
      comparables: [comp('Othakadai, Madurai', 'Residential plot', 1200, 2150, 'transaction', '2026-08-01', 'Registered sale (sample)', 'Similar')],
    }),
    prop({
      id: 'PROP-1005', title: '2 BHK apartment, Anna Nagar', type: 'flat', purpose: 'sale', status: 'available', facing: 'N',
      description: 'Ready-to-move 2 BHK on the 3rd floor with a lift, a covered car park, power backup and security. Schools, a clinic and the bus stop are within walking distance.',
      areaSqft: 1050, price: 5200000, listedAt: '2026-10-20', photo: 'flat-anna-nagar', amenities: ['Lift', 'Power backup', 'Security', 'CCTV', 'Visitor parking'],
      specs: {bhk: "2 BHK",carpet: 820,superBuiltup: 1250,floor: 3,totalFloors: 5,lifts: 1,parking: "1 covered",uds: 420,maintenance: 2500,possession: "Ready to move",possessionDate: ""},
      location: { city: 'Madurai', locality: 'Anna Nagar', exact: true, lat: 9.925, lng: 78.138, roadType: 'Tar road', roadWidthFt: 40, nearby: [
        place('school', 'St. Mary’s Matriculation School (sample)', 0.7), place('hospital', 'Anna Nagar Clinic & Nursing Home (sample)', 0.5),
        place('busStop', 'Anna Nagar bus stop', 0.3), place('railway', 'Madurai Junction', 5.6), place('highway', 'NH-38', 3.8)] },
      approvals: [approval('dtcp', 'verified', '2026-10-18'), approval('rera', 'verified', '2026-10-18')],
      documents: docs('PROP-1005', '2026-10-18', ['ec']),
      comparables: [
        comp('Anna Nagar, Madurai', '2 BHK flat', 1000, 4800, 'transaction', '2026-09-11', 'Registered sale (sample)', 'Older building'),
        comp('Anna Nagar, Madurai', '2 BHK flat', 1100, 5100, 'asking', '2026-10-15', 'Property portal listing', 'New building'),
        comp('K.K. Nagar, Madurai', '2 BHK flat', 1050, 4950, 'transaction', '2026-08-30', 'Channel partner', 'No lift')],
    }),
    prop({
      id: 'PROP-1006', title: '3 BHK apartment on OMR', type: 'flat', purpose: 'sale', status: 'available', facing: 'E',
      description: 'A 3 BHK on the 9th floor of a 14-storey tower with a pool, gym and clubhouse. Direct access to OMR; the Sholinganallur metro station (Phase 2) is under construction 900 m away.',
      areaSqft: 1450, price: 9800000, listedAt: '2026-10-05', photo: 'flat-omr', amenities: ['Lift', 'Power backup', 'Gym', 'Swimming pool', 'Clubhouse', 'Security', 'CCTV'],
      specs: {bhk: "3 BHK",carpet: 1120,superBuiltup: 1720,floor: 9,totalFloors: 14,lifts: 3,parking: "1 covered",uds: 510,maintenance: 5200,possession: "Under construction",possessionDate: "2027-09"},
      location: { city: 'Chennai', locality: 'Sholinganallur (OMR)', exact: true, lat: 12.901, lng: 80.227, roadType: 'Highway service road', roadWidthFt: 60, nearby: [
        place('school', 'Bayview International School (sample)', 1.8), place('hospital', 'OMR Multispeciality Hospital (sample)', 2.1),
        place('metro', 'Metro Phase 2 — Sholinganallur station', 0.9, 'underConstruction', true), place('highway', 'OMR (Rajiv Gandhi Salai)', 0.4)] },
      approvals: [approval('dtcp', 'verified', '2026-10-01'), approval('rera', 'verified', '2026-10-01')],
      documents: docs('PROP-1006', '2026-10-01', ['ec']),
      comparables: [
        comp('Sholinganallur, Chennai', '3 BHK flat', 1500, 6500, 'asking', '2026-09-28', 'Builder price list', 'Lower floor'),
        comp('Sholinganallur, Chennai', '3 BHK flat', 1400, 6900, 'transaction', '2026-08-12', 'Registered sale (sample)', 'Ready to move'),
        comp('Navalur, Chennai', '3 BHK flat', 1450, 6100, 'transaction', '2026-07-09', 'Channel partner', '3 km further south')],
    }),
    prop({
      id: 'PROP-1007', title: 'Independent house, Peelamedu', type: 'house', purpose: 'sale', status: 'available', facing: 'N',
      description: 'A 3-bedroom, 2-floor house on 2,400 sq.ft. of land, built in 2018, with parking for 2 cars and a small front garden. 1.2 km from Avinashi Road and 4 km from the airport.',
      areaSqft: 1800, price: 13500000, listedAt: '2026-09-25', photo: 'house-peelamedu', amenities: ['Rainwater harvesting', 'Power backup'],
      specs: {subType: "Independent house",landArea: 2400,floors: 2,bedrooms: 3,bathrooms: 3,parking: "2 cars",constructionYear: 2018,quality: "Standard",condition: "Good",garden: "Small front garden",water: "Municipal + borewell",power: "EB + inverter",approvalDocs: "Approval + completion available"},
      location: { city: 'Coimbatore', locality: 'Peelamedu', exact: true, lat: 11.03, lng: 77.02, roadType: 'Tar road', roadWidthFt: 30, nearby: [
        place('school', 'Peelamedu Public School (sample)', 0.8), place('hospital', 'Kovai Medical Centre (sample)', 2.4),
        place('airport', 'Coimbatore Airport', 4.2), place('highway', 'Avinashi Road', 1.2)] },
      approvals: [approval('dtcp', 'verified', '2026-09-20')],
      documents: docs('PROP-1007', '2026-09-20', ['ec']),
      comparables: [
        comp('Peelamedu, Coimbatore', 'Independent house', 1750, 7300, 'transaction', '2026-08-18', 'Registered sale (sample)', 'Older construction'),
        comp('Peelamedu, Coimbatore', 'Independent house', 2000, 7800, 'asking', '2026-09-10', 'Property portal listing', 'Corner, larger land'),
        comp('Hope College, Coimbatore', 'Independent house', 1600, 7100, 'transaction', '2026-06-22', 'Channel partner', 'Smaller land')],
    }),
    prop({
      id: 'PROP-1008', title: 'Luxury villa, Vadavalli', type: 'house', purpose: 'sale', status: 'available', facing: 'E',
      description: 'A new 4-bedroom villa in a gated community, with a private lawn, a terrace garden, a pool and a clubhouse. Solar power and parking for 3+ cars.',
      areaSqft: 3800, price: 34000000, listedAt: '2026-10-12', photo: 'house-vadavalli', amenities: ['Gated community', 'Security', 'Swimming pool', 'Clubhouse', 'Power backup', 'CCTV'],
      specs: {subType: "Villa (gated community)",landArea: 5400,floors: 2,bedrooms: 4,bathrooms: 5,parking: "3+ cars",constructionYear: 2025,quality: "Premium",condition: "New",garden: "Private lawn + terrace garden",water: "Municipal + borewell",power: "EB + solar",approvalDocs: "Approval + completion available"},
      location: { city: 'Coimbatore', locality: 'Vadavalli', exact: true, lat: 11.025, lng: 76.905, roadType: 'Concrete road', roadWidthFt: 40, nearby: [
        place('school', 'Hillside International School (sample)', 2.5), place('hospital', 'West Kovai Hospital (sample)', 3.1),
        place('highway', 'Marudhamalai Road', 0.9), place('other', 'Western bypass', 2.0, 'planned', false)] },
      approvals: [approval('dtcp', 'verified', '2026-10-09')],
      documents: docs('PROP-1008', '2026-10-09', ['ec']),
      comparables: [
        comp('Vadavalli, Coimbatore', 'Villa', 3500, 8600, 'transaction', '2026-07-30', 'Registered sale (sample)', 'Smaller land'),
        comp('Vadavalli, Coimbatore', 'Villa', 4000, 9200, 'asking', '2026-10-01', 'Builder price list', 'Same community, larger'),
        comp('Thondamuthur Rd, Coimbatore', 'Villa', 3600, 8300, 'transaction', '2026-06-15', 'Channel partner', 'Farther from city')],
    }),
    prop({
      id: 'PROP-1009', title: 'Retail shop, Thillai Nagar main road', type: 'commercial', purpose: 'sale', status: 'available', facing: 'S',
      description: 'A ground-floor shop with an 18 ft frontage on a 60 ft main road, let to a retail tenant at ₹45,000 a month until March 2028 (5% yearly increase).',
      areaSqft: 650, price: 8500000, listedAt: '2026-10-01', photo: 'shop-thillai-nagar', amenities: ['CCTV'],
      specs: {commCategory: "Shop / Showroom",floor: "Ground",frontage: 18,roadWidth: 60,parking: "Street parking",permittedUsage: "Retail / showroom",occupancy: "Tenanted",rentalIncome: 45000,leaseDuration: "3 years (ends Mar 2028)",leaseTerms: "5% annual escalation",maintenance: 1500,opex: 24000},
      location: { city: 'Tiruchirappalli', locality: 'Thillai Nagar', exact: true, lat: 10.825, lng: 78.685, roadType: 'Main road', roadWidthFt: 60, nearby: [
        place('busStop', 'Thillai Nagar bus stop', 0.2), place('railway', 'Tiruchirappalli Junction', 3.9), place('highway', 'Trichy–Chennai NH', 4.0)] },
      approvals: [approval('dtcp', 'verified', '2026-09-25')],
      documents: docs('PROP-1009', '2026-09-25', ['ec']),
      comparables: [
        comp('Thillai Nagar, Trichy', 'Shop', 600, 12500, 'transaction', '2026-08-08', 'Registered sale (sample)', 'First floor'),
        comp('Thillai Nagar, Trichy', 'Shop', 700, 13800, 'asking', '2026-09-20', 'Property portal listing', 'Wider frontage'),
        comp('Cantonment, Trichy', 'Shop', 650, 12900, 'transaction', '2026-07-01', 'Channel partner', 'Similar footfall')],
    }),
    prop({
      id: 'PROP-1010', title: 'Office floor, Velachery', type: 'commercial', purpose: 'sale', status: 'reserved', facing: 'W',
      areaSqft: 4200, price: 42000000, listedAt: '2026-08-18', photo: 'office-velachery', amenities: ['Lift', 'Power backup', 'Security', 'CCTV', 'Visitor parking'],
      historyText: 'Status changed to Reserved (booking by Ramesh Traders)',
      specs: {commCategory: "Office space",floor: "4th of 7",frontage: 0,roadWidth: 80,parking: "Dedicated 5+",permittedUsage: "Office / IT",occupancy: "Vacant",rentalIncome: 0,leaseDuration: "",leaseTerms: "",maintenance: 21000,opex: 180000},
      location: { city: 'Chennai', locality: 'Velachery', exact: true, lat: 12.98, lng: 80.22, roadType: 'Main road', roadWidthFt: 80, nearby: [
        place('railway', 'Velachery MRTS', 1.1), place('highway', 'Velachery Main Road', 0.1)] },
      approvals: [approval('dtcp', 'verified', '2026-08-18')],
      documents: docs('PROP-1010', '2026-08-18', ['ec']),
      comparables: [comp('Velachery, Chennai', 'Office floor', 4000, 9800, 'transaction', '2026-06-30', 'Registered sale (sample)', 'Older building')],
    }),
    prop({
      id: 'PROP-1011', title: 'Warehouse, Kappalur industrial area', type: 'commercial', purpose: 'sale', status: 'available', facing: 'N',
      areaSqft: 10000, price: 26000000, listedAt: '2026-10-28', photo: 'warehouse-kappalur', amenities: ['Loading bay', 'Security', 'CCTV'],
      specs: {commCategory: "Warehouse / Godown",floor: "Ground",frontage: 80,roadWidth: 40,parking: "Dedicated 5+",permittedUsage: "Warehousing / light industry",occupancy: "Vacant",rentalIncome: 0,leaseDuration: "",leaseTerms: "",maintenance: 0,opex: 120000},
      location: { city: 'Madurai', locality: 'Kappalur', exact: true, lat: 9.87, lng: 78.03, roadType: 'Industrial road', roadWidthFt: 40, nearby: [
        place('highway', 'NH-44 (Madurai–Tirunelveli)', 1.5), place('other', 'SIDCO industrial estate', 0.8), place('other', 'Freight terminal', 6, 'proposed', false)] },
      approvals: [approval('dtcp', 'verified', '2026-10-25')],
      documents: docs('PROP-1011', '2026-10-25', ['ec']),
      comparables: [
        comp('Kappalur, Madurai', 'Warehouse', 12000, 2500, 'transaction', '2026-09-15', 'Registered sale (sample)', 'Larger, older shed'),
        comp('Kappalur, Madurai', 'Warehouse', 8000, 2750, 'asking', '2026-10-20', 'Property portal listing', 'Newer construction')],
    }),
    prop({
      id: 'PROP-1012', title: 'West-facing plot, Ponmeni', type: 'plot', purpose: 'sale', status: 'available', facing: 'W',
      areaSqft: 1350, price: 3100000, listedAt: '2026-11-11', photo: 'plot-ponmeni', amenities: [],
      specs: {length: 45,width: 30,roadWidth: 23,roadAccess: "Public road",corner: "Non-corner",topography: "Level",surveyNo: "66/7",subdivision: "Plot 5",layoutApproval: "Local body approval (sample no. 39/2021)",landUse: "Residential",water: "Municipal supply",electricity: "Available at site",drainage: "Underground drainage",roadInfra: "Tar road"},
      location: { city: 'Madurai', locality: 'Ponmeni', exact: true, lat: 9.93, lng: 78.095, roadType: 'Tar road', roadWidthFt: 23, nearby: [
        place('school', 'Ponmeni Matriculation School (sample)', 0.6), place('hospital', 'Ponmeni Nursing Home (sample)', 1.0),
        place('busStop', 'Ponmeni bus stop', 0.3)] },
      approvals: [approval('dtcp', 'verified', '2026-11-10')],
      documents: docs('PROP-1012', '2026-11-10', ['ec']),
      comparables: [
        comp('Ponmeni, Madurai', 'Residential plot', 1200, 2250, 'transaction', '2026-09-25', 'Registered sale (sample)', 'Interior road'),
        comp('Ponmeni, Madurai', 'Residential plot', 1400, 2350, 'asking', '2026-11-02', 'Property portal listing', 'Similar'),
        comp('Bypass Road, Madurai', 'Residential plot', 1300, 2400, 'transaction', '2026-08-10', 'Channel partner', 'Main road frontage')],
    }),
    /* v3 drafts — one from the AI assistant, one from an import */
    prop({
      id: 'PROP-1013', title: '2 BHK flat in Porur', type: 'flat', purpose: 'sale', status: 'draft', facing: 'E',
      areaSqft: 980, price: 6200000, listedAt: '2026-11-15', photo: 'flat-porur', amenities: ['Lift'], historyText: 'Draft created with the AI assistant',
      specs: { bhk: '2 BHK' },
      location: { city: 'Chennai', locality: 'Porur', exact: false, nearby: [] },
      approvals: [approval('rera', 'pending', '2026-11-15')], documents: [], comparables: [],
    }),
    prop({
      id: 'PROP-1014', title: 'Plot in Tambaram', type: 'plot', purpose: 'sale', status: 'draft',
      areaSqft: 1200, price: 2400000, listedAt: '2026-11-14', photo: 'plot-tambaram', amenities: [], historyText: 'Draft created from an import (ABC Realty — plots.xlsx, row 9): the price says "onwards"',
      specs: { length: 40 },
      location: { city: 'Chennai', locality: 'Tambaram', exact: false, nearby: [] },
      approvals: [], documents: [], comparables: [],
    }),
  ]
}

/* ---------- leads ---------- */

const act = (at: string, type: LeadActivity['type'], text: string, by: string): LeadActivity => ({ id: nextId('act'), at, type, text, by })
const req = (r: Partial<Lead['requirement']> & Pick<Lead['requirement'], 'type' | 'cities'>): Lead['requirement'] =>
  ({ localities: [], amenities: [], approvalRequired: true, ...r })
const budget = (min: number, preferred: number, max: number, flexPct = 0) => ({ min, preferred, max, flexPct })
const facing = (f: Facing) => f

export function seedLeads(): Lead[] {
  const L = (l: Omit<Lead, 'recommendedPropertyIds' | 'visits' | 'activity'> & Partial<Pick<Lead, 'recommendedPropertyIds' | 'visits' | 'activity'>>): Lead =>
    ({ recommendedPropertyIds: [], visits: [], activity: [], ...l })
  return [
    L({ id: 'LEAD-1001', name: 'Arun', phone: '+91 98xxxxxx01', source: 'Website', enquiryDate: '2026-11-16', ownerId: 'u-ex01', purpose: 'ownUse',
      qualification: { need: 'clear', timeline: 'm1to3', authority: 'joint', funding: 'combination', fundingReady: 'arranging' },
      engagement: { responded: true, docsRequested: false, siteVisited: false }, purposeNote: 'Building a family home',
      budget: budget(2000000, 2500000, 3000000, 5),
      requirement: req({ type: 'plot', cities: ['Madurai'], localities: ['Vilangudi', 'Thirunagar'], sizeSqft: 1200, facing: facing('E'), minRoadFt: 30, corner: 'any' }),
      stage: 'qualified', stageSince: '2026-11-16', nextFollowUp: '2026-11-17',
      activity: [act('2026-11-16', 'call', 'Wants a 1,200 sq.ft. plot in an approved layout to build a house. ₹30 L is for the plot only; home loan in process.', 'u-ex01')] }),
    L({ id: 'LEAD-1002', name: 'Meena Krishnan', phone: '+91 98xxxxxx02', email: 'meena.k@example.com', source: 'Property portal', enquiryDate: '2026-10-28', ownerId: 'u-ex02', purpose: 'ownUse',
      qualification: { need: 'clear', timeline: 'm1', authority: 'joint', funding: 'loan', fundingReady: 'ready' },
      engagement: { responded: true, docsRequested: true, siteVisited: false },
      budget: budget(4000000, 4800000, 5500000, 5),
      requirement: req({ type: 'flat', cities: ['Madurai'], localities: ['Anna Nagar', 'K.K. Nagar'], sizeSqft: 1000, bhk: '2 BHK', parking: 'required', possession: 'ready', amenities: ['Lift', 'Security'] }),
      stage: 'visitScheduled', stageSince: '2026-11-12', nextFollowUp: '2026-11-18', recommendedPropertyIds: ['PROP-1005'],
      visits: [{ id: 'VIS-001', propertyId: 'PROP-1005', date: '2026-11-19', time: '11:00', status: 'scheduled' }],
      activity: [act('2026-11-12', 'whatsapp', 'Shared the brochure and floor plan of PROP-1005. Site visit fixed for 19 Nov.', 'u-ex02')] }),
    L({ id: 'LEAD-1003', name: 'Rajesh Kumar', phone: '+91 98xxxxxx03', source: 'Referral', enquiryDate: '2026-11-03', ownerId: 'u-ex01', purpose: 'investment',
      qualification: { need: 'partly', timeline: 'm3to6', authority: 'sole', funding: 'own', fundingReady: 'ready' },
      engagement: { responded: true, docsRequested: true, siteVisited: false }, purposeNote: 'Investment',
      budget: budget(2500000, 3000000, 3500000),
      requirement: req({ type: 'plot', cities: ['Madurai'], sizeSqft: 1200, corner: 'any' }),
      stage: 'recommended', stageSince: '2026-11-06', nextFollowUp: '2026-11-14', recommendedPropertyIds: ['PROP-1001', 'PROP-1012'],
      activity: [act('2026-11-06', 'email', 'Sent a comparison of PROP-1001 and PROP-1012.', 'u-ex01')] }),
    L({ id: 'LEAD-1004', name: 'Fatima Begum', phone: '+91 98xxxxxx04', email: 'fatima.b@example.com', source: 'Walk-in', enquiryDate: '2026-09-30', ownerId: 'u-ex03', purpose: 'ownUse',
      qualification: { need: 'clear', timeline: 'm1', authority: 'joint', funding: 'combination', fundingReady: 'ready' },
      engagement: { responded: true, docsRequested: true, siteVisited: true },
      budget: budget(11000000, 13000000, 14500000, 3),
      requirement: req({ type: 'house', cities: ['Coimbatore'], localities: ['Peelamedu', 'Saravanampatti'], sizeSqft: 1700, bhk: '3 BHK', parking: 'required', possession: 'ready', amenities: ['Rainwater harvesting'] }),
      stage: 'negotiation', stageSince: '2026-10-25', nextFollowUp: '2026-11-16', negotiation: { propertyId: 'PROP-1007', offered: 12800000, counter: 13200000, notes: 'Seller open to ₹1.31 Cr if registration is within 30 days.' },
      recommendedPropertyIds: ['PROP-1007'],
      visits: [{ id: 'VIS-002', propertyId: 'PROP-1007', date: '2026-10-18', status: 'completed', feedback: 'Liked the layout and location; wants a kitchen renovation quote.' }],
      activity: [act('2026-11-14', 'meeting', 'Price discussion with the seller — counter at ₹1.32 Cr.', 'u-ex03')] }),
    L({ id: 'LEAD-1005', name: 'Suresh Babu', phone: '+91 98xxxxxx05', source: 'Channel partner', enquiryDate: '2026-10-10', ownerId: 'u-ex04', purpose: 'rentalIncome',
      qualification: { need: 'clear', timeline: 'm1to3', authority: 'sole', funding: 'own', fundingReady: 'ready' },
      engagement: { responded: true, docsRequested: true, siteVisited: true }, purposeNote: 'Rental income',
      budget: budget(7000000, 8500000, 9500000, 5),
      requirement: req({ type: 'commercial', cities: ['Tiruchirappalli'], localities: ['Thillai Nagar'], sizeSqft: 600, commCategory: 'Shop / Showroom', occupancy: 'tenanted' }),
      stage: 'negotiation', stageSince: '2026-10-24', nextFollowUp: '2026-11-12', negotiation: { propertyId: 'PROP-1009', offered: 8000000, counter: 8400000, notes: 'Waiting for the fire NOC to be verified before the final offer.' },
      recommendedPropertyIds: ['PROP-1009'],
      visits: [{ id: 'VIS-003', propertyId: 'PROP-1009', date: '2026-10-22', status: 'completed', feedback: 'Happy with the tenant; wants a copy of the lease.' }],
      activity: [act('2026-10-29', 'call', 'Will finalise once the fire NOC is verified.', 'u-ex04')] }),
    L({ id: 'LEAD-1006', name: 'Lakshmi Narayanan', phone: '+91 98xxxxxx06', email: 'lakshmi.n@example.com', source: 'Referral', enquiryDate: '2026-10-15', ownerId: 'u-ex03', purpose: 'investment',
      qualification: { need: 'clear', timeline: 'm1to3', authority: 'sole', funding: 'own', fundingReady: 'ready' },
      engagement: { responded: true, docsRequested: true, siteVisited: false }, purposeNote: 'Investment',
      budget: budget(30000000, 35000000, 40000000),
      requirement: req({ type: 'house', cities: ['Coimbatore'], localities: ['Vadavalli'], sizeSqft: 3500, bhk: '4 BHK', parking: 'required', possession: 'ready', amenities: ['Gated community', 'Swimming pool'] }),
      stage: 'visitScheduled', stageSince: '2026-11-10', nextFollowUp: '2026-11-19', recommendedPropertyIds: ['PROP-1008'],
      visits: [{ id: 'VIS-004', propertyId: 'PROP-1008', date: '2026-11-20', time: '15:00', status: 'scheduled' }],
      activity: [act('2026-11-10', 'meeting', 'Investment discussion; villa site visit fixed for 20 Nov.', 'u-ex03')] }),
    L({ id: 'LEAD-1007', name: 'Vignesh R', phone: '+91 98xxxxxx07', source: 'Website', enquiryDate: '2026-11-09', ownerId: 'u-ex02', purpose: 'ownUse',
      qualification: { need: 'clear', timeline: 'm3to6', authority: 'joint', funding: 'loan', fundingReady: 'arranging' },
      engagement: { responded: true, docsRequested: false, siteVisited: false },
      budget: budget(8000000, 9500000, 10500000, 5),
      requirement: req({ type: 'flat', cities: ['Chennai'], localities: ['Sholinganallur (OMR)'], sizeSqft: 1400, bhk: '3 BHK', parking: 'required', possession: 'any', amenities: ['Gym', 'Swimming pool'] }),
      stage: 'qualified', stageSince: '2026-11-11', nextFollowUp: '2026-11-18',
      activity: [act('2026-11-11', 'call', '3 BHK on OMR; loan eligibility check in progress.', 'u-ex02')] }),
    L({ id: 'LEAD-1008', name: 'Anitha Joseph', phone: '+91 98xxxxxx08', source: 'Social media', enquiryDate: '2026-11-07', ownerId: 'u-ex04', purpose: 'secondHome',
      qualification: { need: 'partly', timeline: 'm6to12', authority: 'unknown', funding: 'own', fundingReady: 'undecided' },
      engagement: { responded: true, docsRequested: false, siteVisited: false }, purposeNote: 'Second home',
      budget: budget(6000000, 7000000, 8000000, 5),
      requirement: req({ type: 'house', cities: ['Madurai'], sizeSqft: 1500, bhk: '2 BHK', parking: 'preferred', possession: 'ready', approvalRequired: false }),
      stage: 'contacted', stageSince: '2026-11-08', nextFollowUp: '2026-11-22',
      activity: [act('2026-11-08', 'whatsapp', 'Introduced the company; exploring options for a second home.', 'u-ex04')] }),
    L({ id: 'LEAD-1009', name: 'Mohammed Irfan', phone: '+91 98xxxxxx09', email: 'irfan.logistics@example.com', source: 'Phone enquiry', enquiryDate: '2026-10-30', ownerId: 'u-ex01', purpose: 'businessUse',
      qualification: { need: 'clear', timeline: 'm3to6', authority: 'joint', funding: 'combination', fundingReady: 'arranging' },
      engagement: { responded: true, docsRequested: true, siteVisited: false }, purposeNote: 'Logistics business expansion',
      budget: budget(22000000, 25000000, 28000000, 5),
      requirement: req({ type: 'commercial', cities: ['Madurai'], localities: ['Kappalur'], sizeSqft: 9000, commCategory: 'Warehouse / Godown', occupancy: 'vacant', amenities: ['Loading bay'] }),
      stage: 'recommended', stageSince: '2026-11-04', nextFollowUp: '2026-11-17', recommendedPropertyIds: ['PROP-1011'],
      activity: [act('2026-11-04', 'email', 'Shared the PROP-1011 specification sheet and access route.', 'u-ex01')] }),
    L({ id: 'LEAD-1010', name: 'Deepa Srinivasan', phone: '+91 98xxxxxx10', source: 'Website', enquiryDate: '2026-11-15', ownerId: 'u-ex02', purpose: 'ownUse',
      qualification: { need: 'partly', timeline: 'undecided', authority: 'unknown', funding: 'loan', fundingReady: 'undecided' },
      engagement: { responded: false, docsRequested: false, siteVisited: false },
      budget: budget(1500000, 1800000, 2000000),
      requirement: req({ type: 'plot', cities: ['Madurai'], sizeSqft: 1000, corner: 'any' }),
      stage: 'new', stageSince: '2026-11-15', nextFollowUp: '2026-11-16',
      activity: [act('2026-11-15', 'note', 'Enquiry received from the website form.', 'system')] }),
    L({ id: 'LEAD-1011', name: 'Senthil Kumar', phone: '+91 98xxxxxx11', source: 'Property portal', enquiryDate: '2026-10-22', ownerId: 'u-ex03', purpose: 'investment',
      qualification: { need: 'partly', timeline: 'm6to12', authority: 'sole', funding: 'own', fundingReady: 'arranging' },
      engagement: { responded: true, docsRequested: false, siteVisited: false }, purposeNote: 'Investment',
      budget: budget(3000000, 3500000, 4000000),
      requirement: req({ type: 'plot', cities: ['Madurai'], localities: ['K.K. Nagar', 'Anna Nagar'], sizeSqft: 1200, facing: facing('E'), minRoadFt: 30, corner: 'any', amenities: ['Gated community'] }),
      stage: 'contacted', stageSince: '2026-10-23', nextFollowUp: '2026-11-06',
      activity: [act('2026-10-23', 'call', 'Interested in gated plots; not in a hurry.', 'u-ex03')] }),
    L({ id: 'LEAD-1012', name: 'Kavya Ramesh', phone: '+91 98xxxxxx12', source: 'Website', enquiryDate: '2026-09-15', ownerId: 'u-ex02', purpose: 'ownUse',
      qualification: { need: 'clear', timeline: 'm1', authority: 'joint', funding: 'loan', fundingReady: 'ready' },
      engagement: { responded: true, docsRequested: true, siteVisited: true },
      budget: budget(4500000, 5000000, 5500000),
      requirement: req({ type: 'flat', cities: ['Madurai'], localities: ['Anna Nagar'], sizeSqft: 1000, bhk: '2 BHK', parking: 'required', possession: 'ready' }),
      stage: 'lost', stageSince: '2026-10-20',
      visits: [{ id: 'VIS-005', propertyId: 'PROP-1005', date: '2026-10-02', status: 'completed', feedback: 'Liked the flat, felt the price was high.' }],
      activity: [act('2026-10-20', 'call', 'Bought a resale flat nearby at a lower price.', 'u-ex02')] }),
    L({ id: 'LEAD-1013', name: 'Ramesh Traders (Ramesh M)', phone: '+91 98xxxxxx13', email: 'accounts@rameshtraders.example', source: 'Channel partner', enquiryDate: '2026-08-20', ownerId: 'u-ex04', purpose: 'businessUse',
      qualification: { need: 'clear', timeline: 'm1', authority: 'joint', funding: 'combination', fundingReady: 'ready' },
      engagement: { responded: true, docsRequested: true, siteVisited: true }, purposeNote: 'Regional office',
      budget: budget(38000000, 42000000, 45000000),
      requirement: req({ type: 'commercial', cities: ['Chennai'], localities: ['Velachery'], sizeSqft: 4000, commCategory: 'Office space', occupancy: 'vacant', amenities: ['Lift', 'Power backup'] }),
      stage: 'closed', stageSince: '2026-11-10', nextFollowUp: '2026-11-25', negotiation: { propertyId: 'PROP-1010', offered: 41000000, counter: 42000000, notes: 'Closed at ₹4.2 Cr.' },
      recommendedPropertyIds: ['PROP-1010'],
      visits: [{ id: 'VIS-006', propertyId: 'PROP-1010', date: '2026-09-12', status: 'completed', feedback: 'Suitable; partners approved.' }],
      activity: [act('2026-11-10', 'meeting', 'Booking amount received; registration planned for 25 Nov.', 'u-ex04')] }),
    L({ id: 'LEAD-1014', name: 'Priyanka Nair', phone: '+91 98xxxxxx14', source: 'Social media', enquiryDate: '2026-11-14', ownerId: 'u-ex04', purpose: 'rentalIncome',
      qualification: { need: 'exploring', timeline: 'undecided', authority: 'unknown', funding: 'loan', fundingReady: 'undecided' },
      engagement: { responded: false, docsRequested: false, siteVisited: false }, purposeNote: 'Rental income',
      budget: budget(8000000, 9000000, 10000000),
      requirement: req({ type: 'flat', cities: ['Chennai'], sizeSqft: 1200, bhk: '2 BHK', parking: 'preferred', possession: 'any' }),
      stage: 'new', stageSince: '2026-11-14', nextFollowUp: '2026-11-15',
      activity: [act('2026-11-14', 'note', 'Instagram lead form.', 'system')] }),
    L({ id: 'LEAD-1015', name: 'Karthik Subramanian', phone: '+91 98xxxxxx15', source: 'Website', enquiryDate: '2026-11-12', ownerId: 'u-ex01', purpose: 'investment',
      qualification: { need: 'exploring', timeline: 'undecided', authority: 'unknown', funding: 'combination', fundingReady: 'undecided' },
      engagement: { responded: true, docsRequested: false, siteVisited: false }, purposeNote: 'Investment',
      budget: budget(50000000, 60000000, 70000000),
      requirement: req({ type: 'commercial', cities: ['Tiruchirappalli', 'Madurai'], sizeSqft: 5000, commCategory: 'Commercial building', occupancy: 'tenanted' }),
      stage: 'contacted', stageSince: '2026-11-13', nextFollowUp: '2026-11-20',
      activity: [act('2026-11-13', 'call', 'Stated a ₹5–7 Cr range; no timeline or funding plan yet.', 'u-ex01')] }),
  ]
}

export function seedDatabase(): Database {
  seq = 0
  return { version: 5, users: USERS, properties: seedProperties(), leads: seedLeads(), settings: structuredClone(DEFAULT_SETTINGS) }
}
