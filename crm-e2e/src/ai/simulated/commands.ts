/**
 * The global assistant's command reader (master prompt §12.5): a request in English or Hinglish → a reply with links,
 * the records to list, small graphics, next-question chips and action proposals. Nothing is written here: the panel
 * shows each proposal with Confirm / Edit / Cancel and services/commands runs it. A request the role may not do is
 * refused with the reason. Ported idea: wireframe-rebuild/src/lib/ai/plan.ts ("plan of changes, a person applies")
 * and answer.ts (query answers); the handlers live in command-actions.ts (writes) and command-queries.ts (reads).
 */
import { can } from '@/lib/permissions'
import { paths } from '@/app/paths'
import type { AIContext, CommandPlan } from '../types'
import {
  assignLeadPlan, bulkAssignPlan, completeTaskPlan, createAppointmentPlan, createLeadPlan, createPropertyPlan, createTaskPlan, draftMessagePlan,
  moveStagePlan, reassignFromPlan, requestReassignPlan, reschedulePlan, sharePlan, updateLeadPlan,
} from './command-actions'
import { makeEnv, refuse, say, t, type Env } from './command-kit'
import {
  businessSummaryPlan, duplicatesPlan, findMatchesPlan, followUpLeadsPlan, lostReasonsPlan, namedLeadPlan, nextCallPlan,
  performancePlan, priorityLeadsPlan, propertySearchPlan, sourceConversionPlan, stalledPlan, summarizeLeadPlan,
  targetLeftPlan, teamPerformancePlan, todayAppointmentsPlan, todayTasksPlan, unsoldInventoryPlan, workloadPlan,
} from './command-queries'
import { fromHinglish } from './hinglish'
import { detectIntent, type IntentKey } from './intents'
import { norm } from './parse'
import { readPropertyUpdate } from './property-update'
import { propose } from '../proposals'
import { changeText, fieldLabelKey } from './summaries'

function run(intent: IntentKey, env: Env): CommandPlan {
  const { user } = env
  switch (intent) {
    // destructive and admin requests: refused for roles without the permission; otherwise done on the record or
    // Team page, where they have a confirm and undo (the assistant never deletes)
    case 'deleteProperty':
      return can(user, 'property.delete') ? say(intent, t('ai:reply.deleteOnRecord'), { nav: [{ label: 'ai:nav.properties', to: paths.properties() }] }) : refuse(intent, 'property.delete', user)
    case 'deleteLead':
      return can(user, 'lead.delete') ? say(intent, t('ai:reply.deleteOnRecord'), { nav: [{ label: 'ai:nav.leads', to: paths.leads() }] })
        : refuse(intent, 'lead.delete', user, { text: t('ai:reply.markLostInstead'), label: t('ai:followUp.markLost'), command: `${env.text.replace(/\b(delete|remove|erase)\b/i, 'mark')} as lost` })
    case 'manageUsers':
      return can(user, 'user.manage') ? say(intent, t('ai:reply.manageUsersOnTeam'), { nav: [{ label: 'ai:nav.team', to: paths.team() }] }) : refuse(intent, 'user.manage', user)
    case 'importHelp': {
      const action = /\bpropert|inventory|listing|flats|villas|plots\b/.test(env.s) ? 'import.properties' as const : 'import.leads' as const
      if (!can(user, action)) {
        return can(user, 'import.document')
          ? say(intent, t('ai:reply.importDocumentOnly'), { nav: [{ label: 'ai:nav.import', to: paths.import() }] })
          : refuse(intent, action, user)
      }
      return say(intent, t(action === 'import.leads' ? 'ai:reply.importLeads' : 'ai:reply.importProperties'), {
        bullets: [t('ai:reply.importSteps')],
        nav: [{ label: 'ai:nav.import', to: paths.importKind(action === 'import.leads' ? 'leads' : 'apartments') }, { label: 'ai:nav.importHistory', to: paths.importHistory() }],
      })
    }

    case 'help':
      return say(intent, t('ai:reply.help'), { followUps: helpChips(env) })

    case 'createLead': return createLeadPlan(env)
    case 'createProperty': return createPropertyPlan(env)
    case 'updateLead': return updateLeadPlan(env)
    case 'createAppointment': return createAppointmentPlan(env)
    case 'createTask': return createTaskPlan(env)
    case 'reschedule': return reschedulePlan(env)
    case 'completeTask': return completeTaskPlan(env)
    case 'assignLead': return assignLeadPlan(env)
    case 'bulkAssign': return bulkAssignPlan(env)
    case 'reassignFrom': return reassignFromPlan(env)
    case 'requestReassign': return requestReassignPlan(env)
    case 'moveStage': return moveStagePlan(env)
    case 'shareProperties': return sharePlan(env)
    case 'shortlist': return sharePlan(env, true)
    case 'draftMessage': return draftMessagePlan(env)

    case 'findMatches': return findMatchesPlan(env)
    case 'propertySearch': return propertySearchPlan(env)
    case 'todayTasks': return todayTasksPlan(env)
    case 'todayAppointments': return todayAppointmentsPlan(env)
    case 'priorityLeads': return priorityLeadsPlan(env, 'priorityLeads')
    case 'conversions': return priorityLeadsPlan(env, 'conversions')
    case 'nextCall': return nextCallPlan(env)
    case 'followUpLeads': return followUpLeadsPlan(env)
    case 'performance': return performancePlan(env)
    case 'teamPerformance': return teamPerformancePlan(env)
    case 'targetLeft': return targetLeftPlan(env)
    case 'workload': return workloadPlan(env)
    case 'stalledDeals': return stalledPlan(env)
    case 'sourceConversion': return sourceConversionPlan(env)
    case 'lostReasons': return lostReasonsPlan(env)
    case 'unsoldInventory': return unsoldInventoryPlan(env)
    case 'businessSummary': return businessSummaryPlan(env)
    case 'duplicates': return duplicatesPlan(env)
    case 'summarizeLead': return summarizeLeadPlan(env)

    case 'unknown':
      return namedLeadPlan(env) ?? say(intent, t('ai:reply.unknown'), { followUps: helpChips(env) })
  }
}

