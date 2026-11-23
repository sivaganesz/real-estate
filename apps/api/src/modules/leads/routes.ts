import { Router } from 'express';
import { z } from 'zod';
import { ACTIVITY_TYPES, LEAD_SOURCES, Requirement, STAGES, TEMPERATURES } from '@estate/shared';
import { parse } from '../../lib/http';
import { requirePermission } from '../../lib/auth';
import { Lead } from '../../models/lead';
import { User } from '../../models/user';
import {
  addEnquiry,
  assignLead,
  assignUnassignedEvenly,
  createLead,
  findByPhone,
  getLeadFor,
  listLeads,
  logActivity,
  serialiseLead,
  timeline,
  updateLead,
} from '../../services/leads';
import { parseRequirement } from '../../ai/requirement';

export const leadsRouter = Router();

const csv = (v: unknown) => (typeof v === 'string' && v ? v.split(',') : undefined);

leadsRouter.get('/', async (req, res) => {
  const q = req.query as Record<string, string>;
  const f = parse(
    z.object({
      q: z.string().optional(),
      stages: z.array(z.enum(STAGES)).optional(),
      ownerId: z.string().optional(),
      sources: z.array(z.enum(LEAD_SOURCES)).optional(),
      temperature: z.array(z.enum(TEMPERATURES)).optional(),
      open: z.boolean().optional(),
      noFollowUp: z.boolean().optional(),
      overdue: z.boolean().optional(),
      stale: z.boolean().optional(),
      limit: z.number().optional(),
    }),
    {
      ...q,
      stages: csv(q.stages),
      sources: csv(q.sources),
      temperature: csv(q.temperature),
      open: q.open === 'true' || undefined,
      noFollowUp: q.noFollowUp === 'true' || undefined,
      overdue: q.overdue === 'true' || undefined,
      stale: q.stale === 'true' || undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    },
  );
  res.json(await listLeads(f, req.actor));
});

/** "Is this number already a customer?" asked while typing a new lead. */
leadsRouter.get('/lookup', async (req, res) => {
  const l = await findByPhone(String(req.query.phone ?? ''));
  if (!l) {
    res.json({ existing: null });
    return;
  }
  const owner = l.ownerId ? await User.findById(l.ownerId).select('name').lean() : null;
  res.json({ existing: { id: String(l._id), name: l.name, stage: l.stage, owner: owner?.name ?? null, mine: String(l.ownerId) === req.actor.id } });
});

leadsRouter.post('/parse-requirement', async (req, res) => {
  const { text } = parse(z.object({ text: z.string().min(3).max(2000) }), req.body);
  res.json(await parseRequirement(text));
});

leadsRouter.post('/', async (req, res) => {
  const lead = await createLead(req.body, req.actor, { autoAssign: req.query.autoAssign === 'true' });
  res.status(201).json({ lead: serialiseLead(lead as never) });
});

leadsRouter.post('/assign-evenly', requirePermission('lead.assign'), async (req, res) => {
  res.json({ assigned: await assignUnassignedEvenly(req.actor) });
});

leadsRouter.get('/:id', async (req, res) => {
  const lead = await getLeadFor(String(req.params.id), req.actor);
  const owner = lead.ownerId ? await User.findById(lead.ownerId).select('name').lean() : null;
  res.json({ lead: serialiseLead(lead.toObject() as never, owner?.name) });
});

leadsRouter.get('/:id/timeline', async (req, res) => {
  const lead = await getLeadFor(String(req.params.id), req.actor);
  res.json({ items: await timeline(String(lead._id)) });
});

leadsRouter.patch('/:id', async (req, res) => {
  const body = parse(
    z.object({ name: z.string().trim().min(2).optional(), email: z.string().email().nullish().or(z.literal('')), temperature: z.enum(TEMPERATURES).optional(), requirement: Requirement.partial().optional() }),
    req.body,
  );
  const lead = await updateLead(String(req.params.id), body, req.actor);
  res.json({ lead: serialiseLead(lead as never) });
});

leadsRouter.post('/:id/assign', async (req, res) => {
  const { ownerId } = parse(z.object({ ownerId: z.string() }), req.body);
  const lead = await assignLead(String(req.params.id), ownerId, req.actor);
  res.json({ lead: serialiseLead(lead as never) });
});

leadsRouter.post('/:id/enquiries', async (req, res) => {
  const body = parse(z.object({ source: z.enum(LEAD_SOURCES).optional(), message: z.string().max(2000).optional(), propertyId: z.string().optional() }), req.body);
  // Anyone may add an enquiry to an existing customer; the record stays with its owner.
  const lead = await addEnquiry(String(req.params.id), body, req.actor);
  res.json({ lead: serialiseLead(lead as never) });
});

leadsRouter.post('/:id/log', async (req, res) => {
  const body = parse(z.object({ type: z.enum(ACTIVITY_TYPES), outcome: z.string().max(200).optional(), notes: z.string().max(4000).optional(), propertyIds: z.array(z.string()).optional() }), req.body);
  const a = await logActivity(String(req.params.id), body, req.actor);
  const lead = await Lead.findById(String(req.params.id)).lean();
  res.status(201).json({ activity: a, lead: lead && serialiseLead(lead as never) });
});
