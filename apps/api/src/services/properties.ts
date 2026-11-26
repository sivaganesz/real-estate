import crypto from 'node:crypto';
import mongoose, { type FilterQuery } from 'mongoose';
import { advertisedPlaces, serialisePlace } from './neighbourhood';
import {
  AVAILABILITY_LABEL,
  LISTING_LABEL,
  PROPERTY_TYPE_LABEL,
  PropertyInput,
  can,
  formatINR,
  propertyReadiness,
  suggestTitle,
  toSqft,
  type Availability,
  type PropertyType,
} from '@estate/shared';
import { Property, nextCode, type PropertyDoc } from '../models/property';
import { audit, assertCan, type Actor } from '../lib/auth';
import { HttpError, badRequest, notFound } from '../lib/http';
import type { RecordRef } from '../ai/tools';

const PREFIX: Record<PropertyType, string> = { apartment: 'APT', villa: 'VIL', plot: 'PLT', commercial: 'COM', agricultural: 'AGR', industrial: 'IND' };

export type PropertyFilters = {
  q?: string;
  /** Only listings that are not units of a project. */
  standalone?: boolean;
  types?: PropertyType[];
  purpose?: 'sale' | 'rent' | 'lease';
  budgetMin?: number;
  budgetMax?: number;
  city?: string;
  localities?: string[];
  bedrooms?: number;
  bedroomsMin?: number;
  areaMin?: number;
  areaMax?: number;
  availability?: Availability[];
  listing?: ('draft' | 'live' | 'archived')[];
  projectId?: string;
  amenities?: string[];
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'updated';
  limit?: number;
  skip?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serialiseProperty(p: Record<string, any>): Record<string, any> & { id: string; readiness: ReturnType<typeof propertyReadiness> } {
  const { _id, __v, shareToken, ...rest } = p;
  void __v;
  void shareToken;
  const readiness = propertyReadiness(rest as Parameters<typeof propertyReadiness>[0]);
  return { id: String(_id), ...rest, projectId: rest.projectId ? String(rest.projectId) : null, nearby: (rest.nearby ?? []).map(serialisePlace), readiness };
}

export function propertyRef(p: { _id: unknown; title: string; price?: number | null; locality?: string | null; availability?: string | null; code?: string | null }): RecordRef {
  const bits = [p.price ? formatINR(p.price) : null, p.locality, p.availability && p.availability !== 'available' ? AVAILABILITY_LABEL[p.availability as Availability] : null].filter(Boolean);
  return { kind: 'property', id: String(p._id), title: p.title, subtitle: bits.join(' · ') };
}

/** Holds lapse on their own: a lapsed hold is released the next time anyone reads inventory. */
export async function releaseExpiredHolds() {
  await Property.updateMany({ availability: 'held', heldUntil: { $lt: new Date() } }, { $set: { availability: 'available' }, $unset: { heldUntil: 1, heldFor: 1 } });
}

function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildPropertyQuery(f: PropertyFilters, actor: Actor): FilterQuery<PropertyDoc> {
  const q: FilterQuery<PropertyDoc> = {};
  // Executives work with what can be offered; drafts are the managers' workspace.
  if (!can(actor.role, 'property.edit')) q.listing = 'live';
  else if (f.listing?.length) q.listing = { $in: f.listing };
  else q.listing = { $ne: 'archived' };
  if (f.standalone) q.projectId = null;
  if (f.types?.length) q.type = { $in: f.types };
  if (f.purpose) q.purpose = f.purpose;
  if (f.budgetMin || f.budgetMax) q.price = { ...(f.budgetMin ? { $gte: f.budgetMin } : {}), ...(f.budgetMax ? { $lte: f.budgetMax } : {}) };
  if (f.city) q.city = new RegExp(`^${escapeRx(f.city)}$`, 'i');
  if (f.localities?.length) q.locality = { $in: f.localities.map((l) => new RegExp(escapeRx(l), 'i')) };
  if (f.bedrooms) q['details.bedrooms'] = f.bedrooms;
  if (f.bedroomsMin) q['details.bedrooms'] = { $gte: f.bedroomsMin };
  if (f.areaMin || f.areaMax) q.areaSqft = { ...(f.areaMin ? { $gte: f.areaMin } : {}), ...(f.areaMax ? { $lte: f.areaMax } : {}) };
  if (f.availability?.length) q.availability = { $in: f.availability };
  if (f.projectId) q.projectId = new mongoose.Types.ObjectId(f.projectId);
  if (f.amenities?.length) q.amenities = { $all: f.amenities };
  if (f.q?.trim()) {
    const rx = new RegExp(escapeRx(f.q.trim()), 'i');
    q.$or = [{ title: rx }, { code: rx }, { locality: rx }, { city: rx }, { 'extras.value': rx }, { description: rx }, { unitNumber: rx }];
  }
  return q;
}

export async function searchProperties(f: PropertyFilters, actor: Actor) {
  await releaseExpiredHolds();
  const query = buildPropertyQuery(f, actor);
  const sort: Record<string, 1 | -1> =
    f.sort === 'price_asc' ? { price: 1 } : f.sort === 'price_desc' ? { price: -1 } : f.sort === 'updated' ? { updatedAt: -1 } : { createdAt: -1 };
  const limit = Math.min(f.limit ?? 60, 200);
  const [items, total] = await Promise.all([
    Property.find(query).sort(sort).skip(f.skip ?? 0).limit(limit).lean(),
    Property.countDocuments(query),
  ]);
  return { items: items.map(serialiseProperty), total };
}

export async function getProperty(id: string, actor: Actor) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Property');
  await releaseExpiredHolds();
  const p = await Property.findById(id).lean();
  if (!p) throw notFound('Property');
  if (p.listing !== 'live' && !can(actor.role, 'property.edit')) throw notFound('Property');
  return p;
}

