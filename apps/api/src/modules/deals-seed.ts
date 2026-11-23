import { registerSeeder } from '../db/seed';
import { Lead } from '../models/lead';
import { Property } from '../models/property';
import { Deal } from '../models/deal';
import { addOffer, confirmBooking, holdUnit, proposePrice, recordPayment, requestBooking, startDeal } from '../services/deals';
import type { Actor } from '../lib/auth';

const L = 100_000;

/** Deals at every step: negotiating, waiting for approval, waiting for booking, booked with payments. */
registerSeeder('deals', async ({ users }) => {
  const as = (u: { _id: unknown; name: string }, role: Actor['role']): Actor => ({ id: String(u._id), name: u.name, role });
  const manager = as(users.manager, 'manager');
  const priya = as(users.priya, 'executive');
  const arun = as(users.arun, 'executive');
  const lead = async (name: string) => String((await Lead.findOne({ name }).lean())!._id);
  const unit = async (q: Record<string, unknown>) => String((await Property.findOne({ listing: 'live', availability: 'available', ...q }).sort({ unitNumber: -1 }).lean())!._id);

  // Ramesh: haggling on a Green Meadows 2 BHK, unit on hold.
  const r = await startDeal(await lead('Ramesh Krishnan'), await unit({ title: /Green Meadows/, 'details.bedrooms': 2 }), priya, { offer: 66 * L, note: 'Asked for ₹1.5 L off, cites possession delay' });
  await addOffer(String(r._id), { by: 'us', amount: 69 * L, note: 'Offered free car park instead' }, priya);
  await addOffer(String(r._id), { by: 'customer', amount: 67.5 * L }, priya);
  await holdUnit(String(r._id), 3, priya);

  // Balaji: plot price below Arun's limit, waiting for the manager.
  const b = await startDeal(await lead('Balaji Rajendran'), await unit({ title: /Sunrise Enclave/ }), arun, { offer: 34 * L, note: 'Cash buyer, wants plot near the park' });
  await holdUnit(String(b._id), 5, arun);
  await proposePrice(String(b._id), { price: 34.5 * L, note: 'Cash, can register within 30 days' }, arun);

  // Anitha: agreed at list price, booking amount received, waiting for confirmation.
  const a = await startDeal(await lead('Anitha Joseph'), await unit({ locality: 'Sholinganallur' }), arun);
  await proposePrice(String(a._id), { price: 78 * L }, arun);
  await requestBooking(String(a._id), { amount: 2 * L, mode: 'NEFT / RTGS', reference: 'HDFC N-88231' }, arun);

  // Kavya and Abdul: booked, payments under way.
  const k = await startDeal(await lead('Kavya Prakash'), await unit({ title: /Green Meadows/, 'details.bedrooms': 3 }), manager);
  await proposePrice(String(k._id), { price: 94 * L }, manager);
  await confirmBooking(String(k._id), { amount: 9.4 * L, mode: 'Cheque', reference: 'SBI 004512', date: new Date(Date.now() - 5 * 86_400_000) }, manager);
  await recordPayment(String(k._id), 1, { reference: 'Loan disbursal 1' }, manager);

  const ab = await startDeal(await lead('Abdul Rahman'), await unit({ title: /Sunrise Enclave/ }), manager);
  await proposePrice(String(ab._id), { price: 35.5 * L }, manager);
  await confirmBooking(String(ab._id), { amount: 2 * L, mode: 'UPI', reference: 'UPI 3381', date: new Date(Date.now() - 15 * 86_400_000) }, manager);
  // Move his agreement payment into the past so something is overdue.
  await Deal.updateOne({ _id: ab._id }, { $set: { 'payments.1.dueDate': new Date(Date.now() - 2 * 86_400_000) } });
});
