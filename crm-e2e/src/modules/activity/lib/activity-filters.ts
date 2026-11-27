/**
 * The global activity log's pure logic: kind groups, filters (who, which record type, what kind, when, how it was
 * done), small stats for the header, and a simulated "ask in words" reader that turns "AI changes by Arjun this week"
 * into the same filters. Nothing here reads the store; `now` and the local-day function are passed in.
 */
import type { Activity, ActivityKind, ActorId, EntityKind, ID, Origin, User } from '@/domain/types'

export const KIND_GROUPS = ['leads', 'communication', 'appointments', 'tasks', 'properties', 'clients', 'imports', 'team', 'settings'] as const
export type KindGroup = (typeof KIND_GROUPS)[number]

export function kindGroupOf(kind: ActivityKind): KindGroup {
  if (kind.startsWith('lead.')) return 'leads'
  if (kind.startsWith('comm.') || kind === 'note') return 'communication'
  if (kind.startsWith('appointment.')) return 'appointments'
  if (kind.startsWith('task.')) return 'tasks'
  if (kind.startsWith('property.')) return 'properties'
  if (kind.startsWith('client.')) return 'clients'
  if (kind.startsWith('import.') || kind.startsWith('draft.')) return 'imports'
  if (kind.startsWith('user.')) return 'team'
  return 'settings'
}

export const ENTITY_FILTERS: EntityKind[] = ['lead', 'client', 'property', 'appointment', 'task', 'user', 'importJob', 'settings']
export const VIA_FILTERS: Origin[] = ['manual', 'ai', 'automation', 'import']
export const RANGES = ['today', '7d', '30d', 'all'] as const
export type Range = (typeof RANGES)[number]

export type ActivityFilters = {
  actors: ActorId[]
  entities: EntityKind[]
  groups: KindGroup[]
  via: Origin[]
  range: Range
  q: string
}
export const NO_FILTERS: ActivityFilters = { actors: [], entities: [], groups: [], via: [], range: 'all', q: '' }

export const activeFilterCount = (f: ActivityFilters) =>
  f.actors.length + f.entities.length + f.groups.length + f.via.length + (f.range !== 'all' ? 1 : 0) + (f.q.trim() ? 1 : 0)

/** The earliest local day a range includes (inclusive), or null for "all time". */
export function rangeStartDay(range: Range, today: string, addDays: (day: string, n: number) => string): string | null {
  if (range === 'today') return today
  if (range === '7d') return addDays(today, -6)
  if (range === '30d') return addDays(today, -29)
  return null
}

/**
 * Applies the filters, newest first. `text(a)` renders an entry (for the search box: the rendered sentence, the
 * typed note, the actor's name); `dayOf` is lib/dates.localDay.
 */
export function filterActivities(
  list: Activity[], f: ActivityFilters,
  ctx: { today: string; dayOf: (iso: string) => string; addDays: (day: string, n: number) => string; text?: (a: Activity) => string },
): Activity[] {
  const from = rangeStartDay(f.range, ctx.today, ctx.addDays)
  const q = f.q.trim().toLowerCase()
  return list
    .filter((a) =>
      (!f.actors.length || f.actors.includes(a.actorId)) &&
      (!f.entities.length || a.refs.some((r) => f.entities.includes(r.kind))) &&
      (!f.groups.length || f.groups.includes(kindGroupOf(a.kind))) &&
      (!f.via.length || f.via.includes(a.via)) &&
      (!from || ctx.dayOf(a.at) >= from) &&
      (!q || (ctx.text?.(a) ?? '').toLowerCase().includes(q) || (a.text ?? '').toLowerCase().includes(q)))
    .sort((a, b) => b.at.localeCompare(a.at))
}

export type ActivityStats = { total: number; ai: number; automation: number; import: number; manual: number; people: number; topActor: ActorId | null }

export function activityStats(list: Activity[]): ActivityStats {
  const by: Record<string, number> = {}
  let ai = 0, automation = 0, imported = 0
  for (const a of list) {
    by[a.actorId] = (by[a.actorId] ?? 0) + 1
    if (a.via === 'ai') ai++
    else if (a.via === 'automation') automation++
    else if (a.via === 'import') imported++
  }
  const people = Object.keys(by).filter((id) => id !== 'system')
  const topActor = people.sort((x, y) => by[y] - by[x] || x.localeCompare(y))[0] ?? null
  return { total: list.length, ai, automation, import: imported, manual: list.length - ai - automation - imported, people: people.length, topActor }
}

