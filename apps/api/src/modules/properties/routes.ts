import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config';
import { z } from 'zod';
import { AVAILABILITY, PROPERTY_TYPES } from '@estate/shared';
import { requirePermission } from '../../lib/auth';
import { badRequest, notFound, parse } from '../../lib/http';
import { Property } from '../../models/property';
import { documentUpload, memoryUpload, photoUpload, publicUrl } from '../../lib/uploads';
import {
  createProperty,
  ensureShareToken,
  findDuplicates,
  getProperty,
  searchProperties,
  serialiseProperty,
  setAvailability,
  setListing,
  statusCounts,
  updateProperty,
} from '../../services/properties';
import { fitCounts } from '../../services/matching';
import { comparables, propertyHistory } from '../../services/propertyInsights';
import { createProject, generateUnits, getProjectWithUnits, listProjects, publishReadyUnits, revisePrices, updateProject } from '../../services/projects';
import { applyLayout, layoutFromMap, setProjectPublished, syncApprovals } from '../../services/projectLayout';
import { Project } from '../../models/property';
import { extractProperties } from '../../ai/extract';
import { knownPlaces, parseSearchText } from '../../ai/rules';
import { audit } from '../../lib/auth';

export const propertiesRouter = Router();
export const projectsRouter = Router();

const csv = (v: unknown) => (typeof v === 'string' && v ? v.split(',') : undefined);
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));

const ListQuery = z.object({
  q: z.string().optional(),
  types: z.array(z.enum(PROPERTY_TYPES)).optional(),
  availability: z.array(z.enum(AVAILABILITY)).optional(),
  listing: z.array(z.enum(['draft', 'live', 'archived'])).optional(),
  projectId: z.string().optional(),
  standalone: z.boolean().optional(),
  budgetMax: z.number().optional(),
  budgetMin: z.number().optional(),
  areaMin: z.number().optional(),
  areaMax: z.number().optional(),
  purpose: z.enum(['sale', 'rent', 'lease']).optional(),
  localities: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  withFit: z.boolean().optional(),
  withCounts: z.boolean().optional(),
  bedrooms: z.number().optional(),
  city: z.string().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'updated']).optional(),
  limit: z.number().optional(),
  skip: z.number().optional(),
  smart: z.boolean().optional(),
});

/**
 * One search box for everything: plain words go through the same reader the
 * assistant uses ("2 bhk under 70 lakhs in porur"), so the list understands them too.
 */
propertiesRouter.get('/', async (req, res) => {
  const qy = req.query as Record<string, string>;
  const f = parse(ListQuery, {
    ...qy,
    types: csv(qy.types),
    availability: csv(qy.availability),
    listing: csv(qy.listing),
    budgetMax: num(qy.budgetMax),
    budgetMin: num(qy.budgetMin),
    areaMin: num(qy.areaMin),
    areaMax: num(qy.areaMax),
    localities: csv(qy.localities),
    amenities: csv(qy.amenities),
    withFit: qy.withFit === 'true' || undefined,
    withCounts: qy.withCounts === 'true' || undefined,
    bedrooms: num(qy.bedrooms),
    limit: num(qy.limit),
    skip: num(qy.skip),
    standalone: qy.standalone === 'true' || undefined,
    smart: qy.smart !== 'false',
  });
  let understood: string[] = [];
  let filters: Parameters<typeof searchProperties>[0] = { ...f };
  if (f.q && f.smart) {
    const parsed = parseSearchText(f.q, await knownPlaces());
    if (parsed.understood.length) {
      const { understood: u, ...rest } = parsed;
      understood = u;
      filters = { ...filters, ...rest, types: f.types ?? rest.types, q: undefined };
    }
  }
  const result = await searchProperties(filters, req.actor);
  // Optional extras for the list page: leads that fit each listing, and counts per status tab.
  const [fit, counts] = await Promise.all([f.withFit ? fitCounts(result.items as never, req.actor) : null, f.withCounts ? statusCounts(filters, req.actor) : null]);
  const items = fit ? result.items.map((i) => ({ ...i, fitCount: fit.get(i.id) ?? 0 })) : result.items;
  res.json({ items, total: result.total, understood, ...(counts ? { counts } : {}) });
});

