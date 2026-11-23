import mongoose, { type FilterQuery } from 'mongoose';
import {
  ACTIVITY_LABEL,
  LEAD_SOURCE_LABEL,
  LeadInput,
  OPEN_STAGES,
  Requirement,
  STAGE_META,
  can,
  isQualified,
  normalisePhone,
  requirementSummary,
  type ActivityType,
  type Stage,
} from '@estate/shared';
import { Activity, Lead, type LeadDoc } from '../models/lead';
import { User } from '../models/user';
import { Audit } from '../models/audit';
import { nextCode } from '../models/property';
import { audit, assertCan, type Actor } from '../lib/auth';
import { HttpError, badRequest, notFound } from '../lib/http';
import type { RecordRef } from '../ai/tools';

export const CONTACT_TYPES: ActivityType[] = ['call', 'meeting', 'site_visit', 'whatsapp', 'email'];

export function leadScope(actor: Actor): FilterQuery<LeadDoc> {
  return can(actor.role, 'lead.viewAll') ? {} : { ownerId: new mongoose.Types.ObjectId(actor.id) };
}

export function leadRef(l: { _id: unknown; name: string; stage?: string | null; requirement?: unknown }): RecordRef {
  return { kind: 'lead', id: String(l._id), title: l.name, subtitle: [l.stage ? STAGE_META[l.stage as Stage].label : null, requirementSummary(l.requirement as never)].filter(Boolean).join(' · ') };
}

/** Executives only ever see their own customers; others look like they don't exist. */
export async function getLeadFor(id: string, actor: Actor) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Lead');
  const lead = await Lead.findOne({ _id: id, ...leadScope(actor) });
  if (!lead) throw notFound('Lead');
  return lead;
}

export type LeadFilters = {
  q?: string;
  stages?: Stage[];
  ownerId?: string | 'none';
  sources?: string[];
  temperature?: string[];
  open?: boolean;
  noFollowUp?: boolean;
  overdue?: boolean;
  stale?: boolean;
  createdWithinDays?: number;
  limit?: number;
};

export function buildLeadQuery(f: LeadFilters, actor: Actor): FilterQuery<LeadDoc> {
  const q: FilterQuery<LeadDoc> = { ...leadScope(actor) };
  if (f.stages?.length) q.stage = { $in: f.stages };
  else if (f.open) q.stage = { $in: OPEN_STAGES };
  if (f.ownerId === 'none') q.ownerId = null;
  else if (f.ownerId && can(actor.role, 'lead.viewAll')) q.ownerId = new mongoose.Types.ObjectId(f.ownerId);
  if (f.sources?.length) q.source = { $in: f.sources };
  if (f.temperature?.length) q.temperature = { $in: f.temperature };
  if (f.noFollowUp) {
    q['nextAction.dueAt'] = { $exists: false };
    q.stage = { $in: OPEN_STAGES };
  }
  if (f.overdue) q['nextAction.dueAt'] = { $lt: new Date() };
  if (f.createdWithinDays) q.createdAt = { $gte: new Date(Date.now() - f.createdWithinDays * 86_400_000) };
  if (f.q?.trim()) {
    const t = f.q.trim();
    const rx = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const digits = t.replace(/\D/g, '');
    q.$or = [{ name: rx }, { code: rx }, { email: rx }, { 'requirement.localities': rx }, ...(digits.length >= 4 ? [{ phone: new RegExp(digits) }] : [])];
  }
  if (f.stale) {
    // A lead is stale when it has sat in its stage longer than that stage's limit.
    q.$and = [
      {
        $or: OPEN_STAGES.map((s) => ({ stage: s, stageChangedAt: { $lt: new Date(Date.now() - STAGE_META[s].staleAfterDays * 86_400_000) } })),
      },
    ];
  }
  return q;
}

export async function listLeads(f: LeadFilters, actor: Actor) {
  const q = buildLeadQuery(f, actor);
  const [items, total] = await Promise.all([Lead.find(q).sort({ 'nextAction.dueAt': 1, updatedAt: -1 }).limit(Math.min(f.limit ?? 100, 300)).lean(), Lead.countDocuments(q)]);
  return { items: await withOwners(items), total };
}

