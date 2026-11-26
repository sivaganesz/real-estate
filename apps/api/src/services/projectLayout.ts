import mongoose from 'mongoose';
import { z } from 'zod';
import type { Part } from '@google/genai';
import {
  PROPERTY_TYPE_LABEL,
  ProjectLayout,
  plannedUnits,
  projectCompletion,
  propertyReadiness,
  toSqft,
  type PlannedUnit,
  type PropertyType,
} from '@estate/shared';
import { Project, Property, nextCode } from '../models/property';
import { Deal } from '../models/deal';
import { Lead } from '../models/lead';
import { audit, assertCan, type Actor } from '../lib/auth';
import { HttpError, badRequest, notFound } from '../lib/http';
import { AiUnavailable, aiJson, gemini } from '../ai/client';
import { can } from '@estate/shared';

const PREFIX: Record<PropertyType, string> = { apartment: 'APT', villa: 'VIL', plot: 'PLT', commercial: 'COM', agricultural: 'AGR', industrial: 'IND' };

/** The facts a unit gets from its place in the layout. */
function unitFacts(type: PropertyType, u: PlannedUnit, totalFloors?: number) {
  const details: Record<string, unknown> = { facing: u.facing };
  if (type === 'apartment') Object.assign(details, { bedrooms: u.bedrooms, floor: u.floor, totalFloors });
  if (type === 'commercial') Object.assign(details, { usage: /shop/i.test(u.kindLabel) ? 'Retail / shop' : 'Office', floor: u.floor });
  if (type === 'plot') Object.assign(details, { width: u.w, length: u.l, cornerPlot: u.corner });
  if (type === 'villa') Object.assign(details, { bedrooms: u.bedrooms, landArea: u.land });
  const label = type === 'plot' ? `Plot ${u.unitNumber}` : type === 'villa' ? `Villa ${u.unitNumber}` : `${u.kindLabel} · ${u.unitNumber}`;
  return { details, label };
}

const ordinal = (n: number) => (n === 0 ? 'ground' : `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`);
const sqft = (n: number) => `${n.toLocaleString('en-IN')} sq.ft`;
/** "lift, car parking, CCTV and gym": amenity names read inside a sentence. */
const amenityList = (names: string[]) => {
  const words = names.map((a) => (/^[A-Z]{2,}/.test(a) ? a : a.charAt(0).toLowerCase() + a.slice(1)));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : (words[0] ?? '');
};

type DescribedProject = { name: string; locality?: string | null; status?: string | null; description?: string | null; amenities?: string[] | null; reraNumber?: string | null; developer?: string | null; possessionDate?: Date | null };
type DescribedUnit = { type: string; unitNumber?: string | null; area?: number | null; details?: Record<string, unknown> | null; title?: string | null };

/**
 * A buyer-facing description for a project unit, written only from facts we hold:
 * the unit's place in the layout (size, floor, facing, corner) and the project's
 * description, amenities, developer, RERA number and possession date.
 */
export function unitDescription(project: DescribedProject, u: DescribedUnit, blockName?: string): string {
  const d = u.details ?? {};
  const where = [project.name, project.locality].filter(Boolean).join(', ');
  const facing = d.facing ? `${String(d.facing).toLowerCase()} facing` : '';
  const size = u.area ? sqft(u.area) : '';
  const inBlock = blockName ? ` in ${blockName}` : '';
  let lead: string;
  if (u.type === 'apartment') lead = `${d.bedrooms} BHK flat ${u.unitNumber} on the ${ordinal(Number(d.floor))} floor${inBlock}${d.totalFloors ? ` (${d.totalFloors} floors)` : ''} at ${where}. ${[size, facing].filter(Boolean).join(', ')}.`;
  else if (u.type === 'plot') lead = `${d.width} × ${d.length} ft plot ${u.unitNumber}${size ? ` (${size})` : ''}${facing ? `, ${facing}` : ''}${d.cornerPlot ? ', on a corner' : ''},${inBlock} at ${where}.`;
  else if (u.type === 'villa') lead = `${d.bedrooms} BHK villa ${u.unitNumber}${size ? ` with ${size} built up` : ''}${d.landArea ? ` on a ${sqft(Number(d.landArea))} plot` : ''}${facing ? `, ${facing}` : ''},${inBlock} at ${where}.`;
  else lead = `${d.usage ?? 'Unit'} ${u.unitNumber}${d.floor !== undefined ? ` on the ${ordinal(Number(d.floor))} floor` : ''}${inBlock} at ${where}. ${[size, facing].filter(Boolean).join(', ')}.`;
  const possession = project.status === 'ready' ? 'Ready for registration.' : project.possessionDate ? `Possession expected by ${new Date(project.possessionDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}.` : '';
  const about = [project.description, project.amenities?.length ? `Amenities: ${amenityList(project.amenities)}.` : '', project.developer ? `Developed by ${project.developer}.` : '', project.reraNumber ? `RERA no. ${project.reraNumber}.` : '', possession].filter(Boolean).join(' ');
  return about ? `${lead.replace(/\s+\./g, '.')}\n\n${about}` : lead.replace(/\s+\./g, '.');
}