function normalise(input: PropertyInput) {
  const out: Record<string, unknown> = { ...input };
  if (input.area) out.areaSqft = toSqft(input.area, input.areaUnit ?? 'sqft');
  if (!input.title) out.title = suggestTitle(input);
  if (input.pincode === '') out.pincode = null;
  // Plots: if length and width are known but area is not, the area follows.
  const d = input.details ?? {};
  if (input.type === 'plot' && !input.area && Number(d.length) > 0 && Number(d.width) > 0) {
    out.area = Number(d.length) * Number(d.width);
    out.areaUnit = 'sqft';
    out.areaSqft = out.area;
  }
  return out;
}

/** Same unit in the same project, or a near-identical listing in the same locality. */
export async function findDuplicates(input: Partial<PropertyInput> & { type: PropertyType }, excludeId?: string) {
  const ors: FilterQuery<PropertyDoc>[] = [];
  if (input.projectId && input.unitNumber) ors.push({ projectId: input.projectId, block: input.block ?? null, unitNumber: input.unitNumber });
  if (input.locality && input.price && input.area) {
    ors.push({
      type: input.type,
      locality: new RegExp(`^${escapeRx(input.locality)}$`, 'i'),
      price: { $gte: input.price * 0.95, $lte: input.price * 1.05 },
      area: { $gte: input.area * 0.98, $lte: input.area * 1.02 },
    });
  }
  if (!ors.length) return [];
  const found = await Property.find({ $or: ors, listing: { $ne: 'archived' }, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).limit(5).lean();
  return found.map(propertyRef);
}

export async function createProperty(raw: unknown, actor: Actor, opts: { allowDuplicate?: boolean; importBatchId?: unknown } = {}) {
  assertCan(actor, 'property.create', 'Only sales managers and admins add properties');
  const input = PropertyInput.parse(raw);
  if (!opts.allowDuplicate) {
    const duplicates = await findDuplicates(input);
    if (duplicates.length) throw new HttpError(409, 'This looks like a property that already exists', { duplicates });
  }
  const data = normalise(input);
  const p = await Property.create({ ...data, code: await nextCode(PREFIX[input.type]), createdBy: actor.id, listing: 'draft', importBatchId: opts.importBatchId });
  await audit(actor, 'property', p._id, 'create', `Created ${p.title}${actor.viaAI ? ' with the assistant' : ''}`);
  return p.toObject();
}

export async function updateProperty(id: string, raw: Record<string, unknown>, actor: Actor) {
  assertCan(actor, 'property.edit');
  const p = await Property.findById(id);
  if (!p) throw notFound('Property');
  const merged = { ...p.toObject(), ...raw, details: { ...(p.details ?? {}), ...((raw.details as object) ?? {}) } };
  const input = PropertyInput.parse({
    ...merged,
    projectId: merged.projectId ? String(merged.projectId) : null,
    sources: { ...(p.sources ?? {}), ...((raw.sources as object) ?? {}) },
  });
  const data = normalise(input);
  // An edit keeps each approval's document and verified mark; only the verify step can mark it.
  const before = new Map((p.approvals ?? []).map((a) => [a.name, a]));
  data.approvals = input.approvals.map((a) => {
    const old = before.get(a.name);
    const documentUrl = a.documentUrl ?? old?.documentUrl ?? null;
    return { name: a.name, documentUrl, verified: !!old?.verified && documentUrl === old?.documentUrl };
  });
  if (p.listing === 'live') {
    const r = propertyReadiness(data as Parameters<typeof propertyReadiness>[0]);
    if (!r.ready) throw badRequest(`A live property needs: ${r.missing.map((m) => m.label).join(', ')}`);
  }
  const changes: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) {
    const before = (p as unknown as Record<string, unknown>)[k];
    if (JSON.stringify(before) !== JSON.stringify(data[k])) changes[k] = { from: before ?? null, to: data[k] ?? null };
  }
  p.set(data);
  await p.save();
  if (Object.keys(changes).length) {
    const summary = changes.price ? `Price changed from ${formatINR(changes.price && (changes.price as { from: number }).from)} to ${formatINR(p.price)}` : `Updated ${Object.keys(changes).join(', ')}`;
    await audit(actor, 'property', p._id, 'update', summary, changes);
  }
  return p.toObject();
}

