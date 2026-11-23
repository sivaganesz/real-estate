import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../lib/auth';
import { badRequest, notFound, parse } from '../lib/http';
import { memoryUpload } from '../lib/uploads';
import { ImportBatch, ImportFormat } from '../models/importBatch';
import { commitImport, errorReport, fixRow, listFormats, listImports, remap, startImport, templateWorkbook } from '../services/import';
import { IMPORT_FIELDS } from '../services/import/mapping';
import { registerTools } from '../ai/tools';

export const importsRouter = Router();
importsRouter.use(requirePermission('property.import'));

importsRouter.get('/', async (_req, res) => {
  res.json({ items: await listImports(), formats: await listFormats(), fields: IMPORT_FIELDS.map((f) => ({ key: f.key, label: f.label })) });
});

importsRouter.get('/template.xlsx', async (_req, res) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="estateos-property-template.xlsx"');
  res.send(await templateWorkbook());
});

importsRouter.post('/', memoryUpload().single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Choose a file to import');
  const opts = parse(z.object({ sender: z.string().max(80).optional(), defaultType: z.string().optional(), defaultCity: z.string().max(80).optional() }), req.body ?? {});
  const batch = await startImport(req.file, opts, req.actor);
  res.status(201).json({ batch: shape(batch) });
});

importsRouter.get('/:id', async (req, res) => {
  const b = await ImportBatch.findById(String(req.params.id)).lean();
  if (!b) throw notFound('Import');
  res.json({ batch: shape(b) });
});

importsRouter.patch('/:id/mapping', async (req, res) => {
  const body = parse(z.object({ mapping: z.array(z.object({ column: z.number(), field: z.string() })).default([]), defaultType: z.string().optional(), defaultCity: z.string().optional() }), req.body);
  res.json({ batch: shape(await remap(String(req.params.id), body.mapping, body, req.actor)) });
});

importsRouter.patch('/:id/rows/:index', async (req, res) => {
  const fixes = parse(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])), req.body);
  res.json({ batch: shape(await fixRow(String(req.params.id), Number(req.params.index), fixes, req.actor)) });
});

importsRouter.post('/:id/commit', async (req, res) => {
  const opts = parse(z.object({ asLive: z.boolean().default(false), duplicates: z.enum(['skip', 'update']).default('skip') }), req.body);
  res.json({ batch: shape(await commitImport(String(req.params.id), opts, req.actor)) });
});

importsRouter.get('/:id/errors.csv', async (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="import-problems.csv"');
  res.send('﻿' + (await errorReport(String(req.params.id))));
});

importsRouter.delete('/formats/:id', async (req, res) => {
  await ImportFormat.deleteOne({ _id: String(req.params.id) });
  res.json({ ok: true });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shape(b: Record<string, any>) {
  const rows = b.rows as { status: string }[];
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    id: String(b._id),
    fileName: b.fileName,
    sender: b.sender,
    kind: b.kind,
    sheetName: b.sheetName,
    headers: b.headers,
    mapping: b.mapping,
    defaultType: b.defaultType,
    defaultCity: b.defaultCity,
    status: b.status,
    aiUsed: b.aiUsed,
    counts: b.counts,
    summary: { total: rows.length, ready: count('ready'), draft: count('draft'), duplicate: count('duplicate'), error: count('error'), imported: count('imported'), updated: count('updated'), skipped: count('skipped') },
    rows: (b.rows as Record<string, unknown>[]).map((r) => ({ index: r.index, status: r.status, issues: r.issues, values: r.values, fixes: r.fixes, duplicateOf: r.duplicateOf, propertyId: r.propertyId ? String(r.propertyId) : null, source: r.source })),
  };
}

registerTools({
  name: 'recent_imports',
  kind: 'read',
  permission: 'property.import',
  description: 'Recent bulk imports: file, sender, who ran it, and how many rows were imported, updated, skipped or failed.',
  schema: z.object({}),
  run: async () => ({ data: await listImports() }),
});
