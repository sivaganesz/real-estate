import { z } from 'zod';
import {
  AREA_UNIT_LABEL,
  type AreaUnit,
  AVAILABILITY,
  AVAILABILITY_LABEL,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABEL,
  formatINR,
  propertyReadiness,
  type Availability,
  type PropertyType,
} from '@estate/shared';
import { registerTools, type RecordRef } from '../../ai/tools';
import { registerIntents } from '../../ai/offline';
import { callTool } from '../../ai/assistant';
import { knownPlaces, parseSearchText } from '../../ai/rules';
import { Property, Project } from '../../models/property';
import {
  createProperty,
  ensureShareToken,
  getProperty,
  propertyRef,
  searchProperties,
  setAvailability,
  setListing,
  updateProperty,
} from '../../services/properties';
import { listProjects, projectRef } from '../../services/projects';
import { HttpError } from '../../lib/http';

/** Compact view of a property for the model: facts only, no internals it doesn't need. */
export function compactProperty(p: Record<string, unknown>) {
  const d = (p.details ?? {}) as Record<string, unknown>;
  return {
    id: String(p.id ?? p._id),
    code: p.code,
    title: p.title,
    type: p.type,
    purpose: p.purpose,
    price: p.price ? formatINR(p.price as number) : null,
    area: p.area ? `${Number(p.area).toLocaleString('en-IN')} ${AREA_UNIT_LABEL[p.areaUnit as AreaUnit] ?? p.areaUnit}` : null,
    locality: p.locality,
    city: p.city,
    details: Object.fromEntries(Object.entries(d).filter(([, v]) => v !== null && v !== '')),
    listing: p.listing,
    availability: p.availability,
    project: p.projectId ? String(p.projectId) : null,
    unit: p.unitNumber ? `${p.block ? `${p.block}-` : ''}${p.unitNumber}` : null,
  };
}

const SearchInput = z.object({
  text: z.string().optional().describe('Free text to match in title, code, locality or extras'),
  types: z.array(z.enum(PROPERTY_TYPES)).optional(),
  purpose: z.enum(['sale', 'rent', 'lease']).optional(),
  budgetMin: z.number().optional().describe('Rupees'),
  budgetMax: z.number().optional().describe('Rupees'),
  city: z.string().optional(),
  localities: z.array(z.string()).optional(),
  bedrooms: z.number().int().optional(),
  areaMinSqft: z.number().optional(),
  availability: z.array(z.enum(AVAILABILITY)).optional().describe('Defaults to all; use ["available"] for what can be offered now'),
  projectId: z.string().optional(),
  includeDrafts: z.boolean().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest']).optional(),
});

const DetailsRecord = z.record(z.union([z.string(), z.number(), z.boolean()]));

const DraftInput = z.object({
  type: z.enum(PROPERTY_TYPES),
  purpose: z.enum(['sale', 'rent', 'lease']).default('sale'),
  title: z.string().optional(),
  price: z.number().optional().describe('Total rupees'),
  area: z.number().optional(),
  areaUnit: z.enum(['sqft', 'sqyd', 'sqm', 'cent', 'ground', 'acre']).optional(),
  city: z.string().optional(),
  locality: z.string().optional(),
  address: z.string().optional(),
  details: DetailsRecord.optional().describe('Key details: bedrooms, floor, totalFloors, bathrooms, facing, furnishing, length, width, roadWidth, landArea, usage, waterSource, roadAccess, powerKva'),
  amenities: z.array(z.string()).optional(),
  description: z.string().optional(),
  extras: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});

