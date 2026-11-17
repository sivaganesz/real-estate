import type { CategoryKey } from '@real-estate/shared';
import type {
  Catalogue,
  StartingAttribute,
  StartingCategory,
  StartingSubcategory,
} from '../modules/propertyTypes/propertyTypes.defaults';

/**
 * A fixed property catalogue for tests of general behaviour (validation, statuses, media,
 * imports, Settings rules). It is the v1 starting catalogue, kept as test data so those
 * tests don't change whenever the product's own starting catalogue changes. The product
 * catalogue (v2) has its own tests in propertyTypes.catalogue.test.ts.
 */
type V1Subcategory = Omit<StartingSubcategory, 'mainAreaMeaning' | 'legalChecklist'>;
type V1Category = Omit<StartingCategory, 'subcategories'> & { subcategories: V1Subcategory[] };

const FACING = [
  'East',
  'West',
  'North',
  'South',
  'North-East',
  'North-West',
  'South-East',
  'South-West',
];
const BHK = ['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', '5+ BHK'];
const FURNISHING = ['Unfurnished', 'Semi-furnished', 'Fully furnished'];
const POSSESSION = ['Ready to move', 'Under construction'];

/**
 * The starting attribute library. Each attribute is defined once and can be placed in
 * several categories and subcategories (e.g. "Carpet area" for flats and offices). All optional.
 */
const ATTRIBUTES: StartingAttribute[] = [
  // Common attributes (Residential and Commercial)
  { key: 'facing', label: 'Facing', type: 'dropdown', options: FACING, searchFilter: true },
  {
    key: 'ownership_type',
    label: 'Ownership type',
    type: 'dropdown',
    options: ['Freehold', 'Leasehold'],
  },
  { key: 'description', label: 'Description', type: 'long_text' },
  // Plots and land
  { key: 'plot_dimensions', label: 'Plot dimensions', type: 'text' },
  { key: 'road_width', label: 'Road width', type: 'number', unit: 'ft', searchFilter: true },
  { key: 'corner_plot', label: 'Corner plot', type: 'yes_no', searchFilter: true },
  {
    key: 'approval_type',
    label: 'Approval type',
    type: 'dropdown',
    options: ['DTCP', 'CMDA', 'Panchayat', 'Unapproved'],
    searchFilter: true,
  },
  { key: 'boundary_wall', label: 'Boundary wall', type: 'yes_no' },
  { key: 'layout_name', label: 'Layout name', type: 'text' },
  { key: 'plot_number', label: 'Plot number', type: 'text' },
  // Villa / House and Apartment / Flat (several are shared by both)
  { key: 'bhk', label: 'BHK', type: 'dropdown', options: BHK, searchFilter: true },
  { key: 'bathrooms', label: 'Bathrooms', type: 'number', searchFilter: true },
  { key: 'built_up_area', label: 'Built-up area', type: 'number', unit: 'sq.ft' },
  { key: 'floors', label: 'Floors', type: 'number' },
  { key: 'car_parking', label: 'Car parking', type: 'number', unit: 'slots' },
  {
    key: 'furnishing',
    label: 'Furnishing',
    type: 'dropdown',
    options: FURNISHING,
    searchFilter: true,
  },
  {
    key: 'possession',
    label: 'Possession',
    type: 'dropdown',
    options: POSSESSION,
    searchFilter: true,
  },
  {
    key: 'age_of_property',
    label: 'Age of property',
    type: 'dropdown',
    options: ['New', '1–5 years', '5–10 years', '10+ years'],
  },
  { key: 'carpet_area', label: 'Carpet area', type: 'number', unit: 'sq.ft' },
  { key: 'floor_number', label: 'Floor number', type: 'number' },
  { key: 'total_floors', label: 'Total floors', type: 'number' },
  { key: 'lift', label: 'Lift', type: 'yes_no', searchFilter: true },
  { key: 'maintenance', label: 'Maintenance', type: 'number', unit: '₹ / month' },
  { key: 'rera_number', label: 'RERA number', type: 'text' },
  // Commercial
  {
    key: 'office_fit_out',
    label: 'Office fit-out',
    type: 'dropdown',
    options: ['Bare shell', 'Warm shell', 'Plug and play'],
    searchFilter: true,
  },
  { key: 'cabins', label: 'Cabins', type: 'number' },
  { key: 'workstations', label: 'Workstations', type: 'number', searchFilter: true },
  { key: 'washrooms', label: 'Washrooms', type: 'number' },
  { key: 'frontage', label: 'Frontage', type: 'number', unit: 'ft' },
  { key: 'ceiling_height', label: 'Ceiling height', type: 'number', unit: 'ft' },
  { key: 'main_road_facing', label: 'Main road facing', type: 'yes_no', searchFilter: true },
  {
    key: 'suitable_for',
    label: 'Suitable for',
    type: 'multi_select',
    options: ['Retail', 'Showroom', 'Restaurant / Café', 'Clinic', 'Bank / ATM', 'Office'],
    searchFilter: true,
  },
  {
    key: 'land_use',
    label: 'Land use',
    type: 'dropdown',
    options: ['Commercial', 'Mixed use', 'Industrial'],
    searchFilter: true,
  },
  { key: 'loading_docks', label: 'Loading docks', type: 'number' },
  { key: 'truck_access', label: 'Truck access', type: 'yes_no', searchFilter: true },
  { key: 'power_load', label: 'Power load', type: 'number', unit: 'kVA' },
  // Other (agricultural and industrial land)
  { key: 'survey_number', label: 'Survey number', type: 'text' },
  {
    key: 'water_source',
    label: 'Water source',
    type: 'multi_select',
    options: ['Borewell', 'Open well', 'Canal', 'River', 'Rain-fed'],
    searchFilter: true,
  },
  {
    key: 'soil_type',
    label: 'Soil type',
    type: 'dropdown',
    options: ['Red soil', 'Black soil', 'Alluvial', 'Sandy', 'Clay', 'Loamy'],
    searchFilter: true,
  },
  { key: 'road_access', label: 'Road access', type: 'yes_no', searchFilter: true },
  { key: 'electricity_connection', label: 'Electricity connection', type: 'yes_no' },
  { key: 'fencing', label: 'Fencing', type: 'yes_no' },
  { key: 'water_connection', label: 'Water connection', type: 'yes_no' },
];

