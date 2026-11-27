/**
 * The CRM fields an import can fill, per import kind, with the words people use for them in their own sheets
 * (master prompt §15.2: "Rate", "Cost", "Price (₹)" → asking price; "Sq.ft", "SBA" → area). Labels are i18n keys
 * `import:field.<key>`. `value` says how a cell is read (lib/values.ts). Pure data.
 */
import type { ImportKind, PropertyType } from '@/domain/types'
import { PROPERTY_TYPES, familyOf } from '@/domain/catalogue'

export type SheetKind = Exclude<ImportKind, 'document'>
export const SHEET_KINDS: SheetKind[] = ['apartments', 'villas', 'plots', 'commercial', 'leads']
export const PROPERTY_KINDS: SheetKind[] = ['apartments', 'villas', 'plots', 'commercial']
export const isSheetKind = (k: string | undefined): k is SheetKind => !!k && (SHEET_KINDS as string[]).includes(k)
export const isPropertyKind = (k: string | undefined) => !!k && (PROPERTY_KINDS as string[]).includes(k)

export type ValueKind =
  | 'text' | 'phone' | 'email' | 'price' | 'area' | 'int' | 'config' | 'configs' | 'propertyType' | 'propertyTypes'
  | 'facing' | 'possession' | 'date' | 'source' | 'timeline' | 'city' | 'cities' | 'locality' | 'localities' | 'dimensions'
  | 'furnishing' | 'transaction' | 'bool' | 'list'

export type FieldDef = {
  key: string
  value: ValueKind
  /** Words seen in real sheets (lower case, no punctuation). The first one is the canonical name. */
  synonyms: string[]
  /** Needed to save the record; a missing one makes the row a Draft (properties) or needs fixing (leads). */
  required?: boolean
  /** Only for these property kinds (default: all of the kind's table). */
  only?: SheetKind[]
}

export const LEAD_FIELDS: FieldDef[] = [
  { key: 'name', value: 'text', required: true, synonyms: ['name', 'full name', 'customer name', 'client name', 'lead name', 'contact name', 'buyer name', 'buyer', 'customer', 'enquirer'] },
  { key: 'phone', value: 'phone', required: true, synonyms: ['phone', 'mobile', 'mobile no', 'mobile number', 'phone number', 'contact no', 'contact number', 'contact', 'cell', 'whatsapp', 'whatsapp no', 'ph no'] },
  { key: 'email', value: 'email', synonyms: ['email', 'e mail', 'email id', 'email address', 'mail', 'mail id'] },
  { key: 'altPhone', value: 'phone', synonyms: ['alternate phone', 'alternate mobile', 'alt phone', 'other phone', 'landline', 'secondary phone'] },
  { key: 'source', value: 'source', required: true, synonyms: ['source', 'lead source', 'channel', 'portal', 'medium', 'origin'] },
  { key: 'sourceDetail', value: 'text', synonyms: ['campaign', 'sub source', 'campaign name', 'ad name', 'referrer', 'referred by', 'cp name', 'source detail'] },
  { key: 'requirement.cities', value: 'cities', synonyms: ['city', 'location city', 'preferred city', 'town'] },
  { key: 'requirement.localities', value: 'localities', synonyms: ['locality', 'preferred locality', 'preferred location', 'location', 'area', 'preferred area', 'micro market', 'project location'] },
  { key: 'requirement.propertyTypes', value: 'propertyTypes', synonyms: ['property type', 'type', 'category', 'property category', 'looking for'] },
  { key: 'requirement.configurations', value: 'configs', synonyms: ['bhk', 'configuration', 'config', 'unit type', 'bedrooms', 'beds'] },
  { key: 'requirement.budgetMin', value: 'price', synonyms: ['min budget', 'budget min', 'budget from', 'minimum budget', 'budget minimum'] },
  { key: 'requirement.budgetMax', value: 'price', synonyms: ['budget', 'max budget', 'budget max', 'budget to', 'maximum budget', 'price range', 'budget range'] },
  { key: 'qualification.timeline', value: 'timeline', synonyms: ['timeline', 'buying in', 'purchase timeline', 'when', 'time to buy', 'possession needed'] },
  { key: 'preferredLanguage', value: 'text', synonyms: ['language', 'preferred language', 'mother tongue'] },
  { key: 'enquiredAt', value: 'date', synonyms: ['query date', 'enquiry date', 'lead date', 'date', 'created on', 'received on'] },
  { key: 'notes', value: 'text', synonyms: ['notes', 'remarks', 'comments', 'message', 'requirement', 'query', 'details', 'description'] },
]