export type LayoutResult = { created: number; updated: number; removed: number; lost: string[]; total: number };

/**
 * Makes the project's units match its layout. New positions become units,
 * existing ones get their size and (if unsold) price refreshed, and positions
 * that disappeared are archived — unless a unit there is held, booked, sold or
 * under negotiation, in which case nothing is saved and the units are listed.
 */
export async function applyLayout(projectId: string, raw: unknown, actor: Actor): Promise<LayoutResult> {
  assertCan(actor, 'project.manage');
  const project = await Project.findById(projectId);
  if (!project) throw notFound('Project');
  const layout = ProjectLayout.parse(raw);
  const type = project.type as PropertyType;
  const planned = plannedUnits(type, layout);
  if (planned.length > 2000) throw badRequest('That is more than 2,000 units; split the project');
  const codes = [...layout.towers.map((t) => t.code), ...layout.plotBlocks.map((b) => b.code)];
  if (new Set(codes).size !== codes.length) throw badRequest('Each tower or block needs its own code');

  const existing = await Property.find({ projectId: project._id, listing: { $ne: 'archived' } });
  const key = (block: string | null | undefined, n: string | null | undefined) => `${block ?? ''}|${n ?? ''}`;
  const want = new Map(planned.map((u) => [key(u.block, u.unitNumber), u]));
  const openDeals = new Set((await Deal.find({ propertyId: { $in: existing.map((e) => e._id) }, status: { $in: ['negotiating', 'approval', 'approved', 'booked'] } }).select('propertyId').lean()).map((d) => String(d.propertyId)));
  const gone = existing.filter((e) => !want.has(key(e.block, e.unitNumber)));
  const lost = gone.filter((e) => e.availability !== 'available' || openDeals.has(String(e._id))).map((e) => (e.block && !String(e.unitNumber).startsWith(e.block) ? `${e.block}-${e.unitNumber}` : String(e.unitNumber)));
  if (lost.length) {
    throw new HttpError(409, `${lost.length} unit${lost.length > 1 ? 's are' : ' is'} held, booked, sold or under negotiation and would be removed (${lost.slice(0, 5).join(', ')}${lost.length > 5 ? ` +${lost.length - 5} more` : ''}). Keep them in the layout, or release them first.`, { lost });
  }

  const floorsOf = new Map(layout.towers.map((t) => [t.code, t.floors]));
  const blockNames = new Map([...layout.towers, ...layout.plotBlocks].map((b) => [b.code, b.name]));
  const approvals = (project.approvalBadges ?? []).map((b) => ({ name: b.name, documentUrl: b.documentUrl }));
  const extras = project.reraNumber ? [{ label: 'RERA number', value: project.reraNumber }] : [];
  let created = 0;
  let updated = 0;
  const byKey = new Map(existing.map((e) => [key(e.block, e.unitNumber), e]));
  for (const u of planned) {
    const { details, label } = unitFacts(type, u, floorsOf.get(u.block));
    const title = `${label} · ${project.name}`;
    const cur = byKey.get(key(u.block, u.unitNumber));
    if (cur) {
      // Sold and booked units keep the price they were sold at.
      const unsold = cur.availability === 'available' || cur.availability === 'held';
      cur.set({ title, area: u.area, areaUnit: 'sqft', areaSqft: u.area, details: { ...(cur.details ?? {}), ...details } });
      if (unsold && u.price) cur.price = u.price;
      // Fill a missing description; one someone wrote or edited is never replaced.
      if (!cur.description?.trim()) cur.description = unitDescription(project, { type, unitNumber: u.unitNumber, area: u.area, details: cur.details as Record<string, unknown> }, blockNames.get(u.block));
      if (cur.isModified()) {
        await cur.save();
        updated++;
      }
    } else {
      const doc = new Property({
        code: await nextCode(PREFIX[type]),
        title,
        type,
        purpose: 'sale',
        projectId: project._id,
        block: u.block,
        unitNumber: u.unitNumber,
        price: u.price ?? undefined,
        area: u.area,
        areaUnit: 'sqft',
        areaSqft: toSqft(u.area, 'sqft'),
        city: project.city,
        locality: project.locality,
        address: project.address,
        details,
        description: unitDescription(project, { type, unitNumber: u.unitNumber, area: u.area, details }, blockNames.get(u.block)),
        amenities: project.amenities,
        approvals,
        extras,
        listing: 'draft',
        availability: 'available',
        createdBy: actor.id,
      });
      // In a published project, a complete new unit goes on sale straight away.
      if (project.published && propertyReadiness(doc.toObject() as never).ready) {
        doc.listing = 'live';
        doc.publishedAt = new Date();
      }
      await doc.save();
      created++;
    }
  }
  for (const g of gone) {
    g.listing = 'archived';
    await g.save();
  }
  project.set({ flatTypes: layout.flatTypes, towers: layout.towers, plotBlocks: layout.plotBlocks, pricing: layout.pricing });
  await project.save();
  await audit(actor, 'project', project._id, 'layout', `Layout saved: ${planned.length} units (${created} new, ${updated} updated, ${gone.length} removed)`);
  return { created, updated, removed: gone.length, lost: [], total: planned.length };
}

