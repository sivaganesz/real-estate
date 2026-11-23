import mongoose from 'mongoose';
import { ACTIVITY_LABEL, OPEN_STAGES, STAGE_META, can, isQualified, type ActivityType, type Stage } from '@estate/shared';
import { Activity, Lead } from '../models/lead';
import { Property } from '../models/property';
import { User } from '../models/user';
import { audit, type Actor } from '../lib/auth';
import { HttpError, badRequest, notFound } from '../lib/http';
import { CONTACT_TYPES, getLeadFor, leadScope, setStage, withOwners } from './leads';

export type ScheduleInput = {
  type: ActivityType;
  scheduledAt: Date;
  durationMin?: number;
  title?: string;
  notes?: string;
  propertyIds?: string[];
  ownerId?: string;
  force?: boolean;
};

/** The lead's next step is always its earliest planned activity. */
export async function recomputeNextAction(leadId: unknown) {
  const next = await Activity.findOne({ leadId, status: 'planned' }).sort({ scheduledAt: 1 }).lean();
  await Lead.updateOne(
    { _id: leadId },
    next ? { $set: { nextAction: { activityId: next._id, type: next.type, dueAt: next.scheduledAt, title: next.title ?? ACTIVITY_LABEL[next.type as ActivityType] } } } : { $unset: { nextAction: 1 } },
  );
}

async function canTouch(activityId: string, actor: Actor) {
  if (!mongoose.isValidObjectId(activityId)) throw notFound('Activity');
  const a = await Activity.findById(activityId);
  if (!a) throw notFound('Activity');
  await getLeadFor(String(a.leadId), actor); // scope check: executives only touch their own customers
  return a;
}

/** Visits and meetings take the salesperson's time; two at once is a clash. Calls don't. */
async function clashes(ownerId: unknown, start: Date, minutes: number, exclude?: unknown) {
  const end = new Date(start.getTime() + minutes * 60_000);
  const others = await Activity.find({
    ownerId,
    status: 'planned',
    type: { $in: ['site_visit', 'meeting'] },
    scheduledAt: { $gte: new Date(start.getTime() - 4 * 3_600_000), $lt: end },
    ...(exclude ? { _id: { $ne: exclude } } : {}),
  })
    .populate('leadId', 'name')
    .lean();
  return others.filter((o) => new Date(o.scheduledAt!).getTime() + (o.durationMin ?? 30) * 60_000 > start.getTime());
}

export async function schedule(leadId: string, input: ScheduleInput, actor: Actor) {
  const lead = await getLeadFor(leadId, actor);
  if (OPEN_STAGES.indexOf(lead.stage as Stage) < 0 && lead.stage !== 'booked') throw badRequest(`${lead.name} is closed as lost. Reopen them first.`);
  if (!(input.scheduledAt instanceof Date) || Number.isNaN(input.scheduledAt.getTime())) throw badRequest('Choose a date and time');
  if (input.scheduledAt.getTime() < Date.now() - 15 * 60_000) throw badRequest('That time has already passed');
  const ownerId = input.ownerId && can(actor.role, 'lead.assign') ? input.ownerId : String(lead.ownerId ?? actor.id);
  const duration = input.durationMin ?? (input.type === 'site_visit' ? 60 : input.type === 'meeting' ? 45 : 15);
  if (['site_visit', 'meeting'].includes(input.type) && !input.force) {
    const c = await clashes(ownerId, input.scheduledAt, duration);
    if (c.length) {
      throw new HttpError(409, `Clashes with ${ACTIVITY_LABEL[c[0].type as ActivityType].toLowerCase()} with ${(c[0].leadId as unknown as { name: string }).name} at ${new Date(c[0].scheduledAt!).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`, { clash: true });
    }
  }
  let title = input.title;
  if (!title && input.type === 'site_visit' && input.propertyIds?.length) {
    const p = await Property.findById(input.propertyIds[0]).select('title').lean();
    title = `Site visit: ${p?.title ?? 'property'}${input.propertyIds.length > 1 ? ` +${input.propertyIds.length - 1}` : ''}`;
  }
  const a = await Activity.create({
    leadId: lead._id,
    type: input.type,
    status: 'planned',
    title: title ?? ACTIVITY_LABEL[input.type],
    scheduledAt: input.scheduledAt,
    durationMin: duration,
    notes: input.notes,
    propertyIds: input.propertyIds,
    ownerId,
    createdBy: actor.id,
    viaAI: !!actor.viaAI,
  });
  // A planned visit is the evidence for the Site visit stage.
  if (input.type === 'site_visit' && ['new', 'contacted', 'qualified'].includes(lead.stage) && lead.lastContactAt && isQualified(lead.requirement as never)) {
    await setStage(lead, 'visit', actor, 'site visit scheduled');
  }
  for (const pid of input.propertyIds ?? []) {
    if (!lead.shortlist.some((s) => String(s.propertyId) === pid)) lead.shortlist.push({ propertyId: new mongoose.Types.ObjectId(pid), status: 'shared', at: new Date() });
  }
  await lead.save();
  await recomputeNextAction(lead._id);
  return a.toObject();
}