const P = { all: undefined, flats: ['apartments', 'commercial'] as SheetKind[], built: ['apartments', 'villas', 'commercial'] as SheetKind[], land: ['plots', 'villas'] as SheetKind[] }

export const PROPERTY_FIELDS: FieldDef[] = [
  { key: 'title', value: 'text', synonyms: ['title', 'property name', 'listing title', 'property title', 'name', 'unit name'] },
  { key: 'projectName', value: 'text', synonyms: ['project', 'project name', 'society', 'building', 'building name', 'layout', 'layout name', 'venture'] },
  { key: 'builderName', value: 'text', synonyms: ['builder', 'builder name', 'developer', 'developer name', 'promoter'] },
  { key: 'type', value: 'propertyType', synonyms: ['property type', 'type', 'category', 'usage', 'property category'] },
  { key: 'configuration', value: 'config', only: P.built, synonyms: ['configuration', 'bhk', 'unit type', 'config', 'flat type', 'type of unit', 'bedrooms'] },
  { key: 'location.city', value: 'city', required: true, synonyms: ['city', 'town', 'district'] },
  { key: 'location.locality', value: 'locality', required: true, synonyms: ['locality', 'location', 'area', 'micro market', 'neighbourhood', 'neighborhood', 'zone', 'village'] },
  { key: 'location.address', value: 'text', synonyms: ['address', 'full address', 'site address', 'street'] },
  { key: 'location.pincode', value: 'text', synonyms: ['pincode', 'pin code', 'pin', 'zip', 'postal code'] },
  { key: 'price', value: 'price', required: true, synonyms: ['price', 'asking price', 'expected price', 'rate', 'cost', 'total price', 'amount', 'total cost', 'all inclusive price', 'quoted price', 'value', 'price inr', 'price rs'] },
  { key: 'area.carpet', value: 'area', only: P.built, synonyms: ['carpet', 'carpet area', 'carpet sqft', 'carpet sft', 'rera carpet', 'carpet area sqft'] },
  { key: 'area.builtUp', value: 'area', only: P.built, synonyms: ['built up', 'builtup', 'built up area', 'bua', 'plinth area', 'built area'] },
  { key: 'area.superBuiltUp', value: 'area', only: P.flats, synonyms: ['super built up', 'super builtup', 'super built up area', 'saleable area', 'sba', 'super area', 'salable area', 'sq ft', 'sqft', 'sft', 'size', 'area'] },
  { key: 'area.plot', value: 'area', only: P.land, synonyms: ['plot area', 'plot size', 'land area', 'site area', 'extent', 'land extent', 'site size', 'uds', 'area'] },
  { key: 'dimensions', value: 'dimensions', only: ['plots'], synonyms: ['dimensions', 'dimension', 'plot dimensions', 'length x width', 'size lxw'] },
  { key: 'roadWidthFt', value: 'int', only: ['plots'], synonyms: ['road width', 'road', 'road width ft', 'approach road'] },
  { key: 'floor', value: 'int', only: P.flats, synonyms: ['floor', 'floor no', 'floor number', 'level'] },
  { key: 'totalFloors', value: 'int', only: P.built, synonyms: ['total floors', 'floors', 'no of floors', 'storeys', 'stories'] },
  { key: 'facing', value: 'facing', synonyms: ['facing', 'direction', 'face', 'orientation'] },
  { key: 'possession.status', value: 'possession', only: P.built, synonyms: ['possession', 'possession status', 'status', 'construction status', 'ready to move', 'handover'] },
  { key: 'possession.date', value: 'date', only: P.built, synonyms: ['possession date', 'handover date', 'completion date', 'ready by'] },
  { key: 'furnishing', value: 'furnishing', only: P.built, synonyms: ['furnishing', 'furnished', 'furnishing status'] },
  { key: 'transaction', value: 'transaction', synonyms: ['transaction', 'sale type', 'new or resale', 'resale', 'transaction type'] },
  { key: 'rera.number', value: 'text', synonyms: ['rera', 'rera no', 'rera number', 'rera id', 'rera registration'] },
  { key: 'specs.towerName', value: 'text', only: P.flats, synonyms: ['tower', 'tower name', 'block', 'wing', 'phase'] },
  { key: 'specs.unitNumber', value: 'text', synonyms: ['unit no', 'unit number', 'flat no', 'flat number', 'plot no', 'plot number', 'shop no', 'door no', 'unit', 'villa no'] },
  { key: 'parking.covered', value: 'int', only: P.built, synonyms: ['parking', 'car parking', 'car park', 'covered parking', 'parkings'] },
  { key: 'maintenancePerMonth', value: 'price', only: P.built, synonyms: ['maintenance', 'maintenance per month', 'monthly maintenance', 'cam charges'] },
  { key: 'amenities', value: 'list', synonyms: ['amenities', 'features', 'facilities'] },
  { key: 'owner.name', value: 'text', synonyms: ['owner', 'owner name', 'seller', 'seller name', 'contact person', 'landlord'] },
  { key: 'owner.phone', value: 'phone', synonyms: ['owner phone', 'owner mobile', 'seller phone', 'seller mobile', 'contact number', 'owner contact'] },
  { key: 'description', value: 'text', synonyms: ['description', 'remarks', 'notes', 'comments', 'details', 'highlights'] },
]