/** Entries per day for the last `days` days, oldest first (the header sparkline). */
export function dailyCounts(list: Activity[], today: string, days: number, dayOf: (iso: string) => string, addDays: (day: string, n: number) => string): number[] {
  const index = new Map<string, number>()
  for (let i = 0; i < days; i++) index.set(addDays(today, i - days + 1), i)
  const out = new Array<number>(days).fill(0)
  for (const a of list) {
    const i = index.get(dayOf(a.at))
    if (i !== undefined) out[i]++
  }
  return out
}

/* ---------- simulated "ask in words" ---------- */

export type QueryReading = { filters: Partial<ActivityFilters>; understood: string[] }

const GROUP_WORDS: [RegExp, KindGroup][] = [
  [/\b(calls?|whats\s*app|messages?|emails?|sms|notes?)\b/i, 'communication'],
  [/\b(visits?|appointments?|meetings?)\b/i, 'appointments'],
  [/\b(tasks?|follow-?ups?)\b/i, 'tasks'],
  [/\b(propert(y|ies)|listings?|inventory)\b/i, 'properties'],
  [/\b(clients?|bookings?)\b/i, 'clients'],
  [/\b(imports?|uploads?|drafts?)\b/i, 'imports'],
  [/\b(users?|team|availability|leave|deactivat\w*)\b/i, 'team'],
  [/\b(settings?|rules?|templates?|weights?|sla)\b/i, 'settings'],
  [/\b(leads?|stages?|assign\w*)\b/i, 'leads'],
]

/**
 * "AI changes by Arjun this week" → { via: ['ai'], actors: ['u-arjun'], range: '7d' }. People are matched by first or
 * full name; "system" / "automatic" means automation. Words it does not understand become the search text.
 */
export function readActivityQuery(text: string, users: Pick<User, 'id' | 'name'>[]): QueryReading {
  const filters: Partial<ActivityFilters> = {}
  const understood: string[] = []
  let rest = ` ${text.toLowerCase()} `
  const take = (re: RegExp) => {
    const hit = re.test(rest)
    if (hit) rest = rest.replace(re, ' ')
    return hit
  }

  const via: Origin[] = []
  if (take(/\b(by|from|via|with)?\s*(the\s+)?(ai|assistant)\b/g)) via.push('ai')
  if (take(/\b(automatic(ally)?|automation|auto|system|timers?)\b/g)) via.push('automation')
  if (take(/\b(imported|via import|from import)\b/g)) via.push('import')
  if (take(/\b(manual(ly)?|by hand)\b/g)) via.push('manual')
  if (via.length) {
    filters.via = via
    understood.push('via')
  }

  if (take(/\btoday\b/g)) filters.range = 'today'
  else if (take(/\b(this|last|past)\s+week\b|\b7\s*days\b/g)) filters.range = '7d'
  else if (take(/\b(this|last|past)\s+month\b|\b30\s*days\b/g)) filters.range = '30d'
  if (filters.range) understood.push('range')

  const actors: ID[] = []
  for (const u of users) {
    const full = u.name.toLowerCase()
    const first = full.split(/\s+/)[0]
    const re = new RegExp(`\\b(${full}|${first})('s)?\\b`, 'g')
    if (re.test(rest)) {
      actors.push(u.id)
      rest = rest.replace(re, ' ')
    }
  }
  if (actors.length) {
    filters.actors = actors
    understood.push('actors')
  }

  const groups: KindGroup[] = []
  for (const [re, g] of GROUP_WORDS) if (re.test(rest) && !groups.includes(g)) groups.push(g)
  for (const [re] of GROUP_WORDS) rest = rest.replace(new RegExp(re.source, 'gi'), ' ')
  if (groups.length) {
    filters.groups = groups
    understood.push('groups')
  }

  const leftover = rest.replace(/\b(show|me|all|the|a|an|of|by|from|for|in|on|what|did|do|changes?|activity|activities|log|entries|everything|done|made|and|who|happened|about|with|to)\b/g, ' ').replace(/\s+/g, ' ').trim()
  if (leftover) filters.q = leftover
  return { filters, understood }
}

/** Every person who appears in the log (for the actor filter), most active first; `system` last. */
export function actorsIn(list: Activity[]): ActorId[] {
  const n: Record<string, number> = {}
  for (const a of list) n[a.actorId] = (n[a.actorId] ?? 0) + 1
  return Object.keys(n).sort((a, b) => (a === 'system' ? 1 : b === 'system' ? -1 : n[b] - n[a] || a.localeCompare(b)))
}
