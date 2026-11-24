import type mongoose from 'mongoose';
import type { ActivityType } from '@estate/shared';
import { registerSeeder } from '../db/seed';
import { Activity, Lead } from '../models/lead';
import { Property } from '../models/property';
import { recomputeNextAction } from '../services/activities';

/** A believable week: a few done, some overdue, a few today, meetings and visits coming up, and gaps. */
registerSeeder('activities', async () => {
  const now = Date.now();
  const hoursFromNow = (h: number) => new Date(now + h * 3_600_000);
  const dayAt = (days: number, hour: number, minute = 0) => {
    const d = new Date(now + days * 86_400_000);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  /** Today at office hours when that's still ahead; otherwise a little later today, so it stays "today". */
  const todayAt = (hour: number, minute: number, fallbackHours: number) => {
    const d = dayAt(0, hour, minute);
    return d.getTime() > now ? d : hoursFromNow(fallbackHours);
  };
  const nextSaturday = () => {
    const d = new Date(now);
    d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7));
    d.setHours(11, 0, 0, 0);
    return d;
  };
  const prop = async (q: Record<string, unknown>, n = 1) => (await Property.find({ listing: 'live', availability: 'available', ...q }).limit(n).select('_id').lean()).map((p) => p._id);

  type Plan = [name: string, type: ActivityType, at: Date, title?: string, props?: () => Promise<mongoose.Types.ObjectId[]>, done?: string];
  const plan: Plan[] = [
    // Done earlier this week.
    ['Balaji Rajendran', 'meeting', dayAt(-2, 11), 'Plot measurement walk at Sunrise Enclave', undefined, 'Walked plot 26 with him; wants corner plot price.'],
    ['Gopinath Iyer', 'call', dayAt(-1, 12), 'Share Anna Nagar options', undefined, 'Sent three options; family to visit on Friday.'],
    ['Lakshmi Narayanan', 'call', dayAt(-1, 16), 'Confirm the Saturday visit', undefined, 'Confirmed. Coming with parents.'],
    ['Abdul Rahman', 'meeting', dayAt(-1, 11), 'Hand over the booking receipt', undefined, 'Receipt handed over; reminded him the agreement instalment is due.'],
    ['Ramesh Krishnan', 'meeting', dayAt(-2, 15), 'Walk through the Green Meadows clubhouse', undefined, 'Liked the amenities; still wants ₹1.5 L off.'],
    // Priya's week: meetings with her customers.
    ['Abdul Rahman', 'meeting', todayAt(13, 0, 2), 'Explain the payment plan to his family'],
    ['Abdul Rahman', 'meeting', dayAt(1, 11), 'Collect the agreement-for-sale cheque'],
    ['Ramesh Krishnan', 'meeting', dayAt(1, 16), 'Second look at B904 with his wife'],
    ['Lakshmi Narayanan', 'meeting', dayAt(3, 11), 'Compare Palm Grove villa floor plans'],
    ['Abdul Rahman', 'meeting', dayAt(3, 17), 'Go through the registration documents'],
    ['Ramesh Krishnan', 'meeting', dayAt(5, 12), 'Meet at the bank for the home loan'],
    ['Lakshmi Narayanan', 'meeting', dayAt(6, 17), 'Talk through the villa payment schedule'],
    // Overdue.
    ['Mohammed Irfan', 'call', dayAt(-1, 17), 'Check if B-block brochure helped'],
    ['Suresh Kumar', 'call', dayAt(-2, 12), 'Road width answer for Sunrise Enclave'],
    // Today.
    ['Sangeetha Raman', 'call', todayAt(11, 30, 1.5), 'Confirm plot budget and location'],
    ['Ramesh Krishnan', 'meeting', todayAt(16, 0, 3), 'Price follow-up on A402'],
    ['Fathima Begum', 'call', todayAt(17, 30, 5), 'Share loan tie-up details'],
    // The rest of the week.
    ['Tarun Agarwal', 'meeting', dayAt(1, 10), 'Discuss factory shed layout'],
    ['Anitha Joseph', 'site_visit', dayAt(1, 11), undefined, () => prop({ locality: 'Sholinganallur' })],
    ['Balaji Rajendran', 'meeting', dayAt(1, 15), 'Counter-offer on plot 26'],
    ['Senthil Murugan', 'meeting', dayAt(1, 17, 30), 'Go through the farm land survey papers'],
    ['Gopinath Iyer', 'site_visit', dayAt(2, 10, 30), undefined, () => prop({ locality: 'Anna Nagar' })],
    ['Anitha Joseph', 'meeting', dayAt(2, 12), 'Booking paperwork at the office'],
    ['Arjun Mehta', 'meeting', dayAt(2, 16), 'Meet the landlord on rental terms'],
    ['Lakshmi Narayanan', 'meeting', dayAt(2, 18), 'Villa options over coffee with the family'],
    ['Fathima Begum', 'meeting', dayAt(3, 10, 30), 'Bank meeting for the loan sanction'],
    ['Tarun Agarwal', 'site_visit', dayAt(3, 11), undefined, () => prop({ locality: 'Ambattur' })],
    ['Karthik Subramanian', 'call', dayAt(3, 12), 'Get office size requirement'],
    ['Suresh Kumar', 'meeting', dayAt(3, 16), 'Meet at the Sunrise Enclave site office'],
    ['Gopinath Iyer', 'meeting', dayAt(4, 11), 'Family meeting to finalise the shortlist'],
    ['Ramesh Krishnan', 'meeting', dayAt(4, 15), 'Bring the revised offer for A402'],
    ['Senthil Murugan', 'call', dayAt(4, 17), 'Harvest over — revisit farm land'],
    ['Karthik Subramanian', 'meeting', dayAt(5, 15), 'Office space walkthrough with his partners'],
    ['Kavya Prakash', 'task', dayAt(5, 10), 'Collect agreement-for-sale instalment'],
    ['Lakshmi Narayanan', 'site_visit', nextSaturday(), undefined, () => prop({ title: /Palm Grove/ }, 2)],
  ];
  for (const [name, type, at, title, props, done] of plan) {
    const lead = await Lead.findOne({ name }).lean();
    if (!lead) continue;
    const propertyIds = props ? await props() : [];
    await Activity.create({
      leadId: lead._id,
      type,
      status: done ? 'done' : 'planned',
      title: title ?? (type === 'site_visit' ? 'Site visit' : undefined),
      scheduledAt: at,
      completedAt: done ? at : undefined,
      notes: done,
      durationMin: type === 'site_visit' ? 60 : type === 'meeting' ? 45 : 15,
      propertyIds,
      ownerId: lead.ownerId,
      createdBy: lead.ownerId,
    });
    if (propertyIds.length) await Lead.updateOne({ _id: lead._id }, { $push: { shortlist: { $each: propertyIds.map((p) => ({ propertyId: p, status: 'shared', at: new Date() })) } } });
    await recomputeNextAction(lead._id);
  }
});
