/**
 * Pipeline rules (master prompt §11, DESIGN_SYSTEM §11.5), kept pure so the board, the list, the mobile tabs and the
 * analytics strip all count deals the same way. Nothing here is stored: values, ageing and predictions are derived.
 */
import type { ID, Lead, LeadSource, PipelineStageKey, Property, Settings, Task, Temperature, User } from '@/domain/types'
import { CLOSED_STAGES, STAGES } from '@/domain/catalogue'
import { CRORE, LAKH } from '@/lib/amount'
import { agingOf, stalledDeals, type AgingTone } from '@/lib/stalled'

/** A lead as a deal on the board. */
export type DealItem = {
  lead: Lead
  /** The deal value when known, else the top of the budget (the same rule as services/queries/stats). */
  value: number
  property?: Property
  owner?: User
  days: number
  target: number
  aging: AgingTone
  /** Past 2× the stage target (the ✦ stalled marker). */
  stalled: boolean
  score: number
  temperature: Temperature
  /** 0–1 predicted conversion (lib/scoring probability). */
  probability: number
  /** Earliest open task (the derived next follow-up). */
  nextFollowUpAt?: string
}

export const dealValue = (lead: Pick<Lead, 'deal' | 'requirement'>) => lead.deal?.value ?? lead.requirement.budgetMax ?? 0

/** The enabled stages, in the configured order (Settings → Pipeline). */
export function boardStages(settings: Pick<Settings, 'pipeline'>): PipelineStageKey[] {
  const defs = settings.pipeline.stages.filter((s) => s.enabled).sort((a, b) => a.order - b.order).map((s) => s.key)
  return defs.length ? defs : STAGES
}

export type DealContext = {
  properties: Property[]
  users: User[]
  tasks: Pick<Task, 'leadId' | 'status' | 'dueAt'>[]
  settings: Pick<Settings, 'pipeline'>
  now: Date
  score: (l: Lead) => { score: number; temperature: Temperature; probability: number }
}

export function buildDeals(leads: Lead[], ctx: DealContext): DealItem[] {
  const next = new Map<ID, string>()
  for (const t of ctx.tasks) {
    if (t.status !== 'open' || !t.leadId) continue
    const cur = next.get(t.leadId)
    if (!cur || t.dueAt < cur) next.set(t.leadId, t.dueAt)
  }
  const stalled = new Set(stalledDeals(leads, ctx.settings, ctx.now).map((s) => s.lead.id))
  return leads.map((lead) => {
    const a = agingOf(lead, ctx.settings, ctx.now)
    const s = ctx.score(lead)
    const propertyId = lead.deal?.propertyId
    return {
      lead,
      value: dealValue(lead),
      property: propertyId ? ctx.properties.find((p) => p.id === propertyId) : undefined,
      owner: ctx.users.find((u) => u.id === lead.ownerId),
      days: a.days, target: a.target, aging: a.tone, stalled: stalled.has(lead.id),
      score: s.score, temperature: lead.temperatureOverride ?? s.temperature, probability: s.probability,
      nextFollowUpAt: CLOSED_STAGES.includes(lead.stage) ? undefined : next.get(lead.id),
    }
  })
}

/* ---------- filters ---------- */

export type ValueBand = 'under50L' | 'l50to1Cr' | 'cr1to2' | 'over2Cr'
export const VALUE_BANDS: ValueBand[] = ['under50L', 'l50to1Cr', 'cr1to2', 'over2Cr']
const BAND_RANGE: Record<ValueBand, [number, number]> = {
  under50L: [0, 50 * LAKH],
  l50to1Cr: [50 * LAKH, CRORE],
  cr1to2: [CRORE, 2 * CRORE],
  over2Cr: [2 * CRORE, Number.POSITIVE_INFINITY],
}
export const inBand = (value: number, band: ValueBand) => value >= BAND_RANGE[band][0] && value < BAND_RANGE[band][1]

export type PipelineFilters = {
  q: string
  owners: ID[]
  sources: LeadSource[]
  temperatures: Temperature[]
  values: ValueBand[]
  stalledOnly: boolean
}
export const EMPTY_FILTERS: PipelineFilters = { q: '', owners: [], sources: [], temperatures: [], values: [], stalledOnly: false }

