/**
 * Column mapping for imports (master prompt §15.2): each sheet header → a field, by synonym, fuzzy spelling or by
 * sniffing the sample values (10-digit numbers are phones, "@" is e-mail, "Cr"/"L" amounts are prices). First version;
 * M5 owns the import wizard and may refine it.
 */
import type { ColumnMapping, ImportKind } from '@/domain/types'
import { distance } from './parse'

const LEAD_FIELDS: Record<string, string[]> = {
  name: ['name', 'full name', 'customer name', 'client name', 'lead name', 'contact name', 'buyer'],
  phone: ['phone', 'mobile', 'mobile no', 'mobile number', 'contact', 'contact no', 'phone number', 'whatsapp', 'cell'],
  email: ['email', 'e-mail', 'email id', 'mail'],
  source: ['source', 'lead source', 'channel', 'portal', 'medium'],
  'requirement.cities': ['city', 'location city'],
  'requirement.localities': ['locality', 'location', 'area', 'preferred location', 'preferred area', 'micro market'],
  'requirement.configurations': ['bhk', 'configuration', 'config', 'unit type', 'bedrooms'],
  'requirement.propertyTypes': ['property type', 'type', 'category'],
  'requirement.budgetMin': ['min budget', 'budget min', 'budget from'],
  'requirement.budgetMax': ['budget', 'max budget', 'budget max', 'budget to', 'price range'],
  'qualification.timeline': ['timeline', 'buying in', 'purchase timeline', 'when'],
  notes: ['notes', 'remarks', 'comments', 'requirement', 'message'],
}
const PROPERTY_FIELDS: Record<string, string[]> = {
  title: ['title', 'property name', 'name', 'listing title', 'unit'],
  projectName: ['project', 'project name', 'society', 'building'],
  type: ['type', 'property type', 'category'],
  configuration: ['bhk', 'configuration', 'config', 'unit type'],
  'location.city': ['city'],
  'location.locality': ['locality', 'location', 'area', 'micro market', 'address'],
  price: ['price', 'rate', 'cost', 'asking price', 'expected price', 'total price', 'amount'],
  'area.carpet': ['carpet', 'carpet area', 'carpet sqft'],
  'area.builtUp': ['built up', 'builtup', 'built-up area', 'bua'],
  'area.superBuiltUp': ['super built up', 'saleable area', 'sba', 'super area'],
  'area.plot': ['plot area', 'plot size', 'land area', 'site area', 'extent'],
  facing: ['facing', 'direction'],
  floor: ['floor', 'floor no'],
  'possession.status': ['possession', 'status', 'possession status'],
  'rera.number': ['rera', 'rera no', 'rera number'],
  'owner.name': ['owner', 'owner name', 'seller', 'builder'],
  'owner.phone': ['owner phone', 'owner mobile', 'seller phone'],
}

const clean = (s: string) => s.toLowerCase().replace(/[_./()-]+/g, ' ').replace(/\s+/g, ' ').trim()

export function mapColumnsSim(headers: string[], sample: string[][], kind: ImportKind): ColumnMapping[] {
  const table = kind === 'leads' ? LEAD_FIELDS : PROPERTY_FIELDS
  const used = new Set<string>()
  return headers.map((header, col) => {
    const h = clean(header)
    let best: { field: string; confidence: number; method: ColumnMapping['method'] } | undefined
    for (const [field, words] of Object.entries(table)) {
      if (used.has(field)) continue
      for (const w of words) {
        const conf = h === w ? 0.97 : h.includes(w) && w.length > 3 ? 0.85 : w.length > 4 && distance(h, w) <= 2 ? 0.7 : 0
        if (conf && (!best || conf > best.confidence)) best = { field, confidence: conf, method: conf >= 0.85 ? 'synonym' : 'fuzzy' }
      }
    }
    if (!best) {
      const values = sample.map((r) => r[col] ?? '').filter(Boolean)
      const all = (re: RegExp) => values.length > 0 && values.every((v) => re.test(v))
      const field = all(/^(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/) ? (kind === 'leads' ? 'phone' : 'owner.phone')
        : all(/@/) ? (kind === 'leads' ? 'email' : null)
        : all(/\d\s*(cr|crore|l|lakh|lac)s?\b/i) ? (kind === 'leads' ? 'requirement.budgetMax' : 'price')
        : all(/\d\s*bhk/i) ? (kind === 'leads' ? 'requirement.configurations' : 'configuration') : null
      if (field && !used.has(field)) best = { field, confidence: 0.75, method: 'value' }
    }
    if (best) used.add(best.field)
    return { column: header, field: best?.field ?? null, confidence: best?.confidence ?? 0, method: best?.method ?? 'manual' }
  })
}
