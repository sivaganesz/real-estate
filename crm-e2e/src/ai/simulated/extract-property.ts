/**
 * Paste-and-fill for properties: an owner's or builder's listing message → PropertyInput fields. The fact rules come from
 * wireframe-rebuild/src/lib/assistant.ts (type, purpose, city, locality, price, area, BHK, facing, amenities) with its
 * rule "never invent a fact; ask only for the missing required ones". Smart-required (master prompt §12.6): title or
 * configuration + type + location + price + area.
 */
import type { Configuration, FieldMetaMap, PropertyArea, PropertyInput, PropertyType } from '@/domain/types'
import { APPROVAL_AUTHORITIES, PROPERTY_TYPES } from '@/domain/catalogue'
import { localDay } from '@/lib/dates'
import type { AIQuestion, Extraction } from '../types'
import {
  amenitiesIn, amountsIn, areaIn, configurationsIn, facingIn, furnishingIn, nameIn, norm, phonesIn, placesIn, possessionIn,
  propertyTypesIn, rentOrSaleIn, transactionIn, vastuIn,
} from './parse'

const TYPE_LABEL: Record<PropertyType, string> = {
  apartment: 'Apartment', villa: 'Villa', independentHouse: 'Independent House', rowHouse: 'Row House', plot: 'Plot',
  agriLand: 'Agricultural Land', office: 'Office', shop: 'Shop', showroom: 'Showroom', warehouse: 'Warehouse', coworking: 'Co-working Space',
}
const configText = (c: Configuration) => c.replace(/^(\d(?:\.5)?)BHK(\+?)$/, '$1$2 BHK')

export const PROPERTY_QUESTIONS: Record<string, AIQuestion> = {
  type: {
    field: 'type', prompt: 'ai:question.property.type', essential: true,
    chips: (['apartment', 'villa', 'independentHouse', 'plot', 'office', 'shop'] as const).map((v) => ({ label: `catalogue:propertyType.${v}`, value: v })),
  },
  configuration: {
    field: 'configuration', prompt: 'ai:question.property.configuration', essential: true,
    chips: (['1BHK', '2BHK', '3BHK', '4BHK+'] as const).map((v) => ({ label: `ai:chip.config.${v.replace('+', 'plus')}`, value: v })),
  },
  location: { field: 'location.locality', prompt: 'ai:question.property.location', essential: true },
  price: { field: 'price', prompt: 'ai:question.property.price', essential: true },
  area: { field: 'area', prompt: 'ai:question.property.area', essential: true },
  possession: {
    field: 'possession.status', prompt: 'ai:question.property.possession', essential: false,
    chips: (['ready', 'underConstruction'] as const).map((v) => ({ label: `catalogue:possession.${v}`, value: v })),
  },
  facing: {
    field: 'facing', prompt: 'ai:question.property.facing', essential: false,
    chips: (['E', 'N', 'W', 'S', 'NE'] as const).map((v) => ({ label: `catalogue:facing.${v}`, value: v })),
  },
}

