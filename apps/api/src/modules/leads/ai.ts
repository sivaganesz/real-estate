import { z } from 'zod';
import {
  CALL_OUTCOMES,
  FINANCING_LABEL,
  INTENT_LABEL,
  LEAD_SOURCES,
  LEAD_SOURCE_LABEL,
  Requirement,
  STAGES,
  STAGE_META,
  TEMPERATURES,
  TIMELINE_LABEL,
  leadScore,
  relativeDay,
  requirementGaps,
  requirementSummary,
  type Stage,
} from '@estate/shared';
import { registerTools } from '../../ai/tools';
import { registerIntents } from '../../ai/offline';
import { callTool } from '../../ai/assistant';
import { User } from '../../models/user';
import { addEnquiry, assignLead, createLead, getLeadFor, leadRef, listLeads, logActivity, timeline, updateLead } from '../../services/leads';
import { HttpError } from '../../lib/http';

export function compactLead(l: ReturnType<typeof import('../../services/leads').serialiseLead>) {
  return {
    id: l.id,
    name: l.name,
    phone: l.phone,
    stage: STAGE_META[l.stage as Stage].label,
    daysInStage: l.daysInStage,
    temperature: l.temperature,
    owner: l.ownerName ?? 'Unassigned',
    source: LEAD_SOURCE_LABEL[l.source as keyof typeof LEAD_SOURCE_LABEL],
    requirement: l.summary,
    lastContact: l.lastContactAt ? relativeDay(l.lastContactAt) : 'never',
    nextAction: l.nextAction?.dueAt ? `${l.nextAction.title ?? l.nextAction.type} ${relativeDay(l.nextAction.dueAt)}${l.overdue ? ' (overdue)' : ''}` : 'none planned',
    stale: l.stale,
  };
}

const LeadSearch = z.object({
  text: z.string().optional().describe('Name, phone digits, or locality'),
  stages: z.array(z.enum(STAGES)).optional(),
  ownerName: z.string().optional().describe('Managers only: a salesperson name'),
  unassigned: z.boolean().optional(),
  temperature: z.array(z.enum(TEMPERATURES)).optional(),
  openOnly: z.boolean().optional(),
  noFollowUpPlanned: z.boolean().optional().describe('Open leads with nothing scheduled'),
  overdueFollowUp: z.boolean().optional(),
  stuck: z.boolean().optional().describe('Sitting in their stage longer than normal'),
  createdWithinDays: z.number().int().optional(),
});

