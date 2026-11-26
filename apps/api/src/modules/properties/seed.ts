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
    { type: 'apartment', title: '3 BHK apartment in Anna Nagar West', price: 1.6 * CR, area: 1650, city: 'Chennai', locality: 'Anna Nagar', details: { bedrooms: 3, floor: 4, totalFloors: 6, bathrooms: 3, facing: 'East', furnishing: 'Semi-furnished', parking: 1, carpetArea: 1320, superBuiltUpArea: 1650, uds: 610, lifts: 1, maintenance: 4500, possession: 'Ready to move', expectedPossession: 'Immediate' }, amenities: ['Lift', 'Car parking', 'Power backup', 'Security'], description:
        'Well-kept 3 BHK on the 4th floor, close to Anna Nagar Tower Park and the 2nd Avenue shops. 8 years old, single owner.\n\nThe living and dining area opens onto an east-facing balcony that gets the morning sun, and all three bedrooms have attached bathrooms. The kitchen has a granite counter, modular cabinets and a separate utility area. Wardrobes in every bedroom stay with the flat.\n\nThe building has 6 floors with one lift, a covered car park for this flat, power backup for common areas and the lift, and a 24-hour watchman. Corporation water plus a borewell; no water problems in summer. Schools, Anna Nagar Arch, the metro station and hospitals are all within 2 km.\n\nThe owner is moving abroad and wants to close within 60 days. Documents are clear and the flat can be shown on weekends.', highlights: ['Near Tower Park', 'Single owner', 'East facing'] },
    { type: 'apartment', title: '2 BHK near Velachery MRTS', price: 72 * L, area: 1050, city: 'Chennai', locality: 'Velachery', details: { bedrooms: 2, floor: 2, totalFloors: 5, bathrooms: 2, facing: 'North', furnishing: 'Unfurnished', parking: 1, carpetArea: 840, lifts: 1 }, amenities: ['Lift', 'Car parking', 'Power backup'], description: "2 BHK a 6-minute walk from Velachery MRTS station and Phoenix Mall. It is on the 2nd floor of a 5-floor building: 1,050 sq.ft (840 sq.ft carpet), north facing, with 2 bathrooms. Unfurnished, so it's ready for your own interiors. One car park, a lift and power backup." },
    { type: 'apartment', title: '2 BHK in Sholinganallur, OMR', price: 78 * L, area: 1180, city: 'Chennai', locality: 'Sholinganallur', details: { bedrooms: 2, floor: 7, totalFloors: 14, bathrooms: 2, facing: 'East', furnishing: 'Semi-furnished', parking: 1, carpetArea: 920, superBuiltUpArea: 1180, lifts: 3, maintenance: 3800, possession: 'Ready to move' }, amenities: ['Lift', 'Car parking', 'Power backup', 'Gym', 'Swimming pool', 'Security'], description: "High-floor 2 BHK in a gated community on OMR, 10 minutes to the IT corridor. It is on the 7th of 14 floors, east facing, with 1,180 sq.ft super built-up (920 sq.ft carpet). Semi-furnished, with 2 bathrooms and one car park. The community has 3 lifts, a gym, a swimming pool, power backup and security. Ready to move in; maintenance is about ₹3,800 a month. RERA registered.", approvals: [{ name: 'RERA' }] },
    { type: 'apartment', title: '3 BHK sea-side flat in Adyar', description: "Fully furnished 3 BHK on the 3rd floor of a 4-floor building in Adyar. 1,800 sq.ft, east facing, with 3 bathrooms and 2 car parks. The building has a lift, power backup, security and an intercom.\n\nElliot's Beach in Besant Nagar is a 5-minute drive away, and Adyar's shops, banks, schools and hospitals are close by. The furniture stays: wardrobes, beds, a dining set, sofas and air conditioners in all three bedrooms. A quiet, low-rise building with only 8 flats.", price: 2.4 * CR, area: 1800, city: 'Chennai', locality: 'Adyar', details: { bedrooms: 3, floor: 3, totalFloors: 4, bathrooms: 3, facing: 'East', furnishing: 'Fully furnished', parking: 2 }, amenities: ['Lift', 'Car parking', 'Power backup', 'Security', 'Intercom'] },
    { type: 'apartment', title: '2 BHK in Chromepet', description: "2 BHK on the 1st floor of a 3-floor building in Chromepet. 950 sq.ft, west facing, with 2 bathrooms. Car parking and a borewell for water.\n\nA short walk to Chromepet railway station and the GST Road buses, with schools, markets and hospitals nearby. Priced for a first home, and easy to rent out.", price: 55 * L, area: 950, city: 'Chennai', locality: 'Chromepet', details: { bedrooms: 2, floor: 1, totalFloors: 3, bathrooms: 2, facing: 'West' }, amenities: ['Car parking', 'Borewell'] },
    { type: 'apartment', title: '2 BHK resale in Porur', description: "Resale 2 BHK on the 3rd floor of a 5-floor building in Porur. 1,000 sq.ft, north-east facing, with 2 bathrooms and one car park. The building has a lift and power backup.\n\nPorur junction and the upcoming metro line are close by, and the IT parks on Mount–Poonamallee Road are a short drive away. The flat is well kept, with fresh paint and new bathroom fittings, and can be shown on weekends.", price: 64 * L, area: 1000, city: 'Chennai', locality: 'Porur', details: { bedrooms: 2, floor: 3, totalFloors: 5, bathrooms: 2, facing: 'North-East', parking: 1 }, amenities: ['Lift', 'Car parking', 'Power backup'] },
    { type: 'villa', title: '3 BHK independent house in Medavakkam', description: "Independent house in Medavakkam, built in 2016 and in good condition. 1,900 sq.ft built up over 2 floors on a 1,200 sq.ft plot, south facing. 3 bedrooms, 3 bathrooms and one car park; unfurnished. Municipal water plus a borewell, EB with inverter backup, and a small front garden with two coconut trees.", price: 1.1 * CR, area: 1900, city: 'Chennai', locality: 'Medavakkam', details: { bedrooms: 3, landArea: 1200, bathrooms: 3, floors: 2, facing: 'South', furnishing: 'Unfurnished', parking: 1, houseType: 'Independent house', constructionYear: 2016, constructionQuality: 'Standard', condition: 'Good', waterSupply: 'Municipal + borewell', powerArrangement: 'EB + inverter', garden: 'Small front garden with two coconut trees' }, amenities: ['Car parking', 'Borewell', 'Corporation water'] },
    { type: 'plot', title: '2,400 sq.ft plot in Tambaram', description: "Level 60 × 40 ft residential plot (2,400 sq.ft) in a DTCP-approved layout in Tambaram (approval no. 245/2024). North facing, on a 30 ft tar layout road. Survey no. 112/3B, plot 14. Municipal water and a borewell, electricity at the site and underground drainage, so building can start straight away.", price: 54 * L, area: 2400, city: 'Chennai', locality: 'Tambaram', details: { length: 60, width: 40, facing: 'North', roadWidth: 30, roadType: 'Layout road', roadSurface: 'Tar road', cornerPlot: false, topography: 'Level', surveyNumber: '112/3B', subdivision: 'Plot 14', approval: 'DTCP (no. 245/2024)', landUse: 'Residential', waterSupply: 'Municipal + borewell', powerSupply: 'Available at site', drainage: 'Underground drainage' }, approvals: [{ name: 'DTCP' }] },
    { type: 'plot', title: 'Corner plot in Kelambakkam', description: "East-facing corner plot in Kelambakkam, 45 × 40 ft (1,800 sq.ft), on a 40 ft public road. Level land, zoned residential. Being on a corner gives the house more light and a wider frontage.\n\nKelambakkam is on OMR, close to the Siruseri IT park and the colleges along the corridor. Corner plots on a 40 ft road are rare here and suit an independent house with a car porch on the side road.", price: 42 * L, area: 1800, city: 'Chennai', locality: 'Kelambakkam', details: { length: 45, width: 40, facing: 'East', roadWidth: 40, roadType: 'Public road', cornerPlot: true, topography: 'Level', landUse: 'Residential' } },
    { type: 'agricultural', title: '2.5 acres farm land near Thiruporur', description: "2.5 acres of red-soil farm land near Thiruporur on a gentle slope, survey no. 58/2A. Borewell water, an EB connection and road access. About 120 coconut trees, 6 years old, are already on the land.", price: 85 * L, area: 2.5, areaUnit: 'acre', city: 'Chennai', locality: 'Thiruporur', details: { waterSource: 'Borewell', roadAccess: true, electricity: true, soilType: 'Red soil', surveyNumber: '58/2A', topography: 'Gentle slope' }, extras: [{ label: 'Coconut trees', value: '120 trees, 6 years old' }] },
    { type: 'commercial', title: 'Office space in Guindy', description: "Semi-furnished office on the 2nd floor in Guindy: 1,200 sq.ft with a 35 ft frontage, north facing. 2 washrooms and 2 car parks; the building has a lift, power backup, security and CCTV. It is tenanted at ₹1,10,000 a month on a 3-year lease from April 2025, so it earns from day one. Maintenance is ₹9,000 a month.", price: 1.8 * CR, area: 1200, city: 'Chennai', locality: 'Guindy', details: { usage: 'Office', floor: 2, washrooms: 2, frontage: 35, furnishing: 'Semi-furnished', parking: 2, facing: 'North', occupancy: 'Tenanted', rentalIncome: 110000, maintenance: 9000, leaseDuration: '3 years, from Apr 2025' }, amenities: ['Lift', 'Power backup', 'Security', 'CCTV'] },
    { type: 'industrial', title: 'Factory shed in Ambattur Industrial Estate', description: "5,000 sq.ft factory shed in Ambattur Industrial Estate with a 22 ft clear height and a 75 kVA power connection. It is on a 40 ft road with truck access for loading and unloading.\n\nAmbattur Industrial Estate has quick road links to the Outer Ring Road and Chennai port. The shed suits light manufacturing, an assembly line or a warehouse, and the estate has its own security at the gates.", price: 2.2 * CR, area: 5000, city: 'Chennai', locality: 'Ambattur', details: { usage: 'Shed', powerKva: 75, roadWidth: 40, clearHeight: 22, truckAccess: true } },
    { type: 'apartment', purpose: 'rent', title: '2 BHK for rent in Nungambakkam', description: "Semi-furnished 2 BHK for rent on the 2nd floor of a 4-floor building in Nungambakkam. 1,100 sq.ft, with a lift and car parking. Rent is ₹38,000 a month.\n\nA central address, close to offices, schools, hospitals and the shops on Khader Nawaz Khan Road. The flat has wardrobes, a modular kitchen and fans and lights in every room. Family tenants preferred.", price: 38_000, area: 1100, city: 'Chennai', locality: 'Nungambakkam', details: { bedrooms: 2, floor: 2, totalFloors: 4, furnishing: 'Semi-furnished' }, amenities: ['Lift', 'Car parking'] },
    { type: 'apartment', title: '2 BHK in Saravanampatti', description: "2 BHK in Saravanampatti, Coimbatore, on the 2nd floor of a 4-floor building. 1,020 sq.ft, east facing, with 2 bathrooms. Lift, car parking and power backup.\n\nSaravanampatti is Coimbatore's IT area, close to the tech parks and colleges on Sathy Road. A good home for someone working nearby, or a steady rental.", price: 48 * L, area: 1020, city: 'Coimbatore', locality: 'Saravanampatti', details: { bedrooms: 2, floor: 2, totalFloors: 4, bathrooms: 2, facing: 'East' }, amenities: ['Lift', 'Car parking', 'Power backup'] },
  ];
  const enquiries = [14, 22, 31, 6, 9, 12, 8, 17, 5, 3, 4, 2, 11, 7];
  for (const [i, s] of standalone.entries()) {
    const p = await createProperty(s, actor);
    await setListing(String(p._id), 'live', actor);
    await Property.updateOne({ _id: p._id }, { enquiries: enquiries[i] ?? 0 });
  }
  // Two drafts still being completed, so the to-do flow has something to show.
  await createProperty({ type: 'villa', title: 'Villa in ECR, Uthandi', description: "4-bedroom villa in Uthandi on ECR, 3,200 sq.ft.", city: 'Chennai', locality: 'Uthandi', area: 3200, details: { bedrooms: 4 }, extras: [{ label: 'Owner remark', value: 'Wants quick sale, call after 6 pm', internal: true }] }, actor);
  await createProperty({ type: 'apartment', city: 'Chennai', locality: 'Perungudi', description: "3 BHK apartment in Perungudi, 1,250 sq.ft.", price: 88 * L, area: 1250, details: { bedrooms: 3 } }, actor);
});
