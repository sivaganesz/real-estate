import mongoose from 'mongoose';
import { OPEN_STAGES, PROPERTY_TYPE_LABEL, formatINR, isQualified, relativeDay, type Requirement } from '@estate/shared';
import { Lead, Activity } from '../models/lead';
import { Property, type PropertyDoc } from '../models/property';
import { audit, type Actor } from '../lib/auth';
import { badRequest } from '../lib/http';
import { getLeadFor, leadScope } from './leads';
import { ensureShareToken, getProperty, releaseExpiredHolds, serialiseProperty } from './properties';
import { recomputeNextAction } from './activities';

export type Reason = { ok: 'yes' | 'near' | 'no' | 'info'; text: string };
export type Fit = 'strong' | 'good' | 'partial';
export type Match = { fit: Fit; reasons: Reason[]; score: number };

type Shortlist = { propertyId?: unknown; status?: string | null; at?: Date | null }[];

const near = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Why a property fits a customer, in words a salesperson would use.
 * Returns null when it clearly doesn't (wrong type, way over budget, already
 * rejected, can't be sold). The score only orders results; people see the fit
 * label and the reasons.
 */
export function scoreMatch(r: Partial<Requirement>, p: Pick<PropertyDoc, 'type' | 'purpose' | 'price' | 'areaSqft' | 'city' | 'locality' | 'details' | 'amenities' | 'availability' | 'listing' | 'heldUntil' | 'approvals'> & { _id: unknown }, shortlist: Shortlist = []): Match | null {
  if (p.listing !== 'live' || p.availability === 'booked' || p.availability === 'sold') return null;
  if ((r.purpose ?? 'sale') !== p.purpose) return null;
  if (r.types?.length && !r.types.includes(p.type as never)) return null;
  const seen = shortlist.find((s) => String(s.propertyId) === String(p._id));
  if (seen?.status === 'rejected') return null;

  const reasons: Reason[] = [];
  let score = 0;
  let misses = 0;
  const d = (p.details ?? {}) as Record<string, unknown>;

  // Budget (35)
  if (p.price && (r.budgetMax || r.budgetMin)) {
    const max = r.budgetMax ?? Infinity;
    if (p.price <= max) {
      score += 35;
      if (r.budgetMin && p.price < r.budgetMin * 0.75) {
        reasons.push({ ok: 'near', text: `${formatINR(p.price)} — well under their budget; may feel too small` });
        score -= 10;
      } else reasons.push({ ok: 'yes', text: `${formatINR(p.price)}, within budget${r.budgetMax ? ` (up to ${formatINR(r.budgetMax)})` : ''}` });
    } else if (p.price <= max * 1.1) {
      score += 20;
      reasons.push({ ok: 'near', text: `${formatINR(p.price - max)} over budget (${Math.round(((p.price - max) / max) * 100)}%) — worth a try if negotiable` });
    } else if (p.price <= max * 1.2) {
      score += 5;
      misses++;
      reasons.push({ ok: 'no', text: `${formatINR(p.price - max)} over budget (${Math.round(((p.price - max) / max) * 100)}%)` });
    } else return null;
  } else if (!p.price) reasons.push({ ok: 'info', text: 'Price on request' });
  else score += 15;

  // Location (30)
  const locs = r.localities ?? [];
  if (locs.length) {
    if (p.locality && locs.some((l) => near(l, p.locality!))) {
      score += 30;
      reasons.push({ ok: 'yes', text: `In ${p.locality}, a preferred area` });
    } else if (r.city ? p.city && near(r.city, p.city) : true) {
      score += 12;
      reasons.push({ ok: 'near', text: `In ${p.locality ?? p.city}, not one of their areas (${locs.join(', ')})` });
    } else return null;
  } else if (r.city) {
    if (p.city && near(r.city, p.city)) {
      score += 25;
      reasons.push({ ok: 'yes', text: `In ${p.city}` });
    } else return null;
  } else score += 15;

  // Bedrooms (15)
  if (r.bedrooms && (p.type === 'apartment' || p.type === 'villa')) {
    const b = Number(d.bedrooms ?? 0);
    if (b === r.bedrooms) {
      score += 15;
      reasons.push({ ok: 'yes', text: `${b} BHK as wanted` });
    } else if (b > r.bedrooms) {
      score += 11;
      reasons.push({ ok: 'yes', text: `${b} BHK (wanted ${r.bedrooms}+)` });
    } else if (b) return null;
  } else score += 10;

  // Size (10)
  if (r.areaMin && p.areaSqft) {
    if (p.areaSqft >= r.areaMin) {
      score += 10;
      reasons.push({ ok: 'yes', text: `${p.areaSqft.toLocaleString('en-IN')} sq.ft (wanted ${r.areaMin.toLocaleString('en-IN')}+)` });
    } else if (p.areaSqft >= r.areaMin * 0.9) {
      score += 5;
      reasons.push({ ok: 'near', text: `${p.areaSqft.toLocaleString('en-IN')} sq.ft, slightly smaller than wanted` });
    } else {
      misses++;
      reasons.push({ ok: 'no', text: `${p.areaSqft.toLocaleString('en-IN')} sq.ft, smaller than the ${r.areaMin.toLocaleString('en-IN')} wanted` });
    }
  } else score += 7;

  // Must-haves (10)
  const must = r.mustHaves ?? [];
  if (must.length) {
    let hit = 0;
    for (const m of must) {
      const lower = m.toLowerCase();
      const facing = lower.match(/(north|east|south|west)(?:[\s-](east|west))?\s*facing/);
      let has: boolean | null = null;
      if (facing) has = String(d.facing ?? '').toLowerCase().replace('-', ' ') === facing.slice(1).filter(Boolean).join(' ');
      else if ((p.amenities ?? []).some((a) => a.toLowerCase().includes(lower) || lower.includes(a.toLowerCase()))) has = true;
      else if (/borewell|water/.test(lower) && /borewell/i.test(String(d.waterSource ?? ''))) has = true;
      else if (/kva|power/.test(lower) && d.powerKva) has = Number(d.powerKva) >= Number(lower.match(/\d+/)?.[0] ?? 0);
      else has = /near|school|metro/.test(lower) ? null : false;
      if (has === true) {
        hit++;
        reasons.push({ ok: 'yes', text: m });
      } else if (has === false) {
        misses++;
        reasons.push({ ok: 'no', text: `No ${m.toLowerCase()} listed` });
      } else reasons.push({ ok: 'info', text: `${m} — check` });
    }
    score += Math.round((hit / must.length) * 10);
  } else score += 7;

  if (p.availability === 'held') {
    score -= 15;
    reasons.push({ ok: 'near', text: `On hold${p.heldUntil ? ` until ${relativeDay(p.heldUntil)}` : ''} for another buyer` });
  }
  const pending = (p.approvals ?? []).filter((a) => !a.documentUrl).map((a) => a.name);
  if (pending.length) reasons.push({ ok: 'info', text: `${pending.join(', ')} claimed; document pending` });
  if (seen?.status === 'liked') reasons.unshift({ ok: 'yes', text: 'They liked this one' });
  else if (seen?.status === 'visited') reasons.push({ ok: 'info', text: 'Already visited' });
  else if (seen?.status === 'shared') reasons.push({ ok: 'info', text: `Already shared${seen.at ? ` ${relativeDay(seen.at).toLowerCase()}` : ''}` });

  const fit: Fit = score >= 85 && misses === 0 ? 'strong' : score >= 65 && misses <= 1 ? 'good' : 'partial';
  if (score < 40) return null;
  return { fit, reasons, score };
}

