/**
 * The five default templates (master prompt §15.1): headings + 2–3 example rows each. The headings are the CRM's own,
 * so an upload of a filled template maps every column instantly ("template" method). Headings and example rows are data
 * written in English (the language the sheets are exchanged in); the page around them is translated.
 */
import type { SheetKind } from './fields'

export type TemplateColumn = { header: string; field: string; required?: boolean; note?: string }
export type TemplateDef = { kind: SheetKind; fileBase: string; columns: TemplateColumn[]; examples: (string | number)[][] }

const APARTMENTS: TemplateDef = {
  kind: 'apartments',
  fileBase: 'apartments-template',
  columns: [
    { header: 'Title', field: 'title' },
    { header: 'Project Name', field: 'projectName' },
    { header: 'Builder', field: 'builderName' },
    { header: 'Configuration (BHK)', field: 'configuration', required: true },
    { header: 'City', field: 'location.city', required: true },
    { header: 'Locality', field: 'location.locality', required: true },
    { header: 'Price (₹)', field: 'price', required: true, note: 'e.g. 85 L, 1.2 Cr or 8500000' },
    { header: 'Carpet Area (sq ft)', field: 'area.carpet', required: true },
    { header: 'Built-up Area (sq ft)', field: 'area.builtUp' },
    { header: 'Super Built-up Area (sq ft)', field: 'area.superBuiltUp' },
    { header: 'Floor', field: 'floor' },
    { header: 'Total Floors', field: 'totalFloors' },
    { header: 'Facing', field: 'facing' },
    { header: 'Possession', field: 'possession.status', note: 'Ready or Under construction' },
    { header: 'Possession Date', field: 'possession.date' },
    { header: 'Transaction', field: 'transaction', note: 'New booking or Resale' },
    { header: 'Tower', field: 'specs.towerName' },
    { header: 'Unit Number', field: 'specs.unitNumber' },
    { header: 'RERA Number', field: 'rera.number' },
    { header: 'Owner Name', field: 'owner.name' },
    { header: 'Owner Phone', field: 'owner.phone' },
  ],
  examples: [
    ['Aranya Greens 3 BHK', 'Aranya Greens', 'Vriksha Developers', '3 BHK', 'Bengaluru', 'Whitefield', '1.25 Cr', 1350, 1580, 1720, 9, 18, 'East', 'Under construction', 'Dec 2027', 'New booking', 'T2', 'T2-904', 'PRM/KA/RERA/1251/446/PR/0001', 'Vriksha Developers', '98450 11001'],
    ['Velachery 2 BHK resale', '', '', '2 BHK', 'Chennai', 'Velachery', '78 L', 880, 1050, '', 3, 5, 'North-East', 'Ready', '', 'Resale', '', '3B', '', 'Ganesh R', '98410 23456'],
    ['Kokapet 3 BHK lake view', 'Deccan Pearl', 'Golconda Infra', '3 BHK', 'Hyderabad', 'Kokapet', '1.6 Cr', 1620, 1890, 2150, 21, 32, 'West', 'Ready', '', 'New booking', 'B', 'B-2104', 'P02400004321', 'Golconda Infra', '90000 12345'],
  ],
}