/** "unassigned" in the owner filter matches deals without an owner. */
export const UNASSIGNED = 'unassigned'

export function matchesDeal(d: DealItem, f: PipelineFilters): boolean {
  const q = f.q.trim().toLowerCase()
  if (q) {
    const hay = [d.lead.name, d.lead.id, d.lead.phone, d.property?.title, d.owner?.name].filter(Boolean).join(' ').toLowerCase()
    const digits = q.replace(/\D/g, '')
    if (!hay.includes(q) && !(digits.length >= 3 && d.lead.phone.replace(/\D/g, '').includes(digits))) return false
  }
  if (f.owners.length && !f.owners.includes(d.lead.ownerId ?? UNASSIGNED)) return false
  if (f.sources.length && !f.sources.includes(d.lead.source)) return false
  if (f.temperatures.length && !f.temperatures.includes(d.temperature)) return false
  if (f.values.length && !f.values.some((b) => inBand(d.value, b))) return false
  if (f.stalledOnly && !d.stalled) return false
  return true
}

export const activeFilterCount = (f: PipelineFilters) =>
  (f.q.trim() ? 1 : 0) + f.owners.length + f.sources.length + f.temperatures.length + f.values.length + (f.stalledOnly ? 1 : 0)

/* ---------- columns ---------- */

export type ColumnSummary = { stage: PipelineStageKey; count: number; value: number; /** 0–1 of the open pipeline value */ share: number }

/** Count, ₹ total and share of the open value per stage. Closed stages have no share (they are not "pipeline"). */
export function columnSummaries(deals: DealItem[], stages: PipelineStageKey[]): ColumnSummary[] {
  const openTotal = deals.filter((d) => !CLOSED_STAGES.includes(d.lead.stage)).reduce((n, d) => n + d.value, 0)
  return stages.map((stage) => {
    const list = deals.filter((d) => d.lead.stage === stage)
    const value = list.reduce((n, d) => n + d.value, 0)
    return { stage, count: list.length, value, share: CLOSED_STAGES.includes(stage) || !openTotal ? 0 : value / openTotal }
  })
}

/** Cards inside a column: stalled first, then the oldest in stage, then the biggest. */
export const sortColumn = (deals: DealItem[]) =>
  [...deals].sort((a, b) => Number(b.stalled) - Number(a.stalled) || b.days - a.days || b.value - a.value)

export type DealSort = { key: 'name' | 'stage' | 'value' | 'days' | 'probability' | 'followUp'; dir: 'asc' | 'desc' }

export function sortDeals(deals: DealItem[], sort: DealSort, order: PipelineStageKey[]): DealItem[] {
  const rank = (s: PipelineStageKey) => order.indexOf(s)
  const cmp: Record<DealSort['key'], (a: DealItem, b: DealItem) => number> = {
    name: (a, b) => a.lead.name.localeCompare(b.lead.name),
    stage: (a, b) => rank(a.lead.stage) - rank(b.lead.stage),
    value: (a, b) => a.value - b.value,
    days: (a, b) => a.days - b.days,
    probability: (a, b) => a.probability - b.probability,
    followUp: (a, b) => (a.nextFollowUpAt ?? '￿').localeCompare(b.nextFollowUpAt ?? '￿'),
  }
  const dir = sort.dir === 'asc' ? 1 : -1
  return [...deals].sort((a, b) => dir * cmp[sort.key](a, b) || a.lead.name.localeCompare(b.lead.name))
}

/* ---------- totals and analytics ---------- */

export type PipelineTotals = { openCount: number; openValue: number; weighted: number; stalled: number; wonCount: number; wonValue: number; lostCount: number; winRate: number }

