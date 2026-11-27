/**
 * Settings' pure logic: match-weight sums, field checks for SLA / scoring / stages, and the two simulated assistants
 * (a rule written in words → an assignment rule; a template drafted for a purpose / channel / tone). Rule-based and
 * deterministic; the UI shows their output with the Demo AI badge and saves only when the user confirms.
 */
import type {
  AssignmentRule, LeadSource, MessagePurpose, MessageTemplate, PipelineStageDef, PropertyType, Settings, User,
} from '@/domain/types'
import { CITIES, CITY_NAMES, LANGUAGES_SPOKEN } from '@/domain/catalogue'

/* ---------- matching weights ---------- */

export type Weights = Settings['matching']['weights']
export const WEIGHT_KEYS: (keyof Weights)[] = ['budget', 'location', 'size', 'amenities', 'preferences']

/** Sum of the weights, rounded to 2 decimals (what the live "= 1.00" shows). */
export const weightsSum = (w: Weights) => Math.round(WEIGHT_KEYS.reduce((n, k) => n + w[k], 0) * 100) / 100
export const weightsValid = (w: Weights) => Math.abs(weightsSum(w) - 1) < 0.005

/**
 * Scales the other weights so the total is exactly 1.00 while `keep` stays as set (two decimals; the rounding
 * remainder goes to the largest other weight). With every other weight at 0 they share the rest equally.
 */
export function normaliseWeights(w: Weights, keep?: keyof Weights): Weights {
  const fixed = keep ? Math.min(1, Math.max(0, w[keep])) : 0
  const others = WEIGHT_KEYS.filter((k) => k !== keep)
  const rest = Math.max(0, 1 - fixed)
  const otherSum = others.reduce((n, k) => n + w[k], 0)
  const out = { ...w } as Weights
  if (keep) out[keep] = Math.round(fixed * 100) / 100
  for (const k of others) out[k] = Math.round((otherSum > 0 ? (w[k] / otherSum) * rest : rest / others.length) * 100) / 100
  const diff = Math.round((1 - weightsSum(out)) * 100) / 100
  if (diff !== 0) {
    const biggest = [...others].sort((a, b) => out[b] - out[a])[0]
    out[biggest] = Math.round((out[biggest] + diff) * 100) / 100
  }
  return out
}

/* ---------- field checks (keys in the settings namespace: settings:errors.<key>) ---------- */

export type SettingError = { field: string; key: string; params?: Record<string, number> }

export function validateSla(sla: Settings['sla']): SettingError[] {
  const e: SettingError[] = []
  const whole = (field: keyof Settings['sla'], min: number, max: number) => {
    const v = sla[field]
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < min || v > max) e.push({ field, key: 'range', params: { min, max } })
  }
  whole('firstResponseMins', 1, 1440)
  whole('escalateAfterMins', 1, 2880)
  whole('staleDays', 1, 90)
  whole('hotNoContactDays', 1, 30)
  if (!e.length && sla.escalateAfterMins <= sla.firstResponseMins) e.push({ field: 'escalateAfterMins', key: 'escalateAfter' })
  return e
}

export function validateScoring(s: Settings['scoring']): SettingError[] {
  const e: SettingError[] = []
  for (const field of ['hotAt', 'warmAt'] as const) {
    if (!Number.isInteger(s[field]) || s[field] < 1 || s[field] > 100) e.push({ field, key: 'range', params: { min: 1, max: 100 } })
  }
  if (!e.length && s.warmAt >= s.hotAt) e.push({ field: 'warmAt', key: 'warmBelowHot' })
  return e
}

/** Target days 0–365 and probability 0–100 % per stage; Converted is always 100 % and Lost 0 %. */
export function validateStages(stages: PipelineStageDef[]): SettingError[] {
  const e: SettingError[] = []
  for (const s of stages) {
    if (!Number.isInteger(s.targetDays) || s.targetDays < 0 || s.targetDays > 365) e.push({ field: `${s.key}.targetDays`, key: 'range', params: { min: 0, max: 365 } })
    if (!(s.probability >= 0 && s.probability <= 1)) e.push({ field: `${s.key}.probability`, key: 'range', params: { min: 0, max: 100 } })
    if (s.label !== undefined && s.label.length > 40) e.push({ field: `${s.key}.label`, key: 'tooLong', params: { max: 40 } })
  }
  return e
}

/** Stages that must stay on: the pipeline needs a start and both ends. */
export const LOCKED_STAGES: PipelineStageDef['key'][] = ['new', 'booked', 'converted', 'lost']

/* ---------- simulated assistant 1: a rule written in words ---------- */

export type RuleDraft = Omit<AssignmentRule, 'id' | 'scope' | 'enabled'>
/** `alsoFound`: other conditions in the sentence that a one-condition rule cannot hold (shown so nothing is dropped silently). */
export type RuleReading = { rule: Partial<RuleDraft>; missing: ('kind' | 'values' | 'userIds')[]; filled: number; alsoFound: AssignmentRule['kind'][] }

