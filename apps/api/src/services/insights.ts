import mongoose from 'mongoose';
import { Lead } from '../models/lead';
import { Deal } from '../models/deal';
import { Audit } from '../models/audit';
import { Project, Property } from '../models/property';
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
