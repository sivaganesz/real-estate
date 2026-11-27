/**
 * Paste-and-fill for leads (master prompt §12.3): reads a WhatsApp message, portal enquiry, call note or voice
 * transcript into LeadInput fields, marks each filled field with origin 'ai' + a confidence, lists the essential fields
 * still missing (name, phone or e-mail, source) and asks short questions with quick-pick chips for them and for the
 * qualification gaps (budget, timeline, decision makers, requirement). Never invents a value.
 */
import type { DB, FieldMetaMap, LeadInput, Qualification, Requirement } from '@/domain/types'
import { findDuplicates } from '@/lib/duplicates'
import { localDay } from '@/lib/dates'
import type { AIQuestion, Extraction } from '../types'
import {
  amenitiesIn, areaIn, budgetIn, configurationsIn, decisionIn, emailIn, facingIn, familySizeIn, furnishingIn, languageIn,
  loanIn, nameIn, nriIn, parkingIn, phonesIn, placesIn, possessionIn, propertyTypesIn, purposeIn, rentOrSaleIn, sourceIn,
  timelineIn, transactionIn, vastuIn,
} from './parse'

export const emptyRequirement = (): Requirement => ({
  propertyTypes: [], configurations: [], cities: [], localities: [], budgetFlexPct: 10, possession: 'any', facing: [],
  amenities: [], mustHaves: [], purpose: 'sale',
})
export const emptyQualification = (): Qualification => ({ decisionMakers: [], loan: 'unknown' })

const SOURCE_CHIPS = ['phone', 'whatsapp', 'website', 'walkIn', 'acres99', 'magicbricks', 'referral', 'channelPartner'] as const

export const LEAD_QUESTIONS: Record<string, AIQuestion> = {
  name: { field: 'name', prompt: 'ai:question.lead.name', essential: true },
  phone: { field: 'phone', prompt: 'ai:question.lead.phone', essential: true },
  source: { field: 'source', prompt: 'ai:question.lead.source', essential: true, chips: SOURCE_CHIPS.map((v) => ({ label: `catalogue:source.${v}`, value: v })) },
  budget: {
    field: 'requirement.budgetMax', prompt: 'ai:question.lead.budget', essential: false,
    chips: [5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000].map((v) => ({ label: `leads:qualify.chip.budget${v}`, value: v })),
  },
  configuration: {
    field: 'requirement.configurations', prompt: 'ai:question.lead.configuration', essential: false,
    chips: (['1BHK', '2BHK', '3BHK', '4BHK+'] as const).map((v) => ({ label: `ai:chip.config.${v.replace('+', 'plus').replace('.', '_')}`, value: [v] })),
  },
  location: { field: 'requirement.localities', prompt: 'ai:question.lead.location', essential: false },
  timeline: {
    field: 'qualification.timeline', prompt: 'ai:question.lead.timeline', essential: false,
    chips: (['immediate', 'm1to3', 'm3to6', 'exploring'] as const).map((v) => ({ label: `catalogue:timeline.${v}`, value: v })),
  },
  decisionMakers: {
    field: 'qualification.decisionMakers', prompt: 'ai:question.lead.decisionMakers', essential: false,
    chips: (['self', 'spouse', 'parents', 'family'] as const).map((v) => ({ label: `catalogue:decisionMaker.${v}`, value: [v] })),
  },
}

