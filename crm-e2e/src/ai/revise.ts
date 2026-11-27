/**
 * "Edit" on an action proposal (DESIGN_SYSTEM §11.9: Confirm / Edit / Cancel): the user changes the few values that
 * matter (when, who, which stage, the title) and the proposal is rebuilt with the same id, payload and summary rows
 * updated. Pure apart from i18next; the panel's edit form calls it, and nothing runs until Confirm.
 */
import i18next from 'i18next'
import type { AppointmentType, DB, ID, LostReason, PipelineStageKey } from '@/domain/types'
import { fmtDateTime } from '@/lib/format'
import { phoneDisplay, toE164 } from '@/lib/phone'
import { isKind } from './proposals'
import type { ActionProposal } from './types'

const t = (key: string, opts: Record<string, unknown> = {}): string => i18next.t(key, opts)

export type ProposalEdits = {
  start?: string
  dueAt?: string
  type?: AppointmentType
  title?: string
  to?: ID | 'auto'
  stage?: PipelineStageKey
  lostReason?: LostReason
  name?: string
  phone?: string
  text?: string
}

/** Which edits a proposal kind supports (the form shows only these). */
export function editableFields(p: ActionProposal): (keyof ProposalEdits)[] {
  switch (p.kind) {
    case 'createAppointment': return ['type', 'start']
    case 'rescheduleAppointment': return ['start']
    case 'createTask': return ['title', 'dueAt']
    case 'rescheduleTask': return ['dueAt']
    case 'assignLead': case 'assignLeads': return ['to']
    case 'moveStage': return ['stage', 'lostReason']
    case 'createLead': return ['name', 'phone']
    case 'logActivity': return ['text']
    default: return []
  }
}

/** The proposal's current values for the edit form. */
export function editValues(p: ActionProposal): ProposalEdits {
  if (isKind(p, 'createAppointment')) return { start: p.payload.input.start, type: p.payload.input.type }
  if (isKind(p, 'rescheduleAppointment')) return { start: p.payload.start }
  if (isKind(p, 'createTask')) return { title: p.payload.input.title, dueAt: p.payload.input.dueAt }
  if (isKind(p, 'rescheduleTask')) return { dueAt: p.payload.dueAt }
  if (isKind(p, 'assignLead') || isKind(p, 'assignLeads')) return { to: p.payload.to }
  if (isKind(p, 'moveStage')) return { stage: p.payload.to, lostReason: p.payload.lostReason }
  if (isKind(p, 'createLead')) return { name: p.payload.input.name, phone: p.payload.input.phone }
  if (isKind(p, 'logActivity')) return { text: p.payload.text }
  return {}
}

function setRow(summary: ActionProposal['summary'], label: string, value: string | undefined, after?: string): ActionProposal['summary'] {
  const rows = summary.filter((r) => r.label !== label || value !== undefined)
  const i = rows.findIndex((r) => r.label === label)
  if (value === undefined) return rows
  if (i >= 0) return rows.map((r, j) => (j === i ? { label, value } : r))
  const at = after ? rows.findIndex((r) => r.label === after) + 1 : rows.length
  return [...rows.slice(0, at || rows.length), { label, value }, ...rows.slice(at || rows.length)]
}

/** The proposal with the edits applied (payload and summary). Values that are empty are ignored. */
export function reviseProposal(p: ActionProposal, e: ProposalEdits, db: Pick<DB, 'users'>): ActionProposal {
  let summary = p.summary
  if (isKind(p, 'createAppointment')) {
    const input = { ...p.payload.input, start: e.start ?? p.payload.input.start, type: e.type ?? p.payload.input.type }
    summary = setRow(setRow(summary, 'ai:field.when', fmtDateTime(input.start)), 'ai:field.type', t(`catalogue:appointmentType.${input.type}`))
    return { ...p, summary, payload: { input } }
  }
  if (isKind(p, 'rescheduleAppointment')) {
    const start = e.start ?? p.payload.start
    return { ...p, summary: setRow(summary, 'ai:field.to', fmtDateTime(start)), payload: { ...p.payload, start } }
  }
  if (isKind(p, 'createTask')) {
    const input = { ...p.payload.input, title: e.title?.trim() || p.payload.input.title, dueAt: e.dueAt ?? p.payload.input.dueAt }
    summary = setRow(setRow(summary, 'ai:field.title', input.title), 'ai:field.due', fmtDateTime(input.dueAt))
    return { ...p, summary, payload: { input } }
  }
  if (isKind(p, 'rescheduleTask')) {
    const dueAt = e.dueAt ?? p.payload.dueAt
    return { ...p, summary: setRow(summary, 'ai:field.to', fmtDateTime(dueAt)), payload: { ...p.payload, dueAt } }
  }
  if (isKind(p, 'assignLead') || isKind(p, 'assignLeads')) {
    const to = e.to ?? p.payload.to
    const name = to === 'auto' ? t('ai:value.auto') : db.users.find((u) => u.id === to)?.name ?? to
    return { ...p, summary: setRow(summary, 'ai:field.to', name), payload: { ...p.payload, to } } as ActionProposal
  }
  if (isKind(p, 'moveStage')) {
    const to = e.stage ?? p.payload.to
    const lostReason = to === 'lost' ? (e.lostReason ?? p.payload.lostReason ?? 'other') : undefined
    summary = setRow(summary, 'ai:field.to', t(`catalogue:stage.${to}`))
    summary = setRow(summary, 'ai:field.reason', lostReason ? t(`catalogue:lostReason.${lostReason}`) : undefined, 'ai:field.to')
    return { ...p, summary, payload: { ...p.payload, to, lostReason } }
  }
  if (isKind(p, 'createLead')) {
    const name = e.name?.trim() || p.payload.input.name
    const phone = e.phone?.trim() ? (toE164(e.phone) || e.phone.trim()) : p.payload.input.phone
    summary = setRow(setRow(summary, 'ai:field.name', name || t('ai:value.missing')), 'ai:field.phone', phone ? phoneDisplay(phone) : t('ai:value.missing'))
    const meta = { ...p.payload.input.fieldMeta }
    if (e.name !== undefined && e.name !== p.payload.input.name) meta.name = { origin: 'manual' }
    if (e.phone !== undefined && phone !== p.payload.input.phone) meta.phone = { origin: 'manual' }
    return { ...p, summary, payload: { input: { ...p.payload.input, name, phone, fieldMeta: meta } } }
  }
  if (isKind(p, 'logActivity')) {
    const text = e.text?.trim() || p.payload.text
    return { ...p, summary: setRow(summary, 'ai:field.note', text), payload: { ...p.payload, text } }
  }
  return p
}
