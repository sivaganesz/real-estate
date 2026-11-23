import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { PROPERTY_TYPES, PROPERTY_TYPE_LABEL, can, propertyReadiness, type PropertyType } from '@estate/shared';
import { ImportBatch, ImportFormat } from '../../models/importBatch';
import { Project, Property } from '../../models/property';
import { audit, assertCan, type Actor } from '../../lib/auth';
import { HttpError, notFound } from '../../lib/http';
import { createProperty, setAvailability, setListing, updateProperty } from '../properties';
import { extractProperties } from '../../ai/extract';
import { readSheet, toCsv, type Cell } from './sheet';
import { IMPORT_FIELDS, TEMPLATE_HEADERS, mapColumns, rememberFormat, type ColumnMap } from './mapping';
import { buildRow, markDuplicates, type RowResult } from './rows';

type File = { buffer: Buffer; originalname: string; mimetype: string };

async function projectList() {
  return (await Project.find().select('name').lean()).map((p) => ({ id: String(p._id), name: p.name }));
}

/** Re-checks every row from its raw cells + mapping + any fixes typed on the Check screen. */
async function evaluate(batch: InstanceType<typeof ImportBatch>) {
  const projects = await projectList();
  const results: (RowResult & { index: number })[] = [];
  for (const row of batch.rows) {
    if (batch.kind === 'brochure') {
      const values = { ...(row.values as Record<string, unknown>), ...(row.fixes as Record<string, unknown>) } as RowResult['values'];
      const r = values.type ? propertyReadiness(values as Parameters<typeof propertyReadiness>[0]) : null;
      results.push({
        index: row.index!,
        values,
        photoUrls: [],
        status: !values.type ? 'error' : r!.ready ? 'ready' : 'draft',
        issues: !values.type ? ['Type is missing'] : r!.ready ? [] : [`Missing ${r!.missing.map((m) => m.label.toLowerCase()).join(', ')} — will be saved as a draft`],
      });
    } else {
      results.push({ index: row.index!, ...buildRow(row.raw as Cell[], batch.mapping as ColumnMap[], (row.fixes ?? {}) as Record<string, unknown>, { defaultType: batch.defaultType ?? undefined, defaultCity: batch.defaultCity ?? undefined, projects }) });
    }
  }
  await markDuplicates(results);
  for (const r of results) {
    const row = batch.rows.find((x) => x.index === r.index)!;
    row.status = r.status;
    row.issues = r.issues;
    if (batch.kind === 'sheet') row.values = { ...r.values, _availability: r.availability, _photos: r.photoUrls };
    row.duplicateOf = r.duplicateOf;
  }
  batch.markModified('rows');
}

export async function startImport(file: File, opts: { sender?: string; defaultType?: string; defaultCity?: string }, actor: Actor) {
  assertCan(actor, 'property.import', 'Only sales managers and admins import properties');
  if (opts.defaultType && !PROPERTY_TYPES.includes(opts.defaultType as PropertyType)) throw new HttpError(400, 'Unknown default type');
  const batch = new ImportBatch({ fileName: file.originalname, sender: opts.sender?.trim() || undefined, defaultType: opts.defaultType || undefined, defaultCity: opts.defaultCity || undefined, createdBy: actor.id, createdByName: actor.name });

  if (file.mimetype === 'application/pdf' || /^image\//.test(file.mimetype)) {
    // Brochures and catalogues: the AI finds each property (one per unit type).
    const out = await extractProperties({ file });
    batch.kind = 'brochure';
    batch.aiUsed = out.mode === 'gemini';
    batch.rows = out.properties.map((p, i) => ({
      index: i,
      raw: [],
      fixes: {},
      values: {
        type: p.type ?? opts.defaultType ?? undefined,
        purpose: p.purpose ?? 'sale',
        title: p.title,
        price: p.price,
        priceNegotiable: p.priceNegotiable,
        area: p.area,
        areaUnit: p.areaUnit ?? 'sqft',
        city: p.city ?? opts.defaultCity ?? null,
        locality: p.locality,
        address: p.address,
        pincode: p.pincode,
        details: p.details,
        amenities: p.amenities,
        highlights: p.highlights,
        description: p.description,
        approvals: p.approvals.map((name) => ({ name })),
        extras: p.extras,
        sources: p.sources,
      },
      source: Object.entries(p.sources).slice(0, 3).map(([k, v]) => `${k}: “${v}”`).join(' · '),
    })) as never;
  } else {
    const sheet = await readSheet(file.buffer, file.originalname);
    const { mapping, aiUsed, savedFormat } = await mapColumns(sheet.headers, sheet.rows, opts.sender);
    batch.kind = 'sheet';
    batch.sheetName = `${sheet.name}${sheet.skipped.length ? ` (${sheet.skipped.join('; ')})` : ''}${savedFormat ? ' · saved format recognised' : ''}`;
    batch.headers = sheet.headers;
    batch.mapping = mapping as never;
    batch.aiUsed = aiUsed;
    batch.rows = sheet.rows.map((raw, index) => ({ index, raw, fixes: {} })) as never;
  }
  await evaluate(batch);
  await batch.save();
  return batch.toObject();
}

