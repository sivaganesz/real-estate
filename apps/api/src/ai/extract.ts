import { z } from 'zod';
import type { Part } from '@google/genai';
import { PROPERTY_TYPES, TYPE_DETAILS, AMENITIES, propertyReadiness, suggestTitle, toSqft, type PropertyType } from '@estate/shared';
import { AiUnavailable, aiJson, gemini } from './client';
import { extractFromText, knownPlaces, type Extracted } from './rules';
import { HttpError } from '../lib/http';

const DETAIL_KEYS = [...new Set(Object.values(TYPE_DETAILS).flatMap((f) => f.map((x) => x.key)))] as [string, ...string[]];

/** The fixed shape the AI must return. Every number is checked by code afterwards. */
const ExtractedProperty = z.object({
  type: z.enum(PROPERTY_TYPES).nullable(),
  purpose: z.enum(['sale', 'rent', 'lease']).nullable(),
  title: z.string().nullable().describe('Short listing title, e.g. "2 BHK apartment in Porur"'),
  price: z.number().nullable().describe('Total price in rupees (not lakhs). Null if only a rate is given.'),
  priceNegotiable: z.boolean().nullable(),
  area: z.number().nullable(),
  areaUnit: z.enum(['sqft', 'sqyd', 'sqm', 'cent', 'ground', 'acre']).nullable(),
  city: z.string().nullable(),
  locality: z.string().nullable(),
  address: z.string().nullable(),
  pincode: z.string().nullable(),
  details: z.array(z.object({ key: z.enum(DETAIL_KEYS), value: z.union([z.string(), z.number(), z.boolean()]) })).describe('Known key details found in the input'),
  amenities: z.array(z.string()).describe(`Use these names where they fit: ${AMENITIES.join(', ')}`),
  highlights: z.array(z.string()).describe('Up to 4 selling points stated in the input'),
  description: z.string().nullable().describe('2-3 sentence factual description using only stated facts'),
  approvals: z.array(z.string()).describe('Approvals claimed, e.g. RERA, DTCP, CMDA, Building approval'),
  extras: z.array(z.object({ label: z.string(), value: z.string() })).describe('Other facts that fit no field, kept as written'),
  sources: z.array(z.object({ field: z.string(), quote: z.string() })).describe('For each filled field, the exact words it came from'),
  unsure: z.array(z.object({ field: z.string(), why: z.string() })).describe('Fields that are ambiguous or inferred'),
});

const ExtractResult = z.object({ properties: z.array(ExtractedProperty) });

const PROMPT = `Read the material and extract the real-estate listing(s) it describes into the JSON schema.
Rules:
- Only use facts that are stated or directly computable (e.g. a 30x40 plot is 1200 sq.ft; G+4 means 5 floors). Never guess a price, size or approval.
- Prices are total rupees: "62 lakhs" = 6200000, "1.2 Cr" = 12000000. If only a per-sq.ft rate is given, leave price null, add the rate to extras, and list price under "unsure".
- If the price says "onwards", "approx" or similar, fill it and list it under "unsure".
- A builder brochure with several unit types (e.g. 2 BHK and 3 BHK) is one entry per unit type.
- For every field you fill, add a short exact quote in "sources".
- Keep anything that fits no field in "extras" exactly as written.`;

export type ExtractOutput = {
  mode: 'gemini' | 'offline';
  properties: (Extracted & { readiness: ReturnType<typeof propertyReadiness>; checks: string[] })[];
};

type FileInput = { buffer: Buffer; mimetype: string; originalname: string };

async function offline(input: { text?: string; file?: FileInput }): Promise<ExtractOutput> {
  let text = input.text ?? '';
  if (input.file) {
    if (input.file.mimetype === 'application/pdf') text += '\n' + (await pdfText(input.file.buffer));
    else throw new HttpError(422, 'Reading photos needs the AI. Ask an admin to set the Gemini key, or type the details instead.');
  }
  if (!text.trim()) throw new HttpError(400, 'Describe the property or attach a brochure');
  return { mode: 'offline', properties: [finish(extractFromText(text, await knownPlaces()))] };
}

export async function extractProperties(input: { text?: string; file?: FileInput }): Promise<ExtractOutput> {
  if (!gemini()) return offline(input);

  const parts: Part[] = [];
  if (input.file) {
    if (input.file.mimetype !== 'application/pdf' && !/^image\/(jpeg|png|webp|gif)$/.test(input.file.mimetype)) throw new HttpError(400, 'Attach a PDF or a photo');
    parts.push({ inlineData: { mimeType: input.file.mimetype, data: input.file.buffer.toString('base64') } });
  }
  const places = await knownPlaces();
  parts.push({
    text: `${PROMPT}\n\nLocalities we already use (match spelling where it is the same place): ${places.localities.slice(0, 80).join(', ')}\n\n${input.text ? `Material:\n${input.text}` : 'The material is attached.'}`,
  });

  let result: z.infer<typeof ExtractResult>;
  try {
    result = await aiJson(ExtractResult, parts);
  } catch (err) {
    if (!(err instanceof AiUnavailable)) throw err;
    // The AI step failed: typed text and PDFs can still be read by rules.
    if (!input.file || input.file.mimetype === 'application/pdf') return offline(input);
    throw new HttpError(502, 'The AI could not read this just now. Please try again.');
  }
  if (!result.properties.length) throw new HttpError(422, 'No property could be read from this. Try adding more detail.');
  return {
    mode: 'gemini',
    properties: result.properties.map((p) =>
      finish({
        ...p,
        priceNegotiable: p.priceNegotiable ?? undefined,
        details: Object.fromEntries(p.details.map((d) => [d.key, d.value])),
        sources: Object.fromEntries(p.sources.map((s) => [s.field, s.quote])),
      }),
    ),
  };
}

/** Code checks on what was read: sensible rates, derived area, missing required facts. */
function finish(p: Extracted) {
  const checks: string[] = [];
  const type = (p.type ?? 'apartment') as PropertyType;
  if (p.price && p.price < 10_000) checks.push(`A price of ₹${p.price} looks too small; is it in lakhs?`);
  if (p.price && p.area && p.areaUnit) {
    const rate = p.price / toSqft(p.area, p.areaUnit);
    const [lo, hi] = type === 'agricultural' ? [5, 20_000] : type === 'plot' ? [300, 60_000] : [1_500, 60_000];
    if (p.purpose !== 'rent' && (rate < lo || rate > hi)) checks.push(`That works out to ₹${Math.round(rate).toLocaleString('en-IN')} per sq.ft, which is unusual. Please check the price and area.`);
  }
  if (!p.title && p.type) p.title = suggestTitle({ type: p.type, purpose: p.purpose ?? 'sale', locality: p.locality, city: p.city, details: p.details });
  const readiness = propertyReadiness({ ...p, type, approvals: p.approvals.map((name) => ({ name })) });
  return { ...p, readiness, checks };
}

async function pdfText(buf: Buffer): Promise<string> {
  // pdf-parse's index runs a self-test on import; the lib entry does not.
  // @ts-expect-error: no type declarations for the lib entry
  const mod = (await import('pdf-parse/lib/pdf-parse.js')) as unknown as { default: (b: Buffer) => Promise<{ text: string }> };
  return (await mod.default(buf)).text;
}