registerTools(
  {
    name: 'search_leads',
    kind: 'read',
    permission: 'lead.create',
    description:
      "Find leads/customers. Executives only see their own. Filters: stage, owner, temperature, open only, no follow-up planned, overdue follow-up, stuck in stage, created recently. Returns up to 15 with requirement summary, last contact and next action.",
    schema: LeadSearch,
    run: async (i, { actor }) => {
      let ownerId: string | undefined;
      if (i.unassigned) ownerId = 'none';
      else if (i.ownerName) {
        const u = await User.findOne({ name: new RegExp(i.ownerName, 'i') }).lean();
        if (!u) return { data: { error: `No team member called ${i.ownerName}` } };
        ownerId = String(u._id);
      }
      const r = await listLeads({ q: i.text, stages: i.stages, ownerId, temperature: i.temperature, open: i.openOnly, noFollowUp: i.noFollowUpPlanned, overdue: i.overdueFollowUp, stale: i.stuck, createdWithinDays: i.createdWithinDays, limit: 15 }, actor);
      return { data: { total: r.total, items: r.items.map(compactLead) }, records: r.items.map((l) => leadRef({ ...l, _id: l.id } as never)) };
    },
  },
  {
    name: 'get_lead',
    kind: 'read',
    permission: 'lead.create',
    description: 'Everything about one lead: contact, owner, stage, requirement (with gaps), shortlisted properties and the recent timeline of calls, visits and notes. Use it before summarising a customer or drafting a message.',
    schema: z.object({ leadId: z.string() }),
    run: async ({ leadId }, { actor }) => {
      const lead = await getLeadFor(leadId, actor);
      const owner = lead.ownerId ? await User.findById(lead.ownerId).select('name').lean() : null;
      const r = lead.requirement as Partial<Requirement>;
      const items = await timeline(leadId);
      return {
        data: {
          id: leadId,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          owner: owner?.name ?? 'Unassigned',
          stage: STAGE_META[lead.stage as Stage].label,
          temperature: lead.temperature,
          score: leadScore({ requirement: r, stage: lead.stage as Stage, temperature: lead.temperature as never }),
          lostReason: lead.lostReason,
          source: LEAD_SOURCE_LABEL[lead.source as keyof typeof LEAD_SOURCE_LABEL],
          firstEnquiry: lead.createdAt,
          enquiries: lead.enquiries.length,
          requirement: {
            summary: requirementSummary(r),
            ...r,
            timeline: r.timeline ? TIMELINE_LABEL[r.timeline] : undefined,
            financing: r.financing ? FINANCING_LABEL[r.financing] : undefined,
            buyingFor: r.intent ? INTENT_LABEL[r.intent] : undefined,
            stillUnknown: requirementGaps(r),
          },
          nextAction: lead.nextAction,
          shortlistCount: lead.shortlist.length,
          timeline: items.slice(0, 20).map((t) => ({ when: t.at, what: t.title, notes: t.body, by: t.by, status: t.status, properties: t.properties?.map((p) => p.title) })),
        },
        records: [leadRef(lead)],
      };
    },
  },
  {
    name: 'create_lead',
    kind: 'write',
    permission: 'lead.create',
    description: 'Add a new lead. If the phone already belongs to a customer, nothing is created and the existing customer is returned; then offer to add an enquiry to them instead.',
    schema: z.object({
      name: z.string(),
      phone: z.string(),
      source: z.enum(LEAD_SOURCES).default('phone'),
      requirement: Requirement.partial().optional(),
      note: z.string().optional(),
    }),
    run: async (i, { actor }) => {
      try {
        const l = await createLead(i, actor, { autoAssign: false });
        return { data: { id: String(l._id), created: true, stage: l.stage }, records: [leadRef(l)], done: `Added lead ${l.name}` };
      } catch (e) {
        if (e instanceof HttpError && e.status === 409) {
          const ex = (e.details as { existing: { id: string; name: string } }).existing;
          return { data: { created: false, existing: e.details }, records: [{ kind: 'lead', id: ex.id, title: ex.name }] };
        }
        throw e;
      }
    },
  },
  {
    name: 'add_enquiry_to_existing_lead',
    kind: 'write',
    permission: 'lead.create',
    description: 'Record a new enquiry on an existing customer (returning customer). Reopens them if they were lost.',
    schema: z.object({ leadId: z.string(), message: z.string().optional(), source: z.enum(LEAD_SOURCES).optional() }),
    run: async (i, { actor }) => {
      const l = await addEnquiry(i.leadId, i, actor);
      return { data: { ok: true, stage: l.stage }, records: [leadRef(l)], done: `Added an enquiry to ${l.name}` };
    },
  },
  {
    name: 'update_lead_requirement',
    kind: 'write',
    permission: 'lead.editOwn',
    description: "Update what a customer is looking for (only the fields given change). Money in rupees.",
    schema: z.object({ leadId: z.string(), requirement: Requirement.partial() }),
    run: async ({ leadId, requirement }, { actor }) => {
      const l = await updateLead(leadId, { requirement }, actor);
      return { data: { ok: true, requirement: requirementSummary(l.requirement as never), stage: l.stage }, records: [leadRef(l)], done: `Updated ${l.name}'s requirement` };
    },
  },
  {
    name: 'set_lead_temperature',
    kind: 'write',
    permission: 'lead.editOwn',
    description: 'Mark a lead hot, warm or cold.',
    schema: z.object({ leadId: z.string(), temperature: z.enum(TEMPERATURES) }),
    run: async ({ leadId, temperature }, { actor }) => {
      const l = await updateLead(leadId, { temperature }, actor);
      return { data: { ok: true }, records: [leadRef(l)], done: `Marked ${l.name} ${temperature}` };
    },
  },
  {
    name: 'add_lead_note',
    kind: 'write',
    permission: 'lead.editOwn',
    description: "Add a note to a lead's timeline.",
    schema: z.object({ leadId: z.string(), note: z.string().min(2) }),
    run: async ({ leadId, note }, { actor }) => {
      await logActivity(leadId, { type: 'note', notes: note }, actor);
      const l = await getLeadFor(leadId, actor);
      return { data: { ok: true }, records: [leadRef(l)], done: `Added a note to ${l.name}` };
    },
  },
  {
    name: 'log_interaction',
    kind: 'write',
    permission: 'lead.editOwn',
    description: `Record a call, WhatsApp, email or meeting that already happened. Call outcomes: ${CALL_OUTCOMES.join(', ')}.`,
    schema: z.object({ leadId: z.string(), type: z.enum(['call', 'whatsapp', 'email', 'meeting']), outcome: z.string().optional(), notes: z.string().optional() }),
    run: async (i, { actor }) => {
      await logActivity(i.leadId, i, actor);
      const l = await getLeadFor(i.leadId, actor);
      return { data: { ok: true, stage: l.stage }, records: [leadRef(l)], done: `Logged a ${i.type} with ${l.name}` };
    },
  },
  {
    name: 'assign_lead',
    kind: 'confirm',
    permission: 'lead.assign',
    description: 'Give a lead to a salesperson (changes who owns the customer and their follow-ups).',
    schema: z.object({ leadId: z.string(), ownerName: z.string() }),
    preview: async ({ leadId, ownerName }, { actor }) => {
      const lead = await getLeadFor(leadId, actor);
      const u = await User.findOne({ name: new RegExp(ownerName, 'i'), active: true }).lean();
      if (!u) throw new HttpError(400, `No active team member called ${ownerName}`);
      return { summary: `Assign ${lead.name} to ${u.name}`, records: [leadRef(lead)] };
    },
    execute: async ({ leadId, ownerName }, { actor }) => {
      const u = await User.findOne({ name: new RegExp(ownerName, 'i'), active: true }).lean();
      if (!u) throw new HttpError(400, `No active team member called ${ownerName}`);
      const l = await assignLead(leadId, String(u._id), actor);
      return { data: { ok: true }, done: `${l.name} is now with ${u.name}`, records: [leadRef(l)] };
    },
  },
);

