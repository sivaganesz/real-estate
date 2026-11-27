/**
 * The property form model (master prompt §13): one PropertyInput, with the sections the form shows decided by the
 * property's family (flat, house, plot, land, commercial, warehouse). Pure: no React, no store.
 *
 * - blankProperty / fromProperty build the form state;
 * - mergeExtraction lays a paste-and-fill result over what is already typed (objects merge, lists union);
 * - familyShows says which optional sections a family gets;
 * - cleanForSave drops values of sections the chosen type does not have, empty owner/RERA rows and stray specs,
 *   and suggests a title from the configuration and place when none was typed (smart required: title OR configuration).
 */
import type { Configuration, PropertyFamily, Property, PropertyArea, PropertyInput, PropertyType } from '@/domain/types'
import { PROPERTY_TYPES, familyOf } from '@/domain/catalogue'
import { pricePerSqft, primaryAreaSqft } from '@/lib/property'

export type FormSection =
  | 'configuration' | 'rooms' | 'floor' | 'facing' | 'corner' | 'vastu' | 'furnishing' | 'parking' | 'gated'
  | 'roadWidth' | 'possession' | 'rera' | 'khata' | 'patta' | 'maintenance' | 'project'

/** Which optional sections each family shows. Approvals, banks, owner, commission, amenities, photos: every family. */
export const FAMILY_SECTIONS: Record<PropertyFamily, FormSection[]> = {
  flat: ['configuration', 'rooms', 'floor', 'facing', 'vastu', 'furnishing', 'parking', 'gated', 'possession', 'rera', 'khata', 'maintenance', 'project'],
  house: ['configuration', 'rooms', 'facing', 'corner', 'vastu', 'furnishing', 'parking', 'gated', 'roadWidth', 'possession', 'rera', 'khata', 'patta', 'project'],
  plot: ['facing', 'corner', 'vastu', 'gated', 'roadWidth', 'possession', 'rera', 'khata', 'patta', 'project'],
  land: ['facing', 'roadWidth', 'patta'],
  commercial: ['floor', 'facing', 'corner', 'furnishing', 'parking', 'roadWidth', 'possession', 'rera', 'maintenance', 'project'],
  warehouse: ['facing', 'parking', 'roadWidth', 'possession'],
}

export const familyShows = (type: PropertyType, section: FormSection) => FAMILY_SECTIONS[familyOf(type)].includes(section)

export function blankProperty(type: PropertyType = 'apartment'): PropertyInput {
  return {
    title: '', type, purpose: 'sale', transaction: 'newBooking',
    location: { city: '', locality: '' },
    price: 0, area: {}, parking: { covered: 0, open: 0 }, amenities: [],
    possession: { status: 'ready' }, approvals: [], bankApprovals: [], specs: {},
    status: 'available', listing: 'live', media: [],
  }
}

/** The editable part of a stored property. */
export function fromProperty(p: Property): PropertyInput {
  const { id: _id, createdBy: _by, createdAt: _at, updatedAt: _up, category: _cat, ...rest } = p
  return structuredClone(rest)
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Lays the AI's fields over the form: nested objects merge, string lists union, approvals union by authority. */
export function mergeExtraction(form: PropertyInput, fields: Partial<PropertyInput>): PropertyInput {
  const out = structuredClone(form) as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    const cur = out[k]
    if (k === 'approvals' && Array.isArray(v)) {
      const have = (cur as PropertyInput['approvals']) ?? []
      out[k] = [...have, ...(v as PropertyInput['approvals']).filter((a) => !have.some((h) => h.authority === a.authority))]
    } else if (Array.isArray(v) && Array.isArray(cur)) out[k] = [...new Set([...(cur as unknown[]), ...v])]
    else if (isObj(v) && isObj(cur)) out[k] = { ...cur, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== '')) }
    else out[k] = structuredClone(v)
  }
  return out as unknown as PropertyInput
}

/**
 * Only what the AI actually read (fields with a meta entry): editing with AI never resets a value the text did not
 * mention (the extractor's defaults such as purpose 'sale' are not marked). `skip` drops keys (the suggested title
 * on an existing listing).
 */
export function pickExtracted(fields: Partial<PropertyInput>, meta: Record<string, unknown>, skip: string[] = []): Partial<PropertyInput> {
  const paths = Object.keys(meta)
  return Object.fromEntries(Object.entries(fields).filter(([k]) => !skip.includes(k) && paths.some((p) => p === k || p.startsWith(k + '.')))) as Partial<PropertyInput>
}

/** Sets a dotted path ("location.city", "area.carpet", "possession.status") on a copy of the form. */
export function setPath(form: PropertyInput, path: string, value: unknown): PropertyInput {
  const out = structuredClone(form) as unknown as Record<string, unknown>
  const keys = path.split('.')
  let node = out
  for (const k of keys.slice(0, -1)) {
    if (!isObj(node[k])) node[k] = {}
    node = node[k] as Record<string, unknown>
  }
  node[keys[keys.length - 1]] = value
  return out as unknown as PropertyInput
}