const SOURCE_WORDS: [RegExp, LeadSource][] = [
  [/\b99\s*acres\b/i, 'acres99'], [/\bmagic\s*bricks\b/i, 'magicbricks'], [/\bhousing(\.com)?\b/i, 'housing'], [/\bno\s*broker\b/i, 'nobroker'],
  [/\b(facebook|fb)\b/i, 'facebook'], [/\b(instagram|insta)\b/i, 'instagram'], [/\bgoogle(\s*ads)?\b/i, 'googleAds'],
  [/\b(channel\s*partners?|cp|brokers?)\b/i, 'channelPartner'], [/\breferr(al|als|ed)\b/i, 'referral'], [/\bwalk[\s-]?ins?\b/i, 'walkIn'],
  [/\bwebsite\b/i, 'website'], [/\bwhats\s*app\b/i, 'whatsapp'], [/\bphone\s*(enquir(y|ies)|calls?)\b/i, 'phone'],
]
const TYPE_WORDS: [RegExp, PropertyType][] = [
  [/\b(apartments?|flats?)\b/i, 'apartment'], [/\bvillas?\b/i, 'villa'], [/\bindependent\s*houses?\b/i, 'independentHouse'],
  [/\brow\s*houses?\b/i, 'rowHouse'], [/\bplots?\b/i, 'plot'], [/\b(agri(cultural)?\s*land|farm\s*land)\b/i, 'agriLand'],
  [/\boffices?\b/i, 'office'], [/\bshops?\b/i, 'shop'], [/\bshowrooms?\b/i, 'showroom'], [/\bwarehouses?\b/i, 'warehouse'],
  [/\bco-?working\b/i, 'coworking'],
]

/**
 * "Send Chennai and Hyderabad leads to Sneha" → location rule; "Hindi speakers go to Vikram" → language;
 * "99acres leads to Arjun" → source; "villas and plots to Arjun and Vikram" → property type.
 * People are matched by first or full name among `users` (the executives the reader may assign to).
 */
export function readRule(text: string, users: Pick<User, 'id' | 'name'>[]): RuleReading {
  const lower = text.toLowerCase()
  // the people part: after "to" / "→" / "for", else anywhere
  const target = /(?:\bto\b|→|->|\bfor\b|\bgoes?\b|\bgo\b)\s+(.+)$/i.exec(text)?.[1] ?? text
  const userIds = users.filter((u) => {
    const [first] = u.name.toLowerCase().split(/\s+/)
    return new RegExp(`\\b(${first}|${u.name.toLowerCase()})\\b`).test(target.toLowerCase())
  }).map((u) => u.id)
  const head = target === text ? text : text.slice(0, text.length - target.length)

  const pick = <T,>(pairs: [RegExp, T][], s: string) => pairs.filter(([re]) => re.test(s)).map(([, v]) => v)
  const places: string[] = []
  for (const city of CITY_NAMES) {
    if (new RegExp(`\\b${city.toLowerCase()}\\b`).test(head.toLowerCase())) places.push(city)
    for (const loc of CITIES[city]) if (head.toLowerCase().includes(loc.toLowerCase())) places.push(loc)
  }
  if (/\bbangalore\b/i.test(head) && !places.includes('Bengaluru')) places.push('Bengaluru')
  const languages = LANGUAGES_SPOKEN.filter((l) => new RegExp(`\\b${l.toLowerCase()}\\b`).test(head.toLowerCase()))
  const sources = pick(SOURCE_WORDS, head)
  const types = pick(TYPE_WORDS, head)

  let rule: Partial<RuleDraft> = {}
  if (languages.length && /\b(speak|speaking|speakers?|language|prefer)/i.test(lower)) rule = { kind: 'language', values: languages }
  else if (sources.length) rule = { kind: 'source', values: sources }
  else if (places.length) rule = { kind: 'location', values: places }
  else if (types.length) rule = { kind: 'propertyType', values: types }
  else if (languages.length) rule = { kind: 'language', values: languages }
  if (userIds.length) rule.userIds = userIds
  const found: [AssignmentRule['kind'], number][] = [['location', places.length], ['propertyType', types.length], ['language', languages.length], ['source', sources.length]]
  const alsoFound = found.filter(([k, n]) => n > 0 && k !== rule.kind).map(([k]) => k)

  const missing: RuleReading['missing'] = []
  if (!rule.kind) missing.push('kind')
  if (!rule.values?.length) missing.push('values')
  if (!rule.userIds?.length) missing.push('userIds')
  return { rule, missing, filled: (rule.kind ? 1 : 0) + (rule.values?.length ? 1 : 0) + (rule.userIds?.length ? 1 : 0), alsoFound }
}

/** Value options for a rule kind (the manual editor's chips). Labels: sources / types through the catalogue namespace. */
export function ruleValueOptions(kind: AssignmentRule['kind'], sources: readonly LeadSource[], types: readonly PropertyType[]): string[] {
  switch (kind) {
    case 'location': return CITY_NAMES.flatMap((c) => [c, ...CITIES[c]])
    case 'language': return [...LANGUAGES_SPOKEN]
    case 'source': return [...sources]
    case 'propertyType': return [...types]
  }
}

/* ---------- message templates ---------- */

