import type { AttributeType, CategoryKey, Purpose } from '@real-estate/shared';
import { normalizeLabel } from '@real-estate/shared';
import {
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

/** The attribute library the Residential setup starts with. All optional. */
const ATTRIBUTES: StartingAttribute[] = [
  // Residential common attributes
  { key: 'facing', label: 'Facing', type: 'dropdown', options: FACING, searchFilter: true },
  {
    key: 'ownership_type',
    label: 'Ownership type',
    type: 'dropdown',
    options: ['Freehold', 'Leasehold'],
  },
  { key: 'description', label: 'Description', type: 'long_text' },
  // Residential Plot
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
];

const CATEGORIES: { key: CategoryKey; name: string; isActive: boolean; attributes: string[] }[] = [
  {
    key: 'residential',
    name: 'Residential',
    isActive: true,
    attributes: ['facing', 'ownership_type', 'description'],
  },
  // Set up later, once Residential is complete.
  { key: 'commercial', name: 'Commercial', isActive: false, attributes: [] },
  { key: 'other', name: 'Other', isActive: false, attributes: [] },
];

const SUBCATEGORIES: {
  name: string;
  codePrefix: string;
  purposes: Purpose[];
  attributes: string[];
}[] = [
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
];

/**
 * Creates the starting categories, Residential subcategories and attributes the first time.
 * Runs at startup and from the seed script. Once the categories exist it does nothing, so
 * attributes an admin deleted are never added back.
 */
export async function ensureStartingPropertyTypes(): Promise<'created' | 'exists'> {
  if (await PropertyCategoryModel.exists({})) return 'exists';

  const ids = new Map<string, string>();
  for (const attr of ATTRIBUTES) {
    const doc = await PropertyAttributeModel.findOneAndUpdate(
      { key: attr.key },
      {
        $setOnInsert: {
          key: attr.key,
          label: attr.label,
          labelKey: normalizeLabel(attr.label),
          type: attr.type,
          unit: attr.unit ?? null,
          options: attr.options ?? [],
          searchFilter: attr.searchFilter ?? false,
        },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean<{ _id: string }>();
    ids.set(attr.key, doc!._id);
  }
  const place = (keys: string[]) =>
    keys.map((key) => ({ attributeId: ids.get(key)!, required: false }));

  for (const [order, sub] of SUBCATEGORIES.entries()) {
    await PropertySubcategoryModel.updateOne(
      { codePrefix: sub.codePrefix },
      {
        $setOnInsert: {
          categoryKey: 'residential',
          name: sub.name,
          nameKey: normalizeLabel(sub.name),
          codePrefix: sub.codePrefix,
          purposes: sub.purposes,
          isActive: true,
          order,
          attributes: place(sub.attributes),
        },
      },
      { upsert: true },
    );
  }
  // Categories last: their existence marks the setup as done.
  for (const [order, cat] of CATEGORIES.entries()) {
    await PropertyCategoryModel.updateOne(
      { key: cat.key },
      {
        $setOnInsert: {
          key: cat.key,
          name: cat.name,
          isActive: cat.isActive,
          order,
          attributes: place(cat.attributes),
        },
      },
      { upsert: true },
    );
  }
  return 'created';
}
