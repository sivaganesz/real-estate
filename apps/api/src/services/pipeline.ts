import mongoose from 'mongoose';
import { LOST_REASONS, OPEN_STAGES, STAGES, STAGE_META, isQualified, requirementGaps, type Stage } from '@estate/shared';
import { Activity, Lead } from '../models/lead';
import { Audit } from '../models/audit';
import { Property } from '../models/property';
import { User } from '../models/user';
import { HttpError, badRequest } from '../lib/http';
import { assertCan, audit, type Actor } from '../lib/auth';
import { getLeadFor, leadScope, setStage, withOwners } from './leads';

const ORDER: Stage[] = ['new', 'contacted', 'qualified', 'visit', 'negotiation', 'booked'];

/** A gate the move didn't pass, with what to do about it. The UI turns `need` into the right prompt. */
export class StageGate extends HttpError {
  constructor(message: string, need: 'conversation' | 'requirement' | 'visit' | 'property' | 'reason' | 'booking' | 'reopen') {
    super(422, message, { need });
  }
}

/**
 * Moving a lead between stages. Forward moves need their evidence; going back
 * is allowed (deals do fall back); Booked only comes from a confirmed booking;
 * Lost needs a reason and cancels what was planned.
 */
export async function moveStage(
  leadId: string,
  to: Stage,
  actor: Actor,
  opts: { reason?: string; note?: string; propertyId?: string; system?: boolean } = {},
) {
  assertCan(actor, 'lead.editOwn');
  const lead = await getLeadFor(leadId, actor);
  const from = lead.stage as Stage;
  if (from === to) return lead.toObject();
  if (from === 'booked' && !opts.system) throw new StageGate('A booked customer changes stage only by cancelling the booking on the deal', 'booking');
  if (from === 'lost' && to !== 'new' && to !== 'contacted') throw new StageGate('Reopen the lead first', 'reopen');

  if (to === 'lost') {
    if (!opts.reason || !(LOST_REASONS as readonly string[]).includes(opts.reason)) throw new StageGate('Say why it was lost', 'reason');
    lead.lostReason = opts.reason;
    lead.lostNote = opts.note;
    const cancelled = await Activity.updateMany({ leadId: lead._id, status: 'planned' }, { status: 'cancelled', cancelReason: 'Lead closed as lost' });
    lead.set('nextAction', undefined);
    await setStage(lead, 'lost', actor, opts.reason + (opts.note ? ` — ${opts.note}` : ''));
    if (cancelled.modifiedCount) await audit(actor, 'lead', lead._id, 'cancel', `Cancelled ${cancelled.modifiedCount} planned follow-up${cancelled.modifiedCount > 1 ? 's' : ''}`);
    return lead.toObject();
  }

  if (from === 'lost') {
    lead.lostReason = undefined;
    lead.lostNote = undefined;
    const back: Stage = lead.lastContactAt ? 'contacted' : 'new';
    await setStage(lead, back, actor, 'reopened');
    return lead.toObject();
  }

  if (to === 'booked' && !opts.system) throw new StageGate('Bookings are confirmed from the deal, with the booking amount', 'booking');

  const forward = ORDER.indexOf(to) > ORDER.indexOf(from);
  if (forward) {
    if (ORDER.indexOf(to) >= 1 && !lead.lastContactAt) throw new StageGate('Log the first conversation before moving on', 'conversation');
    if (ORDER.indexOf(to) >= 2 && !isQualified(lead.requirement as never)) throw new StageGate(`Still unknown: ${requirementGaps(lead.requirement as never).join(', ')}`, 'requirement');
    if (to === 'visit' || to === 'negotiation') {
      const visit = await Activity.exists({ leadId: lead._id, type: 'site_visit', status: { $in: ['planned', 'done'] } });
      if (to === 'visit' && !visit) throw new StageGate('Schedule the site visit first', 'visit');
    }
    if (to === 'negotiation') {
      const pid = opts.propertyId ?? lead.shortlist.find((s) => s.status === 'liked')?.propertyId?.toString();
      if (!pid) throw new StageGate('Which property are they negotiating on?', 'property');
      const p = await Property.findById(pid).select('title').lean();
      if (!p) throw badRequest('Property not found');
      // Negotiating means a deal on that property: it shortlists it and moves the stage.
      const { startDeal } = await import('./deals');
      await startDeal(leadId, pid, actor, { note: opts.note });
      return (await Lead.findById(lead._id))!.toObject();
    }
  }
  await setStage(lead, to, actor, opts.note ?? (forward ? 'moved on' : 'moved back'));
  return lead.toObject();
}

/** The board: open stages as columns, plus recent bookings and losses for context. */
export async function board(actor: Actor, opts: { ownerId?: string; q?: string }) {
  const scope = { ...leadScope(actor) } as Record<string, unknown>;
  if (opts.ownerId === 'none') scope.ownerId = null;
  else if (opts.ownerId && !('ownerId' in scope)) scope.ownerId = new mongoose.Types.ObjectId(opts.ownerId);
  if (opts.q) scope.name = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const since = new Date(Date.now() - 30 * 86_400_000);
  const leads = await Lead.find({ ...scope, $or: [{ stage: { $in: OPEN_STAGES } }, { stage: { $in: ['booked', 'lost'] }, stageChangedAt: { $gte: since } }] })
    .sort({ temperature: 1, stageChangedAt: 1 })
    .lean();
  const items = await withOwners(leads);
  return STAGES.map((s) => ({ stage: s, label: STAGE_META[s].label, entry: STAGE_META[s].entry, leads: items.filter((l) => l.stage === s) }));
}

