import { z } from 'zod';
import { AMENITIES, PROPERTY_TYPES, type Requirement } from '@estate/shared';
import { AiUnavailable, aiJson, gemini } from './client';
import { knownPlaces, parseSearchText } from './rules';

const Out = z.object({
  purpose: z.enum(['sale', 'rent', 'lease']).nullable(),
  types: z.array(z.enum(PROPERTY_TYPES)),
  budgetMin: z.number().nullable().describe('Rupees'),
  budgetMax: z.number().nullable().describe('Rupees'),
  city: z.string().nullable(),
  localities: z.array(z.string()),
  bedrooms: z.number().nullable(),
  areaMin: z.number().nullable().describe('sq.ft'),
  mustHaves: z.array(z.string()).describe('Specific must-haves the customer stated, short phrases'),
  timeline: z.enum(['immediate', '3_months', '6_months', 'exploring']).nullable(),
  financing: z.enum(['own_funds', 'loan', 'loan_approved', 'unknown']).nullable(),
  intent: z.enum(['own_use', 'investment']).nullable().describe('Buying to live in (own_use) or as an investment'),
  notes: z.string().nullable().describe('Anything else useful, one line'),
});

/**
 * "Looking for 2-3 BHK near Porur or Valasaravakkam, 70-80 L, loan, wants to
 * move by March" → a structured requirement. Only stated facts are kept.
 */
export async function parseRequirement(text: string): Promise<{ requirement: Partial<Requirement>; mode: 'gemini' | 'offline' }> {
  const places = await knownPlaces();
  if (gemini()) {
    try {
      const o = await aiJson(Out, [
        {
          text: `Extract the property buyer's or tenant's requirement from this note made by a salesperson. Only include what is stated; use null or [] otherwise. Money in rupees ("70 L" = 7000000). For a range of bedrooms use the smallest.\nLocalities we know (prefer these spellings): ${places.localities.slice(0, 80).join(', ')}\n\nNote: ${text}`,
        },
      ]);
      return {
        mode: 'gemini',
        requirement: Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length))) as Partial<Requirement>,
      };
    } catch (err) {
      if (!(err instanceof AiUnavailable)) throw err;
      // Fall back to rules below.
    }
  }
  return { mode: 'offline', requirement: requirementFromRules(text, places) };
}

export function requirementFromRules(text: string, places: Awaited<ReturnType<typeof knownPlaces>>): Partial<Requirement> {
  const t = text.toLowerCase();
  const f = parseSearchText(text, places);
  const r: Partial<Requirement> = {};
  if (f.types) r.types = f.types;
  if (f.bedrooms) r.bedrooms = f.bedrooms;
  if (f.budgetMin) r.budgetMin = f.budgetMin;
  if (f.budgetMax) r.budgetMax = f.budgetMax;
  if (f.purpose) r.purpose = f.purpose;
  if (f.city) r.city = f.city;
  const localities = places.localities.filter((l) => new RegExp(`\\b${l.toLowerCase()}\\b`).test(t));
  if (localities.length) r.localities = localities.slice(0, 4);
  if (!r.city && localities.length) r.city = places.cities.find((c) => t.includes(c.toLowerCase())) ?? undefined;
  if (/\b(immediate|asap|urgent|right away|ready to move|this month)\b/.test(t)) r.timeline = 'immediate';
  else if (/\b(3|three)\s*months?\b|\bby (jan|feb|mar|apr)/.test(t)) r.timeline = '3_months';
  else if (/\b(6|six)\s*months?\b/.test(t)) r.timeline = '6_months';
  else if (/\b(just looking|exploring|no hurry|next year)\b/.test(t)) r.timeline = 'exploring';
  if (/\bloan (is )?(approved|sanctioned)\b|pre-?approved/.test(t)) r.financing = 'loan_approved';
  else if (/\b(loan|emi|bank finance|home loan)\b/.test(t)) r.financing = 'loan';
  else if (/\b(own funds|cash|no loan|self funded)\b/.test(t)) r.financing = 'own_funds';
  if (/\b(invest(ment|or|ing)?|rental income|returns|roi|appreciation)\b/.test(t)) r.intent = 'investment';
  else if (/\b(own use|self use|to live in|for (my|our) family|move in)\b/.test(t)) r.intent = 'own_use';
  const must = AMENITIES.filter((a) => t.includes(a.toLowerCase().split(' ')[0]) && a.length > 3).map(String);
  const facing = t.match(/\b(north|east|south|west)(?:[\s-](east|west))?\s*facing\b/);
  if (facing) must.push(facing[0].replace(/\b\w/g, (c) => c.toUpperCase()));
  if (/near (a )?school/.test(t)) must.push('Near a school');
  if (/gated/.test(t) && !must.includes('Gated community')) must.push('Gated community');
  if (must.length) r.mustHaves = [...new Set(must)];
  return r;
}
