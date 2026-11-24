import mongoose from 'mongoose';
import { Lead } from '../models/lead';
import { Deal } from '../models/deal';
import { Audit } from '../models/audit';
import { Project, Property } from '../models/property';
import { User } from '../models/user';
import { ImportBatch } from '../models/importBatch';
import { propertyRef } from './properties';

/**
 * Which properties draw interest: direct enquiries, plus how often salespeople
 * shared, showed or negotiated them — so a flat nobody asks for is visible too.
 */
export async function interestByProperty(limit = 10) {
  const [shortlists, deals] = await Promise.all([
    Lead.aggregate<{ _id: mongoose.Types.ObjectId; shared: number; visited: number; liked: number; rejected: number }>([
      { $unwind: '$shortlist' },
      {
        $group: {
          _id: '$shortlist.propertyId',
          shared: { $sum: 1 },
          visited: { $sum: { $cond: [{ $in: ['$shortlist.status', ['visited', 'liked']] }, 1, 0] } },
          liked: { $sum: { $cond: [{ $eq: ['$shortlist.status', 'liked'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$shortlist.status', 'rejected'] }, 1, 0] } },
        },
      },
    ]),
    Deal.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([{ $group: { _id: '$propertyId', n: { $sum: 1 } } }]),
  ]);
  const props = await Property.find({ listing: 'live' }).select('title price locality availability enquiries projectId code').lean();
  const rows = props.map((p) => {
    const s = shortlists.find((x) => String(x._id) === String(p._id));
    const d = deals.find((x) => String(x._id) === String(p._id))?.n ?? 0;
    const enquiries = p.enquiries ?? 0;
    return {
      property: p,
      enquiries,
      shared: s?.shared ?? 0,
      visited: s?.visited ?? 0,
      liked: s?.liked ?? 0,
      rejected: s?.rejected ?? 0,
      deals: d,
      score: enquiries + (s?.shared ?? 0) * 2 + (s?.visited ?? 0) * 3 + d * 5,
    };
  });
  const ranked = rows.sort((a, b) => b.score - a.score);
  const available = ranked.filter((r) => r.property.availability === 'available' && !r.property.projectId);
  return {
    top: ranked.slice(0, limit),
    // Standalone listings that are for sale but nobody is engaging with.
    ignored: available.filter((r) => r.score <= 3).slice(-limit).reverse(),
  };
}

/**
 * How fast each project sells: units booked or sold in the window, and how many
 * months the remaining stock would last at that pace.
 */
export async function projectMovement(days = 90) {
  const since = new Date(Date.now() - days * 86_400_000);
  const projects = await Project.find().lean();
  const out = [];
  for (const pr of projects) {
    const units = await Property.find({ projectId: pr._id, listing: { $ne: 'archived' } }).select('_id availability listing').lean();
    const ids = units.map((u) => u._id);
    const moved = await Audit.countDocuments({ entity: 'property', entityId: { $in: ids }, action: 'availability', summary: /→ (Booked|Sold)/, createdAt: { $gte: since } });
    const available = units.filter((u) => u.listing === 'live' && u.availability === 'available').length;
    const perMonth = moved / (days / 30);
    const monthsOfStock = perMonth ? Math.round((available / perMonth) * 10) / 10 : null;
    const sold = units.filter((u) => u.availability === 'sold' || u.availability === 'booked').length;
    out.push({
      id: String(pr._id),
      name: pr.name,
      locality: pr.locality,
      total: units.length,
      available,
      soldOrBooked: sold,
      movedInWindow: moved,
      perMonth: Math.round(perMonth * 10) / 10,
      monthsOfStock,
      slow: available > 0 && (moved === 0 || (monthsOfStock ?? 0) > 12),
    });
  }
  return { days, projects: out.sort((a, b) => Number(b.slow) - Number(a.slow) || (b.monthsOfStock ?? 999) - (a.monthsOfStock ?? 999)) };
}

export const interestRef = (r: Awaited<ReturnType<typeof interestByProperty>>['top'][number]) => propertyRef(r.property as never);

/**
 * The admin's view of the whole business: stock by state and its value, the
 * people using the app, recent imports and the latest changes anyone made.
 */
export async function adminOverview() {
  const [stock, users, imports, recent] = await Promise.all([
    Property.aggregate<{
      _id: { listing: string; availability: string };
      n: number;
      value: number;
    }>([
      { $match: { listing: { $ne: 'archived' } } },
      {
        $group: {
          _id: { listing: '$listing', availability: '$availability' },
          n: { $sum: 1 },
          value: { $sum: { $ifNull: ['$price', 0] } },
        },
      },
    ]),
    User.find().select('name role active lastLoginAt').sort({ lastLoginAt: -1 }).lean(),
    ImportBatch.aggregate<{
      _id: mongoose.Types.ObjectId;
      fileName?: string;
      sender?: string;
      kind: string;
      status: string;
      counts?: Record<string, number>;
      createdByName?: string;
      createdAt: Date;
      rows: number;
      problems: number;
    }>([
      { $sort: { createdAt: -1 } },
      { $limit: 5 },
      {
        $project: {
          fileName: 1,
          sender: 1,
          kind: 1,
          status: 1,
          counts: 1,
          createdByName: 1,
          createdAt: 1,
          rows: { $size: '$rows' },
          problems: {
            $size: {
              $filter: {
                input: '$rows',
                cond: { $in: ['$$this.status', ['error', 'duplicate']] },
              },
            },
          },
        },
      },
    ]),
    Audit.find().sort({ createdAt: -1 }).limit(8).select('actorName viaAI entity entityId action summary createdAt').lean(),
  ]);

  const live = stock.filter((s) => s._id.listing === 'live');
  const count = (a: string) => live.filter((s) => s._id.availability === a).reduce((t, s) => t + s.n, 0);
  const weekAgo = Date.now() - 7 * 86_400_000;
  return {
    stock: {
      available: count('available'),
      held: count('held'),
      booked: count('booked'),
      sold: count('sold'),
      drafts: stock.filter((s) => s._id.listing === 'draft').reduce((t, s) => t + s.n, 0),
      availableValue: live.filter((s) => s._id.availability === 'available').reduce((t, s) => t + s.value, 0),
    },
    people: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      role: u.role,
      active: u.active !== false,
      lastLoginAt: u.lastLoginAt ?? null,
    })),
    activeThisWeek: users.filter((u) => u.active !== false && u.lastLoginAt && new Date(u.lastLoginAt).getTime() >= weekAgo).length,
    imports: imports.map((b) => ({
      id: String(b._id),
      name: b.fileName || b.sender || 'Import',
      kind: b.kind,
      status: b.status,
      rows: b.rows,
      problems: b.problems,
      counts: b.counts ?? null,
      by: b.createdByName ?? null,
      at: b.createdAt,
    })),
    recent: recent.map((a) => ({
      id: String(a._id),
      who: a.actorName ?? 'Someone',
      viaAI: !!a.viaAI,
      entity: a.entity,
      entityId: String(a.entityId),
      action: a.action,
      summary: a.summary ?? a.action,
      at: a.createdAt,
    })),
  };
}
