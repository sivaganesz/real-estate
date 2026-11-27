/**
 * The live AI provider stub (master prompt §12.1). It POSTs `{ task, input, context }` to VITE_AI_ENDPOINT — a backend
 * proxy that holds the model key (never a vendor URL with a key in the frontend) — and expects the same JSON shapes as
 * the simulated provider. Any method that fails, times out or is not implemented by the proxy falls back to the
 * simulated provider for that call, and the result then says mode 'simulated' (the UI shows the Demo AI badge).
 */
import type { AIContext, AIService, AITask } from '../types'

const TIMEOUT_MS = 15_000

/** What the proxy gets about the context: never the whole database. */
const slim = (ctx: AIContext) => ({
  actor: { id: ctx.actor.id, name: ctx.actor.name, role: ctx.role },
  route: ctx.route,
  selection: ctx.selection,
  now: ctx.now.toISOString(),
})

export function createLiveProvider(endpoint: string, fallback: AIService, model?: string): AIService {
  async function call<T>(task: AITask, input: unknown, ctx: AIContext, simulate: () => Promise<T>): Promise<T> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, input, context: slim(ctx), model }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`AI proxy ${res.status}`)
      const data = (await res.json()) as T
      if (data && typeof data === 'object' && !Array.isArray(data)) return { ...data, mode: 'live' } as T
      return data
    } catch {
      return simulate()
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    mode: 'live',
    extractLead: (text, ctx) => call('extractLead', { text }, ctx, () => fallback.extractLead(text, ctx)),
    extractProperty: (text, ctx) => call('extractProperty', { text }, ctx, () => fallback.extractProperty(text, ctx)),
    extractAppointment: (text, ctx) => call('extractAppointment', { text }, ctx, () => fallback.extractAppointment(text, ctx)),
    qualifyLead: (leadId, ctx) => call('qualifyLead', { leadId }, ctx, () => fallback.qualifyLead(leadId, ctx)),
    scoreLead: (leadId, ctx) => call('scoreLead', { leadId }, ctx, () => fallback.scoreLead(leadId, ctx)),
    // matching stays rule-based (it needs the full inventory); the proxy is not asked
    matchProperties: (leadId, ctx) => fallback.matchProperties(leadId, ctx),
    summarize: (target, ctx) => call('summarize', target, ctx, () => fallback.summarize(target, ctx)),
    generateMessage: (req, ctx) => call('generateMessage', req, ctx, () => fallback.generateMessage(req, ctx)),
    suggestNextAction: (leadId, ctx) => call('suggestNextAction', { leadId }, ctx, () => fallback.suggestNextAction(leadId, ctx)),
    insights: (scope, ctx) => call('insights', { scope }, ctx, () => fallback.insights(scope, ctx)),
    mapColumns: (headers, sample, kind, ctx) => call('mapColumns', { headers, sample, kind }, ctx, () => fallback.mapColumns(headers, sample, kind, ctx)),
    parseCommand: (text, ctx) => call('parseCommand', { text }, ctx, () => fallback.parseCommand(text, ctx)),
    readUpdate: (target, text, ctx) => call('readUpdate', { target, text }, ctx, () => fallback.readUpdate(target, text, ctx)),
  }
}