registerTools(
  {
    name: 'search_properties',
    kind: 'read',
    permission: 'property.view',
    description:
      'Search the property inventory with structured filters. Returns up to 10 matches with price, area, locality, key details, listing state and availability, plus the total count.',
    schema: SearchInput,
    run: async (i, { actor }) => {
      const r = await searchProperties(
        {
          q: i.text,
          types: i.types,
          purpose: i.purpose,
          budgetMin: i.budgetMin,
          budgetMax: i.budgetMax,
          city: i.city,
          localities: i.localities,
          bedrooms: i.bedrooms,
          areaMin: i.areaMinSqft,
          availability: i.availability,
          projectId: i.projectId,
          listing: i.includeDrafts ? ['draft', 'live'] : ['live'],
          sort: i.sort,
          limit: 10,
        },
        actor,
      );
      return { data: { total: r.total, shown: r.items.length, items: r.items.map(compactProperty) }, records: r.items.map((p) => propertyRef({ ...p, _id: p.id } as never)) };
    },
  },
  {
    name: 'get_property',
    kind: 'read',
    permission: 'property.view',
    description: 'Full details of one property by id: facts, amenities, approvals, what it still needs before going live, and recent changes.',
    schema: z.object({ propertyId: z.string() }),
    run: async ({ propertyId }, { actor }) => {
      const p = await getProperty(propertyId, actor);
      const readiness = propertyReadiness(p as never);
      return {
        data: {
          ...compactProperty(p as never),
          description: p.description,
          amenities: p.amenities,
          highlights: p.highlights,
          extras: p.extras,
          approvals: p.approvals?.map((a) => ({ name: a.name, documentUploaded: !!a.documentUrl, verified: !!a.verified })),
          photos: p.media?.length ?? 0,
          missingBeforeLive: readiness.missing.map((m) => m.label),
          suggestions: readiness.suggestions.slice(0, 5).map((s) => s.label),
          heldUntil: p.heldUntil,
          enquiries: p.enquiries,
        },
        records: [propertyRef(p as never)],
      };
    },
  },
  {
    name: 'list_projects',
    kind: 'read',
    permission: 'property.view',
    description: 'All projects with inventory counts (available, held, booked, sold, drafts) and the price range of available units.',
    schema: z.object({}),
    run: async () => {
      const items = await listProjects();
      return {
        data: items.map((p) => ({ id: p.id, name: p.name, type: p.type, locality: p.locality, city: p.city, status: p.status, inventory: p.inventory })),
        records: items.map((p) => projectRef({ _id: p.id, name: p.name, locality: p.locality })),
      };
    },
  },
  {
    name: 'create_draft_property',
    kind: 'write',
    permission: 'property.create',
    description:
      'Create a property as a DRAFT from details the user gave (it is not visible to buyers until published). Fill only what the user stated. Returns what is still missing before it can go live.',
    schema: DraftInput,
    run: async (i, { actor }) => {
      try {
        const p = await createProperty({ ...i, details: i.details ?? {} }, actor);
        const r = propertyReadiness(p as never);
        return {
          data: { id: String(p._id), title: p.title, missingBeforeLive: r.missing.map((m) => m.label) },
          records: [propertyRef(p as never)],
          done: `Created draft “${p.title}”`,
        };
      } catch (e) {
        if (e instanceof HttpError && e.status === 409) {
          const d = (e.details as { duplicates: RecordRef[] }).duplicates;
          return { data: { notCreated: true, reason: 'Possible duplicate', existing: d }, records: d };
        }
        throw e;
      }
    },
  },
  {
    name: 'update_property',
    kind: 'confirm',
    permission: 'property.edit',
    description: 'Change facts on a property (price, area, details, description, amenities, title).',
    schema: z.object({
      propertyId: z.string(),
      changes: DraftInput.omit({ type: true }).partial(),
    }),
    preview: async ({ propertyId, changes }, { actor }) => {
      const p = await getProperty(propertyId, actor);
      const parts = Object.entries(changes).map(([k, v]) =>
        k === 'price' ? `price ${formatINR(p.price)} → ${formatINR(v as number)}` : k === 'details' ? `details ${JSON.stringify(v)}` : `${k} → ${Array.isArray(v) ? v.join(', ') : String(v)}`,
      );
      return { summary: `Update “${p.title}”: ${parts.join('; ')}`, records: [propertyRef(p as never)] };
    },
    execute: async ({ propertyId, changes }, { actor }) => {
      const p = await updateProperty(propertyId, changes, actor);
      return { data: { ok: true }, done: `Updated “${p.title}”`, records: [propertyRef(p as never)] };
    },
  },
  {
    name: 'publish_property',
    kind: 'confirm',
    permission: 'property.publish',
    description: 'Make a draft property live so the sales team can offer and share it.',
    schema: z.object({ propertyId: z.string() }),
    preview: async ({ propertyId }, { actor }) => {
      const p = await getProperty(propertyId, actor);
      const r = propertyReadiness(p as never);
      if (!r.ready) throw new HttpError(400, `It can't go live yet; it still needs ${r.missing.map((m) => m.label).join(', ')}`);
      return { summary: `Publish “${p.title}” (${formatINR(p.price)}) so the team can offer it`, records: [propertyRef(p as never)] };
    },
    execute: async ({ propertyId }, { actor }) => {
      const p = await setListing(propertyId, 'live', actor);
      return { data: { ok: true }, done: `“${p.title}” is live`, records: [propertyRef(p as never)] };
    },
  },
  {
    name: 'set_property_availability',
    kind: 'confirm',
    permission: 'property.availability',
    description: 'Put a property on hold, release it, or mark it booked/sold by hand (with a reason). Normally bookings come from deals.',
    schema: z.object({ propertyId: z.string(), availability: z.enum(AVAILABILITY), reason: z.string().optional(), holdDays: z.number().int().min(1).max(30).optional() }),
    preview: async ({ propertyId, availability, holdDays }, { actor }) => {
      const p = await getProperty(propertyId, actor);
      return {
        summary: `Mark “${p.title}” as ${AVAILABILITY_LABEL[availability as Availability]}${availability === 'held' ? ` for ${holdDays ?? 3} days` : ''}`,
        records: [propertyRef(p as never)],
      };
    },
    execute: async ({ propertyId, availability, reason, holdDays }, { actor }) => {
      const p = await setAvailability(propertyId, availability, actor, { reason: reason ?? 'Changed with the assistant', heldUntil: holdDays ? new Date(Date.now() + holdDays * 86_400_000) : undefined });
      return { data: { ok: true }, done: `“${p.title}” is now ${AVAILABILITY_LABEL[p.availability as Availability]}`, records: [propertyRef(p as never)] };
    },
  },
  {
    name: 'get_share_link',
    kind: 'write',
    permission: 'property.share',
    description: 'Get the buyer-facing brochure link for a live property (safe to send on WhatsApp; shows no internal data).',
    schema: z.object({ propertyId: z.string() }),
    run: async ({ propertyId }, { actor }) => {
      const p = await getProperty(propertyId, actor);
      const token = await ensureShareToken(propertyId);
      return { data: { path: `/p/${token}` }, records: [propertyRef(p as never)] };
    },
  },
);