export async function matchesForLead(leadId: string, actor: Actor, opts: { limit?: number; includeShared?: boolean } = {}) {
  await releaseExpiredHolds();
  const lead = await getLeadFor(leadId, actor);
  const r = (lead.toObject().requirement ?? {}) as Partial<Requirement>;
  const q: Record<string, unknown> = { listing: 'live', availability: { $in: ['available', 'held'] }, purpose: r.purpose ?? 'sale' };
  if (r.types?.length) q.type = { $in: r.types };
  if (r.budgetMax) q.price = { $lte: r.budgetMax * 1.2 };
  if (r.city && !r.localities?.length) q.city = new RegExp(`^${r.city}$`, 'i');
  const candidates = await Property.find(q).limit(500).lean();
  const shortlist = lead.shortlist as Shortlist;
  const scored = candidates
    .map((p) => ({ p, m: scoreMatch(r, p as never, shortlist) }))
    .filter((x): x is { p: (typeof candidates)[number]; m: Match } => !!x.m)
    .filter((x) => opts.includeShared !== false || !shortlist.some((s) => String(s.propertyId) === String(x.p._id)))
    .sort((a, b) => b.m.score - a.m.score);
  // One project shouldn't fill the list with identical units: keep the best two per project.
  const perProject = new Map<string, number>();
  const picked = scored.filter((x) => {
    if (!x.p.projectId) return true;
    const k = String(x.p.projectId);
    perProject.set(k, (perProject.get(k) ?? 0) + 1);
    return perProject.get(k)! <= 2;
  });
  return {
    qualified: isQualified(r),
    total: picked.length,
    items: picked.slice(0, opts.limit ?? 6).map((x) => ({ property: serialiseProperty(x.p as never), ...x.m })),
  };
}

