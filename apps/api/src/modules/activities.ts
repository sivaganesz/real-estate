import { Router } from 'express';
import { z } from 'zod';
import { ACTIVITY_LABEL, ACTIVITY_TYPES, STAGE_META, VISIT_INTEREST, relativeDay, formatTime, type ActivityType, type Stage } from '@estate/shared';
import { parse } from '../lib/http';
import { requirePermission } from '../lib/auth';
import { agenda, cancel, complete, myDay, overdueByPerson, reschedule, schedule, shapeActivity } from '../services/activities';
import { Activity, Lead } from '../models/lead';
import { User } from '../models/user';
import { registerTools } from '../ai/tools';
import { registerIntents } from '../ai/offline';
import { callTool } from '../ai/assistant';
import { getLeadFor, leadRef, leadScope } from '../services/leads';
import { parseWhen } from '../ai/rules';
import { insights } from '../services/pipeline';

export const activitiesRouter = Router();

const When = z.string().datetime({ offset: true }).transform((s) => new Date(s));

const Schedule = z.object({
  leadId: z.string(),
  type: z.enum(ACTIVITY_TYPES),
  scheduledAt: When,
  durationMin: z.number().int().min(5).max(480).optional(),
  title: z.string().max(140).optional(),
  notes: z.string().max(2000).optional(),
  propertyIds: z.array(z.string()).optional(),
  ownerId: z.string().optional(),
  force: z.boolean().optional(),
});

activitiesRouter.post('/', async (req, res) => {
  const { leadId, ...input } = parse(Schedule, req.body);
  res.status(201).json({ activity: await schedule(leadId, input, req.actor) });
});

const Complete = z.object({
  outcome: z.string().max(200).optional(),
  notes: z.string().max(4000).optional(),
  feedback: z.object({ interest: z.enum(VISIT_INTEREST).optional(), liked: z.string().max(500).optional(), concerns: z.string().max(500).optional() }).optional(),
  propertyFeedback: z.array(z.object({ propertyId: z.string(), status: z.enum(['liked', 'rejected', 'visited']) })).optional(),
  next: z.object({ type: z.enum(ACTIVITY_TYPES), scheduledAt: When, notes: z.string().optional() }).optional(),
  noShow: z.boolean().optional(),
});

activitiesRouter.post('/:id/complete', async (req, res) => {
  res.json(await complete(String(req.params.id), parse(Complete, req.body), req.actor));
});

activitiesRouter.post('/:id/reschedule', async (req, res) => {
  const b = parse(z.object({ scheduledAt: When, reason: z.string().max(300).optional(), force: z.boolean().optional() }), req.body);
  res.json({ activity: await reschedule(String(req.params.id), b, req.actor) });
});

activitiesRouter.post('/:id/cancel', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().min(2).max(300) }), req.body);
  res.json({ activity: await cancel(String(req.params.id), reason, req.actor) });
});

activitiesRouter.get('/agenda', async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = req.query.to ? new Date(String(req.query.to)) : new Date(from.getTime() + 7 * 86_400_000);
  res.json({ items: await agenda(req.actor, { from, to, ownerId: (req.query.owner as string) || undefined, includeDone: req.query.done === 'true' }) });
});

activitiesRouter.get('/today', async (req, res) => {
  res.json(await myDay(req.actor, { ownerId: (req.query.owner as string) || undefined }));
});

/** Polled by the app for reminders: what's due in the next N minutes. */
activitiesRouter.get('/upcoming', async (req, res) => {
  const minutes = Math.min(Number(req.query.minutes ?? 30), 240);
  const items = await Activity.find({ ownerId: req.actor.id, status: 'planned', scheduledAt: { $gte: new Date(Date.now() - 5 * 60_000), $lt: new Date(Date.now() + minutes * 60_000) } })
    .populate('leadId', 'name phone stage')
    .lean();
  res.json({ items: items.map(shapeActivity) });
});

activitiesRouter.get('/team', requirePermission('team.view'), async (req, res) => {
  const [overdue, pipeline] = await Promise.all([overdueByPerson(), insights(req.actor)]);
  res.json({ overdue, team: pipeline.team });
});

// AI ---------------------------------------------------------------------------

