import { AMENITIES, parseArea, parseMoney, type AreaUnit, type PropertyType } from '@estate/shared';
import { Property, Project } from '../models/property';

/**
 * Rule-based readers used in offline mode and as a cheap first pass.
 * They only take what is literally in the text and record the words they used.
 */

export type Places = { cities: string[]; localities: string[] };

let placesCache: { at: number; value: Places } | null = null;
export async function knownPlaces(): Promise<Places> {
  if (placesCache && Date.now() - placesCache.at < 60_000) return placesCache.value;
  const [pc, pl, jc, jl] = await Promise.all([Property.distinct('city'), Property.distinct('locality'), Project.distinct('city'), Project.distinct('locality')]);
  const clean = (a: unknown[]) => [...new Set(a.filter((x): x is string => typeof x === 'string' && x.length > 1))].sort((a, b) => b.length - a.length);
  const value = { cities: clean([...pc, ...jc, 'Chennai', 'Coimbatore', 'Bengaluru', 'Madurai', 'Trichy', 'Hyderabad']), localities: clean([...pl, ...jl]) };
  placesCache = { at: Date.now(), value };
  return value;
}

export function detectType(t: string): PropertyType | null {
  if (/\b(agri(cultural)?|farm ?lands?|coconut grove|acres? of land)\b/.test(t)) return 'agricultural';
  if (/\b(warehouses?|factory|factories|industrial|godowns?|sheds?)\b/.test(t)) return 'industrial';
  if (/\b(shops?|offices?|showrooms?|commercial|retail)\b/.test(t)) return 'commercial';
  if (/\b(villas?|independent houses?|individual houses?|row houses?|bungalows?|duplex houses?)\b/.test(t)) return 'villa';
  if (/\b(flats?|apartments?|bhk|penthouses?)\b/.test(t)) return 'apartment';
  if (/\b(plots?|sites?|lands?|layouts?)\b/.test(t)) return 'plot';
  if (/\bhouses?\b/.test(t)) return 'villa';
  return null;
}