propertiesRouter.get('/places', async (_req, res) => {
  res.json(await knownPlaces());
});

propertiesRouter.post('/extract', requirePermission('property.create'), memoryUpload().single('file'), async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : undefined;
  res.json(await extractProperties({ text, file: req.file }));
});

propertiesRouter.post('/check-duplicates', requirePermission('property.create'), async (req, res) => {
  const body = req.body as Parameters<typeof findDuplicates>[0];
  if (!body?.type) throw badRequest('type is required');
  res.json({ duplicates: await findDuplicates(body, req.body.excludeId) });
});

propertiesRouter.post('/', async (req, res) => {
  const p = await createProperty(req.body, req.actor, { allowDuplicate: req.query.allowDuplicate === 'true' });
  res.status(201).json({ property: serialiseProperty(p) });
});

propertiesRouter.get('/:id', async (req, res) => {
  const p = await getProperty(String(req.params.id), req.actor);
  res.json({ property: serialiseProperty(p) });
});

propertiesRouter.get('/:id/history', async (req, res) => {
  res.json({ items: await propertyHistory(String(req.params.id), req.actor) });
});

propertiesRouter.get('/:id/comparables', async (req, res) => {
  res.json(await comparables(String(req.params.id), req.actor));
});

propertiesRouter.patch('/:id', async (req, res) => {
  const p = await updateProperty(String(req.params.id), req.body, req.actor);
  res.json({ property: serialiseProperty(p) });
});

propertiesRouter.post('/:id/listing', async (req, res) => {
  const { to } = parse(z.object({ to: z.enum(['draft', 'live', 'archived']) }), req.body);
  const p = await setListing(String(req.params.id), to, req.actor);
  res.json({ property: serialiseProperty(p) });
});

propertiesRouter.post('/:id/availability', async (req, res) => {
  const { to, reason, heldUntil } = parse(z.object({ to: z.enum(AVAILABILITY), reason: z.string().max(300).optional(), heldUntil: z.string().datetime({ offset: true }).optional() }), req.body);
  const p = await setAvailability(String(req.params.id), to, req.actor, { reason, heldUntil: heldUntil ? new Date(heldUntil) : undefined });
  res.json({ property: serialiseProperty(p) });
});

propertiesRouter.post('/:id/share', requirePermission('property.share'), async (req, res) => {
  const token = await ensureShareToken(String(req.params.id));
  res.json({ token, path: `/p/${token}` });
});

propertiesRouter.post('/:id/photos', requirePermission('property.edit'), photoUpload.array('files', 20), async (req, res) => {
  const p = await Property.findById(String(req.params.id));
  if (!p) throw notFound('Property');
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw badRequest('Choose at least one photo');
  for (const f of files) p.media.push({ url: publicUrl('photos', f.filename), kind: 'photo' });
  await p.save();
  await audit(req.actor, 'property', p._id, 'media', `Added ${files.length} photo${files.length === 1 ? '' : 's'}`);
  res.json({ property: serialiseProperty(p.toObject()) });
});

propertiesRouter.post('/:id/photos/reorder', requirePermission('property.edit'), async (req, res) => {
  const { urls } = parse(z.object({ urls: z.array(z.string()) }), req.body);
  const p = await Property.findById(String(req.params.id));
  if (!p) throw notFound('Property');
  const byUrl = new Map(p.media.map((m) => [m.url, m]));
  p.set('media', urls.map((u) => byUrl.get(u)).filter(Boolean));
  await p.save();
  res.json({ property: serialiseProperty(p.toObject()) });
});

