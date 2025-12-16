/**
 * Zod validation schemas for file routes.
 */

import { z } from 'zod';

import { FileVisibility } from '../../entities';

/**
 * Schema for upload options in multipart form.
 */
export const uploadOptionsSchema = z.object({
  visibility: z.nativeEnum(FileVisibility).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * Schema for presigned upload request.
 */
export const presignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  size: z.number().int().positive(),
  visibility: z.nativeEnum(FileVisibility).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * Schema for confirming presigned upload.
 */
export const confirmUploadSchema = z.object({
  fileId: z.string().uuid(),
});

/**
 * Schema for updating file metadata.
 */
export const updateFileSchema = z.object({
  filename: z.string().min(1).max(255).optional(),
  visibility: z.nativeEnum(FileVisibility).optional(),
  description: z.string().max(1000).nullable().optional(),
});

/**
 * Schema for listing files with filters.
 */
export const listFilesSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  uploadedBy: z.string().uuid().optional(),
  mimeType: z.string().optional(),
  visibility: z.nativeEnum(FileVisibility).optional(),
});