// Offline intents ---------------------------------------------------------------

const PROPERTY_WORDS = /\b(bhk|flat|flats|apartment|apartments|villa|villas|plot|plots|house|houses|propert(y|ies)|land|shop|office|units?|inventory)\b/;

registerIntents(
  {
    name: 'publish-this',
    priority: 10,
    example: 'Publish this property (on a property page)',
    match: (t, ctx) => /\bpublish\b/.test(t) && ctx.context?.entity === 'property' && ctx.context.entityId,
    run: async (_a, ctx, out) => {
      const r = await callTool('publish_property', { propertyId: ctx.context!.entityId }, ctx, out);
      return r.is_error ? r.content : 'I’ve prepared it. Confirm below to make it live.';
    },
  },
  {
    name: 'property-search',
    example: 'Find 2 BHK apartments under 70 lakhs in Porur',
    match: (t) => PROPERTY_WORDS.test(t) && /\b(find|show|search|list|any|under|below|in|available|need|want|looking)\b/.test(t) && !/\b(lead|leads|buyer|buyers|customer)\b/.test(t) && t,
    run: (text, ctx, out) => offlinePropertySearch(text as string, ctx, out),
  },
);

export async function offlinePropertySearch(text: string, ctx: Parameters<typeof callTool>[2], out: Parameters<typeof callTool>[3]) {
  const parsed = parseSearchText(text, await knownPlaces());
  const inProject = ctx.context?.entity === 'project' && /\b(this|here)\b/.test(text) ? ctx.context.entityId : undefined;
  const args = {
    types: parsed.types,
    bedrooms: parsed.bedrooms,
    budgetMin: parsed.budgetMin,
    budgetMax: parsed.budgetMax,
    city: parsed.city,
    localities: parsed.localities,
    purpose: parsed.purpose,
    availability: parsed.availability ?? (/\bavailable\b/.test(text) ? ['available'] : undefined),
    projectId: inProject,
  };
  const r = await callTool('search_properties', args, ctx, out);
  if (r.is_error) return r.content;
  const data = JSON.parse(r.content) as { total: number; items: ReturnType<typeof compactProperty>[] };
  const what = parsed.understood.length ? parsed.understood.join(', ') : 'your search';
  if (!data.total) return `No live properties match ${what}. Try a wider budget or a nearby locality.`;
  const lines = data.items.slice(0, 6).map((p) => `• **${p.title}** — ${p.price ?? 'price on request'}${p.area ? `, ${p.area}` : ''}${p.availability !== 'available' ? ` (${AVAILABILITY_LABEL[p.availability as Availability]})` : ''}`);
  return `Found ${data.total} for ${what}${data.total > 6 ? ' (top 6 below)' : ''}:\n${lines.join('\n')}`;
}

export const typeLabel = (t: string) => PROPERTY_TYPE_LABEL[t as PropertyType] ?? t;
export { Property, Project };
