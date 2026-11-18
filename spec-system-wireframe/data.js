/* =====================================================================
   Real Estate Specification System — wireframe data
   Schemas (what fields each property / requirement type has) + seed data.
   ALL DATA IS FICTIONAL. Prices, schools, hospitals, distances and
   comparables are illustrative only — not actual market data.
   ===================================================================== */

const DEMO_TODAY = '2026-11-16';

/* ---------- Property types and their type-specific specification fields ---------- */
const PROPERTY_TYPES = {
  plot: {
    label: 'Residential plot', category: 'Residential', areaLabel: 'Plot / land area (sq.ft.)', areaBasis: 'plot area',
    fields: [
      { k: 'length', l: 'Length (ft)', t: 'number' },
      { k: 'width', l: 'Width (ft)', t: 'number' },
      { k: 'roadWidth', l: 'Road width (ft)', t: 'number' },
      { k: 'roadAccess', l: 'Road access', t: 'select', o: ['Public road', 'Layout road', 'Private / pathway access'] },
      { k: 'corner', l: 'Corner / non-corner', t: 'select', o: ['Non-corner', 'Corner'] },
      { k: 'topography', l: 'Topography', t: 'select', o: ['Level', 'Gentle slope', 'Elevated', 'Low-lying'] },
      { k: 'surveyNo', l: 'Survey number', t: 'text' },
      { k: 'subdivision', l: 'Subdivision', t: 'text' },
      { k: 'layoutApproval', l: 'Layout approval details', t: 'text', h: 'Authority + approval number as stated on the document' },
      { k: 'landUse', l: 'Land-use classification', t: 'select', o: ['Residential', 'Mixed residential', 'Commercial', 'Agricultural (conversion required)'] },
      { k: 'water', l: 'Water availability', t: 'select', o: ['Municipal supply', 'Borewell', 'Municipal + borewell', 'Not available'] },
      { k: 'electricity', l: 'Electricity', t: 'select', o: ['Available at site', 'Line nearby — connection to apply', 'Not available'] },
      { k: 'drainage', l: 'Drainage', t: 'select', o: ['Underground drainage', 'Open drain', 'Not available'] },
      { k: 'roadInfra', l: 'Road infrastructure', t: 'select', o: ['Tar road', 'Concrete road', 'Gravel road', 'Mud road'] },
    ],
  },
  flat: {
    label: 'Flat / Apartment', category: 'Residential', areaLabel: 'Built-up area (sq.ft.)', areaBasis: 'built-up area',
    fields: [
      { k: 'bhk', l: 'BHK configuration', t: 'select', o: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK'] },
      { k: 'carpet', l: 'Carpet area (sq.ft.)', t: 'number' },
      { k: 'superBuiltup', l: 'Super built-up area (sq.ft.)', t: 'number', h: 'If applicable' },
      { k: 'floor', l: 'Floor number', t: 'number' },
      { k: 'totalFloors', l: 'Total floors', t: 'number' },
      { k: 'lifts', l: 'Number of lifts', t: 'number' },
      { k: 'parking', l: 'Parking allocation', t: 'select', o: ['None', '1 covered', '2 covered', '1 open', 'Shared'] },
      { k: 'uds', l: 'UDS — undivided share of land (sq.ft.)', t: 'number' },
      { k: 'maintenance', l: 'Monthly maintenance (₹)', t: 'number' },
      { k: 'possession', l: 'Possession status', t: 'select', o: ['Ready to move', 'Under construction'] },
      { k: 'possessionDate', l: 'Expected possession', t: 'month' },
    ],
  },
  house: {
    label: 'Independent house / Villa', category: 'Residential', areaLabel: 'Built-up area (sq.ft.)', areaBasis: 'built-up area',
    fields: [
      { k: 'subType', l: 'House or villa', t: 'select', o: ['Independent house', 'Villa (gated community)', 'Row house'] },
      { k: 'landArea', l: 'Land area (sq.ft.)', t: 'number' },
      { k: 'floors', l: 'Number of floors', t: 'number' },
      { k: 'bedrooms', l: 'Bedrooms', t: 'number' },
      { k: 'bathrooms', l: 'Bathrooms', t: 'number' },
      { k: 'parking', l: 'Parking', t: 'select', o: ['None', '1 car', '2 cars', '3+ cars'] },
      { k: 'constructionYear', l: 'Construction year', t: 'number' },
      { k: 'quality', l: 'Construction quality', t: 'select', o: ['Premium', 'Standard', 'Basic'] },
      { k: 'condition', l: 'Condition', t: 'select', o: ['New', 'Good', 'Needs minor repair', 'Needs major repair'] },
      { k: 'garden', l: 'Private garden / amenities', t: 'text' },
      { k: 'water', l: 'Water arrangement', t: 'select', o: ['Municipal supply', 'Borewell', 'Municipal + borewell', 'Tanker dependent'] },
      { k: 'power', l: 'Power arrangement', t: 'select', o: ['EB connection', 'EB + inverter', 'EB + generator backup', 'EB + solar'] },
      { k: 'approvalDocs', l: 'Approval & completion documentation', t: 'select', o: ['Approval + completion available', 'Approval only', 'Not available'] },
    ],
  },
  commercial: {
    label: 'Office / shop / warehouse', category: 'Commercial', areaLabel: 'Carpet / usable area (sq.ft.)', areaBasis: 'usable area',
    fields: [
      { k: 'commCategory', l: 'Commercial category', t: 'select', o: ['Office space', 'Shop / Showroom', 'Warehouse / Godown', 'Commercial building', 'Industrial shed'] },
      { k: 'floor', l: 'Floor', t: 'text' },
      { k: 'frontage', l: 'Frontage (ft)', t: 'number' },
      { k: 'roadWidth', l: 'Road access — width (ft)', t: 'number' },
      { k: 'parking', l: 'Parking', t: 'select', o: ['None', 'Street parking', 'Dedicated 1–5', 'Dedicated 5+'] },
      { k: 'permittedUsage', l: 'Permitted usage', t: 'text' },
      { k: 'occupancy', l: 'Occupancy status', t: 'select', o: ['Vacant', 'Tenanted', 'Owner-occupied'] },
      { k: 'rentalIncome', l: 'Rental income (₹ / month)', t: 'number', h: 'If tenanted' },
      { k: 'leaseDuration', l: 'Lease duration', t: 'text' },
      { k: 'leaseTerms', l: 'Lease terms', t: 'text' },
      { k: 'maintenance', l: 'Maintenance (₹ / month)', t: 'number' },
      { k: 'opex', l: 'Operating expenses (₹ / year)', t: 'number' },
    ],
  },
  /* Agricultural and industrial land sit under Commercial, as on the big listing sites */
  agri: {
    label: 'Agricultural land', category: 'Commercial', areaLabel: 'Land area (sq.ft.)', areaBasis: 'land area',
    fields: [
      { k: 'acres', l: 'Land area (acres)', t: 'number' },
      { k: 'soil', l: 'Soil type', t: 'select', o: ['Red soil', 'Black soil', 'Alluvial', 'Sandy', 'Mixed'] },
      { k: 'waterSource', l: 'Water source', t: 'select', o: ['Borewell', 'Open well', 'Canal', 'River / channel', 'Rain-fed only'] },
      { k: 'crops', l: 'Current crops / trees', t: 'text' },
      { k: 'roadAccess', l: 'Road access', t: 'select', o: ['Tar road', 'Gravel road', 'Mud road / cart track', 'No direct road'] },
      { k: 'electricity', l: 'EB connection', t: 'select', o: ['Three-phase', 'Single-phase', 'Not available'] },
      { k: 'fencing', l: 'Fencing', t: 'select', o: ['Fully fenced', 'Partly fenced', 'Not fenced'] },
      { k: 'surveyNo', l: 'Survey number', t: 'text' },
    ],
  },
  industrial: {
    label: 'Industrial land / shed', category: 'Commercial', areaLabel: 'Plot / shed area (sq.ft.)', areaBasis: 'plot area',
    fields: [
      { k: 'subType', l: 'Industrial type', t: 'select', o: ['Industrial plot', 'Factory / shed', 'Industrial building'] },
      { k: 'shedArea', l: 'Built-up shed area (sq.ft.)', t: 'number' },
      { k: 'powerKva', l: 'Power load (kVA)', t: 'number' },
      { k: 'clearHeight', l: 'Clear height (ft)', t: 'number' },
      { k: 'estate', l: 'Industrial estate / zone', t: 'text', h: 'e.g. SIPCOT, SIDCO' },
      { k: 'roadWidth', l: 'Road width (ft)', t: 'number' },
      { k: 'truckAccess', l: 'Truck access', t: 'select', o: ['Container trucks', 'Small trucks only', 'No truck access'] },
      { k: 'water', l: 'Water supply', t: 'select', o: ['Municipal supply', 'Borewell', 'Industrial supply', 'Not available'] },
    ],
  },
};

const CATEGORIES = ['Residential', 'Commercial'];
const LISTING_PURPOSES = ['Sale', 'Lease', 'Rent'];
const PROPERTY_STATUSES = ['Available', 'Under negotiation', 'Reserved', 'Booked', 'On hold', 'Sold'];
const FACINGS = ['East', 'North', 'West', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
const CITIES = {
  Madurai: { district: 'Madurai', localities: ['Vilangudi', 'K.K. Nagar', 'Anna Nagar', 'Thiruparankundram', 'Ponmeni', 'Othakadai', 'Kappalur', 'Thirunagar'] },
  Chennai: { district: 'Chennai', localities: ['Sholinganallur (OMR)', 'Velachery', 'Porur', 'Tambaram'] },
  Coimbatore: { district: 'Coimbatore', localities: ['Peelamedu', 'Vadavalli', 'Saravanampatti'] },
  Tiruchirappalli: { district: 'Tiruchirappalli', localities: ['Thillai Nagar', 'K.K. Nagar (Trichy)', 'Srirangam'] },
  Salem: { district: 'Salem', localities: ['Fairlands', 'Hasthampatti', 'Alagapuram'] },
  Tirunelveli: { district: 'Tirunelveli', localities: ['Palayamkottai', 'Vannarpettai', 'Perumalpuram'] },
  Erode: { district: 'Erode', localities: ['Perundurai Road', 'Thindal', 'Surampatti'] },
  Vellore: { district: 'Vellore', localities: ['Sathuvachari', 'Katpadi', 'Gandhi Nagar (Vellore)'] },
  Thanjavur: { district: 'Thanjavur', localities: ['Medical College Road', 'Vallam', 'Nanjikottai'] },
  Dindigul: { district: 'Dindigul', localities: ['Reddiarchatram', 'Begampur', 'Nagal Nagar'] },
};
const AMENITIES = ['Gated community', 'Security', 'Park / open space', 'Power backup', 'Lift', 'Gym', 'Swimming pool', 'Clubhouse', 'Rainwater harvesting', 'CCTV', 'Visitor parking', 'Loading bay'];

/* ---------- Location ---------- */
/* Map centre and pincode prefix of each city (stands in for Google geocoding in the wireframe). */
const CITY_GEO = {
  Madurai: [9.925, 78.12, '625'], Chennai: [13.04, 80.23, '600'], Coimbatore: [11.017, 76.955, '641'], Tiruchirappalli: [10.805, 78.686, '620'],
  Salem: [11.665, 78.146, '636'], Tirunelveli: [8.713, 77.757, '627'], Erode: [11.341, 77.717, '638'], Vellore: [12.916, 79.132, '632'],
  Thanjavur: [10.787, 79.137, '613'], Dindigul: [10.362, 77.98, '624'],
};
/* Groups shown in "Explore the neighbourhood", and the place categories inside them.
   The categories are master data (Settings → Nearby place categories); `google` is the Google Places type a category is looked up by. */
const PLACE_GROUPS = [
  { k: 'commute', l: 'Commute', i: '🚌' }, { k: 'schools', l: 'Schools & colleges', i: '🎓' }, { k: 'health', l: 'Hospitals', i: '🏥' },
  { k: 'shop', l: 'Shopping', i: '🛒' }, { k: 'other', l: 'Other & upcoming', i: '📍' },
];
/* check = the route must be checked before it is advertised (everyday places close by — "5 minutes to school");
   far, well-known places (airport, railway station) are advertised with Google's approximate distance.
   auto = shown on every new property by default (the nearest one, from Google). */
const PLACE_CATEGORIES = [
  { name: 'Bus stop', icon: '🚌', group: 'commute', google: 'bus_station', check: true, auto: true },
  { name: 'Railway station', icon: '🚆', group: 'commute', google: 'train_station', check: false, auto: true },
  { name: 'Metro station', icon: '🚇', group: 'commute', google: 'subway_station', check: true, auto: false },
  { name: 'Airport', icon: '✈', group: 'commute', google: 'airport', check: false, auto: false },
  { name: 'Highway', icon: '🛣', group: 'commute', google: '', check: false, auto: false },
  { name: 'School', icon: '🎓', group: 'schools', google: 'school', check: true, auto: true },
  { name: 'College', icon: '🏫', group: 'schools', google: 'university', check: false, auto: false },
  { name: 'Hospital', icon: '🏥', group: 'health', google: 'hospital', check: true, auto: true },
  { name: 'Market', icon: '🛒', group: 'shop', google: 'supermarket', check: true, auto: true },
  { name: 'Shopping mall', icon: '🛍', group: 'shop', google: 'shopping_mall', check: false, auto: false },
  { name: 'Bank', icon: '🏦', group: 'other', google: 'bank', check: false, auto: false },
  { name: 'Place of worship', icon: '🛕', group: 'other', google: 'place_of_worship', check: false, auto: false },
  { name: 'Park', icon: '🌳', group: 'other', google: 'park', check: false, auto: false },
  { name: 'Other', icon: '📍', group: 'other', google: '', check: true, auto: false },
];
const NEARBY_CATEGORIES = PLACE_CATEGORIES.map(c => c.name);
const INFRA_STATUSES = ['Existing', 'Under construction', 'Planned', 'Proposed'];
const ROAD_TYPES = ['Tar road', 'Concrete road', 'Gravel road', 'Mud road', 'Main road', 'Highway service road', 'Industrial road'];
const ROUTE_CHECKS = ['Driven the route', 'Walked the route', 'Travelled by bus / public transport'];

/* ---------- Legal & documentation ---------- */
const LEGAL_DOCS = {
  parent: { n: 'Parent documents', v: 'Ownership history (chain of title)' },
  saledeed: { n: 'Sale deed', v: 'Current ownership and transaction' },
  ec: { n: 'Encumbrance Certificate (EC)', v: 'Registered encumbrances within the searched period' },
  patta: { n: 'Patta / revenue records', v: 'Relevant revenue records' },
  fmb: { n: 'FMB / survey records', v: 'Survey boundaries and measurements' },
  landuse: { n: 'Land-use classification', v: 'Permitted land use' },
  layout: { n: 'Layout approval', v: 'Applicable planning approval (e.g. DTCP / CMDA / local body)' },
  plan: { n: 'Building plan approval', v: 'Sanctioned building plan' },
  completion: { n: 'Completion / occupancy certificate', v: 'Building completed as per approval' },
  rera: { n: 'RERA registration', v: 'Registration or exemption status, as applicable' },
  fire: { n: 'Fire NOC', v: 'Fire safety clearance, where applicable' },
  tax: { n: 'Tax receipts', v: 'Property tax / land revenue records' },
};
const LEGAL_BY_TYPE = {
  plot: ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'landuse', 'layout', 'rera', 'tax'],
  flat: ['parent', 'saledeed', 'ec', 'patta', 'plan', 'completion', 'rera', 'tax'],
  house: ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'plan', 'completion', 'tax'],
  commercial: ['parent', 'saledeed', 'ec', 'patta', 'landuse', 'plan', 'completion', 'fire', 'tax'],
  agri: ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'tax'],
  industrial: ['parent', 'saledeed', 'ec', 'patta', 'landuse', 'plan', 'fire', 'tax'],
};
/* Mandatory checks — a property with any of these unresolved can never be a top recommendation */
const MANDATORY_BY_TYPE = {
  plot: ['saledeed', 'ec', 'layout'],
  flat: ['saledeed', 'ec', 'plan', 'rera'],
  house: ['saledeed', 'ec', 'plan'],
  commercial: ['saledeed', 'ec', 'plan'],
  agri: ['saledeed', 'ec'],
  industrial: ['saledeed', 'ec', 'plan'],
};
const LEGAL_STATUS = {
  not: { l: 'Not collected', tone: 'grey' },
  pending: { l: 'Collected, pending verification', tone: 'amber' },
  verified: { l: 'Verified by authorised legal professional', tone: 'green' },
};