export const PLACEHOLDERS = ['firstName', 'agent', 'property', 'time', 'map', 'price', 'link'] as const
export type Placeholder = (typeof PLACEHOLDERS)[number]

/** Placeholders a body uses, in order of first use. */
export function placeholdersIn(body: string): string[] {
  const out: string[] = []
  for (const m of body.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) if (!out.includes(m[1])) out.push(m[1])
  return out
}
export const unknownPlaceholders = (body: string) => placeholdersIn(body).filter((p) => !(PLACEHOLDERS as readonly string[]).includes(p))

/** The body with sample values (the live preview); unknown placeholders stay visible. */
export const fillTemplate = (body: string, sample: Partial<Record<Placeholder, string>>) =>
  body.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, k: string) => sample[k as Placeholder] ?? all)

/** WhatsApp and SMS bodies are short; SMS over 160 characters is sent as several messages. */
export const smsParts = (body: string) => Math.max(1, Math.ceil(body.length / 160))

const DRAFTS: Record<MessagePurpose, { english: string; hinglish: string }> = {
  intro: {
    english: 'Hi {{firstName}}, this is {{agent}} from RealSpec. Thank you for your enquiry. Could we speak for five minutes today about what you are looking for?',
    hinglish: 'Namaste {{firstName}}, main {{agent}} RealSpec se. Aapki enquiry ke liye dhanyavaad! Aaj 5 minute baat ho sakti hai aapki requirement ke baare mein?',
  },
  followUp: {
    english: 'Hi {{firstName}}, following up on our last conversation. I have shortlisted a few homes that fit your budget. Shall I share them?',
    hinglish: 'Hi {{firstName}}, pichli baat ka follow-up. Aapke budget mein kuch acche options shortlist kiye hain. Share karun?',
  },
  visitConfirm: {
    english: 'Hi {{firstName}}, your site visit to {{property}} is confirmed for {{time}}. I will meet you at the site office. Location: {{map}}',
    hinglish: 'Hi {{firstName}}, {{property}} ka site visit {{time}} ko confirm hai. Main site office pe milunga. Location: {{map}}',
  },
  postVisit: {
    english: 'Hi {{firstName}}, thank you for visiting {{property}} today. What did you and your family think? Happy to answer any questions.',
    hinglish: 'Hi {{firstName}}, aaj {{property}} visit karne ke liye thanks. Aapko aur family ko kaisa laga? Koi bhi sawaal ho toh batayein.',
  },
  offer: {
    english: 'Hi {{firstName}}, good news: the builder has agreed to {{price}} for {{property}}. This offer is valid for a short time. Shall we block it?',
    hinglish: 'Hi {{firstName}}, achhi khabar: builder {{property}} ke liye {{price}} pe maan gaye hain. Offer kuch hi din ka hai. Block kar dein?',
  },
  share: {
    english: 'Hi {{firstName}}, here are homes that match what you told me: {{link}}. Tell me which ones you would like to see.',
    hinglish: 'Hi {{firstName}}, aapki requirement ke hisaab se yeh options hain: {{link}}. Batayein kaunse dekhna chahenge.',
  },
  reminder: {
    english: 'Hi {{firstName}}, a quick reminder about your visit to {{property}} at {{time}}. See you there!',
    hinglish: 'Hi {{firstName}}, reminder: {{property}} visit {{time}} pe hai. Milte hain!',
  },
}

/**
 * Drafts a template body for a purpose, channel and tone. Email gets a greeting line and a sign-off; SMS is trimmed
 * to one message where possible (the link / map placeholder is kept).
 */
export function draftTemplate(purpose: MessagePurpose, channel: MessageTemplate['channel'], tone: MessageTemplate['tone']): string {
  const base = DRAFTS[purpose][tone]
  if (channel === 'email') return `${base}\n\n${tone === 'hinglish' ? 'Dhanyavaad' : 'Warm regards'},\n{{agent}}\nRealSpec`
  if (channel === 'sms' && base.length > 160) {
    const firstSentence = base.split(/(?<=[.!?])\s/)[0]
    const keep = placeholdersIn(base).filter((p) => p === 'map' || p === 'link').map((p) => ` {{${p}}}`).join('')
    return `${firstSentence}${keep}`.slice(0, 160)
  }
  return base
}

/** Templates grouped by purpose in catalogue order (for the list). */
export function groupTemplates(list: MessageTemplate[], purposes: readonly MessagePurpose[]): { purpose: MessagePurpose; items: MessageTemplate[] }[] {
  return purposes.map((purpose) => ({ purpose, items: list.filter((x) => x.purpose === purpose) })).filter((g) => g.items.length)
}

/** Lost reasons in the saved order first, then the rest (switched off). */
export function lostReasonRows<T extends string>(all: readonly T[], enabled: readonly T[]): { reason: T; on: boolean }[] {
  return [...enabled.map((reason) => ({ reason, on: true })), ...all.filter((r) => !enabled.includes(r)).map((reason) => ({ reason, on: false }))]
}

export const moveItem = <T,>(list: readonly T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length || from === to) return [...list]
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