registerTools(
  {
    name: 'schedule_activity',
    kind: 'write',
    permission: 'lead.editOwn',
    description:
      'Plan a follow-up with a lead: a call, meeting, site visit, WhatsApp or task at a specific time (ISO 8601 with +05:30). Resolve relative times ("tomorrow 11am") yourself using today\'s date. If no time was given, ask. Site visits can include propertyIds. Fails with a clash message if the salesperson already has a visit or meeting then; tell the user and suggest another time.',
    schema: z.object({
      leadId: z.string(),
      type: z.enum(ACTIVITY_TYPES),
      when: z.string().describe('ISO 8601 date-time, e.g. 2026-11-24T11:00:00+05:30'),
      notes: z.string().optional(),
      propertyIds: z.array(z.string()).optional(),
    }),
    run: async (i, { actor }) => {
      const at = new Date(i.when);
      const a = await schedule(i.leadId, { type: i.type, scheduledAt: at, notes: i.notes, propertyIds: i.propertyIds }, actor);
      const lead = await getLeadFor(i.leadId, actor);
      return {
        data: { ok: true, activityId: String(a._id), when: at.toISOString() },
        records: [leadRef(lead)],
        done: `${ACTIVITY_LABEL[i.type as ActivityType]} with ${lead.name} planned for ${relativeDay(at)}, ${formatTime(at)}`,
      };
    },
  },
  {
    name: 'reschedule_activity',
    kind: 'write',
    permission: 'lead.editOwn',
    description: 'Move a planned activity to a new time (ISO 8601 with +05:30).',
    schema: z.object({ activityId: z.string(), when: z.string(), reason: z.string().optional() }),
    run: async ({ activityId, when, reason }, { actor }) => {
      const a = await reschedule(activityId, { scheduledAt: new Date(when), reason }, actor);
      return { data: { ok: true }, done: `Moved to ${relativeDay(a.scheduledAt!)}, ${formatTime(a.scheduledAt!)}` };
    },
  },
  {
    name: 'cancel_activity',
    kind: 'write',
    permission: 'lead.editOwn',
    description: 'Cancel a planned activity, with a reason.',
    schema: z.object({ activityId: z.string(), reason: z.string() }),
    run: async ({ activityId, reason }, { actor }) => {
      await cancel(activityId, reason, actor);
      return { data: { ok: true }, done: 'Cancelled' };
    },
  },
  {
    name: 'complete_activity',
    kind: 'write',
    permission: 'lead.editOwn',
    description: `Mark a planned activity done with what happened. For site visits include feedback.interest (${VISIT_INTEREST.join(', ')}), what they liked and their concerns. Optionally plan the next step at the same time.`,
    schema: z.object({
      activityId: z.string(),
      outcome: z.string().optional(),
      notes: z.string().optional(),
      interest: z.enum(VISIT_INTEREST).optional(),
      liked: z.string().optional(),
      concerns: z.string().optional(),
      noShow: z.boolean().optional(),
      nextType: z.enum(ACTIVITY_TYPES).optional(),
      nextWhen: z.string().optional(),
    }),
    run: async (i, { actor }) => {
      const r = await complete(
        i.activityId,
        {
          outcome: i.outcome,
          notes: i.notes,
          noShow: i.noShow,
          feedback: i.interest || i.liked || i.concerns ? { interest: i.interest, liked: i.liked, concerns: i.concerns } : undefined,
          next: i.nextType && i.nextWhen ? { type: i.nextType, scheduledAt: new Date(i.nextWhen) } : undefined,
        },
        actor,
      );
      return { data: { ok: true, needsNextStep: r.needsNextStep }, done: `Marked done${r.next ? ' and planned the next step' : ''}` };
    },
  },
  {
    name: 'agenda',
    kind: 'read',
    permission: 'lead.create',
    description: "Planned calls, meetings, visits and tasks between two dates (default: today and the next 6 days), with overdue ones. Managers can filter by salesperson name; executives see their own.",
    schema: z.object({ from: z.string().optional(), to: z.string().optional(), ownerName: z.string().optional() }),
    run: async ({ from, to, ownerName }, { actor }) => {
      let ownerId: string | undefined;
      if (ownerName) ownerId = String((await User.findOne({ name: new RegExp(ownerName, 'i') }).lean())?._id ?? '');
      const start = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
      const end = to ? new Date(to) : new Date(start.getTime() + 7 * 86_400_000);
      const [items, day] = await Promise.all([agenda(actor, { from: start, to: end, ownerId }), myDay(actor, { ownerId })]);
      return {
        data: {
          overdue: day.overdue.map((a) => ({ id: a.id, what: a.title, with: a.lead?.name, leadId: a.lead?.id, was: a.scheduledAt, owner: a.owner?.name })),
          planned: items.map((a) => ({ id: a.id, what: a.title, type: a.type, with: a.lead?.name, leadId: a.lead?.id, at: a.scheduledAt, owner: a.owner?.name, properties: a.properties.map((p) => p.title) })),
          newLeadsToCall: day.newLeads.map((l) => l.name),
          openLeadsWithoutNextStep: day.noNextStep.map((l) => ({ name: l.name, stage: STAGE_META[l.stage as Stage].label, id: l.id })),
        },
        records: [...day.overdue, ...items].slice(0, 10).flatMap((a) => (a.lead ? [{ kind: 'lead' as const, id: a.lead.id, title: a.lead.name, subtitle: `${a.title} · ${relativeDay(a.scheduledAt)}` }] : [])),
      };
    },
  },
  {
    name: 'overdue_follow_ups_by_person',
    kind: 'read',
    permission: 'team.view',
    description: 'For managers: each salesperson with overdue follow-ups, how many, and how old the oldest is; plus each person\'s open, stuck and no-next-step lead counts.',
    schema: z.object({}),
    run: async (_i, { actor }) => {
      const [overdue, pipeline] = await Promise.all([overdueByPerson(), insights(actor)]);
      return { data: { overdue, team: pipeline.team } };
    },
  },
);

