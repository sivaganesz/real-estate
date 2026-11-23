import mongoose from 'mongoose';
import { z } from 'zod';
import { ProjectInput, propertyReadiness, toSqft, type PropertyType } from '@estate/shared';
import { Project, Property, nextCode } from '../models/property';
import { audit, assertCan, type Actor } from '../lib/auth';
import { badRequest, notFound } from '../lib/http';
import { releaseExpiredHolds, serialiseProperty } from './properties';
import type { RecordRef } from '../ai/tools';

const PREFIX: Record<PropertyType, string> = { apartment: 'APT', villa: 'VIL', plot: 'PLT', commercial: 'COM', agricultural: 'AGR', industrial: 'IND' };

export function projectRef(p: { _id: unknown; name: string; locality?: string | null }): RecordRef {
  return { kind: 'project', id: String(p._id), title: p.name, subtitle: p.locality ?? undefined };
}

export async function listProjects() {
  await releaseExpiredHolds();
  const projects = await Project.find().sort({ createdAt: -1 }).lean();
  const counts = await Property.aggregate<{ _id: { p: mongoose.Types.ObjectId; a: string; l: string }; n: number; min: number; max: number }>([
    { $match: { projectId: { $ne: null }, listing: { $ne: 'archived' } } },
    { $group: { _id: { p: '$projectId', a: '$availability', l: '$listing' }, n: { $sum: 1 }, min: { $min: '$price' }, max: { $max: '$price' } } },
  ]);
  return projects.map((p) => {
    const mine = counts.filter((c) => String(c._id.p) === String(p._id));
    const by = (pred: (c: (typeof mine)[number]) => boolean) => mine.filter(pred).reduce((s, c) => s + c.n, 0);
    const prices = mine.filter((c) => c._id.a === 'available' && c._id.l === 'live');
    return {
      id: String(p._id),
      ...p,
      _id: undefined,
      inventory: {
        total: by(() => true),
        draft: by((c) => c._id.l === 'draft'),
        available: by((c) => c._id.l === 'live' && c._id.a === 'available'),
        held: by((c) => c._id.a === 'held'),
        booked: by((c) => c._id.a === 'booked'),
        sold: by((c) => c._id.a === 'sold'),
        priceFrom: prices.length ? Math.min(...prices.map((c) => c.min)) : null,
        priceTo: prices.length ? Math.max(...prices.map((c) => c.max)) : null,
      },
    };
  });
}

export async function getProjectWithUnits(id: string, actor: Actor) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Project');
  await releaseExpiredHolds();
  const project = await Project.findById(id).lean();
  if (!project) throw notFound('Project');
  const unitQuery: Record<string, unknown> = { projectId: project._id, listing: { $ne: 'archived' } };
  if (actor.role === 'executive') unitQuery.listing = 'live';
  const units = await Property.find(unitQuery).sort({ block: 1, 'details.floor': -1, unitNumber: 1 }).lean();
  return { project: { id: String(project._id), ...project, _id: undefined }, units: units.map(serialiseProperty) };
}

export async function createProject(raw: unknown, actor: Actor) {
  assertCan(actor, 'project.manage');
  const input = ProjectInput.parse(raw);
  const p = await Project.create({ ...input, code: await nextCode('PRJ'), createdBy: actor.id, possessionDate: input.possessionDate ? new Date(input.possessionDate) : undefined });
  await audit(actor, 'project', p._id, 'create', `Created project ${p.name}`);
  return p.toObject();
}

export async function updateProject(id: string, raw: unknown, actor: Actor) {
  assertCan(actor, 'project.manage');
  const input = ProjectInput.partial().parse(raw);
  const p = await Project.findByIdAndUpdate(id, { ...input, possessionDate: input.possessionDate ? new Date(input.possessionDate) : undefined }, { new: true });
  if (!p) throw notFound('Project');
  await audit(actor, 'project', p._id, 'update', `Updated project ${p.name}`);
  return p.toObject();
}

/**
 * Builders sell a block as a grid: floors × units per floor, with the same
 * layout stacked vertically and a floor-rise on price. One form creates them all.
 */
export const GenerateUnits = z.object({
  block: z.string().trim().max(20).default(''),
  floorFrom: z.number().int().min(0).max(80).default(1),
  floorTo: z.number().int().min(0).max(80).default(1),
  unitsPerFloor: z.number().int().min(1).max(40),
  bedrooms: z.number().int().min(1).max(10).nullish(),
  area: z.number().positive(),
  price: z.number().positive(),
  floorRise: z.number().min(0).default(0),
  facing: z.string().nullish(),
  plotWidth: z.number().positive().nullish(),
  plotLength: z.number().positive().nullish(),
  landArea: z.number().positive().nullish(),
});