/** The furthest stage a lead got to, from its stage history and what actually happened. */
async function furthestStages(leadIds: mongoose.Types.ObjectId[]) {
  const [moves, visits] = await Promise.all([
    Audit.find({ entity: 'lead', action: 'stage', entityId: { $in: leadIds } }).select('entityId changes').lean(),
    Activity.find({ leadId: { $in: leadIds }, type: 'site_visit', status: 'done' }).select('leadId').lean(),
  ]);
  const best = new Map<string, number>();
  const bump = (id: string, s: Stage) => best.set(id, Math.max(best.get(id) ?? 0, ORDER.indexOf(s)));
  for (const m of moves) {
    const to = (m.changes as { to?: Stage; from?: Stage } | undefined) ?? {};
    if (to.to && to.to !== 'lost') bump(String(m.entityId), to.to);
    if (to.from && to.from !== 'lost') bump(String(m.entityId), to.from);
  }
  for (const v of visits) bump(String(v.leadId), 'visit');
  return best;
}

/**
 * Where the pipeline converts and where it leaks: funnel, stage-to-stage
 * conversion, time in stage, lost reasons, sources, and per-person health.
 */
export async function insights(actor: Actor, opts: { days?: number; ownerId?: string } = {}) {
  const days = opts.days ?? 90;
  const scope = { ...leadScope(actor) } as Record<string, unknown>;
  if (opts.ownerId && !('ownerId' in scope)) scope.ownerId = new mongoose.Types.ObjectId(opts.ownerId);
  const leads = await Lead.find({ ...scope, createdAt: { $gte: new Date(Date.now() - days * 86_400_000) } }).lean();
  const furthest = await furthestStages(leads.map((l) => l._id));
  const reached = (l: (typeof leads)[number]) => {
    const current = l.stage === 'lost' ? -1 : ORDER.indexOf(l.stage as Stage);
    let best = Math.max(current, furthest.get(String(l._id)) ?? 0);
    if (l.lastContactAt) best = Math.max(best, 1);
    if (isQualified(l.requirement as never) && l.lastContactAt) best = Math.max(best, 2);
    return best;
  };
  const funnel = ORDER.map((s, i) => ({ stage: s, label: STAGE_META[s].label, count: leads.filter((l) => reached(l) >= i).length }));
  const conversion = funnel.slice(1).map((f, i) => ({ from: funnel[i].label, to: f.label, rate: funnel[i].count ? Math.round((f.count / funnel[i].count) * 100) : 0 }));
  const weakest = conversion.filter((c) => c.from !== 'New').sort((a, b) => a.rate - b.rate)[0];

  const lost = leads.filter((l) => l.stage === 'lost');
  const lostReasons = Object.entries(lost.reduce<Record<string, number>>((m, l) => ((m[l.lostReason ?? 'Other'] = (m[l.lostReason ?? 'Other'] ?? 0) + 1), m), {}))
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
  const lostAt = Object.entries(
    lost.reduce<Record<string, number>>((m, l) => {
      const s = ORDER[Math.max(0, reached(l))];
      m[STAGE_META[s].label] = (m[STAGE_META[s].label] ?? 0) + 1;
      return m;
    }, {}),
  ).map(([stage, count]) => ({ stage, count }));

  const open = await Lead.find({ ...scope, stage: { $in: OPEN_STAGES } }).lean();
  const stuck = OPEN_STAGES.map((s) => {
    const inStage = open.filter((l) => l.stage === s);
    const ages = inStage.map((l) => (Date.now() - new Date(l.stageChangedAt ?? l.createdAt).getTime()) / 86_400_000);
    return {
      stage: s,
      label: STAGE_META[s].label,
      open: inStage.length,
      stuck: ages.filter((a) => a >= STAGE_META[s].staleAfterDays).length,
      avgDays: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0,
      limit: STAGE_META[s].staleAfterDays,
    };
  });

  const sources = Object.entries(
    leads.reduce<Record<string, { leads: number; booked: number }>>((m, l) => {
      const s = (m[l.source] ??= { leads: 0, booked: 0 });
      s.leads++;
      if (l.stage === 'booked') s.booked++;
      return m;
    }, {}),
  )
    .map(([source, v]) => ({ source, ...v, rate: v.leads ? Math.round((v.booked / v.leads) * 100) : 0 }))
    .sort((a, b) => b.leads - a.leads);

  const people = await User.find({ role: 'executive', active: true }).select('name').lean();
  const team = people
    .filter((p) => !('ownerId' in scope) || String(scope.ownerId) === String(p._id))
    .map((p) => {
      const mine = open.filter((l) => String(l.ownerId) === String(p._id));
      return {
        id: String(p._id),
        name: p.name,
        open: mine.length,
        stuck: mine.filter((l) => (Date.now() - new Date(l.stageChangedAt ?? l.createdAt).getTime()) / 86_400_000 >= STAGE_META[l.stage as Stage].staleAfterDays).length,
        overdue: mine.filter((l) => l.nextAction?.dueAt && new Date(l.nextAction.dueAt) < new Date()).length,
        noNextStep: mine.filter((l) => !l.nextAction?.dueAt).length,
        booked: leads.filter((l) => String(l.ownerId) === String(p._id) && l.stage === 'booked').length,
      };
    });

  const booked = funnel[funnel.length - 1].count;
  return {
    days,
    total: leads.length,
    booked,
    overallRate: leads.length ? Math.round((booked / leads.length) * 1000) / 10 : 0,
    funnel,
    conversion,
    weakest: weakest ?? null,
    stuck,
    lostReasons,
    lostAt,
    sources,
    team,
  };
}
