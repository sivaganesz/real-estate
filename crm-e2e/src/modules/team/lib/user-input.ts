/**
 * The Add / Edit user form's pure logic: validation, and the simulated "paste and fill" reader that turns a line such
 * as "Add Priya Nair as a sales executive under Rohit, priya.nair@example.com, 98450 11122, Chennai, Tamil and English"
 * into form fields. Rule-based (regex + keyword lists over the app's own data); nothing is saved here.
 */
import type { ID, Role, User } from '@/domain/types'
import { CITY_NAMES, LANGUAGES_SPOKEN, cityOfLocality } from '@/domain/catalogue'
import { toE164 } from '@/lib/phone'
import { isEmail } from '@/lib/validation'

export type UserDraft = {
  name: string
  role: Role
  managerId?: ID
  phone: string
  email: string
  cities: string[]
  languages: string[]
}

export const EMPTY_USER_DRAFT: UserDraft = { name: '', role: 'executive', phone: '', email: '', cities: [], languages: ['English'] }

export type UserFieldError = { field: keyof UserDraft; key: 'required' | 'invalidEmail' | 'invalidPhone' | 'duplicateEmail' | 'managerRequired' }

/** Name and a valid email are required; phone must be a 10-digit Indian mobile when given; executives need a manager. */
export function validateUserDraft(d: UserDraft, users: Pick<User, 'id' | 'email'>[], editingId?: ID): UserFieldError[] {
  const errors: UserFieldError[] = []
  if (!d.name.trim()) errors.push({ field: 'name', key: 'required' })
  if (!d.email.trim()) errors.push({ field: 'email', key: 'required' })
  else if (!isEmail(d.email)) errors.push({ field: 'email', key: 'invalidEmail' })
  else if (users.some((u) => u.id !== editingId && u.email.trim().toLowerCase() === d.email.trim().toLowerCase())) errors.push({ field: 'email', key: 'duplicateEmail' })
  if (d.phone.trim() && !toE164(d.phone)) errors.push({ field: 'phone', key: 'invalidPhone' })
  if (d.role === 'executive' && !d.managerId) errors.push({ field: 'managerId', key: 'managerRequired' })
  return errors
}

export type UserExtraction = {
  fields: Partial<UserDraft>
  /** The fields the reader filled (the form marks them as AI-filled). */
  filled: (keyof UserDraft)[]
  /** Essential fields still empty after reading. */
  missing: (keyof UserDraft)[]
}

const ROLE_WORDS: [RegExp, Role][] = [
  [/\b(admin|administrator|sales\s*admin|crm\s*admin|mis)\b/i, 'admin'],
  [/\b(manager|team\s*lead|tl|closing\s*head|sales\s*head)\b/i, 'manager'],
  [/\b(executive|exec|sales\s*exec(utive)?|agent|associate|rm|relationship\s*manager|pre-?sales)\b/i, 'executive'],
]

