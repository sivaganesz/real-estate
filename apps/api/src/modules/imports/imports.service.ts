import { readFile } from 'node:fs/promises';
import { createPropertyBodySchema, MEDIA_RULES, normalizeLabel } from '@real-estate/shared';
import type {
  CommitImportBody,
  CreatePropertyBody,
  ImportBatch,
  ImportBatchDetail,
  ImportResult,
  PageMeta,
} from '@real-estate/shared';
import { AppError, conflict, notFound } from '../../lib/errors';
import { pageMeta, pageSkip } from '../../lib/http';
import type { Logger } from '../../lib/logger';
import { downloadPublicFile, RemoteFileError } from '../../lib/remoteFile';
import type { StorageProvider } from '../../lib/storage';
import type { PropertyMediaService } from '../properties/media.service';
import type { PropertiesService } from '../properties/properties.service';
import type { PropertyDoc } from '../properties/property.model';
import { PropertyModel } from '../properties/property.model';
import type { PropertyTypesService } from '../propertyTypes/propertyTypes.service';
import { getCompanyName } from '../settings/settings.service';
import { UserModel } from '../users/user.model';
import { columnForPath, columnsFor, parseRow } from './columns';
import type { ImportBatchDoc, ImportRowDoc } from './importBatch.model';
import { ImportBatchModel } from './importBatch.model';
import { buildErrorReport, buildTemplate, readUpload } from './workbook';

const IMAGE_CONCURRENCY = 4;

/** Same subcategory, area / locality and pincode, and the same plot number (or name). */
function duplicateKey(body: CreatePropertyBody): string | null {
  const loc = body.location;
  if (!loc?.locality || !loc.pincode) return null;
  const plot = body.attributeValues?.plot_number;
  const what = plot ? `plot:${normalizeLabel(String(plot))}` : `name:${normalizeLabel(body.title)}`;
  return [body.subcategoryId, normalizeLabel(loc.locality), loc.pincode, what].join('|');
}

const keyOfProperty = (p: PropertyDoc) =>
  duplicateKey({
    subcategoryId: p.subcategoryId,
    title: p.title,
    purpose: p.purpose,
    location: p.location,
    attributeValues: p.attributeValues,
  });

/** Runs `work` over `items`, at most `limit` at a time. */
async function inBatches<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item);
    }),
  );
}

/**
 * Bulk import (Phase 2.4): template per subcategory, upload and check every row (nothing is
 * saved), then import the valid rows as Draft or Published. All inside the request.
 */
export class ImportsService {
  private readonly propertyTypes: PropertyTypesService;
  private readonly properties: PropertiesService;
  private readonly media: PropertyMediaService;
  private readonly storage: StorageProvider;
  private readonly logger: Logger;
  private readonly fetchImpl?: typeof fetch;
  private readonly resolveHost?: (host: string) => Promise<string[]>;

  constructor(deps: {
    propertyTypes: PropertyTypesService;
    properties: PropertiesService;
    media: PropertyMediaService;
    storage: StorageProvider;
    logger: Logger;
    /** For tests: how photo links are downloaded. */
    fetchImpl?: typeof fetch;
    resolveHost?: (host: string) => Promise<string[]>;
  }) {
    this.resolveHost = deps.resolveHost;
    this.propertyTypes = deps.propertyTypes;
    this.properties = deps.properties;
    this.media = deps.media;
    this.storage = deps.storage;
    this.logger = deps.logger;
    this.fetchImpl = deps.fetchImpl;
  }

  async template(subcategoryId: string): Promise<{ data: Buffer; fileName: string }> {
    const def = await this.propertyTypes.definitionFor(subcategoryId);
    const data = await buildTemplate(def, columnsFor(def), await getCompanyName());
    const slug = def.subcategory.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return { data, fileName: `${slug}-import-template.xlsx` };
  }

