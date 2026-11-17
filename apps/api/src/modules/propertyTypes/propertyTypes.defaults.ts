import { legalChecklist, normalizeLabel } from '@real-estate/shared';
import type {
  AmenityIcon,
  AttributeType,
  CategoryKey,
  LegalCheckKey,
  LegalChecklistItem,
  MainAreaMeaning,
  Purpose,
} from '@real-estate/shared';
import {
  AmenityModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from './propertyTypes.model';

/**
 * The starting property catalogue v2, approved 2026-11-16 (docs/v2/PROPERTY-CATALOGUE.md),
 * from the wireframe's property types. Attributes that suit every type are common; the
 * rest belong to one type. Admins change all of it later in Settings.
 */

export interface StartingAttribute {
  key: string;
  label: string;
  type: AttributeType;
  unit?: string;
  options?: string[];
  searchFilter?: boolean;
}

const FACING = [
  'East',
  'North',
  'West',
  'South',
  'North-East',
  'North-West',
  'South-East',
  'South-West',
];
const WATER_SUPPLY = [
  'Municipal supply',
  'Borewell',
  'Municipal + borewell',
  'Tanker dependent',
  'Not available',
];

/** Each attribute is defined once; shared ones (water supply, maintenance) are placed twice. */
const ATTRIBUTES: StartingAttribute[] = [
  // Common: every property type
  { key: 'facing', label: 'Facing', type: 'dropdown', options: FACING, searchFilter: true },
  { key: 'description', label: 'Description', type: 'long_text' },
  // Shared by several types
  { key: 'water_supply', label: 'Water supply', type: 'dropdown', options: WATER_SUPPLY },
  { key: 'maintenance', label: 'Maintenance', type: 'number', unit: '₹ / month' },
  // Residential plot
  { key: 'length', label: 'Length', type: 'number', unit: 'ft' },
  { key: 'width', label: 'Width', type: 'number', unit: 'ft' },
  {
    key: 'road_access',
    label: 'Road access',
    type: 'dropdown',
    options: ['Public road', 'Layout road', 'Private / pathway access'],
    searchFilter: true,
  },
  {
    key: 'corner',
    label: 'Corner / non-corner',
    type: 'dropdown',
    options: ['Non-corner', 'Corner'],
    searchFilter: true,
  },
  {
    key: 'topography',
    label: 'Topography',
    type: 'dropdown',
    options: ['Level', 'Gentle slope', 'Elevated', 'Low-lying'],
  },
  { key: 'survey_number', label: 'Survey number', type: 'text' },
  { key: 'subdivision', label: 'Subdivision', type: 'text' },
  { key: 'layout_approval', label: 'Layout approval details', type: 'text' },
  {
    key: 'land_use',
    label: 'Land-use classification',
    type: 'dropdown',
    options: [
      'Residential',
      'Mixed residential',
      'Commercial',
      'Agricultural (conversion required)',
    ],
    searchFilter: true,
  },
  {
    key: 'electricity',
    label: 'Electricity',
    type: 'dropdown',
    options: ['Available at site', 'Line nearby — connection to apply', 'Not available'],
  },
  {
    key: 'drainage',
    label: 'Drainage',
    type: 'dropdown',
    options: ['Underground drainage', 'Open drain', 'Not available'],
  },
  // Flat / Apartment
  {
    key: 'bhk',
    label: 'BHK configuration',
    type: 'dropdown',
    options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', '4+ BHK'],
    searchFilter: true,
  },
  { key: 'carpet_area', label: 'Carpet area', type: 'number', unit: 'sq.ft' },
  { key: 'super_built_up_area', label: 'Super built-up area', type: 'number', unit: 'sq.ft' },
  { key: 'floor_number', label: 'Floor number', type: 'number' },
  { key: 'total_floors', label: 'Total floors', type: 'number' },
  { key: 'lifts', label: 'Number of lifts', type: 'number' },
  {
    key: 'parking_allocation',
    label: 'Parking allocation',
    type: 'dropdown',
    options: ['None', '1 covered', '2 covered', '1 open', 'Shared'],
    searchFilter: true,
  },
  { key: 'uds', label: 'UDS (undivided share of land)', type: 'number', unit: 'sq.ft' },
  {
    key: 'possession_status',
    label: 'Possession status',
    type: 'dropdown',
    options: ['Ready to move', 'Under construction'],
    searchFilter: true,
  },
  { key: 'expected_possession', label: 'Expected possession', type: 'month' },
  // Independent house / Villa
  {
    key: 'house_type',
    label: 'House or villa',
    type: 'dropdown',
    options: ['Independent house', 'Villa (gated community)', 'Row house'],
    searchFilter: true,
  },
  { key: 'land_area', label: 'Land area', type: 'number', unit: 'sq.ft' },
  { key: 'floors', label: 'Number of floors', type: 'number' },
  { key: 'bedrooms', label: 'Bedrooms', type: 'number', searchFilter: true },
  { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
  {
    key: 'car_parking',
    label: 'Car parking',
    type: 'dropdown',
    options: ['None', '1 car', '2 cars', '3+ cars'],
    searchFilter: true,
  },
  { key: 'construction_year', label: 'Construction year', type: 'number' },
  {
    key: 'construction_quality',
    label: 'Construction quality',
    type: 'dropdown',
    options: ['Premium', 'Standard', 'Basic'],
  },
  {
    key: 'condition',
    label: 'Condition',
    type: 'dropdown',
    options: ['New', 'Good', 'Needs minor repair', 'Needs major repair'],
  },
  { key: 'garden', label: 'Private garden / amenities', type: 'text' },
  {
    key: 'power_arrangement',
    label: 'Power arrangement',
    type: 'dropdown',
    options: ['EB connection', 'EB + inverter', 'EB + generator backup', 'EB + solar'],
  },
  {
    key: 'approval_docs',
    label: 'Approval & completion documents',
    type: 'dropdown',
    options: ['Approval + completion available', 'Approval only', 'Not available'],
  },
  // Commercial (all commercial types)
  { key: 'floor', label: 'Floor', type: 'text' },
  { key: 'frontage', label: 'Frontage', type: 'number', unit: 'ft' },
  {
    key: 'parking',
    label: 'Parking',
    type: 'dropdown',
    options: ['None', 'Street parking', 'Dedicated 1–5', 'Dedicated 5+'],
    searchFilter: true,
  },
  { key: 'permitted_usage', label: 'Permitted usage', type: 'text' },
  {
    key: 'occupancy',
    label: 'Occupancy status',
    type: 'dropdown',
    options: ['Vacant', 'Tenanted', 'Owner-occupied'],
    searchFilter: true,
  },
  { key: 'rental_income', label: 'Rental income', type: 'number', unit: '₹ / month' },
  { key: 'lease_duration', label: 'Lease duration', type: 'text' },
  { key: 'lease_terms', label: 'Lease terms', type: 'text' },
  { key: 'operating_expenses', label: 'Operating expenses', type: 'number', unit: '₹ / year' },
];

/** An attribute placed in a category or subcategory: its key, or `{ key, required }`. */
export type Place = string | { key: string; required: boolean };

export interface StartingSubcategory {
  name: string;
  codePrefix: string;
  purposes: Purpose[];
  mainAreaMeaning: MainAreaMeaning;
  legalChecklist: LegalChecklistItem[];
  attributes: Place[];
}

export interface StartingAmenity {
  name: string;
  icon: AmenityIcon;
  /** Subcategory code prefixes, or 'all'. */
  for: 'all' | string[];
}

export interface StartingCategory {
  name: string;
  attributes: Place[];
  subcategories: StartingSubcategory[];
  amenities: StartingAmenity[];
}

/** Legal checklists from the wireframe (PRD v2 §6.6); mandatory checks are listed second. */
const LEGAL: Record<'plot' | 'flat' | 'house' | 'commercial', LegalChecklistItem[]> = {
  plot: legalChecklist(
    [
      'parent_documents',
      'sale_deed',
      'encumbrance_certificate',
      'patta',
      'fmb_survey',
      'land_use',
      'layout_approval',
      'rera',
      'tax_receipts',
    ],
    ['sale_deed', 'encumbrance_certificate', 'layout_approval'],
  ),
  flat: legalChecklist(
    [
      'parent_documents',
      'sale_deed',
      'encumbrance_certificate',
      'patta',
      'building_plan',
      'completion_certificate',
      'rera',
      'tax_receipts',
    ],
    ['sale_deed', 'encumbrance_certificate', 'building_plan', 'rera'],
  ),
  house: legalChecklist(
    [
      'parent_documents',
      'sale_deed',
      'encumbrance_certificate',
      'patta',
      'fmb_survey',
      'building_plan',
      'completion_certificate',
      'tax_receipts',
    ],
    ['sale_deed', 'encumbrance_certificate', 'building_plan'],
  ),
  commercial: legalChecklist(
    [
      'parent_documents',
      'sale_deed',
      'encumbrance_certificate',
      'patta',
      'land_use',
      'building_plan',
      'completion_certificate',
      'fire_noc',
      'tax_receipts',
    ] satisfies LegalCheckKey[],
    ['sale_deed', 'encumbrance_certificate', 'building_plan'],
  ),
};

const COMMERCIAL_TYPE = (name: string, codePrefix: string): StartingSubcategory => ({
  name,
  codePrefix,
  purposes: ['sale', 'rent', 'lease'],
  mainAreaMeaning: 'usable',
  legalChecklist: LEGAL.commercial,
  // The commercial specification is common to all five types (category level).
  attributes: [],
});

/** The categories in display order. A category without a starting setup stays inactive. */
const CATEGORY_ORDER: { key: CategoryKey; name: string }[] = [
  { key: 'residential', name: 'Residential' },
  { key: 'commercial', name: 'Commercial' },
  { key: 'other', name: 'Other' },
];

/** What each category starts with. "Other" has no setup, so it stays inactive. */
const SETUPS: Partial<Record<CategoryKey, StartingCategory>> = {
  residential: {
    name: 'Residential',
    attributes: ['facing', 'description'],
    subcategories: [
      {
        name: 'Residential plot',
        codePrefix: 'PLT',
        purposes: ['sale', 'lease'],
        mainAreaMeaning: 'plot',
        legalChecklist: LEGAL.plot,
        attributes: [
          'length',
          'width',
          'road_access',
          'corner',
          'topography',
          'survey_number',
          'subdivision',
          'layout_approval',
          'land_use',
          'water_supply',
          'electricity',
          'drainage',
        ],
      },
      {
        name: 'Flat / Apartment',
        codePrefix: 'APT',
        purposes: ['sale', 'rent', 'lease'],
        mainAreaMeaning: 'built_up',
        legalChecklist: LEGAL.flat,
        attributes: [
          'bhk',
          'carpet_area',
          'super_built_up_area',
          'floor_number',
          'total_floors',
          'lifts',
          'parking_allocation',
          'uds',
          'maintenance',
          'possession_status',
          'expected_possession',
        ],
      },
      {
        name: 'Independent house / Villa',
        codePrefix: 'VIL',
        purposes: ['sale', 'rent', 'lease'],
        mainAreaMeaning: 'built_up',
        legalChecklist: LEGAL.house,
        attributes: [
          'house_type',
          'land_area',
          'floors',
          'bedrooms',
          'bathrooms',
          'car_parking',
          'construction_year',
          'construction_quality',
          'condition',
          'garden',
          'water_supply',
          'power_arrangement',
          'approval_docs',
        ],
      },
    ],
    amenities: [
      { name: 'Gated community', icon: 'fence', for: 'all' },
      { name: 'Security', icon: 'shield-check', for: 'all' },
      { name: 'Park / open space', icon: 'trees', for: 'all' },
      { name: 'Power backup', icon: 'zap', for: 'all' },
      { name: 'Lift', icon: 'arrow-up-down', for: ['APT', 'VIL'] },
      { name: 'Gym', icon: 'dumbbell', for: ['APT', 'VIL'] },
      { name: 'Swimming pool', icon: 'waves', for: ['APT', 'VIL'] },
      { name: 'Clubhouse', icon: 'building-2', for: ['APT', 'VIL'] },
      { name: 'Rainwater harvesting', icon: 'cloud-rain', for: 'all' },
      { name: 'CCTV', icon: 'cctv', for: 'all' },
      { name: 'Visitor parking', icon: 'square-parking', for: ['APT', 'VIL'] },
    ],
  },
  commercial: {
    name: 'Commercial',
    attributes: [
      'facing',
      'description',
      'floor',
      'frontage',
      'parking',
      'permitted_usage',
      'occupancy',
      'rental_income',
      'lease_duration',
      'lease_terms',
      'maintenance',
      'operating_expenses',
    ],
    subcategories: [
      COMMERCIAL_TYPE('Office space', 'OFC'),
      COMMERCIAL_TYPE('Shop / Showroom', 'SHP'),
      COMMERCIAL_TYPE('Warehouse / Godown', 'WHS'),
      COMMERCIAL_TYPE('Commercial building', 'CBD'),
      COMMERCIAL_TYPE('Industrial shed', 'ISH'),
    ],
    amenities: [
      { name: 'Security', icon: 'shield-check', for: 'all' },
      { name: 'Power backup', icon: 'zap', for: 'all' },
      { name: 'Lift', icon: 'arrow-up-down', for: 'all' },
      { name: 'Rainwater harvesting', icon: 'cloud-rain', for: 'all' },
      { name: 'CCTV', icon: 'cctv', for: 'all' },
      { name: 'Visitor parking', icon: 'square-parking', for: 'all' },
      { name: 'Loading bay', icon: 'truck', for: ['WHS', 'ISH'] },
    ],
  },
};

/** A starting catalogue: the attribute library and what each category starts with. */
export interface Catalogue {
  attributes: StartingAttribute[];
  setups: Partial<Record<CategoryKey, StartingCategory>>;
}

/** The product's catalogue (v2). Tests of general behaviour pass a fixed catalogue instead. */
export const STARTING_CATALOGUE: Catalogue = { attributes: ATTRIBUTES, setups: SETUPS };

const placeKey = (p: Place) => (typeof p === 'string' ? p : p.key);

/**
 * Finds or creates the starting attributes with these keys and returns key → id.
 * An attribute an admin already made with the same name is reused instead of duplicated.
 */
async function ensureAttributes(
  keys: string[],
  library: StartingAttribute[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const attr of library.filter((a) => keys.includes(a.key))) {
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
 * Sets up one category the first time: its attributes, subcategories (with their main-area
 * meaning and legal checklist) and common attributes, then marks it active. A marker
 * (`setupSeededAt`) makes sure this happens only once, so anything an admin later deletes
 * never comes back. Subcategories whose name or code prefix is already taken are skipped.
 */
async function ensureCategorySetup(key: CategoryKey, catalogue: Catalogue): Promise<boolean> {
  const setup = catalogue.setups[key];
  const category = await PropertyCategoryModel.findOne({ key }).lean<{
    attributes: unknown[];
    setupSeededAt?: Date | null;
  }>();
  if (!setup || !category || category.setupSeededAt) return false;

  const keys = [
    ...setup.attributes.map(placeKey),
    ...setup.subcategories.flatMap((s) => s.attributes.map(placeKey)),
  ];
  const ids = await ensureAttributes([...new Set(keys)], catalogue.attributes);
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
      mainAreaMeaning: sub.mainAreaMeaning,
      legalChecklist: sub.legalChecklist,
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
 * setup (Residential, Commercial) and their amenities. Runs from migration 0001, the seed
 * script and `db:reset-catalogue`. Each step runs once per database.
 */
export async function ensureStartingPropertyTypes(
  catalogue: Catalogue = STARTING_CATALOGUE,
): Promise<'created' | 'exists'> {
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
  for (const { key } of CATEGORY_ORDER) await ensureCategorySetup(key, catalogue);
  await ensureStartingAmenities(catalogue);
  return fresh ? 'created' : 'exists';
}

/**
 * Adds each category's starting amenities once. A marker on the category makes sure deleted
 * amenities never come back. Only active categories get amenities.
 */
export async function ensureStartingAmenities(
  catalogue: Catalogue = STARTING_CATALOGUE,
): Promise<'created' | 'exists'> {
  let created = false;
  for (const { key } of CATEGORY_ORDER) {
    const setup = catalogue.setups[key];
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
