import { MAX_MEDIA_PER_PROPERTY, MEDIA_RULES } from '@real-estate/shared';
import type { MediaKind, Property } from '@real-estate/shared';
import { AppError, businessRule, conflict, notFound } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import type { DetectedFileType, StorageProvider } from '../../lib/storage';
import { detectFileType } from '../../lib/storage';
import { recordChange } from '../changeLogs/changeLog.service';
import { processImage } from './images';
import type { PropertiesService } from './properties.service';
import type { MediaDoc, PropertyDoc } from './property.model';
import { PropertyModel, sortMedia } from './property.model';

/** File contents each media kind accepts (checked from the file's bytes). */
const ACCEPTED: Record<MediaKind, readonly DetectedFileType[]> = {
  image: ['jpg', 'png', 'webp'],
  video: ['mp4', 'webm'],
  floor_plan: ['jpg', 'png', 'webp', 'pdf'],
  brochure: ['pdf'],
  document: ['pdf'],
};
const IMAGE_TYPES: readonly DetectedFileType[] = ['jpg', 'png', 'webp'];
const MIME: Record<DetectedFileType, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
};
const FOLDER: Record<'image' | 'video' | 'document', string> = {
  image: 'images',
  video: 'videos',
  document: 'documents',
};

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/**
 * Photos, videos, floor plans and documents of a property (Phase 2.2b). Files go through
 * the storage module (local disk today; another provider later), under
 * `properties/<code>/images|videos|documents`. Photos are saved as WebP in three sizes.
 */
export class PropertyMediaService {
  private readonly properties: PropertiesService;
  private readonly storage: StorageProvider;
  private readonly logger: Logger;

  constructor(deps: { properties: PropertiesService; storage: StorageProvider; logger: Logger }) {
    this.properties = deps.properties;
    this.storage = deps.storage;
    this.logger = deps.logger;
  }

  async upload(
    actorId: string,
    id: string,
    kind: MediaKind,
    file: UploadedFile,
  ): Promise<Property> {
    const property = await this.editable(id);
    if ((property.media ?? []).length >= MAX_MEDIA_PER_PROPERTY) {
      throw businessRule(
        `A property can have up to ${MAX_MEDIA_PER_PROPERTY} files. Delete some first.`,
      );
    }
    const rule = MEDIA_RULES[kind];
    if (file.size > rule.maxBytes) {
      throw new AppError(
        400,
        'FILE_TOO_LARGE',
        `A ${rule.label.toLowerCase()} can be up to ${rule.maxBytes / 1024 / 1024} MB.`,
      );
    }
    const type = detectFileType(file.buffer);
    if (!type || !ACCEPTED[kind].includes(type)) {
      throw new AppError(
        400,
        'INVALID_FILE_TYPE',
        `This file isn't a valid ${rule.label.toLowerCase()}. Allowed: ${rule.extensions.join(', ')}.`,
      );
    }

    const saved = await this.saveFiles(property.code, type, file.buffer);
    const media = {
      kind,
      path: saved.path,
      thumbPath: saved.thumbPath,
      mediumPath: saved.mediumPath,
      originalName: file.originalname.slice(0, 200),
      mime: saved.mime,
      sizeBytes: saved.sizeBytes,
      order: Math.max(-1, ...(property.media ?? []).map((m) => m.order)) + 1,
      isCover: false,
    };
    let mediaId: string;
    try {
      const updated = await PropertyModel.findOneAndUpdate(
        { _id: id, status: { $ne: 'archived' } },
        { $push: { media }, $set: { updatedBy: actorId } },
        { returnDocument: 'after' },
      ).lean<PropertyDoc>();
      if (!updated) throw businessRule("Archived properties can't be changed.");
      mediaId = updated.media.at(-1)!._id;
    } catch (err) {
      await this.deleteFiles([saved.path, saved.thumbPath, saved.mediumPath]);
      throw err;
    }
    // The first photo becomes the cover (atomic, so two uploads at once can't both be cover).
    if (kind === 'image') {
      await PropertyModel.updateOne(
        { _id: id, media: { $not: { $elemMatch: { isCover: true } } } },
        { $set: { 'media.$[m].isCover': true } },
        { arrayFilters: [{ 'm._id': mediaId }] },
      );
    }
    await recordChange({
      actorId,
      entity: 'property',
      entityId: id,
      action: 'media_added',
      changes: { media: [null, `${rule.label}: ${media.originalName}`] },
    });
    return this.properties.get(id);
  }