export async function withOwners<T extends { ownerId?: unknown }>(items: T[]) {
  const ids = [...new Set(items.map((i) => i.ownerId && String(i.ownerId)).filter(Boolean))];
  const users = await User.find({ _id: { $in: ids } }).select('name').lean();
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  return items.map((i) => serialiseLead(i as never, i.ownerId ? names.get(String(i.ownerId)) : undefined));
}

export function serialiseLead(l: LeadDoc, ownerName?: string) {
  const { _id, __v, ...rest } = l as LeadDoc & { __v?: number };
  void __v;
  const stage = l.stage as Stage;
  const daysInStage = Math.floor((Date.now() - new Date(l.stageChangedAt ?? l.createdAt).getTime()) / 86_400_000);
  return {
    id: String(_id),
    ...rest,
    ownerId: l.ownerId ? String(l.ownerId) : null,
    ownerName: ownerName ?? null,
    summary: requirementSummary(l.requirement as never),
    qualified: isQualified(l.requirement as never),
    daysInStage,
    stale: OPEN_STAGES.includes(stage) && daysInStage >= STAGE_META[stage].staleAfterDays,
    overdue: !!l.nextAction?.dueAt && new Date(l.nextAction.dueAt) < new Date(),
  };
}

export async function findByPhone(phone: string) {
  const p = normalisePhone(phone);
  if (!p) return null;
  return Lead.findOne({ phone: p }).lean();
}

/** Spread new leads fairly: the executive with the fewest open leads gets the next one. */
export async function leastLoadedExecutive() {
  const execs = await User.find({ role: 'executive', active: true }).select('_id name').lean();
  if (!execs.length) return null;
  const counts = await Lead.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $match: { stage: { $in: OPEN_STAGES }, ownerId: { $in: execs.map((e) => e._id) } } }, { $group: { _id: '$ownerId', n: { $sum: 1 } } }]);
  const load = new Map(counts.map((c) => [String(c._id), c.n]));
  return execs.sort((a, b) => (load.get(String(a._id)) ?? 0) - (load.get(String(b._id)) ?? 0))[0];
}

export async function createLead(raw: unknown, actor: Actor, opts: { autoAssign?: boolean } = {}) {
  assertCan(actor, 'lead.create');
  const input = LeadInput.parse(raw);
  const phone = normalisePhone(input.phone);
  if (phone.length < 11) throw badRequest('Enter a valid mobile number');
  const existing = await findByPhone(phone);
  if (existing) {
    const owner = existing.ownerId ? await User.findById(existing.ownerId).select('name').lean() : null;
    throw new HttpError(409, `${existing.name} is already a customer`, {
      existing: { id: String(existing._id), name: existing.name, stage: existing.stage, owner: owner?.name ?? null, mine: String(existing.ownerId) === actor.id },
    });
  }
  let ownerId: string | null = null;
  if (!can(actor.role, 'lead.assign')) ownerId = actor.id;
  else if (input.ownerId) ownerId = input.ownerId;
  else if (opts.autoAssign) ownerId = String((await leastLoadedExecutive())?._id ?? '') || null;

  const requirement = Requirement.partial().parse(input.requirement ?? {});
  const lead = await Lead.create({
    code: await nextCode('LD'),
    name: input.name,
    phone,
    email: input.email || undefined,
    source: input.source,
    ownerId,
    assignedAt: ownerId ? new Date() : undefined,
    requirement,
    enquiries: [{ at: new Date(), source: input.source, message: input.note ?? undefined }],
    createdBy: actor.id,
  });
  await audit(actor, 'lead', lead._id, 'create', `New lead from ${LEAD_SOURCE_LABEL[input.source]}${actor.viaAI ? ' (added with the assistant)' : ''}`);
  if (input.note) await Activity.create({ leadId: lead._id, type: 'note', status: 'done', notes: input.note, ownerId: ownerId ?? actor.id, createdBy: actor.id, completedAt: new Date(), viaAI: !!actor.viaAI });
  await autoAdvance(lead, actor);
  return lead.toObject();
}