propertiesRouter.post('/:id/documents', requirePermission('property.edit'), documentUpload.single('file'), async (req, res) => {
  const { name, approval } = parse(z.object({ name: z.string().trim().min(2).max(80), approval: z.string().optional() }), req.body);
  const p = await Property.findById(String(req.params.id));
  if (!p || !req.file) throw notFound('Property');
  const url = publicUrl('documents', req.file.filename);
  if (approval) {
    // An approval's document lives on the approval. A new file has to be checked again.
    const a = p.approvals.find((x) => x.name === approval);
    if (a) {
      a.documentUrl = url;
      a.verified = false;
    } else p.approvals.push({ name: approval, documentUrl: url, verified: false });
  } else {
    p.documents.push({ name, url, uploadedAt: new Date() });
  }
  await p.save();
  await audit(req.actor, 'property', p._id, 'document', `Uploaded ${name}`);
  res.json({ property: serialiseProperty(p.toObject()) });
});

propertiesRouter.post('/:id/approvals/:name/verify', requirePermission('property.publish'), async (req, res) => {
  const p = await Property.findById(String(req.params.id));
  const a = p?.approvals.find((x) => x.name === String(req.params.name));
  if (!p || !a) throw notFound('Approval');
  if (!a.documentUrl) throw badRequest('Upload the document before marking it verified');
  a.verified = true;
  await p.save();
  await audit(req.actor, 'property', p._id, 'verify', `Verified ${a.name}`);
  res.json({ property: serialiseProperty(p.toObject()) });
});

propertiesRouter.delete('/:id/media', requirePermission('property.edit'), async (req, res) => {
  const { url } = parse(z.object({ url: z.string() }), req.query);
  const p = await Property.findById(String(req.params.id));
  if (!p) throw notFound('Property');
  p.set('media', p.media.filter((m) => m.url !== url));
  await p.save();
  if (url.startsWith('/uploads/photos/')) fs.promises.unlink(path.join(config.uploadDir, 'photos', path.basename(url))).catch(() => {});
  res.json({ property: serialiseProperty(p.toObject()) });
});

// Projects -------------------------------------------------------------------

projectsRouter.get('/', async (req, res) => {
  const items = await listProjects();
  // Executives sell what's published; drafts are the managers' workspace.
  res.json({ items: req.actor.role === 'executive' ? items.filter((p) => p.published) : items });
});
projectsRouter.post('/', async (req, res) => {
  res.status(201).json({ project: await createProject(req.body, req.actor) });
});
projectsRouter.get('/:id', async (req, res) => {
  res.json(await getProjectWithUnits(String(req.params.id), req.actor));
});
projectsRouter.patch('/:id', async (req, res) => {
  res.json({ project: await updateProject(String(req.params.id), req.body, req.actor) });
});
projectsRouter.post('/:id/units', async (req, res) => {
  res.json(await generateUnits(String(req.params.id), req.body, req.actor));
});
projectsRouter.post('/:id/publish-ready', async (req, res) => {
  res.json(await publishReadyUnits(String(req.params.id), req.actor));
});
projectsRouter.post('/:id/revise-prices', async (req, res) => {
  res.json(await revisePrices(String(req.params.id), req.body, req.actor));
});

projectsRouter.put('/:id/layout', async (req, res) => {
  res.json(await applyLayout(String(req.params.id), req.body, req.actor));
});
projectsRouter.post('/:id/publish', async (req, res) => {
  const { published } = parse(z.object({ published: z.boolean() }), req.body);
  res.json(await setProjectPublished(String(req.params.id), published, req.actor));
});
projectsRouter.post('/layout-from-map', requirePermission('project.manage'), memoryUpload(/^(application\/pdf|image\/(jpeg|png|webp))$/).single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Upload the layout drawing');
  res.json(await layoutFromMap(req.file));
});
projectsRouter.post('/:id/approvals/:name/document', requirePermission('project.manage'), documentUpload.single('file'), async (req, res) => {
  const p = await Project.findById(String(req.params.id));
  const badge = p?.approvalBadges.find((b) => b.name === String(req.params.name));
  if (!p || !badge || !req.file) throw notFound('Approval');
  badge.documentUrl = publicUrl('documents', req.file.filename);
  await p.save();
  await syncApprovals(p._id);
  await audit(req.actor, 'project', p._id, 'document', `Uploaded the ${badge.name} document`);
  res.json({ ok: true });
});