  /** `ids` must list every file of the property exactly once, in the new order. */
  async reorder(actorId: string, id: string, ids: string[]): Promise<Property> {
    const property = await this.editable(id);
    const current = property.media ?? [];
    const known = new Set(current.map((m) => m._id));
    const complete =
      ids.length === known.size &&
      new Set(ids).size === ids.length &&
      ids.every((x) => known.has(x));
    if (!complete) {
      throw conflict('The file list has changed. Reload the page and try again.', 'STALE_ORDER');
    }
    const position = new Map(ids.map((mediaId, i) => [mediaId, i]));
    await PropertyModel.updateOne(
      { _id: id },
      {
        $set: Object.fromEntries([
          ...current.map((m, i) => [`media.${i}.order`, position.get(m._id)!]),
          ['updatedBy', actorId],
        ]),
      },
    );
    await recordChange({ actorId, entity: 'property', entityId: id, action: 'media_reordered' });
    return this.properties.get(id);
  }

  async setCover(actorId: string, id: string, mediaId: string): Promise<Property> {
    const property = await this.editable(id);
    const target = this.findMedia(property, mediaId);
    if (target.kind !== 'image') throw businessRule('Only a photo can be the cover.');
    if (target.isCover) return this.properties.get(id);
    const before = (property.media ?? []).find((m) => m.isCover);
    await PropertyModel.updateOne(
      { _id: id },
      {
        $set: Object.fromEntries([
          ...(property.media ?? []).map((m, i) => [`media.${i}.isCover`, m._id === mediaId]),
          ['updatedBy', actorId],
        ]),
      },
    );
    await recordChange({
      actorId,
      entity: 'property',
      entityId: id,
      action: 'cover_changed',
      changes: { cover: [before?.originalName ?? null, target.originalName] },
    });
    return this.properties.get(id);
  }

  /** Deletes the file; the next photo becomes the cover. A published property keeps one photo. */
  async remove(actorId: string, id: string, mediaId: string): Promise<Property> {
    const property = await this.editable(id);
    const target = this.findMedia(property, mediaId);
    const photos = (property.media ?? []).filter((m) => m.kind === 'image');
    if (property.status === 'published' && target.kind === 'image' && photos.length === 1) {
      throw businessRule(
        'A published property needs at least one photo. Add another first, or unpublish it.',
      );
    }
    await PropertyModel.updateOne(
      { _id: id },
      { $pull: { media: { _id: mediaId } }, $set: { updatedBy: actorId } },
    );
    if (target.isCover) {
      const next = sortMedia(photos.filter((m) => m._id !== mediaId))[0];
      if (next) {
        await PropertyModel.updateOne(
          { _id: id },
          { $set: { 'media.$[m].isCover': true } },
          { arrayFilters: [{ 'm._id': next._id }] },
        );
      }
    }
    await this.deleteFiles([target.path, target.thumbPath, target.mediumPath]);
    await recordChange({
      actorId,
      entity: 'property',
      entityId: id,
      action: 'media_removed',
      changes: { media: [`${MEDIA_RULES[target.kind].label}: ${target.originalName}`, null] },
    });
    return this.properties.get(id);
  }

  // ---------------------------------------------------------------- helpers

  private async editable(id: string): Promise<PropertyDoc> {
    const property = await PropertyModel.findById(id).lean<PropertyDoc>();
    if (!property) throw notFound('Property not found');
    if (property.status === 'archived') {
      throw businessRule("Archived properties can't be changed. Restore it as a draft first.");
    }
    return property;
  }

  private findMedia(property: PropertyDoc, mediaId: string): MediaDoc {
    const media = (property.media ?? []).find((m) => m._id === mediaId);
    if (!media) throw notFound('File not found');
    return media;
  }

  /** Saves the file(s); photos become three WebP sizes. Cleans up if anything fails. */
  private async saveFiles(code: string, type: DetectedFileType, data: Buffer) {
    if (IMAGE_TYPES.includes(type)) {
      let images;
      try {
        images = await processImage(data);
      } catch {
        throw new AppError(400, 'INVALID_FILE_TYPE', "This image can't be read. Try another file.");
      }
      const folder = `properties/${code}/${FOLDER.image}`;
      const saved: string[] = [];
      try {
        for (const buffer of [images.large, images.medium, images.thumb]) {
          saved.push((await this.storage.save(buffer, { folder, ext: 'webp' })).path);
        }
      } catch (err) {
        await this.deleteFiles(saved);
        throw err;
      }
      return {
        path: saved[0]!,
        mediumPath: saved[1]!,
        thumbPath: saved[2]!,
        mime: 'image/webp',
        sizeBytes: images.large.length,
      };
    }
    const folder = `properties/${code}/${type === 'pdf' ? FOLDER.document : FOLDER.video}`;
    const file = await this.storage.save(data, { folder, ext: type });
    return {
      path: file.path,
      mediumPath: null,
      thumbPath: null,
      mime: MIME[type],
      sizeBytes: file.sizeBytes,
    };
  }

  /** A leftover file is harmless, so failed deletes are logged rather than failing the request. */
  private async deleteFiles(paths: (string | null)[]): Promise<void> {
    for (const path of paths) {
      if (!path) continue;
      try {
        await this.storage.delete(path);
      } catch (err) {
        this.logger.warn({ err, path }, 'Could not delete a property file');
      }
    }
  }
}
