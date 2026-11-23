import { registerSeeder } from '../../db/seed';
import { Property } from '../../models/property';
import { Audit } from '../../models/audit';
import { createProject } from '../../services/projects';
import { applyLayout, setProjectPublished } from '../../services/projectLayout';
import { createProperty, setListing } from '../../services/properties';
import type { Actor } from '../../lib/auth';

const L = 100_000;
const CR = 10_000_000;

registerSeeder('properties', async ({ users }) => {
  const actor: Actor = { id: String(users.manager._id), name: users.manager.name, role: 'manager' };

  // 1. An apartment project sold block by block
  const meadows = await createProject(
    {
      name: 'Green Meadows',
      type: 'apartment',
      status: 'under_construction',
      city: 'Chennai',
      locality: 'Porur',
      address: 'Mount–Poonamallee Road, Porur, Chennai 600116',
      reraNumber: 'TN/29/Building/0418/2025',
      developer: 'Meadows Builders',
      landAcres: 3.2,
      approvals: ['RERA', 'Bank approved'],
      possessionDate: '2027-12-31',
      description: 'Two towers of 2 and 3 BHK homes, 5 minutes from Porur junction and the upcoming metro.',
      amenities: ['Lift', 'Car parking', 'Power backup', 'Security', 'CCTV', 'Gym', 'Swimming pool', 'Clubhouse', "Children's play area", 'Rainwater harvesting'],
    },
    actor,
  );
  // Tower A mixes 2 and 3 BHKs on every floor; Tower B is all 3 BHK corner flats.
  await applyLayout(
    String(meadows._id),
    {
      flatTypes: [{ type: '2 BHK', area: 1080 }, { type: '3 BHK', area: 1450 }],
      towers: [
        { name: 'Tower A', code: 'A', floors: 8, plan: ['3 BHK', '2 BHK', '2 BHK', '3 BHK'] },
        { name: 'Tower B', code: 'B', floors: 10, plan: ['3 BHK', '2 BHK', '2 BHK', '2 BHK', '3 BHK'] },
      ],
      pricing: { rate: 6300, floorRise: 50 },
    },
    actor,
  );
  await setProjectPublished(String(meadows._id), true, actor);

  // 2. A plotted layout
  const sunrise = await createProject(
    {
      name: 'Sunrise Enclave',
      type: 'plot',
      status: 'ready',
      city: 'Chennai',
      locality: 'Guduvanchery',
      address: 'Off GST Road, Guduvanchery 603202',
      reraNumber: 'TN/01/Layout/0277/2024',
      developer: 'Sunrise Promoters',
      landAcres: 4.5,
      approvals: ['DTCP / CMDA', 'RERA'],
      description: 'DTCP-approved gated layout with 30 ft and 40 ft blacktop roads, 1.5 km from Guduvanchery station.',
      amenities: ['Gated community', 'Security', 'Garden', 'Corporation water'],
    },
    actor,
  );
  const plots = (n: number, w: number, l: number) => Array.from({ length: n }, () => ({ w, l }));
  await applyLayout(
    String(sunrise._id),
    {
      plotBlocks: [
        { name: 'Block A', code: 'A', plots: [{ w: 30, l: 50 }, ...plots(10, 30, 40), { w: 30, l: 50 }] },
        { name: 'Block B', code: 'B', plots: plots(12, 30, 40) },
        { name: 'Block C', code: 'C', plots: plots(12, 30, 40) },
        { name: 'Block D', code: 'D', plots: plots(8, 40, 60) },
      ],
      pricing: { rate: 3000, cornerPct: 5 },
    },
    actor,
  );
  await setProjectPublished(String(sunrise._id), true, actor);

  // 3. Villas
  const palm = await createProject(
    {
      name: 'Palm Grove Villas',
      type: 'villa',
      status: 'under_construction',
      city: 'Chennai',
      locality: 'Medavakkam',
      address: 'Medavakkam–Mambakkam Road, Chennai 600100',
      reraNumber: 'TN/29/Building/0533/2025',
      developer: 'Palm Grove Homes',
      approvals: ['RERA'],
      possessionDate: '2027-06-30',
      amenities: ['Gated community', 'Car parking', 'Power backup', 'Security', 'Clubhouse', 'Garden', 'Solar'],
    },
    actor,
  );
  await applyLayout(
    String(palm._id),
    { plotBlocks: [{ name: 'Row 1', code: 'V', plots: plots(6, 40, 40), bedrooms: 3, builtUp: 1850 }, { name: 'Row 2', code: 'W', plots: plots(6, 40, 40), bedrooms: 3, builtUp: 1850 }], pricing: { rate: 7300, cornerPct: 3 } },
    actor,
  );
  await setProjectPublished(String(palm._id), true, actor);

  // Realistic movement: some units already sold, booked or held.
  // Sales history, spread back over `overDays`, so sales pace per project is real.
  const mark = async (projectId: unknown, n: number, availability: string, overDays = 0) => {
    const units = await Property.find({ projectId, availability: 'available', listing: 'live' }).sort({ unitNumber: 1 }).limit(n);
    for (const [i, u] of units.entries()) {
      u.availability = availability as 'sold';
      if (availability === 'held') u.heldUntil = new Date(Date.now() + 2 * 86_400_000);
      await u.save();
      if (availability === 'sold' || availability === 'booked') {
        const ago = overDays ? Math.round(overDays - (i * overDays) / Math.max(1, units.length)) : 1;
        await Audit.create({ actorId: actor.id, actorName: actor.name, entity: 'property', entityId: u._id, action: 'availability', summary: `Available → ${availability === 'sold' ? 'Sold' : 'Booked'}`, createdAt: new Date(Date.now() - ago * 86_400_000) });
      }
    }
  };
  await mark(meadows._id, 9, 'sold', 240);
  await mark(meadows._id, 4, 'booked', 60);
  await mark(meadows._id, 1, 'held');
  await mark(sunrise._id, 21, 'sold', 300);
  await mark(sunrise._id, 3, 'booked', 45);
  await mark(palm._id, 1, 'booked', 150);

  // Standalone listings: resale homes, land, commercial, a rental.
  const standalone: Parameters<typeof createProperty>[0][] = [
    { type: 'apartment', title: '3 BHK apartment in Anna Nagar West', price: 1.6 * CR, area: 1650, city: 'Chennai', locality: 'Anna Nagar', details: { bedrooms: 3, floor: 4, totalFloors: 6, bathrooms: 3, facing: 'East', furnishing: 'Semi-furnished', parking: 1 }, amenities: ['Lift', 'Car parking', 'Power backup', 'Security'], description: 'Well-kept 3 BHK on the 4th floor, close to Anna Nagar Tower Park and the 2nd Avenue shops. 8 years old, single owner.', highlights: ['Near Tower Park', 'Single owner', 'East facing'] },
    { type: 'apartment', title: '2 BHK near Velachery MRTS', price: 72 * L, area: 1050, city: 'Chennai', locality: 'Velachery', details: { bedrooms: 2, floor: 2, totalFloors: 5, bathrooms: 2, facing: 'North', furnishing: 'Unfurnished', parking: 1 }, amenities: ['Lift', 'Car parking', 'Power backup'], description: '2 BHK a 6-minute walk from Velachery MRTS station and Phoenix Mall.' },
    { type: 'apartment', title: '2 BHK in Sholinganallur, OMR', price: 78 * L, area: 1180, city: 'Chennai', locality: 'Sholinganallur', details: { bedrooms: 2, floor: 7, totalFloors: 14, bathrooms: 2, facing: 'East', furnishing: 'Semi-furnished', parking: 1 }, amenities: ['Lift', 'Car parking', 'Power backup', 'Gym', 'Swimming pool', 'Security'], description: 'High-floor 2 BHK in a gated community on OMR, 10 minutes to the IT corridor.', approvals: [{ name: 'RERA' }] },
    { type: 'apartment', title: '3 BHK sea-side flat in Adyar', price: 2.4 * CR, area: 1800, city: 'Chennai', locality: 'Adyar', details: { bedrooms: 3, floor: 3, totalFloors: 4, bathrooms: 3, facing: 'East', furnishing: 'Fully furnished', parking: 2 }, amenities: ['Lift', 'Car parking', 'Power backup', 'Security', 'Intercom'] },
    { type: 'apartment', title: '2 BHK in Chromepet', price: 55 * L, area: 950, city: 'Chennai', locality: 'Chromepet', details: { bedrooms: 2, floor: 1, totalFloors: 3, bathrooms: 2, facing: 'West' }, amenities: ['Car parking', 'Borewell'] },
    { type: 'apartment', title: '2 BHK resale in Porur', price: 64 * L, area: 1000, city: 'Chennai', locality: 'Porur', details: { bedrooms: 2, floor: 3, totalFloors: 5, bathrooms: 2, facing: 'North-East', parking: 1 }, amenities: ['Lift', 'Car parking', 'Power backup'] },
    { type: 'villa', title: '3 BHK independent house in Medavakkam', price: 1.1 * CR, area: 1900, city: 'Chennai', locality: 'Medavakkam', details: { bedrooms: 3, landArea: 1200, bathrooms: 3, floors: 2, facing: 'South', parking: 1 }, amenities: ['Car parking', 'Borewell', 'Corporation water'] },
    { type: 'plot', title: '2,400 sq.ft plot in Tambaram', price: 54 * L, area: 2400, city: 'Chennai', locality: 'Tambaram', details: { length: 60, width: 40, facing: 'North', roadWidth: 30, approval: 'DTCP' }, approvals: [{ name: 'DTCP' }] },
    { type: 'plot', title: 'Corner plot in Kelambakkam', price: 42 * L, area: 1800, city: 'Chennai', locality: 'Kelambakkam', details: { length: 45, width: 40, facing: 'East', roadWidth: 40, cornerPlot: true } },
    { type: 'agricultural', title: '2.5 acres farm land near Thiruporur', price: 85 * L, area: 2.5, areaUnit: 'acre', city: 'Chennai', locality: 'Thiruporur', details: { waterSource: 'Borewell', roadAccess: true, electricity: true, soilType: 'Red soil' }, extras: [{ label: 'Coconut trees', value: '120 trees, 6 years old' }] },
    { type: 'commercial', title: 'Office space in Guindy', price: 1.8 * CR, area: 1200, city: 'Chennai', locality: 'Guindy', details: { usage: 'Office', floor: 2, washrooms: 2, furnishing: 'Semi-furnished', parking: 2 }, amenities: ['Lift', 'Power backup', 'Security', 'CCTV'] },
    { type: 'industrial', title: 'Factory shed in Ambattur Industrial Estate', price: 2.2 * CR, area: 5000, city: 'Chennai', locality: 'Ambattur', details: { usage: 'Shed', powerKva: 75, roadWidth: 40, clearHeight: 22 } },
    { type: 'apartment', purpose: 'rent', title: '2 BHK for rent in Nungambakkam', price: 38_000, area: 1100, city: 'Chennai', locality: 'Nungambakkam', details: { bedrooms: 2, floor: 2, totalFloors: 4, furnishing: 'Semi-furnished' }, amenities: ['Lift', 'Car parking'] },
    { type: 'apartment', title: '2 BHK in Saravanampatti', price: 48 * L, area: 1020, city: 'Coimbatore', locality: 'Saravanampatti', details: { bedrooms: 2, floor: 2, totalFloors: 4, bathrooms: 2, facing: 'East' }, amenities: ['Lift', 'Car parking', 'Power backup'] },
  ];
  const enquiries = [14, 22, 31, 6, 9, 12, 8, 17, 5, 3, 4, 2, 11, 7];
  for (const [i, s] of standalone.entries()) {
    const p = await createProperty(s, actor);
    await setListing(String(p._id), 'live', actor);
    await Property.updateOne({ _id: p._id }, { enquiries: enquiries[i] ?? 0 });
  }
  // Two drafts still being completed, so the to-do flow has something to show.
  await createProperty({ type: 'villa', title: 'Villa in ECR, Uthandi', city: 'Chennai', locality: 'Uthandi', area: 3200, details: { bedrooms: 4 }, extras: [{ label: 'Owner remark', value: 'Wants quick sale, call after 6 pm', internal: true }] }, actor);
  await createProperty({ type: 'apartment', city: 'Chennai', locality: 'Perungudi', price: 88 * L, area: 1250, details: { bedrooms: 3 } }, actor);
});
