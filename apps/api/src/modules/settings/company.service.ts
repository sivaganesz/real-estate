import type { CompanySettings, UpdateCompanySettings } from '@real-estate/shared';
import { AppError } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import type { StorageProvider } from '../../lib/storage';
import { detectImageType } from '../../lib/storage';
import { diffFields, recordChange } from '../changeLogs/changeLog.service';
import { UserModel } from '../users/user.model';
import { DEFAULT_COMPANY_SETTINGS } from './company.defaults';
import { SettingsModel } from './settings.model';

const KEY = 'company';
const LOGO_FOLDER = 'company/logo';

/** What is stored in `settings.value` for the "company" key (TRD §7.4). */
interface StoredCompany {
  name: string;
  shortDescription: string;
  logoPath: string | null;
  address: string;
  officeLocation: { lat: number; lng: number } | null;
  phone: string;
  email: string;
}

interface StoredDoc {
  _id: string;
  value: Partial<StoredCompany>;
  updatedBy?: string | null;
  updatedAt?: Date;
}

const TRACKED_FIELDS = [
  'name',
  'shortDescription',
  'address',
  'officeLocation',
  'phone',
  'email',
] as const;

/** Empty strings from the starting defaults are returned as null. */
const orNull = (value: string | null | undefined) => (value ? value : null);

/** Settings → Company info (PRD ADM-SET-01): read by every signed-in user, edited with `settings:edit`. */
export class CompanySettingsService {
  private readonly storage: StorageProvider;
  private readonly logger: Logger;

  constructor(deps: { storage: StorageProvider; logger: Logger }) {
    this.storage = deps.storage;
    this.logger = deps.logger;
  }

  private load() {
    return SettingsModel.findOne({ key: KEY }).lean<StoredDoc>();
  }

  private async toResponse(doc: StoredDoc | null): Promise<CompanySettings> {
    const value = { ...DEFAULT_COMPANY_SETTINGS, ...doc?.value };
    const updater = doc?.updatedBy
      ? await UserModel.findById(doc.updatedBy).select('name').lean<{ _id: string; name: string }>()
      : null;
    return {
      name: value.name,
      shortDescription: value.shortDescription ?? '',
      logoUrl: value.logoPath ? this.storage.publicUrl(value.logoPath) : null,
      address: value.address ?? '',
      officeLocation: value.officeLocation ?? null,
      phone: orNull(value.phone),
      email: orNull(value.email),
      isConfigured: Boolean(doc && value.email),
      updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null,
      updatedBy: updater ? { id: updater._id, name: updater.name } : null,
    };
  }

  async get(): Promise<CompanySettings> {
    return this.toResponse(await this.load());
  }

  async update(actorId: string, input: UpdateCompanySettings): Promise<CompanySettings> {
    const before = await this.load();
    const value: StoredCompany = {
      ...input,
      logoPath: before?.value.logoPath ?? null,
    };
    const after = await SettingsModel.findOneAndUpdate(
      { key: KEY },
      { $set: { value, updatedBy: actorId } },
      { upsert: true, returnDocument: 'after' },
    ).lean<StoredDoc>();

    const changes = diffFields(
      { ...DEFAULT_COMPANY_SETTINGS, ...before?.value },
      value as unknown as Record<string, unknown>,
      TRACKED_FIELDS,
    );
    if (Object.keys(changes).length > 0) {
      await recordChange({
        actorId,
        entity: 'settings',
        entityId: after!._id,
        action: before ? 'updated' : 'created',
        changes,
      });
    }
    return this.toResponse(after);
  }

  /**
   * Saves a new logo (PNG, JPG or WebP, checked by its content) and deletes the old file.
   * The file is saved first, so a failed save never leaves the company without its logo.
   */
  async replaceLogo(actorId: string, data: Buffer): Promise<CompanySettings> {
    const ext = detectImageType(data);
    if (!ext) {
      throw new AppError(400, 'INVALID_FILE_TYPE', 'The logo must be a PNG, JPG or WebP image.');
    }
    const saved = await this.storage.save(data, { folder: LOGO_FOLDER, ext });
    const before = await this.load();
    const oldPath = before?.value.logoPath ?? null;

    let after: StoredDoc | null;
    try {
      after = await SettingsModel.findOneAndUpdate(
        { key: KEY },
        before
          ? { $set: { 'value.logoPath': saved.path, updatedBy: actorId } }
          : // Logo uploaded before Company info was ever saved: start from the defaults.
            {
              $set: {
                value: { ...DEFAULT_COMPANY_SETTINGS, logoPath: saved.path },
                updatedBy: actorId,
              },
            },
        { upsert: true, returnDocument: 'after' },
      ).lean<StoredDoc>();
    } catch (err) {
      await this.storage.delete(saved.path);
      throw err;
    }

    if (oldPath) await this.deleteFile(oldPath);
    await recordChange({
      actorId,
      entity: 'settings',
      entityId: after!._id,
      action: 'logo_updated',
      changes: { logo: [oldPath, saved.path] },
    });
    return this.toResponse(after);
  }

  async removeLogo(actorId: string): Promise<CompanySettings> {
    const before = await this.load();
    const oldPath = before?.value.logoPath ?? null;
    if (!before || !oldPath) return this.toResponse(before);

    const after = await SettingsModel.findOneAndUpdate(
      { key: KEY },
      { $set: { 'value.logoPath': null, updatedBy: actorId } },
      { returnDocument: 'after' },
    ).lean<StoredDoc>();
    await this.deleteFile(oldPath);
    await recordChange({
      actorId,
      entity: 'settings',
      entityId: before._id,
      action: 'logo_removed',
      changes: { logo: [oldPath, null] },
    });
    return this.toResponse(after);
  }

  /** A leftover file is harmless, so a failed delete is logged rather than failing the request. */
  private async deleteFile(path: string): Promise<void> {
    try {
      await this.storage.delete(path);
    } catch (err) {
      this.logger.warn({ err, path }, 'Could not delete the old logo file');
    }
  }
}