const VILLAS: TemplateDef = {
  kind: 'villas',
  fileBase: 'villas-houses-template',
  columns: [
    { header: 'Title', field: 'title' },
    { header: 'Property Type', field: 'type', note: 'Villa, Independent house or Row house' },
    { header: 'Project Name', field: 'projectName' },
    { header: 'Configuration (BHK)', field: 'configuration', required: true },
    { header: 'City', field: 'location.city', required: true },
    { header: 'Locality', field: 'location.locality', required: true },
    { header: 'Price (₹)', field: 'price', required: true },
    { header: 'Built-up Area (sq ft)', field: 'area.builtUp', required: true },
    { header: 'Plot Area (sq ft)', field: 'area.plot' },
    { header: 'Total Floors', field: 'totalFloors' },
    { header: 'Facing', field: 'facing' },
    { header: 'Possession', field: 'possession.status' },
    { header: 'Furnishing', field: 'furnishing' },
    { header: 'Transaction', field: 'transaction' },
    { header: 'Unit Number', field: 'specs.unitNumber' },
    { header: 'RERA Number', field: 'rera.number' },
    { header: 'Owner Name', field: 'owner.name' },
    { header: 'Owner Phone', field: 'owner.phone' },
  ],
  examples: [
    ['Sarjapur 4 BHK villa', 'Villa', 'Palm Meadows', '4 BHK', 'Bengaluru', 'Sarjapur Road', '3.2 Cr', 3400, 2400, 2, 'East', 'Ready', 'Semi furnished', 'New booking', 'V-27', 'PRM/KA/RERA/1251/308/PR/0099', 'Palm Meadows Pvt Ltd', '98860 22110'],
    ['Anna Nagar independent house', 'Independent house', '', '3 BHK', 'Chennai', 'Anna Nagar', '2.4 Cr', 2200, '30x40', 2, 'North', 'Ready', 'Unfurnished', 'Resale', '14', '', 'Lakshmi N', '94440 55667'],
  ],
}

const PLOTS: TemplateDef = {
  kind: 'plots',
  fileBase: 'plots-land-template',
  columns: [
    { header: 'Title', field: 'title' },
    { header: 'Property Type', field: 'type', note: 'Plot or Agricultural land' },
    { header: 'Layout Name', field: 'projectName' },
    { header: 'City', field: 'location.city', required: true },
    { header: 'Locality', field: 'location.locality', required: true },
    { header: 'Price (₹)', field: 'price', required: true },
    { header: 'Plot Area', field: 'area.plot', required: true, note: 'e.g. 1200 sq ft, 3 cents, 2 acres' },
    { header: 'Dimensions', field: 'dimensions', note: 'e.g. 30x40' },
    { header: 'Road Width (ft)', field: 'roadWidthFt' },
    { header: 'Facing', field: 'facing' },
    { header: 'Plot Number', field: 'specs.unitNumber' },
    { header: 'RERA / DTCP Number', field: 'rera.number' },
    { header: 'Owner Name', field: 'owner.name' },
    { header: 'Owner Phone', field: 'owner.phone' },
  ],
  examples: [
    ['Tambaram DTCP plot', 'Plot', 'Green Valley Layout', 'Chennai', 'Tambaram', '24 L', '1200 sq ft', '30x40', 30, 'East', '9', 'DTCP/123/2024', 'Murugan K', '98400 11223'],
    ['Hoskote corner plot', 'Plot', 'Sunrise Enclave', 'Bengaluru', 'Hoskote', '42 L', '1500 sq ft', '30x50', 40, 'North-East', '41', '', 'Sunrise Estates', '97411 33445'],
    ['Farm land near Shadnagar', 'Agricultural land', '', 'Hyderabad', 'Shadnagar', '85 L', '2 acres', '', 20, 'South', '', '', 'Ramulu P', '99490 66778'],
  ],
}

const COMMERCIAL: TemplateDef = {
  kind: 'commercial',
  fileBase: 'commercial-template',
  columns: [
    { header: 'Title', field: 'title' },
    { header: 'Property Type', field: 'type', required: true, note: 'Office, Shop, Showroom, Warehouse or Co-working' },
    { header: 'Project Name', field: 'projectName' },
    { header: 'City', field: 'location.city', required: true },
    { header: 'Locality', field: 'location.locality', required: true },
    { header: 'Price (₹)', field: 'price', required: true },
    { header: 'Carpet Area (sq ft)', field: 'area.carpet', required: true },
    { header: 'Built-up Area (sq ft)', field: 'area.builtUp' },
    { header: 'Super Built-up Area (sq ft)', field: 'area.superBuiltUp' },
    { header: 'Floor', field: 'floor' },
    { header: 'Furnishing', field: 'furnishing' },
    { header: 'Car Parking', field: 'parking.covered' },
    { header: 'Maintenance per Month (₹)', field: 'maintenancePerMonth' },
    { header: 'Transaction', field: 'transaction' },
    { header: 'Unit Number', field: 'specs.unitNumber' },
    { header: 'Owner Name', field: 'owner.name' },
    { header: 'Owner Phone', field: 'owner.phone' },
  ],
  examples: [
    ['Grade A office, Baner', 'Office', 'Business Bay', 'Pune', 'Baner', '2.8 Cr', 2400, 2900, 3300, 6, 'Fully furnished', 4, 45000, 'Resale', '604', 'Sameer Joshi', '98220 44556'],
    ['High-street shop, Velachery', 'Shop', '', 'Chennai', 'Velachery', '1.1 Cr', 480, 560, '', 0, 'Unfurnished', 1, 6000, 'Resale', 'G-12', 'Kannan S', '98410 77889'],
  ],
}

