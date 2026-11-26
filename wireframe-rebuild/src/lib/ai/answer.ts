/**
 * Answering a question about leads: the leads that fit, and how the question was read (as chips that can be removed).
 * Only leads the person may see are searched (the caller passes them); closed and lost leads are left out.
 */
import type { TFunction } from 'i18next'
import type { Database, Lead } from '@/data/types'
import { propertiesForLead, type Match } from '@/lib/matching'
import { readiness } from '@/lib/readiness'
import type { LeadQuery } from './understand'

export type Answer = { rows: { lead: Lead; ready: number; band: ReturnType<typeof readiness>['band']; top?: Match }[]; chips: { key: keyof LeadQuery; label: string }[] }

export function answerLeads(q: LeadQuery, leads: Lead[], db: Database, today: string, t: TFunction): Answer {
  const open = leads.filter((l) => l.stage !== 'lost' && l.stage !== 'closed')
  const props = db.properties.filter((p) => p.status === 'available' && !p.archived)
  const rows = open
    .filter((l) => !q.cities.length || l.requirement.cities.some((c) => q.cities.includes(c)))
    .filter((l) => !q.noVisit || !l.visits.some((v) => v.status === 'scheduled'))
    .filter((l) => !q.overdue || (!!l.nextFollowUp && l.nextFollowUp < today))
    .filter((l) => !q.dueToday || l.nextFollowUp === today)
    .filter((l) => !q.noFollowUp || !l.nextFollowUp)
    .filter((l) => !q.stage || l.stage === q.stage)
    .filter((l) => !q.purpose || l.purpose === q.purpose)
    .filter((l) => !q.type || l.requirement.type === q.type)
    .map((lead) => { const r = readiness(lead, db); return { lead, ready: r.total, band: r.band, top: propertiesForLead(lead, props, db.settings)[0] } })
    .filter((r) => !q.readyMin || r.ready >= q.readyMin)
    .sort((a, b) => b.ready - a.ready)
  const chips: Answer['chips'] = []
  if (q.cities.length) chips.push({ key: 'cities', label: t('ai.chip.city', { list: q.cities.join(', ') }) })
  if (q.readyMin) chips.push({ key: 'readyMin', label: t('ai.chip.ready', { n: q.readyMin }) })
  if (q.noVisit) chips.push({ key: 'noVisit', label: t('ai.chip.noVisit') })
  if (q.overdue) chips.push({ key: 'overdue', label: t('ai.chip.overdue') })
  if (q.dueToday) chips.push({ key: 'dueToday', label: t('ai.chip.dueToday') })
  if (q.noFollowUp) chips.push({ key: 'noFollowUp', label: t('ai.chip.noFollowUp') })
  if (q.stage) chips.push({ key: 'stage', label: t('ai.chip.stage', { stage: t(`stage.${q.stage}`) }) })
  if (q.purpose) chips.push({ key: 'purpose', label: t('ai.chip.purpose', { purpose: t(`purpose.buyer.${q.purpose}`) }) })
  if (q.type) chips.push({ key: 'type', label: t('ai.chip.type', { type: t(`type.${q.type}`) }) })
  chips.push({ key: 'count', label: t('ai.chip.open') })
  return { rows, chips }
}

/** The question without one of its conditions (a chip removed). */
export function withoutChip(q: LeadQuery, key: keyof LeadQuery): LeadQuery {
  if (key === 'cities') return { ...q, cities: [] }
  if (key === 'count') return q
  return { ...q, [key]: undefined }
}