export async function generateUnits(projectId: string, raw: unknown, actor: Actor) {
  assertCan(actor, 'project.manage');
  const spec = GenerateUnits.parse(raw);
  if (spec.floorTo < spec.floorFrom) throw badRequest('The last floor is below the first floor');
  const project = await Project.findById(projectId);
  if (!project) throw notFound('Project');
  const type = project.type as PropertyType;
  const count = (spec.floorTo - spec.floorFrom + 1) * spec.unitsPerFloor;
  if (count > 400) throw badRequest('That would create more than 400 units at once; split it by block');

  const existing = new Set((await Property.find({ projectId: project._id, block: spec.block || null }).select('unitNumber').lean()).map((u) => u.unitNumber));
  const docs: Record<string, unknown>[] = [];
  let skipped = 0;
  let plotNo = 0;
  for (let floor = spec.floorFrom; floor <= spec.floorTo; floor++) {
    for (let n = 1; n <= spec.unitsPerFloor; n++) {
      plotNo++;
      const unitNumber = type === 'plot' ? `${spec.block ? `${spec.block}-` : ''}${plotNo}` : `${spec.block}${floor}${String(n).padStart(2, '0')}`;
      if (existing.has(unitNumber)) {
        skipped++;
        continue;
      }
      const price = Math.round(spec.price + spec.floorRise * Math.max(0, floor - spec.floorFrom));
      const details: Record<string, unknown> =
        type === 'plot'
          ? { length: spec.plotLength ?? null, width: spec.plotWidth ?? null, facing: spec.facing ?? null }
          : type === 'villa'
            ? { bedrooms: spec.bedrooms ?? null, landArea: spec.landArea ?? null, facing: spec.facing ?? null }
            : { bedrooms: spec.bedrooms ?? null, floor, facing: spec.facing ?? null };
      const label = type === 'plot' ? `Plot ${unitNumber}` : `${spec.bedrooms ? `${spec.bedrooms} BHK · ` : ''}${spec.block ? `${spec.block}-` : ''}${unitNumber}`;
      docs.push({
        code: await nextCode(PREFIX[type]),
        title: `${label} · ${project.name}`,
        type,
        purpose: 'sale',
        projectId: project._id,
        block: spec.block || null,
        unitNumber,
        price,
        area: spec.area,
        areaUnit: 'sqft',
        areaSqft: toSqft(spec.area, 'sqft'),
        city: project.city,
        locality: project.locality,
        address: project.address,
        details,
        amenities: project.amenities,
        approvals: project.reraNumber ? [{ name: 'RERA', documentUrl: null }] : [],
        extras: project.reraNumber ? [{ label: 'RERA number', value: project.reraNumber }] : [],
        listing: 'draft',
        availability: 'available',
        createdBy: actor.id,
      });
    }
  }
  if (docs.length) await Property.insertMany(docs);
  if (spec.block && !project.blocks.some((b) => b.name === spec.block)) {
    project.blocks.push({ name: spec.block, floors: spec.floorTo });
    await project.save();
  }
  await audit(actor, 'project', project._id, 'units', `Added ${docs.length} units${spec.block ? ` in block ${spec.block}` : ''}`);
  return { created: docs.length, skipped };
}

/** Publishes every draft unit in the project that has what it needs. */
export async function publishReadyUnits(projectId: string, actor: Actor) {
  assertCan(actor, 'property.publish');
  const drafts = await Property.find({ projectId, listing: 'draft' });
  let published = 0;
  const notReady: string[] = [];
  for (const u of drafts) {
    if (propertyReadiness(u.toObject() as Parameters<typeof propertyReadiness>[0]).ready) {
      u.listing = 'live';
      u.publishedAt = new Date();
      await u.save();
      published++;
    } else notReady.push(u.unitNumber ?? u.title);
  }
  if (published) await audit(actor, 'project', new mongoose.Types.ObjectId(projectId), 'publish', `Published ${published} units`);
  return { published, notReady };
}

/** Price revision across all unsold units: by percent or a flat amount per unit. */
export async function revisePrices(projectId: string, raw: unknown, actor: Actor) {
  assertCan(actor, 'property.edit');
  const { percent, amount } = z.object({ percent: z.number().min(-50).max(100).optional(), amount: z.number().optional() }).parse(raw);
  if (!percent && !amount) throw badRequest('Give a percent or an amount');
  const units = await Property.find({ projectId, availability: { $in: ['available', 'held'] }, listing: { $ne: 'archived' } });
  for (const u of units) {
    if (!u.price) continue;
    u.price = Math.round(percent ? u.price * (1 + percent / 100) : u.price + (amount ?? 0));
    await u.save();
  }
  await audit(actor, 'project', new mongoose.Types.ObjectId(projectId), 'price', `Revised prices on ${units.length} unsold units by ${percent ? `${percent}%` : `₹${amount}`}`);
  return { updated: units.length };
}
