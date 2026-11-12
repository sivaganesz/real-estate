import sharp from 'sharp';

/** Sizes saved for every photo (longest side, in pixels). Never enlarged. */
export const IMAGE_SIZES = { large: 2000, medium: 1200, thumb: 400 } as const;

export interface ProcessedImage {
  large: Buffer;
  medium: Buffer;
  thumb: Buffer;
}

/**
 * Turns an uploaded JPG / PNG / WebP into three WebP files. Applies the camera's rotation
 * and drops metadata (GPS location and camera details are not kept). Throws if the file
 * isn't a readable image.
 */
export async function processImage(data: Buffer): Promise<ProcessedImage> {
  const source = sharp(data, { failOn: 'error', limitInputPixels: 100_000_000 }).rotate();
  const resize = (size: number, quality: number) =>
    source
      .clone()
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  const [large, medium, thumb] = await Promise.all([
    resize(IMAGE_SIZES.large, 82),
    resize(IMAGE_SIZES.medium, 80),
    resize(IMAGE_SIZES.thumb, 75),
  ]);
  return { large, medium, thumb };
}
