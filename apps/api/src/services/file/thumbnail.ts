/**
 * Thumbnail generation utilities for image files.
 */

import sharp from 'sharp';

import {
  getStorageAdapter,
  generateThumbnailKey,
  getFileExtension,
} from '../../lib/storage';

import type { File } from '../../entities';
import type { EntityManager } from '@mikro-orm/core';

/** Thumbnail dimensions */
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 200;

/** Thumbnail output format - always PNG for consistency */
const THUMBNAIL_EXT = 'png';
const THUMBNAIL_MIME = 'image/png';

/**
 * Generate and upload a thumbnail for an image.
 * Always outputs PNG format for consistent rendering across browsers.
 *
 * @param buffer - Image buffer
 * @param companyId - Company ID for storage key
 * @param fileId - File ID for storage key
 * @param _ext - Original file extension (unused, thumbnails are always PNG)
 * @param _mimeType - Original MIME type (unused, thumbnails are always PNG)
 * @returns The thumbnail storage key
 */
export async function generateAndUploadThumbnail(
  buffer: Buffer,
  companyId: string,
  fileId: string,
  _ext: string,
  _mimeType: string,
): Promise<string> {
  // Generate thumbnail using sharp - always output PNG for consistency
  // This handles SVG and other formats that Sharp converts internally
  // Use 'contain' to preserve the entire image without cropping
  const thumbnail = await sharp(buffer)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
    })
    .png() // Always output PNG format
    .toBuffer();

  // Always use PNG extension for thumbnails
  const thumbnailKey = generateThumbnailKey(companyId, fileId, THUMBNAIL_EXT);
  const storage = getStorageAdapter();

  await storage.upload({
    key: thumbnailKey,
    buffer: thumbnail,
    mimeType: THUMBNAIL_MIME,
  });

  return thumbnailKey;
}

/**
 * Generate thumbnail asynchronously for presigned uploads.
 * Downloads the file, generates thumbnail, and updates the record.
 *
 * @param file - File entity to generate thumbnail for
 * @param em - Entity manager for database updates
 */
export async function generateThumbnailAsync(
  file: File,
  em: EntityManager,
): Promise<void> {
  const storage = getStorageAdapter();

  // Download the file
  const stream = await storage.download(file.storageKey);
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }

  const buffer = Buffer.concat(chunks);
  const ext = getFileExtension(file.filename, file.mimeType);

  // Generate and upload thumbnail
  const thumbnailKey = await generateAndUploadThumbnail(
    buffer,
    file.company.id,
    file.id,
    ext,
    file.mimeType,
  );

  // Update file record
  file.thumbnailKey = thumbnailKey;
  await em.flush();
}