export function fieldsFor(kind: SheetKind): FieldDef[] {
  if (kind === 'leads') return LEAD_FIELDS
  return PROPERTY_FIELDS.filter((f) => !f.only || f.only.includes(kind))
}

/** A field is needed to save; properties also need *some* area (checked per row, not per column). */
export const requiredFields = (kind: SheetKind) => fieldsFor(kind).filter((f) => f.required).map((f) => f.key)

/** The property type a row gets when the sheet does not say. */
export const DEFAULT_TYPE: Record<Exclude<SheetKind, 'leads'>, PropertyType> = {
  apartments: 'apartment', villas: 'villa', plots: 'plot', commercial: 'office',
}
/** Types that belong to each property template (a row with another type is still accepted, with a warning). */
export const KIND_TYPES: Record<Exclude<SheetKind, 'leads'>, PropertyType[]> = {
  apartments: ['apartment'],
  villas: ['villa', 'independentHouse', 'rowHouse'],
  plots: ['plot', 'agriLand'],
  commercial: ['office', 'shop', 'showroom', 'warehouse', 'coworking'],
}

/** Draft / form field order for a record kind (used by the review and draft forms). */
export const LEAD_FORM_FIELDS = ['name', 'phone', 'email', 'altPhone', 'source', 'sourceDetail', 'requirement.cities', 'requirement.localities',
  'requirement.propertyTypes', 'requirement.configurations', 'requirement.budgetMin', 'requirement.budgetMax', 'qualification.timeline',
  'preferredLanguage', 'notes'] as const
export const PROPERTY_FORM_FIELDS = ['title', 'type', 'configuration', 'projectName', 'builderName', 'location.city', 'location.locality',
  'location.address', 'price', 'area.carpet', 'area.builtUp', 'area.superBuiltUp', 'area.plot', 'floor', 'totalFloors', 'facing',
  'possession.status', 'possession.date', 'transaction', 'rera.number', 'owner.name', 'owner.phone', 'description'] as const

export const fieldDef = (key: string): FieldDef | undefined =>
  LEAD_FIELDS.find((f) => f.key === key) ?? PROPERTY_FIELDS.find((f) => f.key === key)

/** Which property fields make sense for this type (no floor on a plot, no plot area on a flat). */
export function propertyFieldsFor(type: PropertyType | undefined): string[] {
  const def = PROPERTY_TYPES[type ?? 'apartment']
  const fam = familyOf(type ?? 'apartment')
  return PROPERTY_FORM_FIELDS.filter((f) => {
    if (f === 'configuration') return def.configurable
    if (f.startsWith('area.')) return (def.areaFields as string[]).includes(f.slice(5))
    if (f === 'floor') return fam === 'flat' || fam === 'commercial'
    if (f === 'totalFloors') return fam !== 'plot' && fam !== 'land'
    if (f.startsWith('possession.')) return fam !== 'plot' && fam !== 'land'
    return true
  })
}
