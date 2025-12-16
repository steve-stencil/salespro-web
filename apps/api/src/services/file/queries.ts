/**
 * File query operations.
 * Read-only operations for retrieving files and URLs.
 */

import { File, FileStatus, FileVisibility } from '../../entities';
import { getStorageAdapter } from '../../lib/storage';

import { FileServiceError, FileErrorCode } from './types';

import type { EntityManager } from '@mikro-orm/core';

/** Default presigned download URL expiration (1 hour) */
const PRESIGN_DOWNLOAD_EXPIRES_IN = 3600;

/**
 * Get a file by ID, optionally checking access permissions.
 *
 * @param em - Entity manager
 * @param fileId - File ID to retrieve
 * @param companyId - Company ID for authorization
 * @param userId - Optional user ID for private file access check
 * @returns File entity or null if not found/not accessible
 */
export async function getFile(
  em: EntityManager,
  fileId: string,
  companyId: string,
  userId?: string,
): Promise<File | null> {
  const file = await em.findOne(
    File,
    { id: fileId, company: companyId, status: FileStatus.ACTIVE },
    { populate: ['uploadedBy'] },
  );

  if (!file) return null;

  // Check visibility-based access
  if (file.visibility === FileVisibility.PRIVATE && userId) {
    if (file.uploadedBy.id !== userId) return null;
  }

  return file;
}

/**
 * Get a download URL for a file.
 *
 * @param em - Entity manager
 * @param fileId - File ID
 * @param companyId - Company ID for authorization
 * @param userId - Optional user ID for private file access
 * @returns Signed download URL
 * @throws FileServiceError if file not found
 */
export async function getDownloadUrl(
  em: EntityManager,
  fileId: string,
  companyId: string,
  userId?: string,
): Promise<string> {
  const file = await getFile(em, fileId, companyId, userId);
  if (!file) {
    throw new FileServiceError('File not found', FileErrorCode.FILE_NOT_FOUND);
  }

  const storage = getStorageAdapter();
  return await storage.getSignedDownloadUrl({
    key: file.storageKey,
    expiresIn: PRESIGN_DOWNLOAD_EXPIRES_IN,
    filename: file.filename,
  });
}

/**
 * Get a download URL for a file's thumbnail.
 *
 * @param em - Entity manager
 * @param fileId - File ID
 * @param companyId - Company ID for authorization
 * @param userId - Optional user ID for private file access
 * @returns Signed thumbnail URL or null if no thumbnail
 */
export async function getThumbnailUrl(
  em: EntityManager,
  fileId: string,
  companyId: string,
  userId?: string,
): Promise<string | null> {
  const file = await getFile(em, fileId, companyId, userId);
  if (!file?.thumbnailKey) return null;

  const storage = getStorageAdapter();
  return await storage.getSignedDownloadUrl({
    key: file.thumbnailKey,
    expiresIn: PRESIGN_DOWNLOAD_EXPIRES_IN,
  });
}

/**
 * Result type for listFiles operation.
 */
export type ListFilesResult = {
  files: File[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * List files for a company with pagination.
 *
 * @param em - Entity manager
 * @param companyId - Company ID
 * @param options - Pagination and filter options
 * @returns Paginated list of files
 */
export async function listFiles(
  em: EntityManager,
  companyId: string,
  options: {
    page?: number;
    limit?: number;
    uploadedBy?: string;
    mimeType?: string;
    visibility?: FileVisibility;
  } = {},
): Promise<ListFilesResult> {
  const { page = 1, limit = 20, uploadedBy, mimeType, visibility } = options;
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {
    company: companyId,
    status: FileStatus.ACTIVE,
  };

  if (uploadedBy) where['uploadedBy'] = uploadedBy;
  if (mimeType) where['mimeType'] = { $like: `${mimeType}%` };
  if (visibility) where['visibility'] = visibility;

  const [files, total] = await em.findAndCount(File, where, {
    limit,
    offset,
    orderBy: { createdAt: 'DESC' },
    populate: ['uploadedBy'],
  });

  return { files, total, page, totalPages: Math.ceil(total / limit) };
}