  /** Saves the file, checks every row and finds duplicates. Nothing is imported yet. */
  async check(
    actorId: string,
    subcategoryId: string,
    file: { buffer: Buffer; originalname: string },
  ): Promise<ImportBatchDetail> {
    const def = await this.propertyTypes.definitionFor(subcategoryId);
    if (!def.category.isActive || !def.subcategory.isActive) {
      throw new AppError(
        422,
        'BUSINESS_RULE',
        `${def.subcategory.name} isn't active, so properties can't be imported into it.`,
      );
    }
    const columns = columnsFor(def);
    const { rows, unknownColumns } = await readUpload(file.buffer, columns);

    const checked: ImportRowDoc[] = [];
    for (const r of rows) {
      const parsed = parseRow(def, columns, r.cells);
      const errors = [...parsed.errors];
      const schema = createPropertyBodySchema.safeParse(parsed.body);
      if (!schema.success) {
        for (const issue of schema.error.issues) {
          const column = columnForPath(issue.path.join('.'), columns);
          errors.push(column ? `${column}: ${issue.message}` : issue.message);
        }
      } else {
        for (const p of await this.properties.problemsForNew(schema.data, def)) {
          const column = columnForPath(p.path, columns);
          errors.push(
            column && !p.message.startsWith(column) ? `${column}: ${p.message}` : p.message,
          );
        }
      }
      checked.push({
        row: r.row,
        status: errors.length ? 'invalid' : 'valid',
        errors: [...new Set(errors)],
        duplicateOf: null,
        body: parsed.body,
        imageUrls: parsed.imageUrls,
        outcome: null,
      });
    }
    await this.markDuplicates(subcategoryId, checked);

    const saved = await this.storage.save(file.buffer, { folder: 'imports', ext: 'xlsx' });
    const batch = await ImportBatchModel.create({
      subcategoryId,
      subcategoryName: def.subcategory.name,
      fileName: file.originalname.slice(0, 200),
      filePath: saved.path,
      status: 'checked',
      unknownColumns,
      rows: checked,
      createdBy: actorId,
    });
    return this.detail(batch._id);
  }

  /** Imports the checked rows. Each row's outcome is kept on the batch. */
  async commit(actorId: string, id: string, options: CommitImportBody): Promise<ImportBatchDetail> {
    const claimed = await ImportBatchModel.findOneAndUpdate(
      { _id: id, status: 'checked' },
      { $set: { status: 'imported', importedBy: actorId, importedAt: new Date(), ...options } },
      { returnDocument: 'before' },
    ).lean<ImportBatchDoc>();
    if (!claimed) {
      if (await ImportBatchModel.exists({ _id: id }))
        throw conflict(
          'This file was already imported. Upload it again to import more.',
          'ALREADY_IMPORTED',
        );
      throw notFound('Import not found');
    }
    const result: ImportResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      savedAsDraft: 0,
      imagesAdded: 0,
      imagesFailed: 0,
    };
    const rows = claimed.rows.map((r) => ({ ...r }));