/** A few things to try, by role (the full role chips live in ai/prompts.ts). */
function helpChips(env: Env): { label: string; command: string }[] {
  const out = [
    { label: t('ai:followUp.todayTasks'), command: "Show today's pending tasks" },
    { label: t('ai:followUp.nextCall'), command: 'Who should I call next?' },
  ]
  if (can(env.user, 'team.view')) out.push({ label: t('ai:followUp.overloaded'), command: 'Who is overloaded today?' })
  if (env.user.role === 'admin') out.push({ label: t('ai:followUp.business'), command: 'Business summary for today' })
  return out
}

export function parseCommandSim(text: string, ctx: AIContext): CommandPlan {
  const typed = norm(text)
  const english = fromHinglish(typed)
  const env = makeEnv(english, typed, ctx)
  const plan = run(detectIntent(english), env)
  return english !== typed ? { ...plan, readAs: english } : plan
}

/**
 * The Lead / Property Editing assistants: what a message says changed on ONE record (the record is known, so no name
 * is needed in the text). Returns the same kind of plan as a command, with proposals to confirm.
 */
export function readUpdateSim(target: { kind: 'lead' | 'property'; id: string }, text: string, ctx: AIContext): CommandPlan {
  const typed = norm(text)
  const english = fromHinglish(typed)
  const env = makeEnv(english, typed, ctx)
  if (target.kind === 'lead') return updateLeadPlan(env, { leadId: target.id })
  const p = env.db.properties.find((x) => x.id === target.id)
  if (!p) return say('updateProperty', t('ai:summary.notFound'))
  if (!can(env.user, 'property.edit', p, env.db)) return refuse('updateProperty', 'property.edit', env.user)
  const r = readPropertyUpdate(english, p, { now: env.now })
  if (!r.changes.length) return say('updateProperty', t('ai:reply.noPropertyChange', { name: p.title }), { links: [{ kind: 'property', id: p.id }] })
  const proposal = propose({
    kind: 'updateProperty', permission: 'property.edit', targets: [{ kind: 'property', id: p.id }],
    summary: [{ label: 'ai:field.property', value: p.title }, ...r.changes.map((c) => ({ label: fieldLabelKey(c.field), value: changeText(c.field, c.from, c.to) }))],
    payload: { propertyId: p.id, patch: r.patch as Record<string, unknown> },
  })
  return { mode: 'simulated', intent: 'updateProperty', proposals: [proposal], reply: { mode: 'simulated', text: t('ai:reply.updateProperty', { name: p.title, count: r.changes.length }) } }
}
