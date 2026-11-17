import { rm } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { ChangeLogModel } from '../modules/changeLogs/changeLog.model';
import { ImportBatchModel } from '../modules/imports/importBatch.model';
import { CounterModel, PropertyModel } from '../modules/properties/property.model';
import { ensureStartingPropertyTypes } from '../modules/propertyTypes/propertyTypes.defaults';
import {
  AmenityModel,
  PropertyAttributeModel,
  PropertyCategoryModel,
  PropertySubcategoryModel,
} from '../modules/propertyTypes/propertyTypes.model';

/** Upload sub-folders that belong to properties and imports (nothing else is touched). */
const UPLOAD_FOLDERS = ['properties', 'imports'] as const;

export interface CatalogueCounts {
  properties: number;
  importBatches: number;
  propertyTypes: number;
  attributes: number;
  amenities: number;
  changeLogs: number;
}

export async function catalogueCounts(): Promise<CatalogueCounts> {
  const [properties, importBatches, propertyTypes, attributes, amenities, changeLogs] =
    await Promise.all([
      PropertyModel.countDocuments(),
      ImportBatchModel.countDocuments(),
      PropertySubcategoryModel.countDocuments(),
      PropertyAttributeModel.countDocuments(),
      AmenityModel.countDocuments(),
      ChangeLogModel.countDocuments({ entity: { $in: ['property', 'propertyType'] } }),
    ]);
  return { properties, importBatches, propertyTypes, attributes, amenities, changeLogs };
}

/**
 * Replaces the property catalogue and all property data with catalogue v2 (PRD v2
 * PROP-13). For development and test databases that hold test data only: removes
 * properties, their files, import batches, property types, attributes, amenities, code
 * counters and their change logs, then seeds the v2 catalogue. Users, roles, company
 * settings and the other change logs are kept. Refused in production.
 */
export async function resetCatalogue(opts: {
  nodeEnv: string;
  uploadDir: string;
}): Promise<CatalogueCounts> {
  if (opts.nodeEnv === 'production') {
    throw new Error('db:reset-catalogue is for development and test databases only.');
  }
  const removed = await catalogueCounts();
  await Promise.all([
    PropertyModel.deleteMany({}),
    ImportBatchModel.deleteMany({}),
    PropertySubcategoryModel.deleteMany({}),
    PropertyAttributeModel.deleteMany({}),
    AmenityModel.deleteMany({}),
    PropertyCategoryModel.deleteMany({}),
    CounterModel.deleteMany({ _id: /^property:/ }),
    ChangeLogModel.deleteMany({ entity: { $in: ['property', 'propertyType'] } }),
  ]);
  const root = path.resolve(opts.uploadDir);
  for (const folder of UPLOAD_FOLDERS) {
    const target = path.resolve(root, folder);
    // Only ever a direct sub-folder of the upload folder.
    if (path.dirname(target) !== root) throw new Error(`Refusing to delete ${target}`);
    await rm(target, { recursive: true, force: true });
  }
  await ensureStartingPropertyTypes();
  await mongoose.syncIndexes();
  return removed;
}