export function extractPropertyFields(text: string, ctx: { now: Date }): Extraction<PropertyInput> {
  const t = norm(text)
  const lower = t.toLowerCase()
  const meta: FieldMetaMap = {}
  const notes: string[] = []
  const fields: Partial<PropertyInput> = {}
  const ai = (path: string, confidence: number) => { meta[path] = { origin: 'ai', confidence } }

  const configs = configurationsIn(t)
  const types = propertyTypesIn(t)
  const type: PropertyType | undefined = types[0] ?? (configs.length ? 'apartment' : undefined)
  if (type) { fields.type = type; ai('type', types[0] ? 0.9 : 0.7) }
  const configurable = !type || PROPERTY_TYPES[type].configurable
  if (configs[0] && configurable) {
    fields.configuration = configs[0]
    ai('configuration', 0.95)
    const beds = Math.floor(parseFloat(configs[0]) || 1)
    fields.bedrooms = configs[0] === '1RK' ? 1 : configs[0] === '4BHK+' ? 4 : beds
    ai('bedrooms', 0.8)
  }

  const places = placesIn(t)
  if (places.localities[0] || places.cities[0]) {
    fields.location = { city: places.cities[0] ?? '', locality: places.localities[0] ?? '' }
    if (places.cities[0]) ai('location.city', 0.9)
    if (places.localities[0]) ai('location.locality', 0.9)
  }
  const pin = /\b([1-9]\d{5})\b/.exec(t.replace(/(?:\+?91[\s-]*)?[6-9](?:[\s-]?\d){9}/g, ' '))
  if (pin && fields.location) { fields.location.pincode = pin[1]; ai('location.pincode', 0.7) }

  const purpose = rentOrSaleIn(t)
  fields.purpose = purpose ?? 'sale'
  if (purpose) ai('purpose', 0.85)
  const transaction = transactionIn(t)
  if (transaction) { fields.transaction = transaction; ai('transaction', 0.85) }

  // price: the amount after a price word, else the largest amount (rent: the monthly amount)
  const amounts = amountsIn(t)
  const priceWord = /\b(price|asking|expected|cost|rate|rent|quote|selling (?:for|at)|for)\b/.exec(lower)
  const priced = priceWord ? amounts.find((a) => a.index >= priceWord.index) : undefined
  const price = priced ?? [...amounts].sort((a, b) => b.value - a.value)[0]
  if (price) { fields.price = price.value; ai('price', priced ? 0.9 : 0.7) }
  if (/\b(negotiable|neg\.?|slightly negotiable|best offer)\b/.test(lower)) { fields.priceNegotiable = true; ai('priceNegotiable', 0.85) }
  const maint = /maintenance[^0-9₹]{0,20}(?:₹|rs\.?)?\s*([\d,]+)/i.exec(t)
  if (maint) { fields.maintenancePerMonth = Number(maint[1].replace(/,/g, '')); ai('maintenancePerMonth', 0.8) }

  const area = areaIn(t)
  if (area) {
    const a: PropertyArea = {}
    const v = area.value ?? area.min ?? 0
    const isLand = type === 'plot' || type === 'agriLand'
    if (isLand || area.kind === 'plot') {
      a.plot = v
      a.plotUnit = area.unit
      ai('area.plot', 0.85)
      const dims = /\b(\d{2,3})\s*[x×*]\s*(\d{2,3})\b/.exec(t)
      if (dims) { a.plotLengthFt = Number(dims[1]); a.plotWidthFt = Number(dims[2]) }
    } else if (area.kind === 'superBuiltUp') { a.superBuiltUp = area.sqftMin; ai('area.superBuiltUp', 0.85) }
    else if (area.kind === 'builtUp') { a.builtUp = area.sqftMin; ai('area.builtUp', 0.85) }
    else { a.carpet = area.sqftMin; ai('area.carpet', area.kind === 'carpet' ? 0.9 : 0.6); if (area.kind !== 'carpet') notes.push('ai:note.areaAssumedCarpet') }
    fields.area = a
  }

  const bath = /(\d)\s*(?:bath(?:room)?s?|toilets?|washrooms?)\b/i.exec(t)
  if (bath) { fields.bathrooms = Number(bath[1]); ai('bathrooms', 0.85) }
  const balc = /(\d)\s*balcon(?:y|ies)\b/i.exec(t)
  if (balc) { fields.balconies = Number(balc[1]); ai('balconies', 0.85) }
  const floor = /(\d{1,2})(?:st|nd|rd|th)?\s*floor(?:\s*(?:of|out of|\/)\s*(\d{1,2}))?/i.exec(t) ?? /floor\s*:?\s*(\d{1,2})\s*(?:\/|of)\s*(\d{1,2})/i.exec(t)
  if (floor) {
    fields.floor = Number(floor[1]); ai('floor', 0.85)
    if (floor[2]) { fields.totalFloors = Number(floor[2]); ai('totalFloors', 0.85) }
  }
  if (/\bground floor\b/i.test(t) && fields.floor === undefined) { fields.floor = 0; ai('floor', 0.85) }
  const facing = facingIn(t)
  if (facing[0]) { fields.facing = facing[0]; ai('facing', 0.9) }
  if (vastuIn(t)) { fields.vastuCompliant = true; ai('vastuCompliant', 0.85) }
  if (/\bcorner\b/i.test(t)) { fields.corner = true; ai('corner', 0.85) }
  const furnishing = furnishingIn(t)
  if (furnishing) { fields.furnishing = furnishing; ai('furnishing', 0.85) }
  const covered = /(\d)\s*(?:covered|car)\s*park(?:ing|s)?/i.exec(t)
  if (covered || /\b(covered|car) parking\b/i.test(t)) {
    fields.parking = { covered: covered ? Number(covered[1]) : 1, open: 0 }
    ai('parking', covered ? 0.85 : 0.6)
  }
  const amenities = amenitiesIn(t).filter((a) => a !== 'coveredParking')
  if (amenities.length) { fields.amenities = amenities; ai('amenities', 0.8) }
  if (/\bgated\b/i.test(t)) { fields.gatedCommunity = true; ai('gatedCommunity', 0.85) }

  const possession = possessionIn(t, localDay(ctx.now))
  if (possession.pref) {
    fields.possession = { status: possession.pref, date: possession.by }
    ai('possession.status', 0.9)
    if (possession.by) ai('possession.date', 0.8)
  }
  const rera = /\brera\s*(?:no\.?|number|id|reg(?:istration)?)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{7,})/i.exec(t)
  if (rera) { fields.rera = { number: rera[1].toUpperCase(), verified: false }; ai('rera', 0.85) }
  const khata = /\b([abe])[- ]?khata\b/i.exec(t)
  if (khata) { fields.khata = khata[1].toUpperCase() as 'A' | 'B' | 'E'; ai('khata', 0.85) }
  if (/\bpatta\b/i.test(t) && !/\bno patta\b/i.test(t)) { fields.pattaAvailable = true; ai('pattaAvailable', 0.8) }
  // "CMDA approved", "DTCP approval", "BBMP / BDA": named approval authorities (docs still to be uploaded)
  const authorities = APPROVAL_AUTHORITIES.filter((a) => a !== 'Other' && new RegExp(`\\b${a.replace(/ /g, '\\s+')}\\b`, 'i').test(t))
  const approvals = authorities.filter((a) => !authorities.some((b) => b !== a && b.includes(a)))
  if (approvals.length) { fields.approvals = approvals.map((authority) => ({ authority, docStatus: 'pending' as const })); ai('approvals', 0.8) }
  const road = /(\d{2,3})\s*(?:ft|feet)\s*road/i.exec(t)
  if (road) { fields.roadWidthFt = Number(road[1]); ai('roadWidthFt', 0.85) }
  const project = /\b(?:project|society|apartment|in)\s*:?\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\s+(?:by|from)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/.exec(t)
  if (project && !places.localities.some((l) => project[1].includes(l))) {
    fields.projectName = project[1]; ai('projectName', 0.6)
    fields.builderName = project[2]; ai('builderName', 0.6)
  }

  const owner = nameIn(t)
  const phones = phonesIn(t)
  if (owner || phones[0]) {
    const kind = /\b(builder|developer|promoter)\b/i.test(t) ? 'builder' : /\b(channel partner|broker|agent)\b/i.test(t) ? 'channelPartner' : 'owner'
    fields.owner = { name: owner?.value ?? '', phone: phones[0] ?? '', kind }
    ai('owner', 0.7)
  }

  // a suggested title (data, so English like the rest of the record): "3 BHK Apartment in Whitefield"
  const place = fields.location?.locality || fields.location?.city
  if (type && (fields.configuration || place)) {
    fields.title = [fields.configuration ? configText(fields.configuration) : '', TYPE_LABEL[type], place ? `in ${place}` : ''].filter(Boolean).join(' ')
    ai('title', 0.6)
    notes.push('ai:note.titleSuggested')
  }

  const missing: string[] = []
  if (!fields.type) missing.push('type')
  if (!fields.title && !fields.configuration) missing.push(configurable ? 'configuration' : 'title')
  if (!fields.location?.locality && !fields.location?.city) missing.push('location')
  if (!fields.price) missing.push('price')
  if (!fields.area) missing.push('area')
  const questions = missing.map((m) => PROPERTY_QUESTIONS[m === 'title' ? 'configuration' : m]).filter((q): q is AIQuestion => !!q)
  if (configurable && fields.configuration === undefined && !missing.includes('configuration')) questions.push(PROPERTY_QUESTIONS.configuration)
  if (!fields.possession && type !== 'plot' && type !== 'agriLand') questions.push(PROPERTY_QUESTIONS.possession)
  if (!fields.facing) questions.push(PROPERTY_QUESTIONS.facing)

  return { mode: 'simulated', fields, meta, missing, questions, filledCount: Object.keys(meta).length, notes }
}
