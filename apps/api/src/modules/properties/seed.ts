import { registerSeeder } from '../../db/seed';
import { Property } from '../../models/property';
import { createProject, generateUnits, publishReadyUnits } from '../../services/projects';
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
      possessionDate: '2027-12-31',
      description: 'Two towers of 2 and 3 BHK homes, 5 minutes from Porur junction and the upcoming metro.',
      amenities: ['Lift', 'Car parking', 'Power backup', 'Security', 'CCTV', 'Gym', 'Swimming pool', 'Clubhouse', "Children's play area", 'Rainwater harvesting'],
    },
    actor,
  );
  await generateUnits(String(meadows._id), { block: 'A', floorFrom: 1, floorTo: 8, unitsPerFloor: 4, bedrooms: 2, area: 1080, price: 68 * L, floorRise: 50_000, facing: 'East' }, actor);
  await generateUnits(String(meadows._id), { block: 'B', floorFrom: 1, floorTo: 8, unitsPerFloor: 2, bedrooms: 3, area: 1450, price: 92 * L, floorRise: 75_000, facing: 'North' }, actor);
  await publishReadyUnits(String(meadows._id), actor);

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
      description: 'DTCP-approved gated layout with 30 ft and 40 ft blacktop roads, 1.5 km from Guduvanchery station.',
      amenities: ['Gated community', 'Security', 'Garden', 'Corporation water'],
    },
    actor,
  );
  await generateUnits(String(sunrise._id), { block: '', floorFrom: 1, floorTo: 1, unitsPerFloor: 36, area: 1200, price: 36 * L, plotLength: 40, plotWidth: 30, facing: 'East' }, actor);
  await publishReadyUnits(String(sunrise._id), actor);

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
      possessionDate: '2027-06-30',
      amenities: ['Gated community', 'Car parking', 'Power backup', 'Security', 'Clubhouse', 'Garden', 'Solar'],
    },
    actor,
  );
  await generateUnits(String(palm._id), { block: 'V', floorFrom: 1, floorTo: 1, unitsPerFloor: 12, bedrooms: 3, area: 1850, landArea: 1600, price: 1.35 * CR, facing: 'North' }, actor);
  await publishReadyUnits(String(palm._id), actor);

  // Realistic movement: some units already sold, booked or held.
  const mark = async (projectId: unknown, n: number, availability: string) => {
    const units = await Property.find({ projectId, availability: 'available', listing: 'live' }).sort({ unitNumber: 1 }).limit(n);
    for (const u of units) {
      u.availability = availability as 'sold';
      if (availability === 'held') u.heldUntil = new Date(Date.now() + 2 * 86_400_000);
      await u.save();
    }
  };
  await mark(meadows._id, 9, 'sold');
  await mark(meadows._id, 4, 'booked');
  await mark(meadows._id, 1, 'held');
  await mark(sunrise._id, 21, 'sold');
  await mark(sunrise._id, 3, 'booked');
  await mark(palm._id, 1, 'booked');

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
