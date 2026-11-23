import type mongoose from 'mongoose';
import type { ActivityType } from '@estate/shared';
import { registerSeeder } from '../db/seed';
import { Activity, Lead } from '../models/lead';
import { Property } from '../models/property';
import { recomputeNextAction } from '../services/activities';

/** A believable week: some overdue, a few today, visits coming up, and gaps. */
registerSeeder('activities', async () => {
  const now = Date.now();
  const hoursFromNow = (h: number) => new Date(now + h * 3_600_000);
  const dayAt = (days: number, hour: number, minute = 0) => {
    const d = new Date(now + days * 86_400_000);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const nextSaturday = () => {
    const d = new Date(now);
    d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
    d.setHours(11, 0, 0, 0);
    return d;
  };
  const prop = async (q: Record<string, unknown>, n = 1) => (await Property.find({ listing: 'live', availability: 'available', ...q }).limit(n).select('_id').lean()).map((p) => p._id);

  const plan: [string, ActivityType, Date, string?, (() => Promise<mongoose.Types.ObjectId[]>)?][] = [
    ['Ramesh Krishnan', 'meeting', hoursFromNow(3), 'Price follow-up on A402'],
    ['Lakshmi Narayanan', 'site_visit', nextSaturday(), undefined, () => prop({ title: /Palm Grove/ }, 2)],
    ['Mohammed Irfan', 'call', hoursFromNow(-20), 'Check if B-block brochure helped'],
    ['Sangeetha Raman', 'call', hoursFromNow(1.5), 'Confirm plot budget and location'],
    ['Suresh Kumar', 'call', hoursFromNow(-50), 'Road width answer for Sunrise Enclave'],
    ['Anitha Joseph', 'site_visit', dayAt(1, 11), undefined, () => prop({ locality: 'Sholinganallur' })],
    ['Karthik Subramanian', 'call', dayAt(3, 12), 'Get office size requirement'],
    ['Balaji Rajendran', 'meeting', dayAt(1, 15), 'Counter-offer on plot 26'],
    ['Gopinath Iyer', 'site_visit', dayAt(2, 10, 30), undefined, () => prop({ locality: 'Anna Nagar' })],
    ['Fathima Begum', 'call', hoursFromNow(5), 'Share loan tie-up details'],
    ['Senthil Murugan', 'call', dayAt(4, 17), 'Harvest over — revisit farm land'],
    ['Tarun Agarwal', 'site_visit', dayAt(3, 11), undefined, () => prop({ locality: 'Ambattur' })],
    ['Kavya Prakash', 'task', dayAt(5, 10), 'Collect agreement-for-sale instalment'],
  ];
  for (const [name, type, at, title, props] of plan) {
    const lead = await Lead.findOne({ name }).lean();
    if (!lead) continue;
    const propertyIds = props ? await props() : [];
    await Activity.create({
      leadId: lead._id,
      type,
      status: 'planned',
      title: title ?? (type === 'site_visit' ? 'Site visit' : undefined),
      scheduledAt: at,
      durationMin: type === 'site_visit' ? 60 : type === 'meeting' ? 45 : 15,
      propertyIds,
      ownerId: lead.ownerId,
      createdBy: lead.ownerId,
    });
    if (propertyIds.length) await Lead.updateOne({ _id: lead._id }, { $push: { shortlist: { $each: propertyIds.map((p) => ({ propertyId: p, status: 'shared', at: new Date() })) } } });
    await recomputeNextAction(lead._id);
  }
});