/* ---------- Customer side ---------- */
const PURPOSES = [
  { v: 'Own use', d: 'Building a family home or living in a flat' },
  { v: 'Investment', d: 'Long-term appreciation or resale' },
  { v: 'Rental income', d: 'Monthly rental returns' },
  { v: 'Business use', d: 'Office, shop, factory or warehouse' },
  { v: 'Second home', d: 'Holiday or weekend home' },
  { v: 'Other', d: 'Something else — we will ask' },
];
const LEAD_SOURCES = ['Website', 'Walk-in', 'Referral', 'Property portal', 'Social media', 'Phone enquiry', 'Channel partner', 'Test'];
const CONTACT_PREFS = ['WhatsApp', 'Phone call', 'Email', 'SMS'];
const BUDGET_BASIS = ['Not clarified yet', 'Property price only', 'Including registration & other costs', 'Includes a home loan'];
const FUNDING_PREFS = ['Own funds', 'Loan', 'Combination'];
const FUNDING_READY = ['Ready', 'Arranging', 'Not decided'];
const TIMELINES = ['Within 1 month', '1–3 months', '3–6 months', '6–12 months', 'Not decided'];
const AUTHORITY = ['Sole decision-maker', 'Joint — family / partners involved', 'Needs approval from others', 'Not known yet'];
const NEED_CLARITY = ['Clear and specific', 'Partly defined', 'Just exploring'];
const CONSTRUCTION_PLANS = ['Within 1 year', '1–3 years', 'No immediate plan', 'Not applicable'];
const STAGES = ['New enquiry', 'Contacted', 'Qualified', 'Property recommended', 'Site visit scheduled', 'Negotiation', 'Booking / Closed'];
const LOST_STAGE = 'Lost';
const LOST_REASONS = ['Bought elsewhere', 'Budget mismatch', 'No suitable inventory', 'Not responding', 'Postponed purchase', 'Loan not approved', 'Other'];
const CLASSIFICATIONS = [
  { v: 'General lead', d: 'Has enquired about a property' },
  { v: 'Qualified buyer', d: 'Has a clear requirement and realistic budget' },
  { v: 'Investor', d: 'Has an investment objective' },
  { v: 'High-value prospect', d: 'Considering a high-ticket property' },
  { v: 'Potential HNI', d: 'Has indicators of substantial wealth or investment capacity' },
  { v: 'Verified HNI', d: 'Status verified through an appropriate, consent-based process' },
];
const HNI_STATUSES = ['Not determined', 'Not verified', 'Potential — indicators recorded', 'Consent obtained — verification in progress', 'Verified', 'Customer declined verification'];
const HNI_SIGNALS = [
  { k: 'prevInvestment', l: 'Previous investment', q: 'Have you invested in property before?' },
  { k: 'portfolio', l: 'Portfolio experience', q: 'Do you own residential or commercial properties?' },
  { k: 'objective', l: 'Investment objective', q: 'Are you looking for capital appreciation or rental income?' },
  { k: 'range', l: 'Purchase range', q: 'What investment range are you considering?' },
  { k: 'fundingReadiness', l: 'Funding readiness', q: 'Have you arranged funds for this purchase?' },
  { k: 'decisionProcess', l: 'Decision process', q: 'Who else will participate in the purchase decision?' },
  { k: 'timeline', l: 'Timeline', q: 'When would you ideally like to complete the purchase?' },
];
const ACTIVITY_TYPES = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Site visit', 'Note', 'Documents shared'];

