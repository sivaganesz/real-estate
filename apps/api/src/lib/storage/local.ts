import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SavedFile, SaveOptions, StorageProvider } from './types';

const SAFE_SEGMENT = /^[\w.-]+$/;

/** A stored value that is already a full URL (cloud storage) rather than a local path. */
export const isAbsoluteUrl = (value: string) => /^https:\/\//i.test(value);
const SAFE_EXT = /^[a-z0-9]{1,10}$/;

/** Splits a relative path into safe segments; rejects "..", absolute paths and odd characters. */
function safeSegments(relative: string): string[] {
  const segments = relative.split(/[\\/]+/).filter((s) => s.length > 0);
  if (segments.length === 0) throw new Error('Storage path is empty');
  for (const segment of segments) {
    if (segment === '.' || segment === '..' || !SAFE_SEGMENT.test(segment)) {
      throw new Error(`Invalid storage path segment: "${segment}"`);
    }
  }
  return segments;
}

/**
 * Stores files on the server's disk under `rootDir` (default `apps/api/uploads`).
 * File names are generated (random id + extension); the original name is kept only in
 * the database by the calling module.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly root: string;
  private readonly baseUrl: string;

  constructor(rootDir: string, baseUrl = '/uploads') {
    this.root = path.resolve(rootDir);
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async save(data: Buffer, { folder, ext }: SaveOptions): Promise<SavedFile> {
    const extension = ext.toLowerCase().replace(/^\./, '');
    if (!SAFE_EXT.test(extension)) throw new Error(`Invalid file extension: "${ext}"`);

    const name = `${randomBytes(12).toString('hex')}.${extension}`;
    const relative = [...safeSegments(folder), name].join('/');
    const absolute = this.absolutePath(relative);

    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, data, { flag: 'wx' });
    return { path: relative, sizeBytes: data.length };
  }

  async delete(relative: string): Promise<void> {
    if (isAbsoluteUrl(relative)) return; // stored by a cloud provider, not on this disk
    try {
      await unlink(this.absolutePath(relative));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  /** Browser URL; a full https URL (e.g. from Cloudinary) is returned unchanged. */
  publicUrl(relative: string): string {
    if (isAbsoluteUrl(relative)) return relative;
    return `${this.baseUrl}/${safeSegments(relative).join('/')}`;
  }

  absolutePath(relative: string): string {
    const absolute = path.resolve(this.root, ...safeSegments(relative));
    if (!absolute.startsWith(this.root + path.sep)) {
      throw new Error('Storage path is outside the upload folder');
    }
    return absolute;
  }
}
