/**
 * The simulated AI provider (the default; master prompt §12.1): rule-based, regex, keyword and fuzzy matching over
 * the real app data, entirely in the browser. Every result says mode 'simulated' so the UI shows the Demo AI badge.
 * A short delay makes the "thinking" state visible without slowing the demo down.
 */
import type { DB, ID } from '@/domain/types'
import { leadScore } from '@/lib/scoring'
import { propertiesForLead } from '@/lib/matching'
import { suggestNext } from '@/lib/next-action'
import { inrShort } from '@/lib/format'
import i18next from 'i18next'
import type { AIContext, AIService } from '../types'
import { mapColumnsSim } from './columns'
import { parseCommandSim, readUpdateSim } from './commands'
import { extractAppointmentFields } from './extract-appointment'
import { extractLeadFields } from './extract-lead'
import { extractPropertyFields } from './extract-property'
import { generateMessageSim } from './messages'
import { hinglishWords } from './hinglish'
import { qualifyLeadSim } from './qualify'
import { insightsSim, summarizeSim } from './summarize'
import { visible } from '@/services/queries/visibility'

const THINK_MS = 350
const later = <T>(fn: () => T, ms = THINK_MS): Promise<T> =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      try { resolve(fn()) } catch (e) { reject(e) }
    }, ms)
  })

const mustLead = (db: DB, id: ID) => {
  const lead = db.leads.find((l) => l.id === id)
  if (!lead) throw new Error(`lead ${id} not found`)
  return lead
}

export function createSimulatedProvider(opts: { delayMs?: number } = {}): AIService {
  const wait = <T>(fn: () => T) => later(fn, opts.delayMs ?? THINK_MS)
  return {
    mode: 'simulated',
    extractLead: (text, ctx) => wait(() => extractLeadFields(hinglishWords(text), { now: ctx.now, db: ctx.db() })),
    extractProperty: (text, ctx) => wait(() => extractPropertyFields(text, { now: ctx.now })),
    extractAppointment: (text, ctx) => wait(() => {
      const db = ctx.db()
      const x = extractAppointmentFields(hinglishWords(text), {
        now: ctx.now, leads: visible.leads(db, ctx.actor), properties: db.properties.filter((p) => p.listing === 'live'),
        selectedLeadId: ctx.selection?.kind === 'lead' ? ctx.selection.id : undefined,
      })
      delete x.date
      delete x.time
      return x
    }),
    qualifyLead: (leadId, ctx) => wait(() => {
      const db = ctx.db()
      return qualifyLeadSim(mustLead(db, leadId), db.activities)
    }),
    scoreLead: (leadId, ctx) => wait(() => {
      const db = ctx.db()
      return leadScore(mustLead(db, leadId), { properties: db.properties, settings: db.settings, now: ctx.now })
    }),
    matchProperties: (leadId, ctx: AIContext) => wait(() => {
      const db = ctx.db()
      const lead = mustLead(db, leadId)
      const matches = propertiesForLead(lead, db.properties, db.settings, ctx.now, { limit: 10 })
      const best = matches[0]
      return {
        matches,
        text: {
          mode: 'simulated' as const,
          text: best
            ? i18next.t('ai:match.summary', { count: matches.length, name: lead.name, best: best.property.title, score: best.score, price: inrShort(best.property.price) })
            : i18next.t('ai:reply.noMatches', { name: lead.name }),
          links: matches.slice(0, 5).map((m) => ({ kind: 'property' as const, id: m.property.id })),
        },
      }
    }),
    summarize: (target, ctx) => wait(() => summarizeSim(target, ctx.db(), ctx.actor, ctx.now)),
    generateMessage: (req, ctx) => wait(() => generateMessageSim(req, ctx.db(), ctx.actor)),
    suggestNextAction: (leadId, ctx) => wait(() => {
      const db = ctx.db()
      const next = suggestNext(mustLead(db, leadId), { appointments: db.appointments, tasks: db.tasks, properties: db.properties, settings: db.settings, now: ctx.now })
      return next ? { key: `leads:next.${next.key}`, params: next.params } : { key: 'ai:next.none' }
    }),
    insights: (scope, ctx) => wait(() => insightsSim(scope, ctx.db(), ctx.actor, ctx.now)),
    mapColumns: (headers, sample, kind) => wait(() => mapColumnsSim(headers, sample, kind)),
    parseCommand: (text, ctx) => wait(() => parseCommandSim(text, ctx)),
    readUpdate: (target, text, ctx) => wait(() => readUpdateSim(target, text, ctx)),
  }
}