export function extractLeadFields(text: string, ctx: { now: Date; db?: Pick<DB, 'leads'> }): Extraction<LeadInput> {
  const today = localDay(ctx.now)
  const meta: FieldMetaMap = {}
  const notes: string[] = []
  const fields: Partial<LeadInput> = {}
  const requirement = emptyRequirement()
  const qualification = emptyQualification()
  const ai = (path: string, confidence: number) => { meta[path] = { origin: 'ai', confidence } }

  const name = nameIn(text)
  if (name) { fields.name = name.value; ai('name', name.confidence) }

  const phones = phonesIn(text)
  if (phones[0]) { fields.phone = phones[0]; ai('phone', 0.95) }
  if (phones[1]) { fields.altPhone = phones[1]; ai('altPhone', 0.8) }
  const email = emailIn(text)
  if (email) { fields.email = email; ai('email', 0.95) }

  const source = sourceIn(text)
  if (source) { fields.source = source; ai('source', 0.8) }

  // requirement
  const configs = configurationsIn(text)
  if (configs.length) { requirement.configurations = configs; ai('requirement.configurations', 0.95) }
  const types = propertyTypesIn(text)
  if (types.length) { requirement.propertyTypes = types; ai('requirement.propertyTypes', 0.85) }
  else if (configs.length) { requirement.propertyTypes = ['apartment']; ai('requirement.propertyTypes', 0.7) }
  const places = placesIn(text)
  if (places.localities.length) { requirement.localities = places.localities; ai('requirement.localities', 0.9) }
  if (places.cities.length) { requirement.cities = places.cities; ai('requirement.cities', places.localities.length ? 0.85 : 0.9) }

  const budget = budgetIn(text)
  if (budget) {
    if (budget.min) { requirement.budgetMin = budget.min; ai('requirement.budgetMin', budget.confidence) }
    if (budget.preferred) { requirement.budgetPreferred = budget.preferred; ai('requirement.budgetPreferred', budget.confidence) }
    if (budget.max) { requirement.budgetMax = budget.max; ai('requirement.budgetMax', budget.confidence) }
    if (budget.preferred && budget.max === budget.preferred) notes.push('ai:note.budgetAround')
    if (budget.min && !budget.max) notes.push('ai:note.budgetMinOnly')
  }
  const area = areaIn(text)
  if (area?.sqftMin) {
    requirement.areaMinSqft = area.value ? Math.round(area.sqftMin * 0.9) : area.sqftMin
    requirement.areaMaxSqft = area.value ? Math.round((area.sqftMax ?? area.sqftMin) * 1.15) : area.sqftMax
    ai('requirement.areaMinSqft', 0.8)
    ai('requirement.areaMaxSqft', 0.7)
  }
  const possession = possessionIn(text, today)
  if (possession.pref) { requirement.possession = possession.pref; ai('requirement.possession', 0.9) }
  if (possession.by) { requirement.possessionBy = possession.by; ai('requirement.possessionBy', 0.8) }
  const facing = facingIn(text)
  if (facing.length) { requirement.facing = facing; ai('requirement.facing', 0.9) }
  const furnishing = furnishingIn(text)
  if (furnishing) { requirement.furnishing = furnishing; ai('requirement.furnishing', 0.85) }
  const amenities = amenitiesIn(text)
  if (amenities.length) { requirement.amenities = amenities; ai('requirement.amenities', 0.8) }
  if (vastuIn(text)) { requirement.vastu = true; ai('requirement.vastu', 0.85) }
  const parking = parkingIn(text)
  if (parking) { requirement.parking = parking; ai('requirement.parking', 0.75) }
  const transaction = transactionIn(text)
  if (transaction) { requirement.transaction = transaction; ai('requirement.transaction', 0.8) }
  const purpose = rentOrSaleIn(text)
  if (purpose && purpose !== 'sale') { requirement.purpose = purpose; ai('requirement.purpose', 0.75) }
  fields.requirement = requirement

  // qualification
  const timeline = timelineIn(text)
  if (timeline) { qualification.timeline = timeline; ai('qualification.timeline', 0.85) }
  const decision = decisionIn(text)
  if (decision.makers.length) { qualification.decisionMakers = decision.makers; ai('qualification.decisionMakers', 0.85) }
  if (decision.authority) { qualification.authority = decision.authority; ai('qualification.authority', 0.75) }
  const loan = loanIn(text)
  if (loan) { qualification.loan = loan; ai('qualification.loan', 0.85) }
  const buyerPurpose = purposeIn(text)
  if (buyerPurpose) { qualification.buyerPurpose = buyerPurpose; ai('qualification.buyerPurpose', 0.8) }
  if (configs.length && requirement.cities.length && (budget?.max || requirement.localities.length)) {
    qualification.need = 'clear'
    ai('qualification.need', 0.7)
  } else if (/\b(just exploring|exploring|browsing)\b/i.test(text)) {
    qualification.need = 'exploring'
    ai('qualification.need', 0.8)
  }
  fields.qualification = qualification

  const nri = nriIn(text)
  fields.isNri = !!nri?.isNri
  if (nri?.isNri) {
    ai('isNri', 0.85)
    if (nri.country) { fields.nriCountry = nri.country; ai('nriCountry', 0.8) }
  }
  const language = languageIn(text)
  if (language) { fields.preferredLanguage = language; ai('preferredLanguage', 0.8) }
  const familySize = familySizeIn(text)
  if (familySize) { fields.familySize = familySize; ai('familySize', 0.8) }
  if (/\b(whatsapp me|message me|text me|prefer whatsapp)\b/i.test(text)) { fields.contactPref = 'whatsapp'; ai('contactPref', 0.8) }
  else if (/\b(call me|prefer (?:a )?call)\b/i.test(text)) { fields.contactPref = 'call'; ai('contactPref', 0.8) }
  else if (/\b(email me|mail me|prefer email)\b/i.test(text)) { fields.contactPref = 'email'; ai('contactPref', 0.8) }

  // what is missing, and the questions for it
  const missing: string[] = []
  if (!fields.name) missing.push('name')
  if (!fields.phone && !fields.email) missing.push('phone')
  if (!fields.source) missing.push('source')
  const questions: AIQuestion[] = missing.map((f) => LEAD_QUESTIONS[f])
  if (!requirement.budgetMax && !requirement.budgetMin) questions.push(LEAD_QUESTIONS.budget)
  if (!configs.length && (!types.length || types.some((t) => t === 'apartment' || t === 'villa' || t === 'independentHouse' || t === 'rowHouse'))) questions.push(LEAD_QUESTIONS.configuration)
  if (!requirement.cities.length) questions.push(LEAD_QUESTIONS.location)
  if (!qualification.timeline) questions.push(LEAD_QUESTIONS.timeline)
  if (!qualification.decisionMakers.length) questions.push(LEAD_QUESTIONS.decisionMakers)
  if (name && name.confidence < 0.8) notes.push('ai:note.checkName')

  const duplicates = ctx.db && (fields.phone || fields.email)
    ? findDuplicates(ctx.db, { phone: fields.phone, email: fields.email }).map((d) => ({ leadId: d.lead.id, by: d.by }))
    : []

  return { mode: 'simulated', fields, meta, missing, questions, filledCount: Object.keys(meta).length, notes, duplicates }
}