    for (const r of rows) {
      if (r.status === 'invalid') {
        r.outcome = 'Not imported: fix the errors and upload again';
        result.skipped++;
        continue;
      }
      const updateId =
        r.status === 'duplicate' && r.duplicateOf?.id && options.duplicates === 'update'
          ? r.duplicateOf.id
          : null;
      if (r.status === 'duplicate' && !updateId) {
        r.outcome = r.duplicateOf?.row
          ? `Skipped: same as row ${r.duplicateOf.row}`
          : `Skipped: already exists as ${r.duplicateOf?.code}`;
        result.skipped++;
        continue;
      }
      try {
        const body = createPropertyBodySchema.parse(r.body);
        const property = updateId
          ? await this.properties.update(actorId, updateId, body)
          : await this.properties.create(actorId, body);
        const notes: string[] = [];
        const photos = await this.addPhotos(actorId, property.id, r.imageUrls, notes);
        result.imagesAdded += photos.added;
        result.imagesFailed += photos.failed;
        if (options.importAs === 'published' && property.status !== 'published') {
          try {
            await this.properties.changeStatus(actorId, property.id, 'published');
          } catch (err) {
            const issue =
              err instanceof AppError
                ? (err.details?.[0]?.message ?? err.message)
                : 'could not publish';
            notes.push(`saved as Draft: ${issue}`);
            result.savedAsDraft++;
          }
        }
        if (updateId) result.updated++;
        else result.created++;
        r.outcome = `${updateId ? 'Updated' : 'Created'} ${property.code}${notes.length ? ` (${notes.join('; ')})` : ''}`;
      } catch (err) {
        result.failed++;
        r.outcome = `Failed: ${err instanceof AppError ? (err.details?.[0]?.message ?? err.message) : 'something went wrong'}`;
        if (!(err instanceof AppError)) this.logger.error({ err, row: r.row }, 'Import row failed');
      }
    }
    await ImportBatchModel.updateOne({ _id: id }, { $set: { rows, result } });
    return this.detail(id);
  }

  async list(page: number, limit: number): Promise<{ items: ImportBatch[]; meta: PageMeta }> {
    const [docs, total] = await Promise.all([
      ImportBatchModel.find()
        .select('-rows')
        .sort({ createdAt: -1 })
        .skip(pageSkip(page, limit))
        .limit(limit)
        .lean<ImportBatchDoc[]>(),
      ImportBatchModel.countDocuments(),
    ]);
    const counts = await ImportBatchModel.aggregate<{
      _id: string;
      total: number;
      valid: number;
      invalid: number;
      duplicate: number;
    }>([
      { $match: { _id: { $in: docs.map((d) => d._id) } } },
      { $unwind: '$rows' },
      {
        $group: {
          _id: '$_id',
          total: { $sum: 1 },
          valid: { $sum: { $cond: [{ $eq: ['$rows.status', 'valid'] }, 1, 0] } },
          invalid: { $sum: { $cond: [{ $eq: ['$rows.status', 'invalid'] }, 1, 0] } },
          duplicate: { $sum: { $cond: [{ $eq: ['$rows.status', 'duplicate'] }, 1, 0] } },
        },
      },
    ]);
    const byId = new Map(counts.map((c) => [c._id, c]));
    const names = await this.userNames(docs.map((d) => d.createdBy));
    return {
      items: docs.map((d) => this.summary(d, byId.get(d._id), names)),
      meta: pageMeta(total, page, limit),
    };
  }

  async detail(id: string): Promise<ImportBatchDetail> {
    const doc = await ImportBatchModel.findById(id).lean<ImportBatchDoc>();
    if (!doc) throw notFound('Import not found');
    const names = await this.userNames([doc.createdBy]);
    const count = (s: string) => doc.rows.filter((r) => r.status === s).length;
    return {
      ...this.summary(
        doc,
        {
          total: doc.rows.length,
          valid: count('valid'),
          invalid: count('invalid'),
          duplicate: count('duplicate'),
        },
        names,
      ),
      rows: doc.rows.map((r) => ({
        row: r.row,
        status: r.status,
        title: r.body.title ?? '',
        city: r.body.location?.city ?? '',
        locality: r.body.location?.locality ?? '',
        price: r.body.price?.amount ?? null,
        errors: r.errors,
        duplicateOf: r.duplicateOf
          ? {
              id: r.duplicateOf.id ?? null,
              code: r.duplicateOf.code ?? null,
              row: r.duplicateOf.row ?? null,
            }
          : null,
        outcome: r.outcome ?? null,
      })),
    };
  }

  /** The rows that need attention (errors, duplicates, failed imports) with an "Errors" column. */
  async errorReport(id: string): Promise<{ data: Buffer; fileName: string }> {
    const doc = await ImportBatchModel.findById(id).lean<ImportBatchDoc>();
    if (!doc) throw notFound('Import not found');
    const problems = new Map<number, string>();
    for (const r of doc.rows) {
      if (r.status === 'invalid') problems.set(r.row, r.errors.join('; '));
      else if (r.status === 'duplicate') {
        problems.set(
          r.row,
          r.outcome ??
            (r.duplicateOf?.row
              ? `Same as row ${r.duplicateOf.row}`
              : `Already exists as ${r.duplicateOf?.code}`),
        );
      } else if (
        r.outcome?.startsWith('Failed') ||
        r.outcome?.includes('saved as Draft') ||
        r.outcome?.includes('photo')
      ) {
        problems.set(r.row, r.outcome);
      }
    }
    const data = await buildErrorReport(
      await readFile(this.storage.absolutePath(doc.filePath)),
      problems,
    );
    return { data, fileName: doc.fileName.replace(/\.xlsx$/i, '') + '-errors.xlsx' };
  }

  // ---------------------------------------------------------------- helpers

  /** Within the file (later rows) and against existing, not archived properties. */
  private async markDuplicates(subcategoryId: string, rows: ImportRowDoc[]) {
    const pincodes = [
      ...new Set(rows.map((r) => r.body.location?.pincode).filter((p): p is string => Boolean(p))),
    ];
    const existing = await PropertyModel.find({
      subcategoryId,
      status: { $ne: 'archived' },
      'location.pincode': { $in: pincodes },
    }).lean<PropertyDoc[]>();
    const existingByKey = new Map(
      existing.flatMap((p) => {
        const key = keyOfProperty(p);
        return key ? [[key, p] as const] : [];
      }),
    );
    const seen = new Map<string, number>();
    for (const r of rows) {
      if (r.status === 'invalid') continue;
      const key = duplicateKey(r.body);
      if (!key) continue;
      const earlier = seen.get(key);
      const match = existingByKey.get(key);
      if (earlier !== undefined) {
        r.status = 'duplicate';
        r.duplicateOf = { id: null, code: null, row: earlier };
      } else if (match) {
        r.status = 'duplicate';
        r.duplicateOf = { id: match._id, code: match.code, row: null };
      }
      if (earlier === undefined) seen.set(key, r.row);
    }
  }

  /** Downloads photo links and adds them (the first becomes the cover). */
  private async addPhotos(actorId: string, propertyId: string, urls: string[], notes: string[]) {
    let added = 0;
    let failed = 0;
    const downloads: ({ data: Buffer; fileName: string } | null)[] = new Array(urls.length).fill(
      null,
    );
    await inBatches(
      urls.map((url, i) => ({ url, i })),
      IMAGE_CONCURRENCY,
      async ({ url, i }) => {
        try {
          downloads[i] = await downloadPublicFile(url, {
            maxBytes: MEDIA_RULES.image.maxBytes,
            fetchImpl: this.fetchImpl,
            resolveHost: this.resolveHost,
          });
        } catch (err) {
          failed++;
          notes.push(
            `photo ${i + 1} skipped: ${err instanceof RemoteFileError ? err.message : 'download failed'}`,
          );
        }
      },
    );
    // Added in the sheet's order, one at a time.
    for (const [i, file] of downloads.entries()) {
      if (!file) continue;
      try {
        await this.media.upload(actorId, propertyId, 'image', {
          buffer: file.data,
          originalname: file.fileName,
          size: file.data.length,
        });
        added++;
      } catch (err) {
        failed++;
        notes.push(
          `photo ${i + 1} skipped: ${err instanceof AppError ? err.message : 'not a usable image'}`,
        );
      }
    }
    return { added, failed };
  }

  private summary(
    d: ImportBatchDoc,
    c: { total: number; valid: number; invalid: number; duplicate: number } | undefined,
    names: Map<string, string>,
  ): ImportBatch {
    return {
      id: d._id,
      subcategoryId: d.subcategoryId,
      subcategoryName: d.subcategoryName,
      fileName: d.fileName,
      status: d.status,
      rowCount: c?.total ?? 0,
      validCount: c?.valid ?? 0,
      invalidCount: c?.invalid ?? 0,
      duplicateCount: c?.duplicate ?? 0,
      unknownColumns: d.unknownColumns ?? [],
      importAs: d.importAs ?? null,
      duplicates: d.duplicates ?? null,
      result: d.result ?? null,
      createdAt: d.createdAt.toISOString(),
      createdBy:
        d.createdBy && names.has(d.createdBy)
          ? { id: d.createdBy, name: names.get(d.createdBy)! }
          : null,
      importedAt: d.importedAt ? new Date(d.importedAt).toISOString() : null,
    };
  }

  private async userNames(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => Boolean(x)))];
    const users = await UserModel.find({ _id: { $in: wanted } })
      .select('name')
      .lean<{ _id: string; name: string }[]>();
    return new Map(users.map((u) => [u._id, u.name]));
  }
}