export async function remap(id: string, mapping: { column: number; field: string }[], opts: { defaultType?: string; defaultCity?: string }, actor: Actor) {
  assertCan(actor, 'property.import');
  const batch = await ImportBatch.findById(id);
  if (!batch || batch.status !== 'checking') throw notFound('Import');
  for (const m of mapping) {
    const cur = batch.mapping.find((x) => x.column === m.column);
    if (cur && IMPORT_FIELDS.some((f) => f.key === m.field) && cur.field !== m.field) {
      // One column per field: a field moved here is released elsewhere.
      if (m.field !== 'extra' && m.field !== 'ignore') for (const other of batch.mapping) if (other.field === m.field) other.field = 'extra';
      cur.field = m.field;
      cur.how = 'manual';
      cur.confidence = 'high';
    }
  }
  if (opts.defaultType !== undefined) batch.defaultType = opts.defaultType || undefined;
  if (opts.defaultCity !== undefined) batch.defaultCity = opts.defaultCity || undefined;
  batch.markModified('mapping');
  await evaluate(batch);
  await batch.save();
  return batch.toObject();
}

export async function fixRow(id: string, index: number, fixes: Record<string, unknown>, actor: Actor) {
  assertCan(actor, 'property.import');
  const batch = await ImportBatch.findById(id);
  if (!batch || batch.status !== 'checking') throw notFound('Import');
  const row = batch.rows.find((r) => r.index === index);
  if (!row) throw notFound('Row');
  row.fixes = { ...(row.fixes ?? {}), ...fixes };
  if (fixes.skip !== undefined) row.fixes.skip = fixes.skip;
  await evaluate(batch);
  await batch.save();
  return batch.toObject();
}

/**
 * Nothing is saved before this step. Ready rows become live (or drafts),
 * incomplete rows become drafts, duplicates are skipped or update the existing one.
 */
export async function commitImport(id: string, opts: { asLive: boolean; duplicates: 'skip' | 'update' }, actor: Actor) {
  assertCan(actor, 'property.import');
  const batch = await ImportBatch.findById(id);
  if (!batch) throw notFound('Import');
  if (batch.status === 'done') throw new HttpError(409, 'This import was already completed');
  const asLive = opts.asLive && can(actor.role, 'property.publish');
  const counts = { imported: 0, updated: 0, skipped: 0, failed: 0 };
  for (const row of batch.rows) {
    const fixes = (row.fixes ?? {}) as { skip?: boolean };
    const v = { ...(row.values as Record<string, unknown>) };
    const availability = v._availability as string | undefined;
    const photos = (v._photos as string[] | undefined) ?? [];
    delete v._availability;
    delete v._photos;
    if (fixes.skip) {
      row.status = 'skipped';
      counts.skipped++;
      continue;
    }
    try {
      if (row.status === 'error') {
        counts.failed++;
        continue;
      }
      if (row.status === 'duplicate') {
        if (opts.duplicates === 'update' && row.duplicateOf?.id) {
          const { type: _t, projectId: _p, ...changes } = v;
          void _t;
          void _p;
          await updateProperty(row.duplicateOf.id, Object.fromEntries(Object.entries(changes).filter(([, x]) => x !== null && x !== undefined && !(Array.isArray(x) && !x.length))), actor);
          row.status = 'updated';
          row.propertyId = new mongoose.Types.ObjectId(row.duplicateOf.id);
          counts.updated++;
        } else {
          row.status = 'skipped';
          counts.skipped++;
        }
        continue;
      }
      const p = await createProperty(v, actor, { allowDuplicate: true, importBatchId: batch._id });
      if (photos.length) await Property.updateOne({ _id: p._id }, { $push: { media: { $each: photos.map((url) => ({ url, kind: 'photo' })) } } });
      if (row.status === 'ready' && asLive) {
        await setListing(String(p._id), 'live', actor);
        if (availability && availability !== 'available') await setAvailability(String(p._id), availability as 'sold', actor, { reason: 'From import', system: true });
      }
      row.status = 'imported';
      row.propertyId = p._id;
      counts.imported++;
    } catch (err) {
      row.status = 'error';
      row.issues = [err instanceof Error ? err.message : 'Could not save'];
      counts.failed++;
    }
  }
  batch.status = 'done';
  batch.options = opts;
  batch.counts = counts;
  batch.finishedAt = new Date();
  batch.markModified('rows');
  await batch.save();
  if (batch.sender && batch.kind === 'sheet') await rememberFormat(batch.sender, batch.headers, batch.mapping as ColumnMap[]);
  await audit(actor, 'import', batch._id, 'commit', `Imported ${counts.imported}, updated ${counts.updated}, skipped ${counts.skipped} from ${batch.fileName}`);
  return batch.toObject();
}

