/**
 * Storage module interface (TRD §11). Business code only talks to this interface, so the
 * local-disk provider can be swapped for another storage later without code changes.
 */
export interface SaveOptions {
  /** Folder relative to the storage root, e.g. "company/logo" or "properties/RE-VIL-000031/images". */
  folder: string;
  /** File extension without the dot, e.g. "webp". */
  ext: string;
}

export interface SavedFile {
  /** Relative path stored in MongoDB, e.g. "company/logo/3f9a…c1.png". */
  path: string;
  sizeBytes: number;
}

export interface StorageProvider {
  save(data: Buffer, options: SaveOptions): Promise<SavedFile>;
  delete(path: string): Promise<void>;
  /** URL the browser can use, e.g. "/uploads/company/logo/3f9a…c1.png". */
  publicUrl(path: string): string;
  /** Absolute path on disk, for internal reads (imports, error reports). */
  absolutePath(path: string): string;
}

/** Folders served publicly under /uploads. Everything else (e.g. imports/) stays private. */
export const PUBLIC_UPLOAD_FOLDERS = ['company', 'properties'] as const;