export async function projectUnitCount(projectId: unknown) {
  return Property.countDocuments({ projectId, listing: { $ne: 'archived' } });
}

export async function completionOf(projectId: string) {
  const p = await Project.findById(projectId).lean();
  if (!p) throw notFound('Project');
  return projectCompletion(Object.assign({}, p, { unitCount: await projectUnitCount(p._id) }) as never);
}

/** Publishing a project puts every complete unit on sale; unpublishing takes unsold ones back to draft. */
export async function setProjectPublished(projectId: string, published: boolean, actor: Actor) {
  assertCan(actor, 'property.publish');
  const project = await Project.findById(projectId);
  if (!project) throw notFound('Project');
  const units = await Property.find({ projectId: project._id, listing: { $ne: 'archived' } });
  if (published) {
    const c = projectCompletion(Object.assign({}, project.toObject(), { unitCount: units.length }) as never);
    if (c.missing.length) throw new HttpError(400, `Before publishing, add: ${c.missing.join(', ')}`, { missing: c.missing });
    let live = 0;
    const notReady: string[] = [];
    for (const u of units) {
      if (u.listing === 'live') continue;
      if (propertyReadiness(u.toObject() as never).ready) {
        u.listing = 'live';
        u.publishedAt ??= new Date();
        await u.save();
        live++;
      } else notReady.push(String(u.unitNumber));
    }
    project.published = true;
    await project.save();
    await audit(actor, 'project', project._id, 'publish', `Published; ${live} units went on sale${notReady.length ? `, ${notReady.length} still need details` : ''}`);
    return { published: true, live, notReady };
  }
  let back = 0;
  for (const u of units) {
    if (u.listing === 'live' && u.availability === 'available') {
      u.listing = 'draft';
      await u.save();
      back++;
    }
  }
  project.published = false;
  await project.save();
  await audit(actor, 'project', project._id, 'unpublish', `Unpublished; ${back} unsold units back to draft`);
  return { published: false, live: 0, notReady: [] };
}