/* ---------- Default business rules (editable in Settings) ---------- */
const DEFAULT_SETTINGS = {
  matchWeights: { B: 0.30, L: 0.25, S: 0.20, A: 0.15, P: 0.10 },
  readinessPoints: { budget: 25, requirement: 20, timeline: 20, funding: 15, authority: 10, engagement: 10 },
  bands: { high: 80, qualified: 60, developing: 40 },
  highValueThreshold: 15000000, // ₹1.5 Cr — "High-value prospect" suggestion only, never HNI
  stuckDays: 14,
  costs: { stampDutyPct: 7, registrationPct: 4, otherPct: 1 },
  placeCategories: PLACE_CATEGORIES.map(c => ({ ...c })),
  executives: [
    { id: 'EX01', name: 'Executive 01 — Priya S' },
    { id: 'EX02', name: 'Executive 02 — Karthik R' },
    { id: 'EX03', name: 'Executive 03 — Divya M' },
    { id: 'EX04', name: 'Executive 04 — Naveen P' },
  ],
};

/* ---------- Seed helpers ---------- */
function seedLegal(type, verified = [], pending = []) {
  return LEGAL_BY_TYPE[type].map(key => {
    const st = verified.includes(key) ? 'verified' : pending.includes(key) ? 'pending' : 'not';
    return {
      key, status: st,
      verifiedBy: st === 'verified' ? 'Adv. Legal Partner (sample)' : '',
      date: st === 'verified' ? '2026-11-05' : st === 'pending' ? '2026-11-10' : '',
      file: st === 'not' ? '' : `${key}-scan.pdf`,
      note: '',
    };
  });
}
let _nb = 0;
function nb(cat, name, km, status = 'Existing', routeChecked = true) {
  return { id: 'nb' + (++_nb), cat, name, distanceKm: km, durationMin: Math.round(km * 2.6 + 3), routeChecked, status, source: 'user' };
}
function comp(location, type, area, ppsf, kind, date, source, diff) {
  return { location, type, area, pricePerSqft: ppsf, kind, date, source, differences: diff };
}

