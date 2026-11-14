import type { AmenityIcon, AttributeType, CategoryKey, Purpose } from '@real-estate/shared';
import { normalizeLabel } from '@real-estate/shared';
import {
  AmenityModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from './propertyTypes.model';

interface StartingAttribute {
  key: string;
  label: string;
  type: AttributeType;
  unit?: string;
  options?: string[];
  searchFilter?: boolean;
}

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

/** An attribute placed in a category or subcategory: its key, or `{ key, required }`. */
type Place = string | { key: string; required: boolean };

interface StartingSubcategory {
  name: string;
  codePrefix: string;
  purposes: Purpose[];
  attributes: Place[];
}

interface StartingAmenity {
  name: string;
  icon: AmenityIcon;
  /** Subcategory code prefixes, or 'all'. */
  for: 'all' | string[];
}

interface StartingCategory {
  name: string;
  attributes: Place[];
  subcategories: StartingSubcategory[];
  amenities: StartingAmenity[];
}

/** The categories in display order. A category without a starting setup stays inactive. */
const CATEGORY_ORDER: { key: CategoryKey; name: string }[] = [
  { key: 'residential', name: 'Residential' },
  { key: 'commercial', name: 'Commercial' },
  { key: 'other', name: 'Other' },
];

/** What each category starts with. A category with a setup here becomes active. */
const SETUPS: Partial<Record<CategoryKey, StartingCategory>> = {
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

const placeKey = (p: Place) => (typeof p === 'string' ? p : p.key);

/**
 * Finds or creates the starting attributes with these keys and returns key → id.
 * An attribute an admin already made with the same name is reused instead of duplicated.
 */
async function ensureAttributes(keys: string[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const attr of ATTRIBUTES.filter((a) => keys.includes(a.key))) {
    const labelKey = normalizeLabel(attr.label);
    const existing = await PropertyAttributeModel.findOne({
      $or: [{ key: attr.key }, { labelKey }],
    })
      .select('_id')
      .lean<{ _id: string }>();
    if (existing) {
      ids.set(attr.key, existing._id);
      continue;
    }
    const created = await PropertyAttributeModel.create({
      key: attr.key,
      label: attr.label,
      labelKey,
      type: attr.type,
      unit: attr.unit ?? null,
      options: attr.options ?? [],
      searchFilter: attr.searchFilter ?? false,
    });
    ids.set(attr.key, created._id as string);
  }
  return ids;
}

/**
 * Sets up one category the first time: its attributes, subcategories and common attributes,
 * then marks it active. A marker (`setupSeededAt`) makes sure this happens only once, so
 * anything an admin later deletes never comes back. Subcategories whose name or code prefix
 * is already taken are skipped.
 */
async function ensureCategorySetup(key: CategoryKey): Promise<boolean> {
  const setup = SETUPS[key];
  const category = await PropertyCategoryModel.findOne({ key }).lean<{
    attributes: unknown[];
    setupSeededAt?: Date | null;
  }>();
  if (!setup || !category || category.setupSeededAt) return false;

  const keys = [
    ...setup.attributes.map(placeKey),
    ...setup.subcategories.flatMap((s) => s.attributes.map(placeKey)),
  ];
  const ids = await ensureAttributes([...new Set(keys)]);
  const place = (places: Place[]) =>
    places.flatMap((p) => {
      const id = ids.get(placeKey(p));
      return id ? [{ attributeId: id, required: typeof p === 'string' ? false : p.required }] : [];
    });

  const existingCount = await PropertySubcategoryModel.countDocuments({ categoryKey: key });
  for (const [i, sub] of setup.subcategories.entries()) {
    const nameKey = normalizeLabel(sub.name);
    const taken = await PropertySubcategoryModel.exists({
      $or: [{ codePrefix: sub.codePrefix }, { categoryKey: key, nameKey }],
    });
    if (taken) continue; // an admin already uses this name or code prefix
    await PropertySubcategoryModel.create({
      categoryKey: key,
      name: sub.name,
      nameKey,
      codePrefix: sub.codePrefix,
      purposes: sub.purposes,
      isActive: true,
      order: existingCount + i,
      attributes: place(sub.attributes),
    });
  }
  await PropertyCategoryModel.updateOne(
    { key },
    {
      $set: {
        isActive: true,
        setupSeededAt: new Date(),
        // Keep common attributes an admin may already have chosen.
        ...(category.attributes.length === 0 && { attributes: place(setup.attributes) }),
      },
    },
  );
  return true;
}

/**
 * Creates the categories the first time, then sets up every category that has a starting
 * setup (Residential, Commercial, Other) and their amenities. Runs at startup and from the seed
 * script. Each step runs once, so databases set up earlier get new categories (e.g.
 * Commercial) without anything an admin deleted coming back.
 */
export async function ensureStartingPropertyTypes(): Promise<'created' | 'exists'> {
  const fresh = !(await PropertyCategoryModel.exists({}));
  if (fresh) {
    for (const [order, cat] of CATEGORY_ORDER.entries()) {
      await PropertyCategoryModel.updateOne(
        { key: cat.key },
        { $setOnInsert: { key: cat.key, name: cat.name, isActive: false, order, attributes: [] } },
        { upsert: true },
      );
    }
  } else if (
    !(await PropertyCategoryModel.exists({ key: 'residential', setupSeededAt: { $ne: null } }))
  ) {
    // Databases from before the marker existed: Residential was already set up.
    await PropertyCategoryModel.updateOne(
      { key: 'residential', isActive: true },
      { $set: { setupSeededAt: new Date() } },
    );
  }
  for (const { key } of CATEGORY_ORDER) await ensureCategorySetup(key);
  await ensureStartingAmenities();
  return fresh ? 'created' : 'exists';
}

/**
 * Adds each category's starting amenities once (also to databases set up before amenities
 * existed). A marker on the category makes sure deleted amenities never come back. Only
 * active categories get amenities.
 */
export async function ensureStartingAmenities(): Promise<'created' | 'exists'> {
  let created = false;
  for (const { key } of CATEGORY_ORDER) {
    const setup = SETUPS[key];
    const category = await PropertyCategoryModel.findOne({ key }).lean<{
      isActive: boolean;
      amenitiesSeededAt?: Date | null;
    }>();
    if (!setup || !category?.isActive || category.amenitiesSeededAt) continue;

    const subs = await PropertySubcategoryModel.find({ categoryKey: key })
      .select('codePrefix')
      .lean<{ _id: string; codePrefix: string }[]>();
    const idOf = new Map(subs.map((s) => [s.codePrefix, s._id]));
    for (const [order, a] of setup.amenities.entries()) {
      const ids = a.for === 'all' ? [] : a.for.flatMap((p) => (idOf.has(p) ? [idOf.get(p)!] : []));
      if (a.for !== 'all' && ids.length === 0) continue; // its subcategories were removed
      await AmenityModel.updateOne(
        { categoryKey: key, nameKey: normalizeLabel(a.name) },
        {
          $setOnInsert: {
            categoryKey: key,
            name: a.name,
            nameKey: normalizeLabel(a.name),
            icon: a.icon,
            appliesToAll: a.for === 'all',
            subcategoryIds: ids,
            isActive: true,
            order,
          },
        },
        { upsert: true },
      );
    }
    await PropertyCategoryModel.updateOne({ key }, { $set: { amenitiesSeededAt: new Date() } });
    created = true;
  }
  return created ? 'created' : 'exists';
}