export function pipelineTotals(deals: DealItem[]): PipelineTotals {
  const open = deals.filter((d) => !CLOSED_STAGES.includes(d.lead.stage))
  const won = deals.filter((d) => d.lead.stage === 'booked' || d.lead.stage === 'converted')
  const lost = deals.filter((d) => d.lead.stage === 'lost').length
  return {
    openCount: open.length,
    openValue: open.reduce((n, d) => n + d.value, 0),
    weighted: Math.round(open.reduce((n, d) => n + d.value * d.probability, 0)),
    stalled: deals.filter((d) => d.stalled).length,
    wonCount: won.length,
    wonValue: won.reduce((n, d) => n + d.value, 0),
    lostCount: lost,
    winRate: won.length + lost ? Math.round((won.length / (won.length + lost)) * 100) : 0,
  }
}

export type StageAnalytics = {
  stage: PipelineStageKey
  /** Leads that reached this stage at some point (stage history or now). */
  reached: number
  /** % of those who reached this stage that went on to the next stage in the path. */
  conversionPct: number | null
  /** 100 − conversion for open path stages. */
  dropOffPct: number | null
  /** Average whole days spent in the stage (finished stays and the current one). */
  avgDays: number | null
}

const DAY = 86_400_000

/**
 * Stage conversion, drop-off and average days per stage (master prompt §11 "conversion analytics per stage and
 * stage-wise drop-off"). The path excludes Lost; a lead "reached" a stage when it is in its history or current stage.
 */
export function stageAnalytics(leads: Lead[], stages: PipelineStageKey[], now: Date): StageAnalytics[] {
  const path = stages.filter((s) => s !== 'lost')
  const rank = new Map<PipelineStageKey, number>(path.map((s, i) => [s, i]))
  const furthest = leads.map((l) => {
    let max = -1
    for (const h of l.stageHistory) max = Math.max(max, rank.get(h.stage) ?? -1)
    return Math.max(max, rank.get(l.stage) ?? -1)
  })
  const stays = new Map<PipelineStageKey, number[]>()
  for (const l of leads) {
    const hist = [...l.stageHistory].sort((a, b) => a.at.localeCompare(b.at))
    hist.forEach((h, i) => {
      const end = hist[i + 1]?.at ?? (h.stage === l.stage ? now.toISOString() : undefined)
      if (!end) return
      const days = Math.max(0, (new Date(end).getTime() - new Date(h.at).getTime()) / DAY)
      stays.set(h.stage, [...(stays.get(h.stage) ?? []), days])
    })
    if (!hist.length) stays.set(l.stage, [...(stays.get(l.stage) ?? []), Math.max(0, (now.getTime() - new Date(l.stageSince).getTime()) / DAY)])
  }
  return stages.map((stage) => {
    const i = rank.get(stage)
    const reached = i === undefined ? leads.filter((l) => l.stage === stage).length : furthest.filter((f) => f >= i).length
    const nextReached = i !== undefined && i < path.length - 1 ? furthest.filter((f) => f >= i + 1).length : null
    const conversionPct = nextReached !== null && reached ? Math.round((nextReached / reached) * 100) : null
    const list = stays.get(stage) ?? []
    return {
      stage, reached, conversionPct,
      dropOffPct: conversionPct === null ? null : 100 - conversionPct,
      avgDays: list.length && !CLOSED_STAGES.includes(stage) ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null,
    }
  })
}

/** Weekly counts over the last `weeks` weeks (oldest first), for KPI sparklines. */
export function weeklySeries(dates: (string | undefined)[], now: Date, weeks = 8): number[] {
  const out = Array.from({ length: weeks }, () => 0)
  const end = now.getTime()
  for (const d of dates) {
    if (!d) continue
    const age = Math.floor((end - new Date(d).getTime()) / (7 * DAY))
    if (age >= 0 && age < weeks) out[weeks - 1 - age]++
  }
  return out
}

/** Leads that entered a stage at `at`, for the "won" sparkline (booked or converted entries). */
export const wonDates = (leads: Lead[]) =>
  leads.flatMap((l) => l.stageHistory.filter((h) => h.stage === 'booked').map((h) => h.at))

/** The stage where a move needs extra input in a dialog (Lost reason, Booked amount + property, Converted confirm). */
export const NEEDS_DIALOG: PipelineStageKey[] = ['lost', 'booked', 'converted']