// Offline intents ---------------------------------------------------------------

registerIntents(
  {
    name: 'no-follow-ups',
    example: 'Show leads without follow-ups',
    match: (t) => /\b(without|no|missing)\b.*\b(follow[\s-]?ups?|next steps?|plan)\b/.test(t),
    run: async (_a, ctx, out) => {
      const r = await callTool('search_leads', { noFollowUpPlanned: true, openOnly: true }, ctx, out);
      const d = JSON.parse(r.content) as { total: number; items: { name: string; stage: string; requirement: string; owner: string; lastContact: string }[] };
      if (!d.total) return 'Every open lead has a next step planned.';
      return `${d.total} open lead${d.total === 1 ? ' has' : 's have'} nothing planned:\n${d.items.slice(0, 10).map((l) => `• **${l.name}** — ${l.stage}; last contact ${l.lastContact}${ctx.actor.role !== 'executive' ? `; ${l.owner}` : ''}`).join('\n')}`;
    },
  },
  {
    name: 'overdue-by-person',
    example: 'Which sales executives have overdue follow-ups?',
    match: (t) => /\boverdue\b/.test(t) && /\b(who|which|executives?|team|people|salespeople)\b/.test(t),
    run: async (_a, ctx, out) => {
      const r = await callTool('overdue_follow_ups_by_person', {}, ctx, out);
      if (r.is_error) return r.content;
      const d = JSON.parse(r.content) as { overdue: { name: string; count: number; oldestDays: number }[] };
      if (!d.overdue.length) return 'Nobody has overdue follow-ups.';
      return d.overdue.map((o) => `• **${o.name}**: ${o.count} overdue, oldest ${o.oldestDays} day${o.oldestDays === 1 ? '' : 's'}`).join('\n');
    },
  },
  {
    name: 'my-day',
    example: "What's on my plate today?",
    match: (t) => /\b(today|my day|agenda|schedule|plate|plan my day|what should i do|attention)\b/.test(t) && !/\bschedule (a|an)\b/.test(t),
    run: async (_a, ctx, out) => {
      const r = await callTool('agenda', {}, ctx, out);
      const d = JSON.parse(r.content) as { overdue: { what: string; with: string }[]; planned: { what: string; with: string; at: string }[]; newLeadsToCall: string[]; openLeadsWithoutNextStep: { name: string; stage: string }[] };
      const end = new Date(new Date().setHours(23, 59, 59));
      const today = d.planned.filter((p) => new Date(p.at) <= end);
      const lines = [
        d.overdue.length ? `**Overdue (${d.overdue.length})** — do these first:\n${d.overdue.slice(0, 5).map((o) => `• ${o.what} with ${o.with}`).join('\n')}` : 'Nothing overdue.',
        today.length ? `**Today**:\n${today.map((p) => `• ${formatTime(p.at)} ${p.what} with ${p.with}`).join('\n')}` : 'Nothing else booked today.',
        d.newLeadsToCall.length ? `**New leads to call**: ${d.newLeadsToCall.join(', ')}` : '',
        d.openLeadsWithoutNextStep.length ? `**No next step planned**: ${d.openLeadsWithoutNextStep.slice(0, 6).map((l) => l.name).join(', ')}` : '',
      ];
      return lines.filter(Boolean).join('\n\n');
    },
  },
  {
    name: 'schedule',
    example: 'Schedule a call with Ramesh tomorrow at 11am',
    match: (t) => /\b(schedule|plan|book|set up|fix|remind me to)\b.*\b(call|meeting|visit|site visit|follow[\s-]?up|whatsapp)\b/.test(t) && t,
    run: async (text, ctx, out) => {
      const t = text as string;
      const when = parseWhen(t);
      if (!when) return 'When should it be? For example "tomorrow at 11am" or "Saturday 4 pm".';
      const type: ActivityType = /site visit|visit/.test(t) ? 'site_visit' : /meeting/.test(t) ? 'meeting' : /whatsapp/.test(t) ? 'whatsapp' : 'call';
      let leadId = ctx.context?.entity === 'lead' ? ctx.context.entityId : undefined;
      if (!leadId) {
        const name = t.match(/\bwith ([a-z][a-z.\s]+?)(?:\s+(?:on|at|tomorrow|today|next|this|in)\b|$)/)?.[1]?.trim();
        if (name) {
          const found = await Lead.find({ ...leadScope(ctx.actor), name: new RegExp(name, 'i') }).limit(2).lean();
          if (found.length === 1) leadId = String(found[0]._id);
          else if (found.length > 1) return `More than one customer matches "${name}". Open their page and ask again there.`;
        }
      }
      if (!leadId) return 'Who is it with? Say the customer\'s name, or ask from their page.';
      const r = await callTool('schedule_activity', { leadId, type, when: when.toISOString() }, ctx, out);
      return r.is_error ? r.content : `Done — ${out.done.at(-1)}.`;
    },
  },
);