/** A returning customer: new enquiry on the same record. Lost leads come back to life. */
export async function addEnquiry(id: string, input: { source?: string; message?: string; propertyId?: string }, actor: Actor) {
  const lead = await Lead.findById(id);
  if (!lead) throw notFound('Lead');
  lead.enquiries.push({ at: new Date(), source: input.source ?? 'phone', message: input.message, propertyId: input.propertyId ? new mongoose.Types.ObjectId(input.propertyId) : undefined });
  if (lead.stage === 'lost') {
    await setStage(lead, 'new', actor, 'Came back with a new enquiry');
    lead.lostReason = undefined;
  }
  // Their previous owner keeps them, unless that person has left.
  if (lead.ownerId) {
    const owner = await User.findById(lead.ownerId).select('active').lean();
    if (!owner?.active) lead.ownerId = null;
  }
  if (!lead.ownerId && !can(actor.role, 'lead.assign')) lead.ownerId = new mongoose.Types.ObjectId(actor.id);
  await lead.save();
  await audit(actor, 'lead', lead._id, 'enquiry', `New enquiry${input.message ? `: “${input.message.slice(0, 80)}”` : ''}`);
  return lead.toObject();
}

export async function updateLead(id: string, patch: { name?: string; email?: string | null; temperature?: string; requirement?: Partial<Requirement> }, actor: Actor) {
  assertCan(actor, 'lead.editOwn');
  const lead = await getLeadFor(id, actor);
  const changes: string[] = [];
  if (patch.name && patch.name !== lead.name) {
    lead.name = patch.name;
    changes.push('name');
  }
  if (patch.email !== undefined) lead.email = patch.email || undefined;
  if (patch.temperature && patch.temperature !== lead.temperature) {
    lead.temperature = patch.temperature as 'hot';
    changes.push(`marked ${patch.temperature}`);
  }
  if (patch.requirement) {
    const merged = Requirement.partial().parse({ ...(lead.toObject().requirement ?? {}), ...patch.requirement });
    lead.set('requirement', merged);
    changes.push('requirement');
  }
  await lead.save();
  if (changes.length) await audit(actor, 'lead', lead._id, 'update', `Updated ${changes.join(', ')}${actor.viaAI ? ' with the assistant' : ''}`);
  await autoAdvance(lead, actor);
  return lead.toObject();
}

export async function assignLead(id: string, ownerId: string, actor: Actor) {
  assertCan(actor, 'lead.assign', 'Only managers assign leads');
  const lead = await Lead.findById(id);
  if (!lead) throw notFound('Lead');
  const owner = await User.findById(ownerId).lean();
  if (!owner || !owner.active) throw badRequest('Choose an active team member');
  if (String(lead.ownerId) === ownerId) return lead.toObject();
  const from = lead.ownerId ? (await User.findById(lead.ownerId).select('name').lean())?.name : null;
  lead.ownerId = owner._id;
  lead.assignedAt = new Date();
  await lead.save();
  // Their planned follow-ups move with them.
  await Activity.updateMany({ leadId: lead._id, status: 'planned' }, { ownerId: owner._id });
  await audit(actor, 'lead', lead._id, 'assign', from ? `Reassigned from ${from} to ${owner.name}` : `Assigned to ${owner.name}`);
  return lead.toObject();
}

export async function assignUnassignedEvenly(actor: Actor) {
  assertCan(actor, 'lead.assign');
  const leads = await Lead.find({ ownerId: null, stage: { $in: OPEN_STAGES } }).sort({ createdAt: 1 });
  const result: { lead: string; owner: string }[] = [];
  for (const l of leads) {
    const exec = await leastLoadedExecutive();
    if (!exec) break;
    await assignLead(String(l._id), String(exec._id), actor);
    result.push({ lead: l.name, owner: exec.name });
  }
  return result;
}