const SETUPS: Partial<Record<CategoryKey, V1Category>> = {
  residential: {
    name: 'Residential',
    attributes: ['facing', 'ownership_type', 'description'],
    subcategories: [
      {
        name: 'Residential Plot',
        codePrefix: 'PLT',
        purposes: ['sale', 'lease'],
        attributes: [
          'plot_dimensions',
          'road_width',
          'corner_plot',
          'approval_type',
          'boundary_wall',
          'layout_name',
          'plot_number',
        ],
      },
      {
        name: 'Villa / House',
        codePrefix: 'VIL',
        purposes: ['sale', 'rent', 'lease'],
        attributes: [
          'bhk',
          'bathrooms',
          'built_up_area',
          'floors',
          'car_parking',
          'furnishing',
          'possession',
          'age_of_property',
        ],
      },
      {
        name: 'Apartment / Flat',
        codePrefix: 'APT',
        purposes: ['sale', 'rent', 'lease'],
        attributes: [
          'bhk',
          'bathrooms',
          'carpet_area',
          'floor_number',
          'total_floors',
          'lift',
          'car_parking',
          'furnishing',
          'possession',
          'maintenance',
          'rera_number',
        ],
      },
    ],
    amenities: [
      { name: 'Gated community', icon: 'fence', for: 'all' },
      { name: '24×7 security', icon: 'shield-check', for: 'all' },
      { name: 'CCTV surveillance', icon: 'cctv', for: 'all' },
      { name: 'Park / Garden', icon: 'trees', for: 'all' },
      { name: "Children's play area", icon: 'baby', for: 'all' },
      { name: 'Street lights', icon: 'lightbulb', for: ['PLT'] },
      { name: 'Tar roads', icon: 'route', for: ['PLT'] },
      { name: 'Covered car parking', icon: 'car', for: ['VIL', 'APT'] },
      { name: 'Power backup', icon: 'zap', for: ['VIL', 'APT'] },
      { name: 'Rainwater harvesting', icon: 'cloud-rain', for: ['VIL', 'APT'] },
      { name: 'Swimming pool', icon: 'waves', for: ['VIL', 'APT'] },
      { name: 'Club house', icon: 'building-2', for: ['VIL', 'APT'] },
      { name: 'Gym', icon: 'dumbbell', for: ['VIL', 'APT'] },
      { name: 'Lift', icon: 'arrow-up-down', for: ['APT'] },
    ],
  },
  commercial: {
    name: 'Commercial',
    attributes: ['facing', 'ownership_type', 'description'],
    subcategories: [
      {
        name: 'Office space',
        codePrefix: 'OFC',
        purposes: ['sale', 'rent', 'lease'],
        attributes: [
          'carpet_area',
          'floor_number',
          'total_floors',
          'office_fit_out',
          'cabins',
          'workstations',
          'washrooms',
          'car_parking',
          'lift',
          'maintenance',
        ],
      },
      {
        name: 'Shop / Showroom',
        codePrefix: 'SHP',
        purposes: ['sale', 'rent', 'lease'],
        attributes: [
          'carpet_area',
          'floor_number',
          'frontage',
          'ceiling_height',
          'washrooms',
          'car_parking',
          'main_road_facing',
          'suitable_for',
        ],
      },
      {
        name: 'Commercial land',
        codePrefix: 'CLD',
        purposes: ['sale', 'lease'],
        attributes: [
          { key: 'plot_dimensions', required: true },
          'road_width',
          'corner_plot',
          'approval_type',
          'land_use',
          'plot_number',
        ],
      },
      {
        name: 'Warehouse / Godown',
        codePrefix: 'WHS',
        purposes: ['sale', 'rent', 'lease'],
        attributes: [
          'built_up_area',
          'ceiling_height',
          'loading_docks',
          'truck_access',
          'power_load',
          'approval_type',
        ],
      },
    ],
    amenities: [
      { name: '24×7 security', icon: 'shield-check', for: 'all' },
      { name: 'CCTV surveillance', icon: 'cctv', for: 'all' },
      { name: 'Power backup', icon: 'zap', for: 'all' },
      { name: 'Fire safety', icon: 'flame', for: 'all' },
      { name: 'Water supply', icon: 'droplets', for: 'all' },
      { name: 'Lift', icon: 'arrow-up-down', for: ['OFC', 'SHP'] },
      { name: 'Visitor parking', icon: 'square-parking', for: ['OFC', 'SHP'] },
      { name: 'Air conditioning', icon: 'snowflake', for: ['OFC', 'SHP'] },
      { name: 'Cafeteria', icon: 'coffee', for: ['OFC'] },
      { name: 'Conference room', icon: 'presentation', for: ['OFC'] },
      { name: 'Loading bay', icon: 'truck', for: ['WHS'] },
      { name: 'Compound wall', icon: 'fence', for: ['CLD', 'WHS'] },
    ],
  },
  other: {
    name: 'Other',
    attributes: ['ownership_type', 'description'],
    subcategories: [
      {
        name: 'Agricultural land',
        codePrefix: 'AGR',
        purposes: ['sale', 'lease'],
        attributes: [
          'survey_number',
          'water_source',
          'soil_type',
          'road_access',
          'road_width',
          'electricity_connection',
          'fencing',
        ],
      },
      {
        name: 'Industrial land',
        codePrefix: 'IND',
        purposes: ['sale', 'lease'],
        attributes: [
          'plot_dimensions',
          'road_width',
          'land_use',
          'approval_type',
          'power_load',
          'water_connection',
          'truck_access',
          'survey_number',
        ],
      },
    ],
    amenities: [
      { name: 'Compound wall', icon: 'fence', for: 'all' },
      { name: '24×7 security', icon: 'shield-check', for: 'all' },
      { name: 'Tar roads', icon: 'route', for: 'all' },
      { name: 'Storage shed', icon: 'store', for: 'all' },
      { name: 'Farm house', icon: 'building-2', for: ['AGR'] },
      { name: 'Drip irrigation', icon: 'droplets', for: ['AGR'] },
      { name: 'Solar power', icon: 'sun', for: ['AGR'] },
      { name: 'CCTV surveillance', icon: 'cctv', for: ['IND'] },
      { name: 'Street lights', icon: 'lightbulb', for: ['IND'] },
    ],
  },
};

export const TEST_CATALOGUE: Catalogue = {
  attributes: ATTRIBUTES,
  setups: Object.fromEntries(
    Object.entries(SETUPS).map(([key, setup]) => [
      key,
      {
        ...setup!,
        subcategories: setup!.subcategories.map((sub) => ({
          ...sub,
          mainAreaMeaning: 'built_up' as const,
          legalChecklist: [],
        })),
      },
    ]),
  ) as Partial<Record<CategoryKey, StartingCategory>>,
};
