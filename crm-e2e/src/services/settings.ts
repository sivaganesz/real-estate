/**
 * Business settings and saved views. Each section has its own permission (foundation-plan §3.1); every change is
 * an audit activity (E18).
 */
import type { AssignmentRule, ID, LostReason, MessageTemplate, SavedView, Settings } from '@/domain/types'
import { LOST_REASONS } from '@/domain/catalogue'
import { PermissionError, explainDenied, type Action } from '@/lib/permissions'
import { assertActorCan, isSystem } from './core/actor'
import { commit, must, type Tx } from './core/commit'

export const SECTION_PERMISSION: Record<keyof Settings, Action> = {
  assignment: 'rules.configure',
  pipeline: 'settings.pipeline',
  templates: 'settings.templates',
  matching: 'settings.matching',
  sla: 'settings.matching',
  scoring: 'settings.matching',
  costs: 'settings.matching',
  extraAmenities: 'settings.matching',
  mappingProfiles: 'import.leads',
}

/** Replaces one section of the settings (or merges an object patch into it). */
export function updateSettings<K extends keyof Settings>(section: K, value: Settings[K] | Partial<Settings[K]>) {
  return commit('settings.update', (tx) => {
    assertActorCan(tx.actor, SECTION_PERMISSION[section])
    const cur = tx.db.settings[section]
    if (Array.isArray(value) || typeof value !== 'object' || value === null || Array.isArray(cur)) tx.db.settings[section] = value as Settings[K]
    else Object.assign(cur as object, value)
    if (section === 'matching') {
      const w = tx.db.settings.matching.weights
      const sum = w.budget + w.location + w.size + w.amenities + w.preferences
      if (Math.abs(sum - 1) > 0.011) throw new Error(`Match weights must add up to 1.00 (now ${sum.toFixed(2)})`)
    }
    tx.emit({ type: 'settings.changed', section })
  }, { undoable: true })
}

/**
 * The lost reasons people may pick, in the order set in Settings → Pipeline stages (switched-off ones are left out).
 * `keep` adds a reason already on the record so an editor can still show it. Falls back to the catalogue if none is on.
 */
export function enabledLostReasons(s: Pick<Settings, 'pipeline'>, keep?: LostReason): LostReason[] {
  const on = s.pipeline.lostReasons.filter((r) => LOST_REASONS.includes(r))
  const list = on.length ? on : LOST_REASONS
  return keep && !list.includes(keep) ? [...list, keep] : list
}

export const setAutoAssign = (on: boolean) => updateSettings('assignment', { autoAssign: on })

/** A manager only changes their own team's rules (never a company-wide one or another team's): M8 R6. */
function assertMayChangeRule(tx: Tx, rule: AssignmentRule | undefined) {
  if (!rule || isSystem(tx.actor) || tx.actor.role !== 'manager') return
  if (rule.scope === 'global' || rule.scope.managerId !== tx.actor.id) throw new PermissionError('rules.configure', explainDenied(tx.actor, 'rules.configure'))
}

export function saveRule(rule: Omit<AssignmentRule, 'id'> & { id?: ID }) {
  return commit('settings.rule', (tx) => {
    assertActorCan(tx.actor, 'rules.configure')
    // a manager's rules are scoped to their own team
    const scope = !isSystem(tx.actor) && tx.actor.role === 'manager' ? { managerId: tx.actor.id } : rule.scope
    const rules = tx.db.settings.assignment.rules
    const existing = rule.id ? rules.find((r) => r.id === rule.id) : undefined
    assertMayChangeRule(tx, existing)
    if (existing) Object.assign(existing, { ...rule, scope })
    else rules.push({ ...rule, scope, id: tx.id('RULE') })
    tx.emit({ type: 'settings.changed', section: 'assignment' })
  })
}

export function deleteRule(id: ID) {
  return commit('settings.ruleDelete', (tx) => {
    assertActorCan(tx.actor, 'rules.configure')
    assertMayChangeRule(tx, tx.db.settings.assignment.rules.find((r) => r.id === id))
    tx.db.settings.assignment.rules = tx.db.settings.assignment.rules.filter((r) => r.id !== id)
    tx.emit({ type: 'settings.changed', section: 'assignment' })
  }, { undoable: true })
}

export function saveView(view: Omit<SavedView, 'id' | 'userId'> & { id?: ID }): { id: ID } {
  const { result: id } = commit('view.save', (tx) => {
    const existing = view.id ? tx.db.savedViews.find((v) => v.id === view.id && v.userId === tx.actor.id) : undefined
    if (existing) {
      Object.assign(existing, view)
      return existing.id
    }
    const id = tx.id('SV')
    tx.db.savedViews.push({ ...view, id, userId: tx.actor.id })
    return id
  })
  return { id }
}

export function deleteView(id: ID) {
  return commit('view.delete', (tx) => {
    const v = must(tx.db.savedViews, id, 'savedView')
    if (v.userId !== tx.actor.id) return
    tx.db.savedViews = tx.db.savedViews.filter((x) => x.id !== id)
  })
}

/** Adds or edits a message template (admin). A new one gets the next free `tpl-custom-N` id. */
export function saveTemplate(tpl: Omit<MessageTemplate, 'id'> & { id?: ID }): { id: ID } {
  if (!tpl.body.trim()) throw new Error('A template needs a message')
  const { result: id } = commit('settings.template', (tx) => {
    assertActorCan(tx.actor, 'settings.templates')
    const list = tx.db.settings.templates
    const existing = tpl.id ? list.find((x) => x.id === tpl.id) : undefined
    if (existing) {
      Object.assign(existing, { ...tpl, body: tpl.body.trim() })
      tx.emit({ type: 'settings.changed', section: 'templates' })
      return existing.id
    }
    let n = list.length + 1
    while (list.some((x) => x.id === `tpl-custom-${n}`)) n++
    const id = `tpl-custom-${n}`
    list.push({ ...tpl, id, body: tpl.body.trim() })
    tx.emit({ type: 'settings.changed', section: 'templates' })
    return id
  })
  return { id }
}

export function deleteTemplate(id: ID) {
  return commit('settings.templateDelete', (tx) => {
    assertActorCan(tx.actor, 'settings.templates')
    tx.db.settings.templates = tx.db.settings.templates.filter((x) => x.id !== id)
    tx.emit({ type: 'settings.changed', section: 'templates' })
  }, { undoable: true })
}

/** Turns one assignment rule on or off. */
export function setRuleEnabled(id: ID, enabled: boolean) {
  return commit('settings.ruleToggle', (tx) => {
    assertActorCan(tx.actor, 'rules.configure')
    const rule = must(tx.db.settings.assignment.rules, id, 'rule')
    // a manager only changes their own team's rules
    assertMayChangeRule(tx, rule)
    rule.enabled = enabled
    tx.emit({ type: 'settings.changed', section: 'assignment' })
  })
}