/** Record something that happened (a call, a WhatsApp, a note). */
export async function logActivity(leadId: string, input: { type: ActivityType; outcome?: string; notes?: string; propertyIds?: string[] }, actor: Actor) {
  const lead = await getLeadFor(leadId, actor);
  if (!input.notes?.trim() && !input.outcome) throw badRequest('Add a note or an outcome');
  const a = await Activity.create({
    leadId: lead._id,
    type: input.type,
    status: 'done',
    outcome: input.outcome,
    notes: input.notes,
    propertyIds: input.propertyIds,
    completedAt: new Date(),
    ownerId: actor.id,
    createdBy: actor.id,
    viaAI: !!actor.viaAI,
  });
  const reached = input.type !== 'call' || !/not reachable|wrong number|no answer/i.test(input.outcome ?? '');
  if (CONTACT_TYPES.includes(input.type) && reached) {
    lead.lastContactAt = new Date();
    if (input.outcome === 'Not interested') lead.temperature = 'cold';
    if (input.outcome === 'Interested' && lead.temperature === 'cold') lead.temperature = 'warm';
    await lead.save();
  }
  await autoAdvance(lead, actor);
  return a.toObject();
}

export async function setStage(lead: InstanceType<typeof Lead>, to: Stage, actor: Actor, why: string) {
  if (lead.stage === to) return;
  const from = lead.stage as Stage;
  lead.stage = to;
  lead.stageChangedAt = new Date();
  await lead.save();
  await audit(actor, 'lead', lead._id, 'stage', `${STAGE_META[from].label} → ${STAGE_META[to].label}: ${why}`, { from, to });
}

/**
 * Stages move on their own when the evidence is there, so nobody has to
 * remember to drag a card: a logged conversation means Contacted; a known
 * budget, location and type means Qualified.
 */
export async function autoAdvance(lead: InstanceType<typeof Lead>, actor: Actor) {
  const order: Stage[] = ['new', 'contacted', 'qualified', 'visit', 'negotiation', 'booked'];
  const at = order.indexOf(lead.stage as Stage);
  if (at < 0) return;
  if (at < 1 && lead.lastContactAt) await setStage(lead, 'contacted', actor, 'first conversation logged');
  if (order.indexOf(lead.stage as Stage) < 2 && lead.lastContactAt && isQualified(lead.requirement as never)) await setStage(lead, 'qualified', actor, 'budget, location and type known');
}

export async function timeline(leadId: string) {
  const [activities, audits, lead] = await Promise.all([
    Activity.find({ leadId }).sort({ createdAt: -1 }).limit(200).populate('ownerId', 'name').populate('propertyIds', 'title').lean(),
    Audit.find({ entity: 'lead', entityId: leadId, action: { $in: ['create', 'stage', 'assign', 'enquiry'] } }).sort({ createdAt: -1 }).limit(100).lean(),
    Lead.findById(leadId).select('enquiries').lean(),
  ]);
  type Item = { id: string; at: Date; kind: 'activity' | 'event'; type: string; title: string; body?: string; by?: string; viaAI?: boolean; status?: string; scheduledAt?: Date | null; outcome?: string; feedback?: unknown; properties?: { id: string; title: string }[] };
  const items: Item[] = [
    ...activities.map((a) => ({
      id: String(a._id),
      at: (a.status === 'planned' ? a.scheduledAt : a.completedAt ?? a.scheduledAt ?? a.createdAt) as Date,
      kind: 'activity' as const,
      type: a.type,
      status: a.status,
      title: a.title || (a.status === 'planned' ? `${ACTIVITY_LABEL[a.type as ActivityType]} planned` : a.outcome ? `${ACTIVITY_LABEL[a.type as ActivityType]} · ${a.outcome}` : ACTIVITY_LABEL[a.type as ActivityType]),
      body: a.notes ?? undefined,
      by: (a.ownerId as unknown as { name?: string })?.name,
      viaAI: a.viaAI,
      scheduledAt: a.scheduledAt,
      outcome: a.outcome ?? undefined,
      feedback: a.feedback,
      properties: ((a.propertyIds ?? []) as unknown as { _id: unknown; title: string }[]).map((p) => ({ id: String(p._id), title: p.title })),
    })),
    ...audits.map((e) => ({ id: String(e._id), at: e.createdAt as Date, kind: 'event' as const, type: e.action, title: e.summary ?? e.action, by: e.actorName ?? undefined, viaAI: e.viaAI })),
  ];
  void lead;
  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