const LEADS: TemplateDef = {
  kind: 'leads',
  fileBase: 'leads-template',
  columns: [
    { header: 'Name', field: 'name', required: true },
    { header: 'Phone', field: 'phone', required: true, note: '10-digit mobile; +91 optional' },
    { header: 'Email', field: 'email' },
    { header: 'Source', field: 'source', required: true, note: '99acres, MagicBricks, Housing, Website, Walk-in, Referral…' },
    { header: 'Campaign', field: 'sourceDetail' },
    { header: 'City', field: 'requirement.cities' },
    { header: 'Preferred Locality', field: 'requirement.localities' },
    { header: 'Property Type', field: 'requirement.propertyTypes' },
    { header: 'Configuration (BHK)', field: 'requirement.configurations' },
    { header: 'Budget Min (₹)', field: 'requirement.budgetMin' },
    { header: 'Budget Max (₹)', field: 'requirement.budgetMax' },
    { header: 'Timeline', field: 'qualification.timeline', note: 'Immediate, 1-3 months, 3-6 months…' },
    { header: 'Preferred Language', field: 'preferredLanguage' },
    { header: 'Notes', field: 'notes' },
  ],
  examples: [
    ['Rahul Menon', '98450 12345', 'rahul.menon@example.com', '99acres', 'Diwali offer', 'Bengaluru', 'Whitefield', 'Apartment', '3 BHK', '1 Cr', '1.3 Cr', '1-3 months', 'English', 'Wants east facing, near metro'],
    ['Kavya Reddy', '+91 99001 22334', '', 'Website', '', 'Hyderabad', 'Gachibowli', 'Apartment', '2 BHK', '70 L', '90 L', 'Immediate', 'Telugu', ''],
    ['Suresh Babu', '9884012345', 'suresh.b@example.com', 'Walk-in', '', 'Chennai', 'OMR', 'Villa', '4 BHK', '2 Cr', '2.5 Cr', '3-6 months', 'Tamil', 'Visited site office on Sunday'],
  ],
}

export const TEMPLATES: Record<SheetKind, TemplateDef> = { apartments: APARTMENTS, villas: VILLAS, plots: PLOTS, commercial: COMMERCIAL, leads: LEADS }

/** Headings + example rows, ready for SheetJS `aoa_to_sheet`. */
export const templateAoa = (kind: SheetKind): (string | number)[][] => [TEMPLATES[kind].columns.map((c) => c.header), ...TEMPLATES[kind].examples]

/** The Instructions tab of the .xlsx (ignored again when the file comes back). */
export const instructionsAoa = (kind: SheetKind): string[][] => [
  ['How to fill this template'],
  ['Fill one row per record on the first data tab. Keep the headings as they are; extra columns are kept too.'],
  ['Amounts can be typed as 85 L, 1.2 Cr or 8500000. Areas as 1200, 1,200 sq ft, 3 cents or 30x40.'],
  ['Phones are 10-digit Indian mobiles; +91, spaces and a leading 0 are fine.'],
  [],
  ['Column', 'Required', 'Notes'],
  ...TEMPLATES[kind].columns.map((c) => [c.header, c.required ? 'Yes' : '', c.note ?? '']),
]

/** True when every required heading of the default template is present (the upload is the default template). */
export function isDefaultTemplate(headers: string[], kind: SheetKind): boolean {
  const set = new Set(headers.map((h) => h.trim().toLowerCase()))
  return TEMPLATES[kind].columns.filter((c) => c.required).every((c) => set.has(c.header.toLowerCase()))
}