const TYPE_WORD: Record<PropertyType, string> = {
  apartment: 'Apartment', villa: 'Villa', independentHouse: 'Independent House', rowHouse: 'Row House', plot: 'Plot',
  agriLand: 'Agricultural Land', office: 'Office', shop: 'Shop', showroom: 'Showroom', warehouse: 'Warehouse', coworking: 'Co-working Space',
}
export const configWords = (c: Configuration) => c.replace(/^(\d(?:\.5)?)BHK(\+?)$/, '$1$2 BHK')

/** "3 BHK Apartment in Whitefield" / "Plot in Tellapur": record data, so English like the rest of the listing. */
export function suggestTitle(f: Pick<PropertyInput, 'type' | 'configuration' | 'projectName' | 'location'>): string {
  const place = f.location.locality || f.location.city
  const head = [f.configuration && PROPERTY_TYPES[f.type].configurable ? configWords(f.configuration) : '', TYPE_WORD[f.type]].filter(Boolean).join(' ')
  const lead = f.projectName ? `${f.projectName} ${f.configuration ? configWords(f.configuration) : TYPE_WORD[f.type]}` : head
  return place ? `${lead}, ${place}` : lead
}

const blank = (v: unknown) => v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))

/** The input that goes to the service: hidden sections cleared, empty rows dropped, a title suggested if missing. */
export function cleanForSave(form: PropertyInput): PropertyInput {
  const f = structuredClone(form)
  const def = PROPERTY_TYPES[f.type]
  const shows = (s: FormSection) => familyShows(f.type, s)

  // area: only the type's area fields (plus the plot unit), no zeros
  const area: PropertyArea = {}
  for (const k of def.areaFields) {
    const v = f.area[k]
    if (typeof v === 'number' && v > 0) (area as Record<string, number>)[k] = v
  }
  if (area.plot) area.plotUnit = f.area.plotUnit ?? 'sqft'
  f.area = area

  // specs: only this type's, non-empty
  const specs: PropertyInput['specs'] = {}
  for (const s of def.specs) {
    const v = f.specs[s.key]
    if (!blank(v) && !(s.kind === 'boolean' && v === false)) specs[s.key] = v
  }
  f.specs = specs

  if (!shows('configuration')) delete f.configuration
  if (!shows('rooms')) { delete f.bedrooms; delete f.bathrooms; delete f.balconies }
  if (!shows('floor')) { delete f.floor; delete f.totalFloors }
  if (!shows('facing')) delete f.facing
  if (!shows('corner')) delete f.corner
  if (!shows('vastu')) delete f.vastuCompliant
  if (!shows('furnishing')) delete f.furnishing
  if (!shows('parking')) f.parking = { covered: 0, open: 0 }
  if (!shows('gated')) delete f.gatedCommunity
  if (!shows('roadWidth')) delete f.roadWidthFt
  if (!shows('rera') || !f.rera?.number.trim()) delete f.rera
  if (!shows('khata')) delete f.khata
  if (!shows('patta')) delete f.pattaAvailable
  if (!shows('maintenance')) delete f.maintenancePerMonth
  if (!shows('possession')) f.possession = { status: 'ready' }
  if (f.possession.status === 'ready') delete f.possession.date
  if (f.status !== 'onHold') { delete f.heldUntil; delete f.heldForLeadId }

  if (f.owner && !f.owner.name.trim() && !f.owner.phone.trim()) delete f.owner
  for (const k of ['address', 'landmark', 'pincode'] as const) if (!f.location[k]?.trim()) delete f.location[k]
  for (const k of ['description', 'projectName', 'builderName'] as const) if (!f[k]?.trim()) delete f[k]
  if (f.configuration && !f.bedrooms && shows('rooms')) f.bedrooms = f.configuration === '4BHK+' ? 4 : Math.max(1, Math.floor(parseFloat(f.configuration) || 1))
  if (!f.title.trim() && (f.configuration || f.location.locality || f.location.city)) f.title = suggestTitle(f)
  f.title = f.title.trim()
  return f
}

/** ₹ per sq ft of the form as typed (null until both a price and an area are known). */
export const formPricePerSqft = (f: Pick<PropertyInput, 'type' | 'area' | 'price'>) => pricePerSqft(f)
export const formAreaSqft = (f: Pick<PropertyInput, 'type' | 'area'>) => primaryAreaSqft(f)

/** The field paths the form changed compared with the stored property (for "N changes" and the dirty guard). */
export function changedKeys(before: PropertyInput, after: PropertyInput): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((k) => JSON.stringify((before as unknown as Record<string, unknown>)[k]) !== JSON.stringify((after as unknown as Record<string, unknown>)[k]))
}
