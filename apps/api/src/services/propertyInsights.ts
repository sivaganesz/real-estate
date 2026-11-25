import mongoose from 'mongoose';
import { ACTIVITY_LABEL, DEAL_STATUS_LABEL, can, type ActivityType, type DealStatus } from '@estate/shared';
import { Audit } from '../models/audit';
import { Activity } from '../models/lead';
import { Deal } from '../models/deal';
import { Property } from '../models/property';
import { getProperty } from './properties';
import type { Actor } from '../lib/auth';

export type HistoryKind = 'details' | 'price' | 'status' | 'documents' | 'photos' | 'buyers' | 'deal';
export type HistoryItem = { id: string; at: Date; kind: HistoryKind; text: string; action?: string; by?: string | null; viaAI?: boolean; leadId?: string };

const AUDIT_KIND: Record<string, HistoryKind> = { create: 'details', update: 'details', listing: 'status', availability: 'status', document: 'documents', verify: 'documents', media: 'photos' };

/**
 * Everything that happened to a property: its own changes, plus what happened
 * with buyers (shares, visits, deals). Executives see buyer events for their
 * own customers only.
 */
export async function propertyHistory(id: string, actor: Actor): Promise<HistoryItem[]> {
  const p = await getProperty(id, actor);
  const all = can(actor.role, 'lead.viewAll');
  const [audits, activities, deals] = await Promise.all([
    Audit.find({ entity: 'property', entityId: p._id }).sort({ createdAt: -1 }).limit(80).lean(),
    Activity.find({ propertyIds: p._id, ...(all ? {} : { ownerId: new mongoose.Types.ObjectId(actor.id) }) })
      .populate('leadId', 'name')
      .populate('ownerId', 'name')
      .sort({ createdAt: -1 })
      .limit(40)
      .lean(),
    Deal.find({ propertyId: p._id }).populate('leadId', 'name ownerId').sort({ createdAt: -1 }).lean(),
  ]);

  const items: HistoryItem[] = [];
  for (const a of audits) {
    const kind = AUDIT_KIND[a.action] === 'details' && /price|₹/i.test(a.summary ?? '') ? 'price' : (AUDIT_KIND[a.action] ?? 'details');
    items.push({ id: String(a._id), at: a.createdAt as Date, kind, text: a.summary ?? a.action, action: a.action, by: a.actorName, viaAI: !!a.viaAI });
  }
  for (const a of activities) {
    const lead = a.leadId as unknown as { _id: unknown; name?: string } | null;
    const owner = (a.ownerId as unknown as { name?: string } | null)?.name ?? null;
    const who = lead?.name ?? 'A customer';
    const label = ACTIVITY_LABEL[a.type as ActivityType] ?? a.type;
    const text =
      a.type === 'site_visit'
        ? a.status === 'planned'
          ? `Site visit with ${who} planned for ${new Date(a.scheduledAt as Date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
          : `${who} visited${a.outcome ? ` · ${a.outcome}` : ''}`
        : a.outcome?.startsWith('Shared')
          ? `Sent to ${who}`
          : `${label} with ${who}${a.title ? `: ${a.title}` : ''}`;
    items.push({ id: String(a._id), at: (a.completedAt ?? a.scheduledAt ?? a.createdAt) as Date, kind: 'buyers', text, by: owner, leadId: lead ? String(lead._id) : undefined });
  }
  for (const d of deals) {
    const lead = d.leadId as unknown as { _id: unknown; name?: string; ownerId?: unknown } | null;
    if (!all && String(lead?.ownerId) !== actor.id) continue;
    const who = lead?.name ?? 'a customer';
    items.push({ id: `${d._id}-start`, at: d.createdAt as Date, kind: 'deal', text: `Negotiation started with ${who} (${d.code})`, leadId: lead ? String(lead._id) : undefined });
    if (d.status !== 'negotiating') items.push({ id: `${d._id}-now`, at: d.updatedAt as Date, kind: 'deal', text: `Deal ${d.code} with ${who}: ${DEAL_STATUS_LABEL[d.status as DealStatus]}`, leadId: lead ? String(lead._id) : undefined });
  }
  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Similar properties in our own records, for a price check: same type and
 * city, for sale, area within 25%, listed or already sold. One unit per
 * project, so a big project doesn't crowd out the rest.
 */
export async function comparables(id: string, actor: Actor) {
  const p = await getProperty(id, actor);
  const rate = p.price && p.areaSqft ? p.price / p.areaSqft : null;
  if (p.purpose !== 'sale' || !p.areaSqft || !p.city) return { rate, items: [], stats: null, verdict: null };
  const query: Record<string, unknown> = {
    _id: { $ne: p._id },
    type: p.type,
    purpose: 'sale',
    city: new RegExp(`^${escapeRx(p.city)}$`, 'i'),
    areaSqft: { $gte: p.areaSqft * 0.75, $lte: p.areaSqft * 1.25 },
    price: { $gt: 0 },
    $or: [{ listing: 'live' }, { availability: { $in: ['booked', 'sold'] } }],
  };
  if (p.projectId) query.projectId = { $ne: p.projectId };
  const docs = await Property.find(query).select('title code locality city price areaSqft availability listing projectId').limit(80).lean();
  const seenProject = new Set<string>();
  const picked = docs
    .sort((a, b) => Math.abs((a.areaSqft ?? 0) - p.areaSqft!) - Math.abs((b.areaSqft ?? 0) - p.areaSqft!))
    .filter((d) => {
      if (!d.projectId) return true;
      const k = String(d.projectId);
      if (seenProject.has(k)) return false;
      seenProject.add(k);
      return true;
    })
    .slice(0, 8);
  const items = picked.map((d) => ({
    id: String(d._id),
    title: d.title,
    code: d.code,
    locality: d.locality,
    price: d.price!,
    areaSqft: d.areaSqft!,
    rate: Math.round(d.price! / d.areaSqft!),
    availability: d.availability,
    open: d.listing === 'live' || can(actor.role, 'property.edit'),
  }));
  if (!items.length) return { rate, items, stats: null, verdict: null };
  const rates = items.map((i) => i.rate).sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)];
  const stats = { min: rates[0], max: rates[rates.length - 1], median, count: rates.length };
  // Neutral words only: "above" or "below", never "bargain" or "overpriced".
  const verdict = rate && rates.length >= 2 ? (Math.abs(rate / median - 1) <= 0.1 ? 'in_line' : rate > median ? 'above' : 'below') : null;
  return { rate: rate ? Math.round(rate) : null, items, stats, verdict };
}