function seedProperties() {
  return [
    {
      id: 'PROP-1001', title: 'Premium residential plot', type: 'plot', purpose: 'Sale', status: 'Available', listingDate: '2026-11-16',
      city: 'Madurai', locality: 'Vilangudi', state: 'Tamil Nadu', facing: 'East', area: 1200, price: 2800000, amenities: ['Park / open space', 'Rainwater harvesting'], images: 4,
      specs: { length: 40, width: 30, roadWidth: 30, roadAccess: 'Layout road', corner: 'Non-corner', topography: 'Level', surveyNo: '112/3B', subdivision: 'Plot 14', layoutApproval: 'DTCP approval (sample no. 245/2024)', landUse: 'Residential', water: 'Municipal + borewell', electricity: 'Available at site', drainage: 'Underground drainage', roadInfra: 'Tar road' },
      location: { lat: 9.9620, lng: 78.0910, roadType: 'Tar road', roadWidth: 30, highway: { name: 'NH-44 (Madurai–Dindigul)', distanceKm: 3.2, route: 'Via Vilangudi main road; route driven and measured 02 Nov 2026' },
        nearby: [nb('School', 'Green Valley Matriculation School (sample)', 1.4), nb('Hospital', 'City Care Multispeciality Hospital (sample)', 2.8), nb('Bus stop', 'Vilangudi bus stop', 0.6), nb('Railway station', 'Madurai Junction', 9.5), nb('Airport', 'Madurai Airport', 21), nb('Other', 'Outer ring road extension', 1.8, 'Planned', false)] },
      legal: seedLegal('plot', ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'landuse', 'layout', 'tax'], ['rera']),
      valuation: { reviewDate: '2026-11-12', valuerReport: 'Valuer report — Registered Valuer (sample), 10 Nov 2026', notes: '', comparables: [
        comp('Vilangudi, Madurai', 'Residential plot', 1200, 2400, 'Transaction', '2026-09-20', 'Registered sale (sample)', 'Older layout, 23 ft road'),
        comp('Vilangudi, Madurai', 'Residential plot', 1500, 2550, 'Asking', '2026-11-01', 'Property portal listing', 'Corner plot, asking price only'),
        comp('Thirunagar, Madurai', 'Residential plot', 1100, 2450, 'Transaction', '2026-08-14', 'Channel partner', 'Similar approval, 1.5 km away') ] },
      history: [{ date: '2026-11-16', text: 'Property listed', by: 'Admin' }, { date: '2026-11-12', text: 'Price reviewed against 3 comparables', by: 'Admin' }],
    },
    {
      id: 'PROP-1002', title: 'Large plot near ring road', type: 'plot', purpose: 'Sale', status: 'Available', listingDate: '2026-11-08',
      city: 'Madurai', locality: 'Thiruparankundram', state: 'Tamil Nadu', facing: 'East', area: 1500, price: 3000000, amenities: [], images: 3,
      specs: { length: 50, width: 30, roadWidth: 30, roadAccess: 'Layout road', corner: 'Corner', topography: 'Level', surveyNo: '87/1A', subdivision: 'Plot 3', layoutApproval: 'Approval number awaited from seller', landUse: 'Residential', water: 'Borewell', electricity: 'Line nearby — connection to apply', drainage: 'Open drain', roadInfra: 'Gravel road' },
      location: { lat: 9.8810, lng: 78.0700, roadType: 'Gravel road', roadWidth: 30, highway: { name: 'Madurai Ring Road', distanceKm: 1.1, route: 'Measured on map — route not yet driven' },
        nearby: [nb('School', 'Sunrise Public School (sample)', 2.2), nb('Hospital', 'Primary Health Centre (sample)', 3.5), nb('Bus stop', 'Thiruparankundram bus stand', 1.9), nb('Other', 'Proposed metro corridor', 4, 'Proposed', false)] },
      legal: seedLegal('plot', ['parent', 'saledeed', 'ec', 'patta'], ['fmb', 'landuse', 'layout']),
      valuation: { reviewDate: '2026-11-08', valuerReport: '', notes: 'Approval verification pending — do not quote as approved.', comparables: [
        comp('Thiruparankundram, Madurai', 'Residential plot', 1500, 1950, 'Asking', '2026-10-30', 'Property portal listing', 'Mud road access'),
        comp('Thiruparankundram, Madurai', 'Residential plot', 1200, 2100, 'Transaction', '2026-09-02', 'Registered sale (sample)', 'Approved layout'),
        comp('Pasumalai, Madurai', 'Residential plot', 1350, 2050, 'Transaction', '2026-07-18', 'Channel partner', 'Closer to main road') ] },
      history: [{ date: '2026-11-08', text: 'Property listed', by: 'Admin' }],
    },
    {
      id: 'PROP-1003', title: 'East-facing plot in gated layout', type: 'plot', purpose: 'Sale', status: 'Available', listingDate: '2026-11-02',
      city: 'Madurai', locality: 'K.K. Nagar', state: 'Tamil Nadu', facing: 'East', area: 1200, price: 3500000, amenities: ['Gated community', 'Security', 'Park / open space', 'CCTV'], images: 6,
      specs: { length: 40, width: 30, roadWidth: 33, roadAccess: 'Layout road', corner: 'Non-corner', topography: 'Level', surveyNo: '45/2', subdivision: 'Plot 22', layoutApproval: 'DTCP approval (sample no. 118/2023)', landUse: 'Residential', water: 'Municipal supply', electricity: 'Available at site', drainage: 'Underground drainage', roadInfra: 'Concrete road' },
      location: { lat: 9.9300, lng: 78.1450, roadType: 'Concrete road', roadWidth: 33, highway: { name: 'NH-38 (Madurai–Trichy)', distanceKm: 4.5, route: 'Via K.K. Nagar 80 ft road; driven 28 Oct 2026' },
        nearby: [nb('School', 'Lakeview Senior Secondary School (sample)', 0.9), nb('Hospital', 'Meenakshi Care Hospital (sample)', 1.6), nb('Bus stop', 'K.K. Nagar arch', 0.4), nb('Market', 'Mattuthavani market', 3.0)] },
      legal: seedLegal('plot', ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'landuse', 'layout', 'rera', 'tax']),
      valuation: { reviewDate: '2026-11-02', valuerReport: '', notes: '', comparables: [
        comp('K.K. Nagar, Madurai', 'Residential plot', 1200, 2850, 'Transaction', '2026-10-05', 'Registered sale (sample)', 'Non-gated'),
        comp('K.K. Nagar, Madurai', 'Residential plot', 1000, 3050, 'Asking', '2026-10-28', 'Property portal listing', 'Gated, smaller plot'),
        comp('Anna Nagar, Madurai', 'Residential plot', 1200, 2900, 'Transaction', '2026-08-21', 'Channel partner', 'Similar approval') ] },
      history: [{ date: '2026-11-02', text: 'Property listed', by: 'Admin' }],
    },
    {
      id: 'PROP-1004', title: 'Budget plot near bypass', type: 'plot', purpose: 'Sale', status: 'Sold', listingDate: '2026-09-10',
      city: 'Madurai', locality: 'Othakadai', state: 'Tamil Nadu', facing: 'East', area: 1200, price: 2600000, amenities: [], images: 2,
      specs: { length: 40, width: 30, roadWidth: 30, roadAccess: 'Public road', corner: 'Non-corner', topography: 'Level', surveyNo: '201/4', subdivision: '', layoutApproval: 'DTCP approval (sample no. 77/2022)', landUse: 'Residential', water: 'Borewell', electricity: 'Available at site', drainage: 'Open drain', roadInfra: 'Tar road' },
      location: { lat: 9.9550, lng: 78.1900, roadType: 'Tar road', roadWidth: 30, highway: { name: 'Madurai–Melur road', distanceKm: 0.8, route: 'Driven 12 Sep 2026' }, nearby: [nb('School', 'Government Higher Secondary School (sample)', 1.2)] },
      legal: seedLegal('plot', ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'landuse', 'layout', 'tax']),
      valuation: { reviewDate: '2026-09-10', valuerReport: '', notes: 'Sold 30 Oct 2026', comparables: [comp('Othakadai, Madurai', 'Residential plot', 1200, 2150, 'Transaction', '2026-08-01', 'Registered sale (sample)', 'Similar')] },
      history: [{ date: '2026-10-30', text: 'Status changed to Sold', by: 'Admin' }],
    },
    {
      id: 'PROP-1005', title: '2 BHK apartment, Anna Nagar', type: 'flat', purpose: 'Sale', status: 'Available', listingDate: '2026-10-20',
      city: 'Madurai', locality: 'Anna Nagar', state: 'Tamil Nadu', facing: 'North', area: 1050, price: 5200000, amenities: ['Lift', 'Power backup', 'Security', 'CCTV', 'Visitor parking'], images: 8,
      specs: { bhk: '2 BHK', carpet: 820, superBuiltup: 1250, floor: 3, totalFloors: 5, lifts: 1, parking: '1 covered', uds: 420, maintenance: 2500, possession: 'Ready to move', possessionDate: '' },
      location: { lat: 9.9250, lng: 78.1380, roadType: 'Tar road', roadWidth: 40, highway: { name: 'NH-38', distanceKm: 3.8, route: 'Driven 18 Oct 2026' },
        nearby: [nb('School', 'St. Mary’s Matriculation School (sample)', 0.7), nb('Hospital', 'Anna Nagar Clinic & Nursing Home (sample)', 0.5), nb('Bus stop', 'Anna Nagar bus stop', 0.3), nb('Railway station', 'Madurai Junction', 5.6)] },
      legal: seedLegal('flat', ['parent', 'saledeed', 'ec', 'patta', 'plan', 'completion', 'rera', 'tax']),
      valuation: { reviewDate: '2026-10-20', valuerReport: '', notes: '', comparables: [
        comp('Anna Nagar, Madurai', '2 BHK flat', 1000, 4800, 'Transaction', '2026-09-11', 'Registered sale (sample)', 'Older building'),
        comp('Anna Nagar, Madurai', '2 BHK flat', 1100, 5100, 'Asking', '2026-10-15', 'Property portal listing', 'New building'),
        comp('K.K. Nagar, Madurai', '2 BHK flat', 1050, 4950, 'Transaction', '2026-08-30', 'Channel partner', 'No lift') ] },
      history: [{ date: '2026-10-20', text: 'Property listed', by: 'Admin' }],
    },
    {
      id: 'PROP-1006', title: '3 BHK apartment on OMR', type: 'flat', purpose: 'Sale', status: 'Available', listingDate: '2026-10-05',
      city: 'Chennai', locality: 'Sholinganallur (OMR)', state: 'Tamil Nadu', facing: 'East', area: 1450, price: 9800000, amenities: ['Lift', 'Power backup', 'Gym', 'Swimming pool', 'Clubhouse', 'Security', 'CCTV'], images: 10,
      specs: { bhk: '3 BHK', carpet: 1120, superBuiltup: 1720, floor: 9, totalFloors: 14, lifts: 3, parking: '1 covered', uds: 510, maintenance: 5200, possession: 'Under construction', possessionDate: '2027-09' },
      location: { lat: 12.9010, lng: 80.2270, roadType: 'Highway service road', roadWidth: 60, highway: { name: 'OMR (Rajiv Gandhi Salai)', distanceKm: 0.4, route: 'Direct access; peak hours add 20+ minutes' },
        nearby: [nb('School', 'Bayview International School (sample)', 1.8), nb('Hospital', 'OMR Multispeciality Hospital (sample)', 2.1), nb('Other', 'Metro Phase 2 — Sholinganallur station', 0.9, 'Under construction', true)] },
      legal: seedLegal('flat', ['parent', 'saledeed', 'ec', 'patta', 'plan', 'rera'], ['tax']),
      valuation: { reviewDate: '2026-10-05', valuerReport: '', notes: 'Under construction — completion certificate not applicable yet.', comparables: [
        comp('Sholinganallur, Chennai', '3 BHK flat', 1500, 6500, 'Asking', '2026-09-28', 'Builder price list', 'Lower floor'),
        comp('Sholinganallur, Chennai', '3 BHK flat', 1400, 6900, 'Transaction', '2026-08-12', 'Registered sale (sample)', 'Ready to move'),
        comp('Navalur, Chennai', '3 BHK flat', 1450, 6100, 'Transaction', '2026-07-09', 'Channel partner', '3 km further south') ] },
      history: [{ date: '2026-10-05', text: 'Property listed', by: 'Admin' }],
    },
    {
      id: 'PROP-1007', title: 'Independent house, Peelamedu', type: 'house', purpose: 'Sale', status: 'Available', listingDate: '2026-09-25',
      city: 'Coimbatore', locality: 'Peelamedu', state: 'Tamil Nadu', facing: 'North', area: 1800, price: 13500000, amenities: ['Rainwater harvesting', 'Power backup'], images: 7,
      specs: { subType: 'Independent house', landArea: 2400, floors: 2, bedrooms: 3, bathrooms: 3, parking: '2 cars', constructionYear: 2018, quality: 'Standard', condition: 'Good', garden: 'Small front garden', water: 'Municipal + borewell', power: 'EB + inverter', approvalDocs: 'Approval + completion available' },
      location: { lat: 11.0300, lng: 77.0200, roadType: 'Tar road', roadWidth: 30, highway: { name: 'Avinashi Road', distanceKm: 1.2, route: 'Driven 20 Sep 2026' },
        nearby: [nb('School', 'Peelamedu Public School (sample)', 0.8), nb('Hospital', 'Kovai Medical Centre (sample)', 2.4), nb('Airport', 'Coimbatore Airport', 4.2)] },
      legal: seedLegal('house', ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'plan', 'completion', 'tax']),
      valuation: { reviewDate: '2026-09-25', valuerReport: '', notes: '', comparables: [
        comp('Peelamedu, Coimbatore', 'Independent house', 1750, 7300, 'Transaction', '2026-08-18', 'Registered sale (sample)', 'Older construction'),
        comp('Peelamedu, Coimbatore', 'Independent house', 2000, 7800, 'Asking', '2026-09-10', 'Property portal listing', 'Corner, larger land'),
        comp('Hope College, Coimbatore', 'Independent house', 1600, 7100, 'Transaction', '2026-06-22', 'Channel partner', 'Smaller land') ] },
      history: [{ date: '2026-09-25', text: 'Property listed', by: 'Admin' }],
    },
    {
      id: 'PROP-1008', title: 'Luxury villa, Vadavalli', type: 'house', purpose: 'Sale', status: 'Available', listingDate: '2026-10-12',
      city: 'Coimbatore', locality: 'Vadavalli', state: 'Tamil Nadu', facing: 'East', area: 3800, price: 34000000, amenities: ['Gated community', 'Security', 'Swimming pool', 'Clubhouse', 'Power backup', 'CCTV'], images: 12,
      specs: { subType: 'Villa (gated community)', landArea: 5400, floors: 2, bedrooms: 4, bathrooms: 5, parking: '3+ cars', constructionYear: 2025, quality: 'Premium', condition: 'New', garden: 'Private lawn + terrace garden', water: 'Municipal + borewell', power: 'EB + solar', approvalDocs: 'Approval + completion available' },
      location: { lat: 11.0250, lng: 76.9050, roadType: 'Concrete road', roadWidth: 40, highway: { name: 'Marudhamalai Road', distanceKm: 0.9, route: 'Driven 08 Oct 2026' },
        nearby: [nb('School', 'Hillside International School (sample)', 2.5), nb('Hospital', 'West Kovai Hospital (sample)', 3.1), nb('Other', 'Western bypass', 2.0, 'Planned', false)] },
      legal: seedLegal('house', ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'plan', 'tax'], ['completion']),
      valuation: { reviewDate: '2026-10-12', valuerReport: 'Valuer report — Registered Valuer (sample), 09 Oct 2026', notes: '', comparables: [
        comp('Vadavalli, Coimbatore', 'Villa', 3500, 8600, 'Transaction', '2026-07-30', 'Registered sale (sample)', 'Smaller land'),
        comp('Vadavalli, Coimbatore', 'Villa', 4000, 9200, 'Asking', '2026-10-01', 'Builder price list', 'Same community, larger'),
        comp('Thondamuthur Rd, Coimbatore', 'Villa', 3600, 8300, 'Transaction', '2026-06-15', 'Channel partner', 'Farther from city') ] },
      history: [{ date: '2026-10-12', text: 'Property listed', by: 'Admin' }],
    },
    {
      id: 'PROP-1009', title: 'Retail shop, Thillai Nagar main road', type: 'commercial', purpose: 'Sale', status: 'Available', listingDate: '2026-10-01',
      city: 'Tiruchirappalli', locality: 'Thillai Nagar', state: 'Tamil Nadu', facing: 'South', area: 650, price: 8500000, amenities: ['CCTV'], images: 5,
      specs: { commCategory: 'Shop / Showroom', floor: 'Ground', frontage: 18, roadWidth: 60, parking: 'Street parking', permittedUsage: 'Retail / showroom', occupancy: 'Tenanted', rentalIncome: 45000, leaseDuration: '3 years (ends Mar 2028)', leaseTerms: '5% annual escalation', maintenance: 1500, opex: 24000 },
      location: { lat: 10.8250, lng: 78.6850, roadType: 'Main road', roadWidth: 60, highway: { name: 'Trichy–Chennai NH', distanceKm: 4.0, route: 'Driven 25 Sep 2026' }, nearby: [nb('Bus stop', 'Thillai Nagar bus stop', 0.2), nb('Railway station', 'Tiruchirappalli Junction', 3.9)] },
      legal: seedLegal('commercial', ['parent', 'saledeed', 'ec', 'patta', 'landuse', 'plan', 'completion', 'tax'], ['fire']),
      valuation: { reviewDate: '2026-10-01', valuerReport: '', notes: 'Gross rental yield ≈ 6.4% on asking price (before costs).', comparables: [
        comp('Thillai Nagar, Trichy', 'Shop', 600, 12500, 'Transaction', '2026-08-08', 'Registered sale (sample)', 'First floor'),
        comp('Thillai Nagar, Trichy', 'Shop', 700, 13800, 'Asking', '2026-09-20', 'Property portal listing', 'Wider frontage'),
        comp('Cantonment, Trichy', 'Shop', 650, 12900, 'Transaction', '2026-07-01', 'Channel partner', 'Similar footfall') ] },
      history: [{ date: '2026-10-01', text: 'Property listed', by: 'Admin' }],
    },
    {
      id: 'PROP-1010', title: 'Office floor, Velachery', type: 'commercial', purpose: 'Sale', status: 'Reserved', listingDate: '2026-08-18',
      city: 'Chennai', locality: 'Velachery', state: 'Tamil Nadu', facing: 'West', area: 4200, price: 42000000, amenities: ['Lift', 'Power backup', 'Security', 'CCTV', 'Visitor parking'], images: 9,
      specs: { commCategory: 'Office space', floor: '4th of 7', frontage: 0, roadWidth: 80, parking: 'Dedicated 5+', permittedUsage: 'Office / IT', occupancy: 'Vacant', rentalIncome: 0, leaseDuration: '', leaseTerms: '', maintenance: 21000, opex: 180000 },
      location: { lat: 12.9800, lng: 80.2200, roadType: 'Main road', roadWidth: 80, highway: { name: 'Velachery Main Road', distanceKm: 0.1, route: 'Direct frontage' }, nearby: [nb('Railway station', 'Velachery MRTS', 1.1), nb('Other', 'Velachery flyover', 0.6, 'Existing')] },
      legal: seedLegal('commercial', ['parent', 'saledeed', 'ec', 'patta', 'landuse', 'plan', 'completion', 'fire', 'tax']),
      valuation: { reviewDate: '2026-08-18', valuerReport: '', notes: 'Booking received 10 Nov 2026', comparables: [comp('Velachery, Chennai', 'Office floor', 4000, 9800, 'Transaction', '2026-06-30', 'Registered sale (sample)', 'Older building')] },
      history: [{ date: '2026-11-10', text: 'Status changed to Reserved (booking CUST-1013)', by: 'Executive 04 — Naveen P' }],
    },
    {
      id: 'PROP-1011', title: 'Warehouse, Kappalur industrial area', type: 'commercial', purpose: 'Sale', status: 'Available', listingDate: '2026-10-28',
      city: 'Madurai', locality: 'Kappalur', state: 'Tamil Nadu', facing: 'North', area: 10000, price: 26000000, amenities: ['Loading bay', 'Security', 'CCTV'], images: 6,
      specs: { commCategory: 'Warehouse / Godown', floor: 'Ground', frontage: 80, roadWidth: 40, parking: 'Dedicated 5+', permittedUsage: 'Warehousing / light industry', occupancy: 'Vacant', rentalIncome: 0, leaseDuration: '', leaseTerms: '', maintenance: 0, opex: 120000 },
      location: { lat: 9.8700, lng: 78.0300, roadType: 'Industrial road', roadWidth: 40, highway: { name: 'NH-44 (Madurai–Tirunelveli)', distanceKm: 1.5, route: 'Driven 25 Oct 2026; truck-accessible' }, nearby: [nb('Other', 'SIDCO industrial estate', 0.8), nb('Other', 'Freight terminal', 6, 'Proposed', false)] },
      legal: seedLegal('commercial', ['parent', 'saledeed', 'ec', 'patta', 'landuse', 'plan', 'completion', 'tax'], ['fire']),
      valuation: { reviewDate: '2026-10-28', valuerReport: '', notes: '', comparables: [
        comp('Kappalur, Madurai', 'Warehouse', 12000, 2500, 'Transaction', '2026-09-15', 'Registered sale (sample)', 'Larger, older shed'),
        comp('Kappalur, Madurai', 'Warehouse', 8000, 2750, 'Asking', '2026-10-20', 'Property portal listing', 'Newer construction') ] },
      history: [{ date: '2026-10-28', text: 'Property listed', by: 'Admin' }],
    },
    {
      id: 'PROP-1012', title: 'West-facing plot, Ponmeni', type: 'plot', purpose: 'Sale', status: 'Available', listingDate: '2026-11-11',
      city: 'Madurai', locality: 'Ponmeni', state: 'Tamil Nadu', facing: 'West', area: 1350, price: 3100000, amenities: [], images: 3,
      specs: { length: 45, width: 30, roadWidth: 23, roadAccess: 'Public road', corner: 'Non-corner', topography: 'Level', surveyNo: '66/7', subdivision: 'Plot 5', layoutApproval: 'Local body approval (sample no. 39/2021)', landUse: 'Residential', water: 'Municipal supply', electricity: 'Available at site', drainage: 'Underground drainage', roadInfra: 'Tar road' },
      location: { lat: 9.9300, lng: 78.0950, roadType: 'Tar road', roadWidth: 23, highway: { name: 'Madurai–Theni road', distanceKm: 2.6, route: 'Driven 10 Nov 2026' }, nearby: [nb('School', 'Ponmeni Matriculation School (sample)', 0.6), nb('Hospital', 'Ponmeni Nursing Home (sample)', 1.0), nb('Bus stop', 'Ponmeni bus stop', 0.3)] },
      legal: seedLegal('plot', ['parent', 'saledeed', 'ec', 'patta', 'fmb', 'landuse', 'layout', 'tax']),
      valuation: { reviewDate: '2026-11-11', valuerReport: '', notes: '', comparables: [
        comp('Ponmeni, Madurai', 'Residential plot', 1200, 2250, 'Transaction', '2026-09-25', 'Registered sale (sample)', 'Interior road'),
        comp('Ponmeni, Madurai', 'Residential plot', 1400, 2350, 'Asking', '2026-11-02', 'Property portal listing', 'Similar'),
        comp('Bypass Road, Madurai', 'Residential plot', 1300, 2400, 'Transaction', '2026-08-10', 'Channel partner', 'Main road frontage') ] },
      history: [{ date: '2026-11-11', text: 'Property listed', by: 'Admin' }],
    },
  ];
}

