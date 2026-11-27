/**
 * Form and service validation. Smart required fields: a lead needs a name, a phone or an email, and a source;
 * a property needs the smart-required set (lib/property.missingRequired); an appointment needs a person, a type,
 * an owner and a time. Errors carry an i18n key in the `common` namespace (`common:validation.<key>`).
 */
import type { AppointmentInput, Lead, LeadInput, PropertyInput, TaskInput } from '@/domain/types'
import { isValidIndianMobile } from './phone'

export type FieldError = { field: string; key: string; params?: Record<string, string | number> }

export const isEmail = (v: string | undefined) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')

export function validateLead(input: Partial<LeadInput>): FieldError[] {
  const e: FieldError[] = []
  if (blank(input.name)) e.push({ field: 'name', key: 'required' })
  if (blank(input.phone) && blank(input.email)) e.push({ field: 'phone', key: 'phoneOrEmail' })
  if (!blank(input.phone) && !isValidIndianMobile(input.phone!)) e.push({ field: 'phone', key: 'invalidPhone' })
  if (!blank(input.altPhone) && !isValidIndianMobile(input.altPhone!)) e.push({ field: 'altPhone', key: 'invalidPhone' })
  if (!blank(input.email) && !isEmail(input.email)) e.push({ field: 'email', key: 'invalidEmail' })
  if (blank(input.source)) e.push({ field: 'source', key: 'required' })
  const r = input.requirement
  if (r) {
    if (r.budgetMin && r.budgetMax && r.budgetMin > r.budgetMax) e.push({ field: 'requirement.budgetMin', key: 'budgetOrder' })
    if (r.budgetPreferred && r.budgetMax && r.budgetPreferred > r.budgetMax) e.push({ field: 'requirement.budgetPreferred', key: 'budgetOrder' })
    if (r.areaMinSqft && r.areaMaxSqft && r.areaMinSqft > r.areaMaxSqft) e.push({ field: 'requirement.areaMinSqft', key: 'rangeOrder' })
    for (const k of ['budgetMin', 'budgetPreferred', 'budgetMax'] as const) if (r[k] != null && r[k]! < 0) e.push({ field: `requirement.${k}`, key: 'positive' })
  }
  return e
}

/** Extra data a stage move needs: a reason for Lost, a property and booking amount for Booked. */
export function validateStageMove(to: Lead['stage'], extra: { lostReason?: string; propertyId?: string; bookingAmount?: number }): FieldError[] {
  const e: FieldError[] = []
  if (to === 'lost' && blank(extra.lostReason)) e.push({ field: 'lost.reason', key: 'lostReasonRequired' })
  if (to === 'booked') {
    if (blank(extra.propertyId)) e.push({ field: 'deal.propertyId', key: 'bookingPropertyRequired' })
    if (!extra.bookingAmount || extra.bookingAmount <= 0) e.push({ field: 'deal.bookingAmount', key: 'bookingAmountRequired' })
  }
  return e
}

export function validateProperty(input: Partial<PropertyInput>): FieldError[] {
  const e: FieldError[] = []
  if (blank(input.title) && blank(input.configuration)) e.push({ field: 'title', key: 'required' })
  if (blank(input.type)) e.push({ field: 'type', key: 'required' })
  if (blank(input.location?.city)) e.push({ field: 'location.city', key: 'required' })
  if (blank(input.location?.locality)) e.push({ field: 'location.locality', key: 'required' })
  if (!input.price || input.price <= 0) e.push({ field: 'price', key: 'required' })
  const a = input.area
  if (!a || !(a.carpet || a.builtUp || a.superBuiltUp || a.plot || (a.plotLengthFt && a.plotWidthFt))) e.push({ field: 'area', key: 'required' })
  if (a?.carpet && a.builtUp && a.carpet > a.builtUp) e.push({ field: 'area.carpet', key: 'carpetOverBuiltUp' })
  if (input.floor != null && input.totalFloors != null && input.floor > input.totalFloors) e.push({ field: 'floor', key: 'floorOverTotal' })
  if (input.owner?.phone && !isValidIndianMobile(input.owner.phone)) e.push({ field: 'owner.phone', key: 'invalidPhone' })
  return e
}

export function validateAppointment(input: Partial<AppointmentInput>): FieldError[] {
  const e: FieldError[] = []
  if (blank(input.leadId) && blank(input.clientId)) e.push({ field: 'leadId', key: 'required' })
  if (blank(input.type)) e.push({ field: 'type', key: 'required' })
  if (blank(input.ownerId)) e.push({ field: 'ownerId', key: 'required' })
  if (blank(input.start) || Number.isNaN(new Date(input.start!).getTime())) e.push({ field: 'start', key: 'required' })
  if (input.type === 'siteVisit' && !input.propertyIds?.length) e.push({ field: 'propertyIds', key: 'siteVisitProperty' })
  if (input.durationMin != null && input.durationMin <= 0) e.push({ field: 'durationMin', key: 'positive' })
  return e
}

export function validateTask(input: Partial<TaskInput>): FieldError[] {
  const e: FieldError[] = []
  if (blank(input.title)) e.push({ field: 'title', key: 'required' })
  if (blank(input.ownerId)) e.push({ field: 'ownerId', key: 'required' })
  if (blank(input.dueAt) || Number.isNaN(new Date(input.dueAt!).getTime())) e.push({ field: 'dueAt', key: 'required' })
  return e
}

/** Thrown by services when input is invalid; the UI shows each error next to its field. */
export class ValidationError extends Error {
  readonly errors: FieldError[]
  constructor(errors: FieldError[]) {
    super(`Invalid input: ${errors.map((x) => `${x.field} ${x.key}`).join(', ')}`)
    this.name = 'ValidationError'
    this.errors = errors
  }
}

export function assertValid(errors: FieldError[]): void {
  if (errors.length) throw new ValidationError(errors)
}