const NAME_PATTERNS = [
  /\bname\s*[:\-–]\s*([A-Za-z][A-Za-z.'\- ]{1,60}?)(?=[,;\n]|\s+(?:as|is|role|phone|mobile|email|from|in|who)\b|$)/i,
  /\b(?:[Aa]dd|[Oo]nboard|[Cc]reate|[Ii]nvite|[Nn]ew\s+(?:user|joinee|member))\s*[:\-–]?\s*([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,3})/,
  /\b(?:i am|i'm|this is|meet)\s+([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){0,3})/i,
]

/** Words that look like names at the start of a line but are not. */
const NOT_NAMES = new Set(['Sales', 'Executive', 'Manager', 'Admin', 'Phone', 'Mobile', 'Email', 'Role', 'Languages', 'City', 'Cities', 'The', 'A', 'An', 'User', 'New'])

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

function readName(text: string): string | undefined {
  for (const re of NAME_PATTERNS) {
    const m = re.exec(text)
    if (!m) continue
    const words = m[1].trim().split(/\s+/).filter((w) => !NOT_NAMES.has(w))
    // stop at the first filler word that slipped in ("Priya Nair As")
    const cut = words.findIndex((w) => /^(as|is|from|under|with|and|to|for|in)$/i.test(w))
    const name = (cut === -1 ? words : words.slice(0, cut)).join(' ').trim()
    if (name.length >= 2) return titleCase(name)
  }
  // a first line that is just a name ("Priya Nair")
  const first = text.trim().split(/\n|,/)[0]?.trim() ?? ''
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(first) && !first.split(/\s+/).some((w) => NOT_NAMES.has(w))) return first
  return undefined
}

function readPhone(text: string): string | undefined {
  const m = /(?:\+?91[\s-]?)?0?([6-9]\d{4}[\s-]?\d{5})/.exec(text.replace(/[()]/g, ''))
  if (!m) return undefined
  return toE164(m[0]) || undefined
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Reads a user from free text. `managers` are the people an executive can report to (matched by first or full name). */
export function extractUser(text: string, managers: Pick<User, 'id' | 'name'>[]): UserExtraction {
  const fields: Partial<UserDraft> = {}
  const filled: (keyof UserDraft)[] = []
  const set = <K extends keyof UserDraft>(k: K, v: UserDraft[K] | undefined) => {
    if (v === undefined || (Array.isArray(v) && !v.length)) return
    fields[k] = v
    filled.push(k)
  }

  const email = /[\w.+-]+@[\w-]+(\.[\w-]+)+/.exec(text)?.[0]
  set('email', email)
  // keep the email out of the other readers
  const rest = email ? text.replace(email, ' ') : text

  set('phone', readPhone(rest))

  // "reports to Rohit" / "under Rohit" / "manager: Rohit Khanna"
  const mgrText = /\b(?:reports?\s+to|reporting\s+to|under|manager\s*[:\-–]|team\s+of)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i.exec(rest)?.[1]
  const first = (s: string) => s.split(/\s+/)[0].toLowerCase()
  const manager = mgrText ? managers.find((m) => m.name.toLowerCase() === mgrText.toLowerCase() || first(m.name) === first(mgrText)) : undefined
  const withoutMgr = (mgrText ? rest.replace(mgrText, ' ') : rest).replace(/\bmanager\s*[:\-–]/i, ' ')

  let role: Role | undefined
  for (const [re, r] of ROLE_WORDS) {
    if (re.test(withoutMgr)) {
      role = r
      break
    }
  }
  if (!role && manager) role = 'executive'
  set('role', role)
  if (manager && (role ?? 'executive') === 'executive') set('managerId', manager.id)

  set('name', readName(withoutMgr))

  const lower = rest.toLowerCase()
  const cities = CITY_NAMES.filter((c) => new RegExp(`\\b${escapeRe(c.toLowerCase())}\\b`).test(lower))
  if (/\bbangalore\b/i.test(rest) && !cities.includes('Bengaluru') && CITY_NAMES.includes('Bengaluru')) cities.push('Bengaluru')
  if (/\bmadras\b/i.test(rest) && !cities.includes('Chennai') && CITY_NAMES.includes('Chennai')) cities.push('Chennai')
  // a locality names its city ("Whitefield" → Bengaluru)
  for (const word of rest.split(/[^A-Za-z]+/)) {
    const city = word.length > 3 ? cityOfLocality(word) : undefined
    if (city && !cities.includes(city)) cities.push(city)
  }
  set('cities', cities)

  set('languages', LANGUAGES_SPOKEN.filter((l) => new RegExp(`\\b${l.toLowerCase()}\\b`).test(lower)))

  const missing: (keyof UserDraft)[] = []
  if (!fields.name) missing.push('name')
  if (!fields.email) missing.push('email')
  if (!fields.role) missing.push('role')
  if ((fields.role ?? 'executive') === 'executive' && !fields.managerId) missing.push('managerId')
  return { fields, filled, missing }
}

/** Applies an extraction over a draft: read values win, everything else stays as the user typed it. */
export function mergeExtraction(draft: UserDraft, x: UserExtraction): UserDraft {
  return { ...draft, ...x.fields }
}