function find(places: string[], text: string) {
  const lower = text.toLowerCase();
  return places.find((p) => new RegExp(`\\b${p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) ?? null;
}

/** Search words → filters. "2 bhk under 70 lakhs in porur" → { bedrooms: 2, budgetMax: 7000000, localities: ['Porur'] } */
export function parseSearchText(text: string, places: Places) {
  const t = text.toLowerCase();
  const f: {
    types?: PropertyType[];
    bedrooms?: number;
    budgetMin?: number;
    budgetMax?: number;
    city?: string;
    localities?: string[];
    purpose?: 'sale' | 'rent' | 'lease';
    availability?: ('available' | 'held' | 'booked' | 'sold')[];
    areaMin?: number;
    understood: string[];
  } = { understood: [] };
  const type = detectType(t);
  if (type) f.types = [type];
  const bhk = t.match(/(\d)\s*-?\s*(?:bhk|bed(?:room)?s?)/);
  if (bhk) {
    f.bedrooms = Number(bhk[1]);
    if (!f.types) f.types = ['apartment', 'villa'];
  }
  const under = t.match(/(?:under|below|less than|upto|up to|within|max(?:imum)?|budget(?: of)?|<)\s*(?:rs\.?|₹)?\s*([\d.,]+\s*(?:crores?|cr|lakhs?|lacs?|l|k)?)/);
  const above = t.match(/(?:above|over|more than|min(?:imum)?|from|>)\s*(?:rs\.?|₹)?\s*([\d.,]+\s*(?:crores?|cr|lakhs?|lacs?|l|k))/);
  const between = t.match(/between\s*(?:rs\.?|₹)?\s*([\d.,]+\s*(?:crores?|cr|lakhs?|lacs?|l)?)\s*(?:and|-|to)\s*(?:rs\.?|₹)?\s*([\d.,]+\s*(?:crores?|cr|lakhs?|lacs?|l))/);
  if (between) {
    const unit = between[2].replace(/[\d.,\s]/g, '');
    f.budgetMin = parseMoney(/[a-z]/.test(between[1]) ? between[1] : `${between[1]} ${unit}`) ?? undefined;
    f.budgetMax = parseMoney(between[2]) ?? undefined;
  } else {
    if (under) f.budgetMax = parseMoney(under[1]) ?? undefined;
    if (above) f.budgetMin = parseMoney(above[1]) ?? undefined;
  }
  if (/\b(rent|rental)\b/.test(t)) f.purpose = 'rent';
  else if (/\blease\b/.test(t)) f.purpose = 'lease';
  // A budget in lakhs or crores means buying, not renting.
  else if ((f.budgetMax ?? 0) >= 500_000 || (f.budgetMin ?? 0) >= 500_000 || /\b(buy|sale|purchase)\b/.test(t)) f.purpose = 'sale';
  if (/\bavailable\b/.test(t)) f.availability = ['available'];
  const loc = find(places.localities, t);
  if (loc) f.localities = [loc];
  const city = find(places.cities, t);
  if (city && city !== loc) f.city = city;
  const areaM = t.match(/(?:above|over|at least|min(?:imum)?)\s*([\d,]+)\s*(?:sq\.?\s*ft|sqft|sft)/);
  if (areaM) f.areaMin = Number(areaM[1].replace(/,/g, ''));
  if (f.bedrooms) f.understood.push(`${f.bedrooms} BHK`);
  if (f.types && !f.bedrooms) f.understood.push(f.types.join(' / '));
  if (f.budgetMin) f.understood.push(`from ₹${f.budgetMin.toLocaleString('en-IN')}`);
  if (f.budgetMax) f.understood.push(`up to ₹${f.budgetMax.toLocaleString('en-IN')}`);
  if (f.localities) f.understood.push(f.localities[0]);
  if (f.city) f.understood.push(f.city);
  if (f.purpose && f.purpose !== 'sale') f.understood.push(`for ${f.purpose}`);
  if (f.areaMin) f.understood.push(`${f.areaMin}+ sq.ft`);
  return f;
}

export type Extracted = {
  priceNegotiable?: boolean;
  type: PropertyType | null;
  purpose: 'sale' | 'rent' | 'lease' | null;
  title: string | null;
  price: number | null;
  area: number | null;
  areaUnit: AreaUnit | null;
  city: string | null;
  locality: string | null;
  address: string | null;
  pincode: string | null;
  details: Record<string, string | number | boolean | null>;
  amenities: string[];
  highlights: string[];
  description: string | null;
  approvals: string[];
  extras: { label: string; value: string }[];
  /** field → the words it was read from */
  sources: Record<string, string>;
  /** fields the reader is not sure about, with why */
  unsure: { field: string; why: string }[];
};

/** The matched words plus a little context, cut at word boundaries. */
function snippet(text: string, index: number, len: number) {
  let a = Math.max(0, index - 12);
  let b = Math.min(text.length, index + len + 12);
  while (a > 0 && /\S/.test(text[a - 1])) a--;
  while (b < text.length && /\S/.test(text[b])) b++;
  return text.slice(a, b).replace(/\s+/g, ' ').trim();
}

export function extractFromText(raw: string, places: Places): Extracted {
  const text = raw.replace(/\s+/g, ' ');
  const t = text.toLowerCase();
  const sources: Record<string, string> = {};
  const unsure: Extracted['unsure'] = [];
  const details: Extracted['details'] = {};

  const type = detectType(t);
  if (type) sources.type = (t.match(/agri\w*|farm ?land|warehouse|factory|industrial|shed|shop|office|showroom|commercial|villa|independent house|house|flat|apartment|bhk|plot|site|land/) ?? [''])[0];

  let purpose: Extracted['purpose'] = null;
  if (/\b(for rent|rent|rental)\b/.test(t)) purpose = 'rent';
  else if (/\blease\b/.test(t)) purpose = 'lease';
  else if (/\b(sale|sell|selling|resale)\b/.test(t)) purpose = 'sale';

  // Price: the first money amount near a price word, or any lakh/crore amount.
  let price: number | null = null;
  const pm = text.match(/(?:price|cost|rate|asking|₹|rs\.?|inr)\s*:?\s*([\d.,]+\s*(?:crores?|cr|lakhs?|lacs?|l\b|k\b)?)/i) ?? text.match(/([\d.,]+\s*(?:crores?|cr\b|lakhs?|lacs?|l\b))/i);
  if (pm) {
    price = parseMoney(pm[1]);
    if (price) sources.price = snippet(text, pm.index ?? 0, pm[0].length);
    if (price && /onwards|approx|starting/i.test(text.slice(pm.index ?? 0, (pm.index ?? 0) + pm[0].length + 20))) {
      unsure.push({ field: 'price', why: 'The text says "onwards" or "approx", so the exact price may differ' });
    }
    if (price && /per\s*(sq|sft|sqft|month|cent|acre)/i.test(text.slice(pm.index ?? 0, (pm.index ?? 0) + pm[0].length + 15))) {
      unsure.push({ field: 'price', why: 'This looks like a rate, not a total price' });
    }
  }

  // Area
  let area: number | null = null;
  let areaUnit: AreaUnit | null = null;
  const am = text.match(/([\d.,]+)\s*(sq\.?\s*ft|sqft|sft|square feet|sq\.?\s*yd|sqyd|cents?|grounds?|acres?)/i);
  const dims = text.match(/(\d{2,3})\s*(?:x|×|\*|by)\s*(\d{2,3})/i);
  if (am) {
    const a = parseArea(`${am[1]} ${am[2]}`);
    if (a) {
      area = a.value;
      areaUnit = a.unit;
      sources.area = snippet(text, am.index ?? 0, am[0].length);
    }
  }
  if (dims) {
    details.length = Number(dims[1]);
    details.width = Number(dims[2]);
    sources['details.length'] = sources['details.width'] = snippet(text, dims.index ?? 0, dims[0].length);
    if (!area) {
      area = details.length * details.width;
      areaUnit = 'sqft';
      sources.area = `${dims[0]} → ${area} sq.ft`;
    }
  }

  const bhk = text.match(/(\d)\s*-?\s*(?:bhk|bed\s*rooms?|bedrooms?|beds?)\b/i);
  if (bhk) {
    details.bedrooms = Number(bhk[1]);
    sources['details.bedrooms'] = snippet(text, bhk.index ?? 0, bhk[0].length);
  }
  const bath = text.match(/(\d)\s*(?:bath(?:room)?s?|toilets?)/i);
  if (bath) details.bathrooms = Number(bath[1]);
  const floor = text.match(/\b(ground|\d{1,2})(?:st|nd|rd|th)?\s*floor\b/i);
  if (floor) {
    details.floor = /ground/i.test(floor[1]) ? 0 : Number(floor[1]);
    sources['details.floor'] = snippet(text, floor.index ?? 0, floor[0].length);
  }
  const totalFloors = text.match(/(?:out of|of|total)\s*(\d{1,2})\s*floors/i) ?? text.match(/g\s*\+\s*(\d{1,2})/i);
  if (totalFloors) details.totalFloors = /g\s*\+/i.test(totalFloors[0]) ? Number(totalFloors[1]) + 1 : Number(totalFloors[1]);
  const facing = text.match(/\b(north|east|south|west)(?:[\s-]?(east|west))?\s*facing\b/i);
  if (facing) details.facing = [facing[1], facing[2]].filter(Boolean).map((s) => s![0].toUpperCase() + s!.slice(1).toLowerCase()).join('-');
  const road = text.match(/(\d{2,3})\s*(?:ft|feet)\s*road/i);
  if (road) details.roadWidth = Number(road[1]);
  if (/corner plot/i.test(text)) details.cornerPlot = true;
  if (/semi[\s-]?furnished/i.test(text)) details.furnishing = 'Semi-furnished';
  else if (/fully[\s-]?furnished|\bfurnished/i.test(text)) details.furnishing = 'Fully furnished';
  else if (/unfurnished/i.test(text)) details.furnishing = 'Unfurnished';
  const water = text.match(/\b(borewell|open well|canal|river)\b/i);
  if (water && type === 'agricultural') details.waterSource = water[1][0].toUpperCase() + water[1].slice(1).toLowerCase();
  if (type === 'agricultural' && /road access|road facing|tar road|main road/i.test(text)) details.roadAccess = true;
  const kva = text.match(/(\d{2,4})\s*kva/i);
  if (kva) details.powerKva = Number(kva[1]);
  if (type === 'commercial') {
    const usage = text.match(/\b(office|shop|showroom|warehouse|hotel)\b/i);
    if (usage) details.usage = { office: 'Office', shop: 'Retail / shop', showroom: 'Showroom', warehouse: 'Warehouse', hotel: 'Hotel' }[usage[1].toLowerCase()]!;
  }
  if (type === 'industrial') {
    const usage = text.match(/\b(factory|warehouse|shed|land)\b/i);
    if (usage) details.usage = usage[1][0].toUpperCase() + usage[1].slice(1).toLowerCase();
  }

  const locality = find(places.localities, text);
  const city = find(places.cities, text);
  if (locality) sources.locality = locality;
  if (city) sources.city = city;
  const pin = text.match(/\b(6\d{5})\b/);

  const amenities = AMENITIES.filter((a) => {
    const key = a.toLowerCase().replace("children's play area", 'play area').replace('car parking', 'parking').replace('corporation water', 'metro water');
    return t.includes(key.split(' ')[0] === 'swimming' ? 'pool' : key);
  });
  const approvals = ['RERA', 'DTCP', 'CMDA', 'Building approval'].filter((a) => new RegExp(`\\b${a}\\b`, 'i').test(text));

  const negotiable = /negotiable/i.test(text);
  if (negotiable) sources.priceNegotiable = 'negotiable';
  return {
    priceNegotiable: negotiable || undefined,
    type,
    purpose,
    title: null,
    price,
    area,
    areaUnit,
    city: city ?? null,
    locality: locality && locality !== city ? locality : null,
    address: null,
    pincode: pin ? pin[1] : null,
    details,
    amenities: [...amenities],
    highlights: [],
    description: null,
    approvals,
    extras: [],
    sources,
    unsure,
  };
}
