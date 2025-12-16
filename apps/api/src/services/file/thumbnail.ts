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

/**
 * Generate and upload a thumbnail for an image.
 *
 * @param buffer - Image buffer
 * @param companyId - Company ID for storage key
 * @param fileId - File ID for storage key
 * @param ext - File extension
 * @param mimeType - MIME type of the image
 * @returns The thumbnail storage key
 */
export async function generateAndUploadThumbnail(
  buffer: Buffer,
  companyId: string,
  fileId: string,
  ext: string,
  mimeType: string,
): Promise<string> {
  // Generate thumbnail using sharp
  const thumbnail = await sharp(buffer)
    .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
      fit: 'cover',
      position: 'center',
    })
    .toBuffer();

  const thumbnailKey = generateThumbnailKey(companyId, fileId, ext);
  const storage = getStorageAdapter();

  await storage.upload({
    key: thumbnailKey,
    buffer: thumbnail,
    mimeType,
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