/** Project-level approvals flow down to every unit, so badges stay consistent. */
export async function syncApprovals(projectId: unknown) {
  const p = await Project.findById(projectId).lean();
  if (!p) return;
  const approvals = (p.approvalBadges ?? []).map((b) => ({ name: b.name, documentUrl: b.documentUrl }));
  await Property.updateMany({ projectId: p._id }, { $set: { approvals } });
}

/**
 * For the layout and master plan: who each unit's deal is with. Executives see
 * the customer's name only for their own customers.
 */
export async function unitDeals(projectId: unknown, actor: Actor) {
  const units = await Property.find({ projectId }).select('_id').lean();
  const deals = await Deal.find({ propertyId: { $in: units.map((u) => u._id) }, status: { $ne: 'cancelled' } })
    .sort({ updatedAt: -1 })
    .lean();
  const leads = await Lead.find({ _id: { $in: deals.map((d) => d.leadId) } }).select('name ownerId').lean();
  const out: Record<string, { id: string; status: string; leadId: string | null; customer: string; price: number; paid: number }> = {};
  for (const d of deals) {
    const k = String(d.propertyId);
    if (out[k]) continue;
    const l = leads.find((x) => String(x._id) === String(d.leadId));
    const mine = can(actor.role, 'lead.viewAll') || String(l?.ownerId) === actor.id;
    out[k] = {
      id: mine ? String(d._id) : '',
      status: d.status,
      leadId: mine && l ? String(l._id) : null,
      customer: mine ? (l?.name ?? 'Customer') : 'Another customer',
      price: d.agreedPrice ?? d.offers.at(-1)?.amount ?? d.listPrice,
      paid: (d.payments ?? []).filter((p) => p.status === 'paid').reduce((s, p) => s + (p.amount ?? 0), 0),
    };
  }
  return out;
}

const MapOut = z.object({
  blocks: z.array(
    z.object({
      name: z.string().describe('Block name as printed, e.g. "Block A"'),
      code: z.string().describe('Short code, e.g. "A"'),
      plots: z.array(z.object({ number: z.string(), w: z.number().describe('Width in feet'), l: z.number().describe('Length in feet') })),
    }),
  ),
  notes: z.array(z.string()).describe('Anything unclear: unreadable plot numbers, sizes in other units converted, etc.'),
});

/**
 * Reads an approved layout drawing (DTCP / CMDA PDF or photo) into blocks
 * of plots with their sizes. The person checks the result before saving.
 */
export async function layoutFromMap(file: { buffer: Buffer; mimetype: string }) {
  if (!gemini()) throw new HttpError(422, 'Reading layout drawings needs the AI. Ask an admin to set the Gemini key, or enter the blocks by hand.');
  if (file.mimetype !== 'application/pdf' && !/^image\/(jpeg|png|webp)$/.test(file.mimetype)) throw badRequest('Upload the layout as a PDF or a photo');
  const parts: Part[] = [
    { inlineData: { mimeType: file.mimetype, data: file.buffer.toString('base64') } },
    {
      text: 'This is an approved real-estate layout drawing (plotted development in India). List every block and, in order, every plot in it with its number and its width and length in feet (convert metres if needed: 1 m = 3.281 ft). If a plot\'s dimensions are not printed, use the most common size in that block and say so in notes. Do not invent blocks or plots that are not on the drawing.',
    },
  ];
  try {
    const r = await aiJson(MapOut, parts);
    return {
      plotBlocks: r.blocks.filter((b) => b.plots.length).map((b) => ({ name: b.name, code: b.code.slice(0, 4).toUpperCase(), plots: b.plots.map((p) => ({ w: Math.round(p.w * 10) / 10, l: Math.round(p.l * 10) / 10 })) })),
      plotCount: r.blocks.reduce((s, b) => s + b.plots.length, 0),
      notes: r.notes,
    };
  } catch (err) {
    if (err instanceof AiUnavailable) throw new HttpError(502, 'The AI could not read this drawing. Try a clearer scan, or enter the blocks by hand.');
    throw err;
  }
}

export const projectTypeLabel = (t: PropertyType) => PROPERTY_TYPE_LABEL[t];
export { mongoose };