export async function setListing(id: string, to: 'draft' | 'live' | 'archived', actor: Actor) {
  assertCan(actor, to === 'live' ? 'property.publish' : 'property.edit');
  const p = await Property.findById(id);
  if (!p) throw notFound('Property');
  if (p.listing === to) return p.toObject();
  if (to === 'live') {
    const r = propertyReadiness(p.toObject() as Parameters<typeof propertyReadiness>[0]);
    if (!r.ready) throw badRequest(`Before it goes live, add: ${r.missing.map((m) => m.label).join(', ')}`, { missing: r.missing });
    p.publishedAt ??= new Date();
  }
  const from = p.listing;
  p.listing = to;
  await p.save();
  await audit(actor, 'property', p._id, 'listing', `${LISTING_LABEL[from]} → ${LISTING_LABEL[to]}`);
  return p.toObject();
}

export async function setAvailability(
  id: string,
  to: Availability,
  actor: Actor,
  opts: { reason?: string; heldUntil?: Date; leadId?: string; system?: boolean } = {},
) {
  if (!opts.system) assertCan(actor, 'property.availability');
  const p = await Property.findById(id);
  if (!p) throw notFound('Property');
  if (p.listing !== 'live' && to !== 'available') throw badRequest('Only a live property can be held, booked or sold');
  if (!opts.system && (to === 'booked' || to === 'sold') && !opts.reason) {
    throw badRequest('Bookings normally come from a deal. To mark it by hand, give a reason.');
  }
  const from = p.availability;
  p.availability = to;
  if (to === 'held') {
    p.heldUntil = opts.heldUntil ?? new Date(Date.now() + 3 * 86_400_000);
    if (opts.leadId) p.heldFor = new mongoose.Types.ObjectId(opts.leadId);
  } else {
    p.heldUntil = undefined;
    p.heldFor = undefined;
  }
  await p.save();
  await audit(actor, 'property', p._id, 'availability', `${AVAILABILITY_LABEL[from]} → ${AVAILABILITY_LABEL[to]}${opts.reason ? ` (${opts.reason})` : ''}`);
  return p.toObject();
}

export async function ensureShareToken(id: string) {
  const p = await Property.findById(id);
  if (!p) throw notFound('Property');
  if (p.listing !== 'live') throw badRequest('Only live properties can be shared with buyers');
  if (!p.shareToken) {
    p.shareToken = crypto.randomBytes(9).toString('base64url');
    await p.save();
  }
  return p.shareToken;
}

/** What a buyer may see. Never: internal extras, documents, owner notes, holds, codes of other units. */
export async function publicProperty(token: string) {
  const p = await Property.findOne({ shareToken: token, listing: 'live' }).lean();
  if (!p) throw notFound('Property');
  return {
    title: p.title,
    type: p.type,
    typeLabel: PROPERTY_TYPE_LABEL[p.type as PropertyType],
    purpose: p.purpose,
    price: p.price,
    priceNegotiable: p.priceNegotiable,
    area: p.area,
    areaUnit: p.areaUnit,
    city: p.city,
    locality: p.locality,
    details: p.details,
    extras: (p.extras ?? []).filter((e) => !e.internal).map(({ label, value }) => ({ label, value })),
    amenities: p.amenities,
    description: p.description,
    highlights: p.highlights,
    media: p.media,
    approvals: (p.approvals ?? []).filter((a) => a.documentUrl).map((a) => ({ name: a.name, verified: !!a.verified })),
    availability: p.availability === 'available' ? 'available' : 'unavailable',
    nearby: advertisedPlaces(p.nearby),
  };
}

/**
 * How many listings sit in each state for the same search, for the status tabs.
 * Live listings count by availability; drafts and archived only for those who can edit.
 */
export async function statusCounts(f: PropertyFilters, actor: Actor) {
  const base = buildPropertyQuery({ ...f, availability: undefined, listing: undefined }, actor);
  const editor = can(actor.role, 'property.edit');
  const [byAvailability, draft, archived] = await Promise.all([
    Property.aggregate<{ _id: Availability; n: number }>([{ $match: { ...base, listing: 'live' } }, { $group: { _id: '$availability', n: { $sum: 1 } } }]),
    editor ? Property.countDocuments({ ...base, listing: 'draft' }) : Promise.resolve(0),
    editor ? Property.countDocuments({ ...base, listing: 'archived' }) : Promise.resolve(0),
  ]);
  const live = (a: Availability) => byAvailability.find((x) => x._id === a)?.n ?? 0;
  const counts = { available: live('available'), held: live('held'), booked: live('booked'), sold: live('sold'), draft, archived };
  return { ...counts, all: counts.available + counts.held + counts.booked + counts.sold + draft };
}
