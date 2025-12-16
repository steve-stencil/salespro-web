/**
 * Utility functions for file routes.
 */

import { FileErrorCode } from '../../services/file';

import type { FileVisibility } from '../../entities';
import type { User, Company } from '../../entities';
import type { FileServiceError } from '../../services/file';
import type { Response } from 'express';

/**
 * Request type with authenticated user.
 */
export interface AuthenticatedFileRequest {
  user?: User & { company?: Company };
  file?: Express.Multer.File;
}

/**
 * Map FileServiceError to HTTP response.
 */
export function handleFileServiceError(
  err: FileServiceError,
  res: Response,
): void {
  switch (err.code) {
    case FileErrorCode.FILE_NOT_FOUND:
      res.status(404).json({ error: err.message, code: err.code });
      break;
    case FileErrorCode.INVALID_FILE_TYPE:
    case FileErrorCode.FILE_TOO_LARGE:
      res.status(400).json({ error: err.message, code: err.code });
      break;
    case FileErrorCode.PRESIGN_NOT_SUPPORTED:
      res.status(501).json({ error: err.message, code: err.code });
      break;
    case FileErrorCode.ACCESS_DENIED:
      res.status(403).json({ error: err.message, code: err.code });
      break;
    case FileErrorCode.STORAGE_ERROR:
    default:
      res.status(500).json({ error: err.message, code: err.code });
      break;
  }
}

/**
 * Format file response for API.
 */
export function formatFileResponse(file: {
  id: string;
  filename: string;
  mimeType: string;
  size: number | bigint;
  visibility: FileVisibility;
  description?: string | null;
  thumbnailKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy?: { id: string; email: string };
}): Record<string, unknown> {
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
    size: Number(file.size),
    visibility: file.visibility,
    description: file.description,
    hasThumbnail: !!file.thumbnailKey,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    uploadedBy: file.uploadedBy
      ? { id: file.uploadedBy.id, email: file.uploadedBy.email }
      : undefined,
  };
}