function act(date, type, text, by) { return { date, type, text, by }; }
function emptyHni() {
  return { status: 'Not determined', signals: {}, potentialFlag: false, consent: false, consentDate: '', verifiedBy: '', verifiedDate: '', notes: '', reviewedBy: '', reviewedDate: '' };
}
function cust(o) {
  return Object.assign({
    email: '', contactPref: 'WhatsApp', source: 'Website', consent: { followUp: true, date: o.enquiryDate, channel: 'Website form' },
    purposeNote: '', classification: '', hni: emptyHni(), recommended: [], siteVisits: [], negotiation: null, lostReason: '', lostNote: '',
    engagement: { responded: false, docsRequested: false, siteVisited: false }, activity: [],
  }, o);
}

function seedCustomers() {
  return [
    cust({ id: 'CUST-1001', name: 'Arun', mobile: '+91 98xxxxxx01', email: '', contactPref: 'WhatsApp', source: 'Website', enquiryDate: '2026-11-16', owner: 'EX01',
      purpose: 'Own use', purposeNote: 'Construct own house',
      budget: { min: 2000000, pref: 2500000, max: 3000000, flexPct: 5, basis: 'Property price only', funding: 'Combination', fundingReady: 'Arranging' },
      req: { type: 'plot', cities: ['Madurai'], localities: ['Vilangudi', 'Thirunagar'], size: 1200, facing: 'East', minRoad: 30, corner: 'No preference', approvalRequired: true, constructionPlan: 'Within 1 year', siteVisit: true, amenities: [] },
      bant: { authority: 'Joint — family / partners involved', need: 'Clear and specific', timeline: '1–3 months' },
      engagement: { responded: true, docsRequested: false, siteVisited: false },
      stage: 'Qualified', stageSince: '2026-11-16', lastContact: '2026-11-16', nextFollowUp: '2026-11-17',
      activity: [act('2026-11-16', 'Call', 'Discussed requirement: 1,200 sq.ft. plot for own house, wants approved layout. Budget ₹30L is for property only; home loan in process.', 'Executive 01 — Priya S'), act('2026-11-16', 'Note', 'Enquiry received via website form (consent for WhatsApp follow-up given).', 'System')] }),
    cust({ id: 'CUST-1002', name: 'Meena Krishnan', mobile: '+91 98xxxxxx02', email: 'meena.k@example.com', contactPref: 'Phone call', source: 'Property portal', enquiryDate: '2026-10-28', owner: 'EX02',
      purpose: 'Own use',
      budget: { min: 4000000, pref: 4800000, max: 5500000, flexPct: 5, basis: 'Includes a home loan', funding: 'Loan', fundingReady: 'Ready' },
      req: { type: 'flat', cities: ['Madurai'], localities: ['Anna Nagar', 'K.K. Nagar'], size: 1000, bhk: '2 BHK', parking: 'Required', possession: 'Ready to move', approvalRequired: true, siteVisit: true, amenities: ['Lift', 'Security'] },
      bant: { authority: 'Joint — family / partners involved', need: 'Clear and specific', timeline: 'Within 1 month' },
      engagement: { responded: true, docsRequested: true, siteVisited: false }, recommended: ['PROP-1005'],
      siteVisits: [{ date: '2026-11-19', prop: 'PROP-1005', status: 'Scheduled', feedback: '', interest: '' }],
      stage: 'Site visit scheduled', stageSince: '2026-11-12', lastContact: '2026-11-12', nextFollowUp: '2026-11-18',
      activity: [act('2026-11-12', 'WhatsApp', 'Shared brochure and floor plan of PROP-1005. Site visit fixed for 19 Nov.', 'Executive 02 — Karthik R'), act('2026-11-05', 'Call', 'Loan pre-approval letter received (customer confirmed verbally).', 'Executive 02 — Karthik R')] }),
    cust({ id: 'CUST-1003', name: 'Rajesh Kumar', mobile: '+91 98xxxxxx03', source: 'Referral', enquiryDate: '2026-11-03', owner: 'EX01',
      purpose: 'Investment',
      budget: { min: 2500000, pref: 3000000, max: 3500000, flexPct: 0, basis: 'Including registration & other costs', funding: 'Own funds', fundingReady: 'Ready' },
      req: { type: 'plot', cities: ['Madurai'], localities: [], size: 1200, facing: '', minRoad: 0, corner: 'No preference', approvalRequired: true, constructionPlan: 'No immediate plan', siteVisit: true, amenities: [] },
      bant: { authority: 'Sole decision-maker', need: 'Partly defined', timeline: '3–6 months' },
      engagement: { responded: true, docsRequested: true, siteVisited: false }, recommended: ['PROP-1001', 'PROP-1012'],
      stage: 'Property recommended', stageSince: '2026-11-06', lastContact: '2026-11-06', nextFollowUp: '2026-11-14',
      activity: [act('2026-11-06', 'Email', 'Sent comparison of PROP-1001 and PROP-1012 with comparable transactions.', 'Executive 01 — Priya S')] }),
    cust({ id: 'CUST-1004', name: 'Fatima Begum', mobile: '+91 98xxxxxx04', email: 'fatima.b@example.com', contactPref: 'Phone call', source: 'Walk-in', enquiryDate: '2026-09-30', owner: 'EX03',
      purpose: 'Own use',
      budget: { min: 11000000, pref: 13000000, max: 14500000, flexPct: 3, basis: 'Property price only', funding: 'Combination', fundingReady: 'Ready' },
      req: { type: 'house', cities: ['Coimbatore'], localities: ['Peelamedu', 'Saravanampatti'], size: 1700, bhk: '3 BHK', parking: 'Required', possession: 'Ready to move', approvalRequired: true, siteVisit: true, amenities: ['Rainwater harvesting'] },
      bant: { authority: 'Joint — family / partners involved', need: 'Clear and specific', timeline: 'Within 1 month' },
      engagement: { responded: true, docsRequested: true, siteVisited: true }, recommended: ['PROP-1007'],
      siteVisits: [{ date: '2026-10-18', prop: 'PROP-1007', status: 'Completed', feedback: 'Liked layout and location; wants kitchen renovation quote.', interest: 'High' }],
      negotiation: { prop: 'PROP-1007', offered: 12800000, counter: 13200000, notes: 'Seller open to ₹1.31 Cr if registration within 30 days.' },
      stage: 'Negotiation', stageSince: '2026-10-25', lastContact: '2026-11-14', nextFollowUp: '2026-11-16',
      activity: [act('2026-11-14', 'Meeting', 'Price discussion with seller — counter at ₹1.32 Cr.', 'Executive 03 — Divya M'), act('2026-10-18', 'Site visit', 'Site visit completed for PROP-1007.', 'Executive 03 — Divya M')] }),
    cust({ id: 'CUST-1005', name: 'Suresh Babu', mobile: '+91 98xxxxxx05', source: 'Channel partner', enquiryDate: '2026-10-10', owner: 'EX04',
      purpose: 'Rental income',
      budget: { min: 7000000, pref: 8500000, max: 9500000, flexPct: 5, basis: 'Property price only', funding: 'Own funds', fundingReady: 'Ready' },
      req: { type: 'commercial', cities: ['Tiruchirappalli'], localities: ['Thillai Nagar'], size: 600, commCategory: 'Shop / Showroom', occupancy: 'Tenanted', approvalRequired: true, siteVisit: true, amenities: [] },
      bant: { authority: 'Sole decision-maker', need: 'Clear and specific', timeline: '1–3 months' },
      engagement: { responded: true, docsRequested: true, siteVisited: true }, recommended: ['PROP-1009'],
      siteVisits: [{ date: '2026-10-22', prop: 'PROP-1009', status: 'Completed', feedback: 'Satisfied with tenant profile; wants lease agreement copy.', interest: 'High' }],
      negotiation: { prop: 'PROP-1009', offered: 8000000, counter: 8400000, notes: 'Awaiting fire NOC verification before final offer.' },
      stage: 'Negotiation', stageSince: '2026-10-24', lastContact: '2026-10-29', nextFollowUp: '2026-11-12',
      activity: [act('2026-10-29', 'Call', 'Customer will finalise once fire NOC is verified.', 'Executive 04 — Naveen P')] }),
    cust({ id: 'CUST-1006', name: 'Lakshmi Narayanan', mobile: '+91 98xxxxxx06', email: 'lakshmi.n@example.com', contactPref: 'Email', source: 'Referral', enquiryDate: '2026-10-15', owner: 'EX03',
      purpose: 'Investment',
      budget: { min: 30000000, pref: 35000000, max: 40000000, flexPct: 0, basis: 'Property price only', funding: 'Own funds', fundingReady: 'Ready' },
      req: { type: 'house', cities: ['Coimbatore'], localities: ['Vadavalli'], size: 3500, bhk: '4 BHK', parking: 'Required', possession: 'Ready to move', approvalRequired: true, siteVisit: true, amenities: ['Gated community', 'Swimming pool'] },
      bant: { authority: 'Sole decision-maker', need: 'Clear and specific', timeline: '1–3 months' },
      engagement: { responded: true, docsRequested: true, siteVisited: false }, recommended: ['PROP-1008'],
      siteVisits: [{ date: '2026-11-20', prop: 'PROP-1008', status: 'Scheduled', feedback: '', interest: '' }],
      classification: 'Potential HNI',
      hni: { status: 'Potential — indicators recorded', potentialFlag: true, consent: false, consentDate: '', verifiedBy: '', verifiedDate: '', notes: 'Indicators recorded from voluntary conversation only. No financial documents requested.', reviewedBy: 'Sales manager', reviewedDate: '2026-11-10',
        signals: { prevInvestment: 'Yes — 3 previous property purchases (stated)', portfolio: 'Owns 2 residential + 1 commercial (stated)', objective: 'Capital appreciation', range: '₹3–4 Cr per asset', fundingReadiness: 'Own funds arranged (stated)', decisionProcess: 'Self; consults family CA', timeline: 'Within 3 months' } },
      stage: 'Site visit scheduled', stageSince: '2026-11-10', lastContact: '2026-11-10', nextFollowUp: '2026-11-19',
      activity: [act('2026-11-10', 'Meeting', 'Investment discussion; villa site visit fixed for 20 Nov.', 'Executive 03 — Divya M')] }),
    cust({ id: 'CUST-1007', name: 'Vignesh R', mobile: '+91 98xxxxxx07', source: 'Website', enquiryDate: '2026-11-09', owner: 'EX02',
      purpose: 'Own use',
      budget: { min: 8000000, pref: 9500000, max: 10500000, flexPct: 5, basis: 'Includes a home loan', funding: 'Loan', fundingReady: 'Arranging' },
      req: { type: 'flat', cities: ['Chennai'], localities: ['Sholinganallur (OMR)'], size: 1400, bhk: '3 BHK', parking: 'Required', possession: 'Any', approvalRequired: true, siteVisit: true, amenities: ['Gym', 'Swimming pool'] },
      bant: { authority: 'Joint — family / partners involved', need: 'Clear and specific', timeline: '3–6 months' },
      engagement: { responded: true, docsRequested: false, siteVisited: false },
      stage: 'Qualified', stageSince: '2026-11-11', lastContact: '2026-11-11', nextFollowUp: '2026-11-18',
      activity: [act('2026-11-11', 'Call', 'Qualified — 3 BHK on OMR, loan eligibility check in progress.', 'Executive 02 — Karthik R')] }),
    cust({ id: 'CUST-1008', name: 'Anitha Joseph', mobile: '+91 98xxxxxx08', source: 'Social media', enquiryDate: '2026-11-07', owner: 'EX04',
      purpose: 'Second home',
      budget: { min: 6000000, pref: 7000000, max: 8000000, flexPct: 5, basis: 'Not clarified yet', funding: 'Own funds', fundingReady: 'Not decided' },
      req: { type: 'house', cities: ['Madurai'], localities: [], size: 1500, bhk: '2 BHK', parking: 'Preferred', possession: 'Ready to move', approvalRequired: false, siteVisit: true, amenities: [] },
      bant: { authority: 'Not known yet', need: 'Partly defined', timeline: '6–12 months' },
      engagement: { responded: true, docsRequested: false, siteVisited: false },
      stage: 'Contacted', stageSince: '2026-11-08', lastContact: '2026-11-08', nextFollowUp: '2026-11-22',
      activity: [act('2026-11-08', 'WhatsApp', 'Introduced company; customer exploring options for a second home.', 'Executive 04 — Naveen P')] }),
    cust({ id: 'CUST-1009', name: 'Mohammed Irfan', mobile: '+91 98xxxxxx09', email: 'irfan.logistics@example.com', contactPref: 'Phone call', source: 'Phone enquiry', enquiryDate: '2026-10-30', owner: 'EX01',
      purpose: 'Business use', purposeNote: 'Logistics business expansion',
      budget: { min: 22000000, pref: 25000000, max: 28000000, flexPct: 5, basis: 'Property price only', funding: 'Combination', fundingReady: 'Arranging' },
      req: { type: 'commercial', cities: ['Madurai'], localities: ['Kappalur'], size: 9000, commCategory: 'Warehouse / Godown', occupancy: 'Vacant', approvalRequired: true, siteVisit: true, amenities: ['Loading bay'] },
      bant: { authority: 'Joint — family / partners involved', need: 'Clear and specific', timeline: '3–6 months' },
      engagement: { responded: true, docsRequested: true, siteVisited: false }, recommended: ['PROP-1011'],
      stage: 'Property recommended', stageSince: '2026-11-04', lastContact: '2026-11-04', nextFollowUp: '2026-11-17',
      activity: [act('2026-11-04', 'Email', 'Shared PROP-1011 specification sheet and access route.', 'Executive 01 — Priya S')] }),
    cust({ id: 'CUST-1010', name: 'Deepa Srinivasan', mobile: '+91 98xxxxxx10', source: 'Website', enquiryDate: '2026-11-15', owner: 'EX02',
      purpose: 'Own use',
      budget: { min: 1500000, pref: 1800000, max: 2000000, flexPct: 0, basis: 'Not clarified yet', funding: 'Loan', fundingReady: 'Not decided' },
      req: { type: 'plot', cities: ['Madurai'], localities: [], size: 1000, facing: '', minRoad: 0, corner: 'No preference', approvalRequired: true, constructionPlan: '1–3 years', siteVisit: false, amenities: [] },
      bant: { authority: 'Not known yet', need: 'Partly defined', timeline: 'Not decided' },
      engagement: { responded: false, docsRequested: false, siteVisited: false },
      stage: 'New enquiry', stageSince: '2026-11-15', lastContact: '', nextFollowUp: '2026-11-16',
      activity: [act('2026-11-15', 'Note', 'Enquiry received via website form.', 'System')] }),
    cust({ id: 'CUST-1011', name: 'Senthil Kumar', mobile: '+91 98xxxxxx11', source: 'Property portal', enquiryDate: '2026-10-22', owner: 'EX03',
      purpose: 'Investment',
      budget: { min: 3000000, pref: 3500000, max: 4000000, flexPct: 0, basis: 'Property price only', funding: 'Own funds', fundingReady: 'Arranging' },
      req: { type: 'plot', cities: ['Madurai'], localities: ['K.K. Nagar', 'Anna Nagar'], size: 1200, facing: 'East', minRoad: 30, corner: 'No preference', approvalRequired: true, constructionPlan: 'No immediate plan', siteVisit: true, amenities: ['Gated community'] },
      bant: { authority: 'Sole decision-maker', need: 'Partly defined', timeline: '6–12 months' },
      engagement: { responded: true, docsRequested: false, siteVisited: false },
      stage: 'Contacted', stageSince: '2026-10-23', lastContact: '2026-10-23', nextFollowUp: '2026-11-06',
      activity: [act('2026-10-23', 'Call', 'Interested in gated plots; not in a hurry.', 'Executive 03 — Divya M')] }),
    cust({ id: 'CUST-1012', name: 'Kavya Ramesh', mobile: '+91 98xxxxxx12', source: 'Website', enquiryDate: '2026-09-15', owner: 'EX02',
      purpose: 'Own use',
      budget: { min: 4500000, pref: 5000000, max: 5500000, flexPct: 0, basis: 'Includes a home loan', funding: 'Loan', fundingReady: 'Ready' },
      req: { type: 'flat', cities: ['Madurai'], localities: ['Anna Nagar'], size: 1000, bhk: '2 BHK', parking: 'Required', possession: 'Ready to move', approvalRequired: true, siteVisit: true, amenities: [] },
      bant: { authority: 'Joint — family / partners involved', need: 'Clear and specific', timeline: 'Within 1 month' },
      engagement: { responded: true, docsRequested: true, siteVisited: true },
      siteVisits: [{ date: '2026-10-02', prop: 'PROP-1005', status: 'Completed', feedback: 'Liked the flat, felt price was high.', interest: 'Medium' }],
      stage: LOST_STAGE, stageSince: '2026-10-20', lastContact: '2026-10-20', nextFollowUp: '', lostAtStage: 'Site visit scheduled', lostReason: 'Bought elsewhere', lostNote: 'Bought a resale flat nearby at a lower price.',
      activity: [act('2026-10-20', 'Call', 'Customer informed they bought elsewhere.', 'Executive 02 — Karthik R')] }),
    cust({ id: 'CUST-1013', name: 'Ramesh Traders (Ramesh M)', mobile: '+91 98xxxxxx13', email: 'accounts@rameshtraders.example', contactPref: 'Email', source: 'Channel partner', enquiryDate: '2026-08-20', owner: 'EX04',
      purpose: 'Business use', purposeNote: 'Regional office',
      budget: { min: 38000000, pref: 42000000, max: 45000000, flexPct: 0, basis: 'Property price only', funding: 'Combination', fundingReady: 'Ready' },
      req: { type: 'commercial', cities: ['Chennai'], localities: ['Velachery'], size: 4000, commCategory: 'Office space', occupancy: 'Vacant', approvalRequired: true, siteVisit: true, amenities: ['Lift', 'Power backup'] },
      bant: { authority: 'Joint — family / partners involved', need: 'Clear and specific', timeline: 'Within 1 month' },
      engagement: { responded: true, docsRequested: true, siteVisited: true }, recommended: ['PROP-1010'], classification: 'High-value prospect',
      siteVisits: [{ date: '2026-09-12', prop: 'PROP-1010', status: 'Completed', feedback: 'Suitable; partners approved.', interest: 'High' }],
      negotiation: { prop: 'PROP-1010', offered: 41000000, counter: 42000000, notes: 'Closed at ₹4.2 Cr.' },
      stage: 'Booking / Closed', stageSince: '2026-11-10', lastContact: '2026-11-10', nextFollowUp: '2026-11-25',
      activity: [act('2026-11-10', 'Meeting', 'Booking amount received; registration planned 25 Nov.', 'Executive 04 — Naveen P')] }),
    cust({ id: 'CUST-1014', name: 'Priyanka Nair', mobile: '+91 98xxxxxx14', source: 'Social media', enquiryDate: '2026-11-14', owner: 'EX04',
      purpose: 'Rental income',
      budget: { min: 8000000, pref: 9000000, max: 10000000, flexPct: 0, basis: 'Not clarified yet', funding: 'Loan', fundingReady: 'Not decided' },
      req: { type: 'flat', cities: ['Chennai'], localities: [], size: 1200, bhk: '2 BHK', parking: 'Preferred', possession: 'Any', approvalRequired: true, siteVisit: false, amenities: [] },
      bant: { authority: 'Not known yet', need: 'Just exploring', timeline: 'Not decided' },
      engagement: { responded: false, docsRequested: false, siteVisited: false },
      stage: 'New enquiry', stageSince: '2026-11-14', lastContact: '', nextFollowUp: '2026-11-15',
      activity: [act('2026-11-14', 'Note', 'Instagram lead form.', 'System')] }),
    cust({ id: 'CUST-1015', name: 'Karthik Subramanian', mobile: '+91 98xxxxxx15', source: 'Website', enquiryDate: '2026-11-12', owner: 'EX01',
      purpose: 'Investment',
      budget: { min: 50000000, pref: 60000000, max: 70000000, flexPct: 0, basis: 'Not clarified yet', funding: 'Combination', fundingReady: 'Not decided' },
      req: { type: 'commercial', cities: ['Tiruchirappalli', 'Madurai'], localities: [], size: 5000, commCategory: 'Commercial building', occupancy: 'Tenanted', approvalRequired: true, siteVisit: false, amenities: [] },
      bant: { authority: 'Not known yet', need: 'Just exploring', timeline: 'Not decided' },
      engagement: { responded: true, docsRequested: false, siteVisited: false },
      stage: 'Contacted', stageSince: '2026-11-13', lastContact: '2026-11-13', nextFollowUp: '2026-11-20',
      activity: [act('2026-11-13', 'Call', 'Stated ₹5–7 Cr range; no timeline or funding plan yet. High budget ≠ HNI — keep as high-value prospect only.', 'Executive 01 — Priya S')] }),
  ];
}

function seedDB() {
  return {
    version: 1,
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
    properties: seedProperties(),
    customers: seedCustomers(),
    counters: { prop: 1012, cust: 1015 },
  };
}