export type CompleteInput = {
  outcome?: string;
  notes?: string;
  feedback?: { interest?: string; liked?: string; concerns?: string };
  propertyFeedback?: { propertyId: string; status: 'liked' | 'rejected' | 'visited' }[];
  next?: { type: ActivityType; scheduledAt: Date; notes?: string };
  noShow?: boolean;
};

/**
 * Finishing an activity asks the two questions that keep a pipeline alive:
 * how did it go, and what happens next.
 */
export async function complete(activityId: string, input: CompleteInput, actor: Actor) {
  const a = await canTouch(activityId, actor);
  if (a.status !== 'planned') throw badRequest(`This ${ACTIVITY_LABEL[a.type as ActivityType].toLowerCase()} is already ${a.status}`);
  const lead = (await Lead.findById(a.leadId))!;
  a.status = input.noShow ? 'missed' : 'done';
  a.completedAt = new Date();
  a.outcome = input.noShow ? 'Customer did not turn up' : input.outcome;
  a.notes = [a.notes, input.notes].filter(Boolean).join('\n') || undefined;
  if (input.feedback) a.feedback = input.feedback;
  await a.save();

  if (!input.noShow) {
    if (CONTACT_TYPES.includes(a.type as ActivityType)) lead.lastContactAt = new Date();
    const interest = input.feedback?.interest;
    if (interest === 'Very interested') lead.temperature = 'hot';
    else if (interest === 'Not interested') lead.temperature = 'cold';
    // What they thought of each property goes on their shortlist (matching learns from it).
    const fb = input.propertyFeedback ?? (a.type === 'site_visit' ? (a.propertyIds ?? []).map((p) => ({ propertyId: String(p), status: interest === 'Not interested' ? 'rejected' : interest === 'Very interested' ? 'liked' : 'visited' })) : []);
    for (const f of fb as { propertyId: string; status: 'liked' | 'rejected' | 'visited' }[]) {
      const item = lead.shortlist.find((s) => String(s.propertyId) === f.propertyId);
      if (item) {
        item.status = f.status;
        item.at = new Date();
      } else lead.shortlist.push({ propertyId: new mongoose.Types.ObjectId(f.propertyId), status: f.status, at: new Date() });
    }
    await lead.save();
  }
  await audit(actor, 'activity', a._id, 'complete', `${ACTIVITY_LABEL[a.type as ActivityType]} with ${lead.name}: ${a.outcome ?? 'done'}`);

  let next = null;
  if (input.next) next = await schedule(String(lead._id), { ...input.next, force: true }, actor);
  await recomputeNextAction(lead._id);
  const fresh = await Lead.findById(lead._id).lean();
  return { activity: a.toObject(), next, needsNextStep: !fresh?.nextAction && OPEN_STAGES.includes(fresh?.stage as Stage) };
}

export async function reschedule(activityId: string, input: { scheduledAt: Date; reason?: string; force?: boolean }, actor: Actor) {
  const a = await canTouch(activityId, actor);
  if (a.status !== 'planned') throw badRequest('Only planned activities can be moved');
  if (input.scheduledAt.getTime() < Date.now() - 15 * 60_000) throw badRequest('That time has already passed');
  if (['site_visit', 'meeting'].includes(a.type) && !input.force) {
    const c = await clashes(a.ownerId, input.scheduledAt, a.durationMin ?? 30, a._id);
    if (c.length) throw new HttpError(409, `Clashes with ${(c[0].leadId as unknown as { name: string }).name} at that time`, { clash: true });
  }
  const from = a.scheduledAt;
  a.rescheduledFrom = from;
  a.scheduledAt = input.scheduledAt;
  if (input.reason) a.notes = [a.notes, `Moved: ${input.reason}`].filter(Boolean).join('\n');
  await a.save();
  await audit(actor, 'activity', a._id, 'reschedule', `Moved from ${from?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}${input.reason ? ` (${input.reason})` : ''}`);
  await recomputeNextAction(a.leadId);
  return a.toObject();
}

export async function cancel(activityId: string, reason: string, actor: Actor) {
  const a = await canTouch(activityId, actor);
  if (a.status !== 'planned') throw badRequest('Only planned activities can be cancelled');
  a.status = 'cancelled';
  a.cancelReason = reason;
  await a.save();
  await audit(actor, 'activity', a._id, 'cancel', `Cancelled: ${reason}`);
  await recomputeNextAction(a.leadId);
  return a.toObject();
}

