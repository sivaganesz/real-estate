import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalStorageProvider } from './local';
import { fileExtension, isAllowedFile } from './upload';

describe('LocalStorageProvider', () => {
  let root: string;
  let storage: LocalStorageProvider;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 're-storage-'));
    storage = new LocalStorageProvider(root);
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('saves a file under the folder with a generated name', async () => {
    const saved = await storage.save(Buffer.from('hello'), {
      folder: 'properties/RE-VIL-000031/images',
      ext: 'WEBP',
    });
    expect(saved.path).toMatch(/^properties\/RE-VIL-000031\/images\/[a-f0-9]{24}\.webp$/);
    expect(saved.sizeBytes).toBe(5);
    expect(await readFile(storage.absolutePath(saved.path), 'utf8')).toBe('hello');
    expect(storage.publicUrl(saved.path)).toBe(`/uploads/${saved.path}`);
  });

  it('deletes files and ignores files that are already gone', async () => {
    const saved = await storage.save(Buffer.from('x'), { folder: 'company/logo', ext: 'png' });
    await storage.delete(saved.path);
    expect(existsSync(storage.absolutePath(saved.path))).toBe(false);
    await expect(storage.delete(saved.path)).resolves.toBeUndefined();
  });

  it('rejects paths that escape the upload folder', async () => {
    expect(() => storage.absolutePath('../outside.txt')).toThrow();
    expect(() => storage.publicUrl('company/../../etc/passwd')).toThrow();
    await expect(
      storage.save(Buffer.from('x'), { folder: '../evil', ext: 'png' }),
    ).rejects.toThrow();
    await expect(
      storage.save(Buffer.from('x'), { folder: 'company', ext: 'p/ng' }),
    ).rejects.toThrow();
  });
});

describe('upload rules', () => {
  it('reads extensions', () => {
    expect(fileExtension('Logo.PNG')).toBe('png');
    expect(fileExtension('noext')).toBe('');
  });

  it('checks both extension and MIME type', () => {
    expect(isAllowedFile('image', 'logo.png', 'image/png')).toBe(true);
    expect(isAllowedFile('image', 'logo.png', 'application/pdf')).toBe(false);
    expect(isAllowedFile('image', 'script.svg', 'image/svg+xml')).toBe(false);
    expect(isAllowedFile('pdf', 'brochure.pdf', 'application/pdf')).toBe(true);
  });
});