export async function leadsForProperty(propertyId: string, actor: Actor, opts: { limit?: number } = {}) {
  const p = await getProperty(propertyId, actor);
  const leads = await Lead.find({ ...leadScope(actor), stage: { $in: OPEN_STAGES }, 'requirement.purpose': p.purpose }).populate('ownerId', 'name').lean();
  const out = leads
    .filter((l) => isQualified(l.requirement as never) || (l.requirement as Partial<Requirement>)?.types?.length)
    .map((l) => ({ l, m: scoreMatch(l.requirement as never, p as never, l.shortlist as Shortlist) }))
    .filter((x): x is { l: (typeof leads)[number]; m: Match } => !!x.m)
    .sort((a, b) => b.m.score - a.m.score)
    .slice(0, opts.limit ?? 8);
  return out.map(({ l, m }) => ({
    lead: { id: String(l._id), name: l.name, stage: l.stage, temperature: l.temperature, owner: (l.ownerId as unknown as { name?: string })?.name ?? null },
    ...m,
  }));
}

/**
 * Sharing properties with a customer: goes on their shortlist, is logged on
 * their timeline, and returns the buyer links and a WhatsApp message to send.
 */
export async function shareWithLead(leadId: string, propertyIds: string[], actor: Actor, opts: { origin?: string } = {}) {
  if (!propertyIds.length) throw badRequest('Choose at least one property');
  const lead = await getLeadFor(leadId, actor);
  const props = await Property.find({ _id: { $in: propertyIds }, listing: 'live' }).lean();
  if (props.length !== propertyIds.length) throw badRequest('Only live properties can be shared');
  const links: { id: string; title: string; url: string }[] = [];
  for (const p of props) {
    const token = await ensureShareToken(String(p._id));
    links.push({ id: String(p._id), title: p.title, url: `${opts.origin ?? ''}/p/${token}` });
    const item = lead.shortlist.find((s) => String(s.propertyId) === String(p._id));
    if (!item) lead.shortlist.push({ propertyId: p._id, status: 'shared', at: new Date() });
    else if (item.status === 'suggested') {
      item.status = 'shared';
      item.at = new Date();
    }
  }
  await lead.save();
  const first = lead.name.split(' ')[0];
  const lines = props.map((p) => `• *${p.title}* — ${p.price ? formatINR(p.price) : 'price on request'}${p.locality ? `, ${p.locality}` : ''}\n  ${links.find((l) => l.id === String(p._id))!.url}`);
  const message = `Hi ${first}, as discussed, here ${props.length === 1 ? 'is an option' : `are ${props.length} options`} that fit what you're looking for:\n\n${lines.join('\n\n')}\n\nHappy to arrange a visit at your convenience.`;
  await Activity.create({
    leadId: lead._id,
    type: 'whatsapp',
    status: 'done',
    outcome: `Shared ${props.length} propert${props.length === 1 ? 'y' : 'ies'}`,
    propertyIds: props.map((p) => p._id),
    completedAt: new Date(),
    ownerId: actor.id,
    createdBy: actor.id,
    viaAI: !!actor.viaAI,
  });
  await audit(actor, 'lead', lead._id, 'share', `Shared ${props.map((p) => p.title).join(', ')}`);
  await recomputeNextAction(lead._id);
  return { links, message, phone: lead.phone };
}

/** Mark how the customer felt about a property on their shortlist. */
export async function rateShortlist(leadId: string, propertyId: string, status: 'liked' | 'rejected' | 'shared', actor: Actor) {
  const lead = await getLeadFor(leadId, actor);
  const item = lead.shortlist.find((s) => String(s.propertyId) === propertyId);
  if (item) {
    item.status = status;
    item.at = new Date();
  } else lead.shortlist.push({ propertyId: new mongoose.Types.ObjectId(propertyId), status, at: new Date() });
  await lead.save();
  return lead.toObject();
}

export async function shortlistOf(leadId: string, actor: Actor) {
  const lead = await getLeadFor(leadId, actor);
  const ids = lead.shortlist.map((s) => s.propertyId);
  const props = await Property.find({ _id: { $in: ids } }).lean();
  return lead.shortlist
    .map((s) => ({ status: s.status, at: s.at, property: props.find((p) => String(p._id) === String(s.propertyId)) }))
    .filter((s) => s.property)
    .map((s) => ({ status: s.status, at: s.at, property: serialiseProperty(s.property as never) }));
}

/** For Today: one fresh, strong match per qualified customer who hasn't been sent anything lately. */
export async function bestMatchesToday(actor: Actor) {
  const leads = await Lead.find({ ...leadScope(actor), stage: { $in: ['qualified', 'visit', 'contacted'] } }).sort({ temperature: 1 }).limit(30).lean();
  const out: { lead: { id: string; name: string; summary: string }; property: ReturnType<typeof serialiseProperty>; fit: Fit; reasons: Reason[] }[] = [];
  for (const l of leads) {
    if (!isQualified(l.requirement as never)) continue;
    const m = await matchesForLead(String(l._id), actor, { limit: 1, includeShared: false });
    const top = m.items[0];
    if (top && top.fit !== 'partial') out.push({ lead: { id: String(l._id), name: l.name, summary: PROPERTY_TYPE_LABEL[(l.requirement as Partial<Requirement>).types?.[0] ?? 'apartment'] }, property: top.property, fit: top.fit, reasons: top.reasons });
    if (out.length >= 5) break;
  }
  return out;
}