/** Planned activities in a window, for the calendar. Executives see their own. */
export async function agenda(actor: Actor, opts: { from: Date; to: Date; ownerId?: string; includeDone?: boolean }) {
  const q: Record<string, unknown> = { scheduledAt: { $gte: opts.from, $lt: opts.to }, status: opts.includeDone ? { $in: ['planned', 'done', 'missed'] } : 'planned' };
  if (!can(actor.role, 'activity.viewAll')) q.ownerId = new mongoose.Types.ObjectId(actor.id);
  else if (opts.ownerId) q.ownerId = new mongoose.Types.ObjectId(opts.ownerId);
  const items = await Activity.find(q).sort({ scheduledAt: 1 }).populate('leadId', 'name phone stage').populate('ownerId', 'name').populate('propertyIds', 'title locality').lean();
  return items.map(shapeActivity);
}

export function shapeActivity(a: Record<string, unknown>) {
  const lead = a.leadId as { _id: unknown; name: string; phone: string; stage: string } | null;
  const owner = a.ownerId as { _id: unknown; name: string } | null;
  return {
    id: String(a._id),
    type: a.type as ActivityType,
    status: a.status as string,
    title: (a.title as string) ?? ACTIVITY_LABEL[a.type as ActivityType],
    scheduledAt: a.scheduledAt as Date,
    durationMin: a.durationMin as number,
    notes: a.notes as string | undefined,
    outcome: a.outcome as string | undefined,
    rescheduled: !!a.rescheduledFrom,
    lead: lead ? { id: String(lead._id), name: lead.name, phone: lead.phone, stage: lead.stage } : null,
    owner: owner ? { id: String(owner._id), name: owner.name } : null,
    properties: ((a.propertyIds as { _id: unknown; title: string; locality?: string }[]) ?? []).map((p) => ({ id: String(p._id), title: p.title, locality: p.locality })),
    viaAI: !!a.viaAI,
  };
}

/** Everything that decides a salesperson's day, in the order they should act on it. */
export async function myDay(actor: Actor, opts: { ownerId?: string } = {}) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  const forId = !can(actor.role, 'activity.viewAll') ? actor.id : opts.ownerId;
  const owner = forId ? { ownerId: new mongoose.Types.ObjectId(forId) } : {};
  const pop = (q: ReturnType<typeof Activity.find>) => q.populate('leadId', 'name phone stage').populate('ownerId', 'name').populate('propertyIds', 'title locality');
  const [overdue, today, doneToday] = await Promise.all([
    pop(Activity.find({ ...owner, status: 'planned', scheduledAt: { $lt: now } }).sort({ scheduledAt: 1 })).lean(),
    pop(Activity.find({ ...owner, status: 'planned', scheduledAt: { $gte: now, $lt: end } }).sort({ scheduledAt: 1 })).lean(),
    Activity.countDocuments({ ...owner, status: { $in: ['done', 'missed'] }, completedAt: { $gte: start } }),
  ]);
  const scope = forId ? { ownerId: new mongoose.Types.ObjectId(forId) } : leadScope(actor);
  const [newLeads, noNextStep] = await Promise.all([
    Lead.find({ ...scope, stage: 'new', lastContactAt: { $exists: false } }).sort({ createdAt: 1 }).limit(20).lean(),
    Lead.find({ ...scope, stage: { $in: OPEN_STAGES.filter((s) => s !== 'new') }, 'nextAction.dueAt': { $exists: false } }).sort({ temperature: 1, stageChangedAt: 1 }).limit(20).lean(),
  ]);
  return {
    overdue: overdue.map(shapeActivity),
    today: today.map(shapeActivity),
    doneToday,
    newLeads: await withOwners(newLeads),
    noNextStep: await withOwners(noNextStep),
  };
}

/** For managers: who is behind, at a glance. */
export async function overdueByPerson() {
  const rows = await Activity.aggregate<{ _id: mongoose.Types.ObjectId; count: number; oldest: Date }>([
    { $match: { status: 'planned', scheduledAt: { $lt: new Date() } } },
    { $group: { _id: '$ownerId', count: { $sum: 1 }, oldest: { $min: '$scheduledAt' } } },
    { $sort: { count: -1 } },
  ]);
  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('name').lean();
  return rows.map((r) => ({ ownerId: String(r._id), name: users.find((u) => String(u._id) === String(r._id))?.name ?? 'Unknown', count: r.count, oldestDays: Math.floor((Date.now() - new Date(r.oldest).getTime()) / 86_400_000) }));
}

export { STAGE_META };