// Offline intents ---------------------------------------------------------------

const onLead = (ctx: { context?: { entity?: string; entityId?: string } }) => (ctx.context?.entity === 'lead' ? ctx.context.entityId : undefined);

registerIntents(
  {
    name: 'lead-summary',
    priority: 10,
    example: 'Summarise this customer (on a lead page)',
    match: (t, ctx) => /\b(summar|brief|who is|tell me about|recap)/.test(t) && onLead(ctx),
    run: async (id, ctx, out) => {
      const r = await callTool('get_lead', { leadId: id }, ctx, out);
      if (r.is_error) return r.content;
      const d = JSON.parse(r.content);
      const recent = d.timeline.filter((x: { status?: string }) => x.status !== 'planned').slice(0, 3);
      const lines = [
        `**${d.name}** — ${d.stage}, ${d.temperature}, with ${d.owner}. Came via ${d.source}${d.enquiries > 1 ? ` (${d.enquiries} enquiries)` : ''}.`,
        `Wants: ${d.requirement.summary}${d.requirement.timeline ? `; ${d.requirement.timeline.toLowerCase()}` : ''}${d.requirement.financing ? `; ${d.requirement.financing.toLowerCase()}` : ''}.`,
        d.requirement.stillUnknown.length ? `Still unknown: ${d.requirement.stillUnknown.join(', ')}.` : '',
        recent.length ? `Recently:\n${recent.map((x: { when: string; what: string; notes?: string }) => `• ${relativeDay(x.when)}: ${x.what}${x.notes ? ` — ${x.notes}` : ''}`).join('\n')}` : 'No conversations logged yet.',
      ];
      return lines.filter(Boolean).join('\n');
    },
  },
  {
    name: 'lead-note',
    priority: 10,
    example: 'Note: wants east facing only (on a lead page)',
    match: (t, ctx) => onLead(ctx) && /^(add (a )?)?note[:\s]/.test(t),
    run: async () => 'Type the note in the box on the lead page, or set an AI key so I can add it for you.',
  },
  {
    name: 'lead-lists',
    example: 'Show unassigned leads / hot leads / my new leads',
    match: (t) => /\b(leads?|customers?|buyers?)\b/.test(t) && /\b(unassigned|hot|cold|warm|new|my|stuck|stale|all)\b/.test(t) && !/follow/.test(t) && t,
    run: async (text, ctx, out) => {
      const t = text as string;
      const args: Record<string, unknown> = { openOnly: true };
      if (/unassigned/.test(t)) args.unassigned = true;
      if (/hot|cold|warm/.test(t)) args.temperature = [t.match(/hot|cold|warm/)![0]];
      if (/\bnew\b/.test(t)) args.stages = ['new'];
      if (/stuck|stale/.test(t)) args.stuck = true;
      const r = await callTool('search_leads', args, ctx, out);
      if (r.is_error) return r.content;
      const d = JSON.parse(r.content) as { total: number; items: ReturnType<typeof compactLead>[] };
      if (!d.total) return 'None right now.';
      return `${d.total} lead${d.total === 1 ? '' : 's'}:\n${d.items.slice(0, 8).map((l) => `• **${l.name}** — ${l.stage}, ${l.requirement}; last contact ${l.lastContact}; owner ${l.owner}`).join('\n')}`;
    },
  },
);
