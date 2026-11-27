/**
 * The AI service contract (foundation-plan §2.3, master prompt §12.1). Two providers implement it: the simulated one
 * (rule-based, runs in the browser, the default) and the live one (a backend proxy; falls back per method).
 * Every result carries `mode`, and the UI renders <DemoAIBadge mode={…}/> from it; the UI never assumes the mode.
 * Nothing here writes data: proposals run only through services/commands.executeProposal after the user confirms.
 */
import type {
  AppointmentInput, ColumnMapping, DB, EntityKind, EntityRef, FieldMetaMap, ID, ImportKind, LeadInput, MessagePurpose,
  PropertyInput, Qualification, Role, User,
} from '@/domain/types'
import type { Action } from '@/lib/permissions'
import type { Match } from '@/lib/matching'
import type { LeadScore } from '@/lib/scoring'

export type { LeadScore, Match }

export type AIMode = 'simulated' | 'live'

/** What the assistant knows about where it is used: who, which page, which record, and a getter for the data. */
export interface AIContext {
  actor: User
  role: Role
  route: string
  selection?: EntityRef
  now: Date
  db: () => DB
}

/** A short question for a missing field: an i18n prompt key and optional quick-pick chips (labels are i18n keys). */
export interface AIQuestion {
  field: string
  prompt: string
  chips?: { label: string; value: unknown }[]
  essential: boolean
}

/** A paste-and-fill result: the fields read from the text, which ones the AI filled, and what is still missing. */
export interface Extraction<T> {
  mode: AIMode
  fields: Partial<T>
  /** Field path → { origin: 'ai', confidence }; the form marks these fields. */
  meta: FieldMetaMap
  /** Essential fields that could not be read (field paths). */
  missing: string[]
  questions: AIQuestion[]
  filledCount: number
  /** i18n keys (namespace `ai`) for remarks such as "budget read as the maximum". */
  notes?: string[]
  /** Leads only: existing leads with the same phone or e-mail. */
  duplicates?: { leadId: ID; by: 'phone' | 'email' }[]
}

export interface AIText {
  mode: AIMode
  text: string
  bullets?: string[]
  links?: EntityRef[]
  /** Pages to open (a label i18n key and a path from app/paths), e.g. "Open Import". */
  nav?: { label: string; to: string }[]
}

/** A small metric the assistant shows as a graphic (a bar or ring with a value). */
export interface AIStat {
  /** Display text (already translated) or a name. */
  label: string
  value: number
  /** Shown instead of the number (₹ amounts, "3 of 40"). */
  display?: string
  /** 0–100 for the bar. */
  pct?: number
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'ai' | 'info' | 'neutral'
}

/** A message the assistant drafted for a client (sent only by the user's click). */
export interface AIDraft {
  leadId: ID
  channel: 'whatsapp' | 'sms' | 'email'
  purpose: MessagePurpose
  tone: 'english' | 'hinglish'
  text: string
}

export type QualCheckKey = 'budget' | 'authority' | 'need' | 'timeline'
export interface QualificationResult {
  mode: AIMode
  known: QualCheckKey[]
  missing: QualCheckKey[]
  /** Values read from notes and messages that the lead does not have yet (the user applies them). */
  inferred: Partial<Qualification>
  questions: AIQuestion[]
}

export type ProposalKind =
  | 'createLead' | 'updateLead' | 'assignLead' | 'assignLeads' | 'requestReassign' | 'moveStage' | 'createAppointment'
  | 'rescheduleAppointment' | 'createTask' | 'rescheduleTask' | 'completeTask' | 'shortlistProperty' | 'shareProperties'
  | 'logActivity' | 'createProperty' | 'updateProperty'

/** A change the assistant wants to make. `summary` labels are i18n keys; values are display text. */
export interface ActionProposal {
  id: ID
  kind: ProposalKind
  permission: Action
  summary: { label: string; value: string }[]
  payload: unknown
  targets?: EntityRef[]
}

export interface CommandPlan {
  mode: AIMode
  /** The recognised intent key (`ai:intent.<key>`). */
  intent: string
  reply: AIText
  /** Nothing runs until the user confirms (services/commands.executeProposal). */
  proposals: ActionProposal[]
  refusal?: { action: Action; reasonKey: string; params?: Record<string, string> }
  /** For query intents ("my highest-priority leads"): the records to list. */
  results?: { kind: EntityKind; ids: ID[] }
  /** The request as the reader understood it, when it rewrote it (Hinglish → English). */
  readAs?: string
  /** Small graphics for numeric answers (targets, workload, sources). */
  stats?: AIStat[]
  /** Bars for comparable numbers (people, sources); tiles for a mix of different measures (count, ₹, %). */
  statsStyle?: 'bars' | 'tiles'
  /** A drafted client message (Copy / Open in WhatsApp). */
  draft?: AIDraft
  /** Next questions worth asking, as chips: a translated label and the English command it sends. */
  followUps?: { label: string; command: string }[]
}

export type SummaryTarget = { kind: 'lead' | 'appointment' | 'day' | 'team' | 'business' | 'pipeline' | 'visitPrep' | 'visitSummary'; id?: ID }
export type MessageRequest = {
  leadId: ID
  purpose: MessagePurpose
  channel: 'whatsapp' | 'sms' | 'email'
  tone: 'english' | 'hinglish'
  propertyIds?: ID[]
  appointmentId?: ID
}
export type NextActionSuggestion = { key: string; params?: Record<string, string | number>; action?: ActionProposal }

export interface AIService {
  readonly mode: AIMode
  extractLead(text: string, ctx: AIContext): Promise<Extraction<LeadInput>>
  extractProperty(text: string, ctx: AIContext): Promise<Extraction<PropertyInput>>
  extractAppointment(text: string, ctx: AIContext): Promise<Extraction<AppointmentInput>>
  qualifyLead(leadId: ID, ctx: AIContext): Promise<QualificationResult>
  scoreLead(leadId: ID, ctx: AIContext): Promise<LeadScore>
  matchProperties(leadId: ID, ctx: AIContext): Promise<{ matches: Match[]; text: AIText }>
  summarize(target: SummaryTarget, ctx: AIContext): Promise<AIText>
  generateMessage(req: MessageRequest, ctx: AIContext): Promise<AIText>
  suggestNextAction(leadId: ID, ctx: AIContext): Promise<NextActionSuggestion>
  insights(scope: 'personal' | 'team' | 'business', ctx: AIContext): Promise<AIText>
  mapColumns(headers: string[], sample: string[][], kind: ImportKind, ctx: AIContext): Promise<ColumnMapping[]>
  parseCommand(text: string, ctx: AIContext): Promise<CommandPlan>
  /** Lead / Property Editing assistants: what a message says changed on one record, as proposals to confirm. */
  readUpdate(target: { kind: 'lead' | 'property'; id: ID }, text: string, ctx: AIContext): Promise<CommandPlan>
}

/** The method names, for the live provider's per-method fallback. */
export type AITask = Exclude<keyof AIService, 'mode'>