export async function errorReport(id: string) {
  const batch = await ImportBatch.findById(id).lean();
  if (!batch) throw notFound('Import');
  const bad = batch.rows.filter((r) => r.status === 'error' || r.status === 'skipped' || r.status === 'duplicate' || r.status === 'draft');
  if (batch.kind === 'brochure') return toCsv([['Title', 'Status', 'Problems'], ...bad.map((r) => [(r.values as { title?: string })?.title ?? '', r.status, (r.issues ?? []).join('; ')])]);
  return toCsv([[...batch.headers, 'Status', 'Problems'], ...bad.map((r) => [...(r.raw as unknown[]), r.status, (r.issues ?? []).join('; ')])]);
}

export async function listImports() {
  const items = await ImportBatch.find().sort({ createdAt: -1 }).limit(30).select('-rows').lean();
  return items.map((b) => ({ id: String(b._id), fileName: b.fileName, sender: b.sender, kind: b.kind, status: b.status, counts: b.counts, createdAt: b.createdAt, by: b.createdByName, aiUsed: b.aiUsed }));
}

export async function listFormats() {
  return (await ImportFormat.find().sort({ updatedAt: -1 }).lean()).map((f) => ({ id: String(f._id), sender: f.sender, columns: f.mapping.length, uses: f.uses, updatedAt: f.updatedAt }));
}

/** Our template: one tab to fill, dropdowns for fixed values, an instructions tab, one example row. */
export async function templateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Properties');
  ws.addRow(TEMPLATE_HEADERS);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4F1' } };
  const example: Record<string, string | number> = {
    Title: '2 BHK apartment in Porur',
    Type: 'Apartment',
    For: 'Sale',
    Price: '62 L',
    Area: 1080,
    'Area unit': 'sq.ft',
    City: 'Chennai',
    Locality: 'Porur',
    BHK: 2,
    Floor: 3,
    'Total floors': 5,
    Facing: 'East',
    Amenities: 'Lift, Car parking, Power backup',
    Negotiable: 'Yes',
  };
  ws.addRow(TEMPLATE_HEADERS.map((h) => example[h] ?? null));
  ws.columns.forEach((c) => (c.width = 16));
  const col = (h: string) => (TEMPLATE_HEADERS as string[]).indexOf(h) + 1;
  const list = (h: string, values: string[]) => {
    for (let r = 2; r <= 2001; r++) ws.getCell(r, col(h)).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${values.join(',')}"`] };
  };
  list('Type', PROPERTY_TYPES.map((t) => PROPERTY_TYPE_LABEL[t].replace(',', '')));
  list('For', ['Sale', 'Rent', 'Lease']);
  list('Area unit', ['sq.ft', 'sq.yd', 'sq.m', 'cent', 'ground', 'acre']);
  list('Facing', ['North', 'East', 'South', 'West', 'North-East', 'North-West', 'South-East', 'South-West']);
  const help = wb.addWorksheet('Instructions');
  help.addRow(['One property per row on the Properties tab, up to 2,000 rows.']);
  help.addRow(['Prices can be written as 6200000, 62 L, 62 lakhs or 1.2 Cr.']);
  help.addRow(['Area can include its unit (1,200 sqft, 3 cents, 2.5 acres) or use the Area unit column.']);
  help.addRow(['Only Type, Price, Area, City, Locality and two key details per type are needed for a property to go live. Rows missing them are saved as drafts.']);
  help.addRow(['Columns you add yourself are kept as internal details, not lost.']);
  help.getColumn(1).width = 120;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
