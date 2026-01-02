/**
 * File service for managing file uploads, downloads, and metadata.
 * Handles storage operations and database tracking.
 */

import { v4 as uuid } from 'uuid';

import { env } from '../../config/env';
import { File, FileStatus, FileVisibility } from '../../entities';
import {
  getStorageAdapter,
  isS3Configured,
  generateStorageKey,
  getFileExtension,
  isImageMimeType,
  sanitizeFilename,
  isFileTypeAllowed,
} from '../../lib/storage';

import {
  getFile as queryGetFile,
  getDownloadUrl as queryGetDownloadUrl,
  getThumbnailUrl as queryGetThumbnailUrl,
  listFiles as queryListFiles,
} from './queries';
import {
  generateAndUploadThumbnail,
  generateThumbnailAsync,
} from './thumbnail';
import { FileServiceError, FileErrorCode } from './types';

import type { ListFilesResult } from './queries';
import type {
  UploadFileParams,
  PresignUploadParams,
  PresignUploadResult,
  UpdateFileParams,
} from './types';
import type { EntityManager } from '@mikro-orm/core';

// Re-export types
export * from './types';
export type { ListFilesResult } from './queries';

/** Default presigned upload URL expiration (15 minutes) */
const PRESIGN_UPLOAD_EXPIRES_IN = 900;

/**
 * File service for managing file operations.
 */
export class FileService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Upload a file to storage and create a database record.
   */
  async uploadFile(params: UploadFileParams): Promise<File> {
    const {
      buffer,
      filename,
      mimeType,
      user,
      company,
      visibility = FileVisibility.COMPANY,
      description,
      metadata,
    } = params;

    this.validateFileUpload(mimeType, filename, buffer.length);

    const storage = getStorageAdapter();
    const fileId = uuid();
    const ext = getFileExtension(filename, mimeType);
    const storageKey = generateStorageKey(company.id, fileId, ext);
    const safeFilename = sanitizeFilename(filename);

    // Upload file to storage
    try {
      await storage.upload({
        key: storageKey,
        buffer,
        mimeType,
        metadata: { originalFilename: safeFilename, uploadedBy: user.id },
      });
    } catch (error) {
      throw new FileServiceError(
        `Failed to upload file: ${(error as Error).message}`,
        FileErrorCode.STORAGE_ERROR,
      );
    }

    // Generate thumbnail for images
    let thumbnailKey: string | undefined;
    if (isImageMimeType(mimeType)) {
      try {
        thumbnailKey = await generateAndUploadThumbnail(
          buffer,
          company.id,
          fileId,
          ext,
          mimeType,
        );
      } catch (error) {
        console.error('Thumbnail generation failed:', error);
      }
    }

    const file = this.createFileEntity(
      fileId,
      safeFilename,
      storageKey,
      mimeType,
      buffer.length,
      visibility,
      FileStatus.ACTIVE,
      company,
      user,
      { thumbnailKey, description, metadata },
    );

    await this.em.persistAndFlush(file);
    return file;
  }

  /**
   * Request a presigned URL for direct upload to S3.
   */
  async requestPresignedUpload(
    params: PresignUploadParams,
  ): Promise<PresignUploadResult> {
    if (!isS3Configured()) {
      throw new FileServiceError(
        'Presigned uploads require S3 storage configuration',
        FileErrorCode.PRESIGN_NOT_SUPPORTED,
      );
    }

    const {
      filename,
      mimeType,
      size,
      user,
      company,
      visibility = FileVisibility.COMPANY,
      description,
    } = params;

    this.validateFileUpload(mimeType, filename, size);

    const storage = getStorageAdapter();
    const fileId = uuid();
    const ext = getFileExtension(filename, mimeType);
    const storageKey = generateStorageKey(company.id, fileId, ext);
    const safeFilename = sanitizeFilename(filename);

    const presigned = await storage.generatePresignedUpload({
      key: storageKey,
      mimeType,
      expiresIn: PRESIGN_UPLOAD_EXPIRES_IN,
      maxSize: size,
    });

    const file = this.createFileEntity(
      fileId,
      safeFilename,
      storageKey,
      mimeType,
      size,
      visibility,
      FileStatus.PENDING,
      company,
      user,
      { description },
    );

    await this.em.persistAndFlush(file);

    return {
      fileId,
      uploadUrl: presigned.url,
      method: presigned.method,
      headers: presigned.headers,
      expiresAt: presigned.expiresAt,
    };
  }

  /**
   * Confirm a presigned upload has completed.
   */
  async confirmPresignedUpload(fileId: string, userId: string): Promise<File> {
    const file = await this.em.findOne(File, {
      id: fileId,
      uploadedBy: userId,
      status: FileStatus.PENDING,
    });

    if (!file) {
      throw new FileServiceError(
        'Pending file not found',
        FileErrorCode.FILE_NOT_FOUND,
      );
    }

    const storage = getStorageAdapter();
    if (!(await storage.exists(file.storageKey))) {
      throw new FileServiceError(
        'File not found in storage. Upload may have failed.',
        FileErrorCode.STORAGE_ERROR,
      );
    }

    file.status = FileStatus.ACTIVE;
    await this.em.flush();

    if (isImageMimeType(file.mimeType) && !file.thumbnailKey) {
      generateThumbnailAsync(file, this.em).catch(err => {
        console.error('Async thumbnail generation failed:', err);
      });
    }

    return file;
  }

  /** Get a file by ID. Delegates to query module. */
  async getFile(
    fileId: string,
    companyId: string,
    userId?: string,
  ): Promise<File | null> {
    return queryGetFile(this.em, fileId, companyId, userId);
  }

  /** Get download URL for a file. Delegates to query module. */
  async getDownloadUrl(
    fileId: string,
    companyId: string,
    userId?: string,
  ): Promise<string> {
    return queryGetDownloadUrl(this.em, fileId, companyId, userId);
  }

  /** Get thumbnail URL for a file. Delegates to query module. */
  async getThumbnailUrl(
    fileId: string,
    companyId: string,
    userId?: string,
  ): Promise<string | null> {
    return queryGetThumbnailUrl(this.em, fileId, companyId, userId);
  }

  /** List files for a company. Delegates to query module. */
  async listFiles(
    companyId: string,
    options?: Parameters<typeof queryListFiles>[2],
  ): Promise<ListFilesResult> {
    return queryListFiles(this.em, companyId, options);
  }

  /**
   * Update a file's metadata.
   */
  async updateFile(
    fileId: string,
    companyId: string,
    updates: UpdateFileParams,
  ): Promise<File> {
    const file = await this.em.findOne(File, {
      id: fileId,
      company: companyId,
      status: FileStatus.ACTIVE,
    });

    if (!file) {
      throw new FileServiceError(
        'File not found',
        FileErrorCode.FILE_NOT_FOUND,
      );
    }

    if (updates.filename) file.filename = sanitizeFilename(updates.filename);
    if (updates.visibility) file.visibility = updates.visibility;
    if (updates.description !== undefined)
      file.description = updates.description;
    if (updates.metadata) file.metadata = updates.metadata;

    await this.em.flush();
    return file;
  }

  /**
   * Soft delete a file and remove it from storage.
   * Uses fire-and-forget pattern for storage deletion to not block API response.
   */
  async deleteFile(fileId: string, companyId: string): Promise<void> {
    const file = await this.em.findOne(File, {
      id: fileId,
      company: companyId,
      status: FileStatus.ACTIVE,
    });

    if (!file) {
      throw new FileServiceError(
        'File not found',
        FileErrorCode.FILE_NOT_FOUND,
      );
    }

    // Soft delete first (ensures DB is consistent even if storage fails)
    file.status = FileStatus.DELETED;
    file.deletedAt = new Date();
    await this.em.flush();

    // Physical deletion (fire and forget - errors logged but don't fail the request)
    const storage = getStorageAdapter();

    // Delete main file from storage
    storage.delete(file.storageKey).catch(err => {
      console.error(`Failed to delete file from storage: ${file.storageKey}`, {
        error: err,
        fileId: file.id,
      });
    });

    // Delete thumbnail if exists
    if (file.thumbnailKey) {
      storage.delete(file.thumbnailKey).catch(err => {
        console.error(
          `Failed to delete thumbnail from storage: ${file.thumbnailKey}`,
          { error: err, fileId: file.id },
        );
      });
    }
  }

  /**
   * Permanently delete a soft-deleted file from storage and database.
   * Used by cleanup jobs to purge files after retention period.
   *
   * @param fileId - File ID to hard delete
   * @returns true if deleted, false if not found
   */
  async hardDeleteFile(fileId: string): Promise<boolean> {
    const file = await this.em.findOne(File, {
      id: fileId,
      status: FileStatus.DELETED,
    });

    if (!file) {
      return false;
    }

    const storage = getStorageAdapter();

    // Delete from storage (continue even if storage fails)
    try {
      await storage.delete(file.storageKey);
      if (file.thumbnailKey) {
        await storage.delete(file.thumbnailKey);
      }
    } catch (err) {
      console.error(`Hard delete storage error for file ${fileId}:`, {
        error: err,
        storageKey: file.storageKey,
        thumbnailKey: file.thumbnailKey,
      });
      // Continue to remove DB record even if storage fails
    }

    // Remove from database
    await this.em.removeAndFlush(file);
    return true;
  }

  /** Validate file upload parameters. */
  private validateFileUpload(
    mimeType: string,
    filename: string,
    size: number,
  ): void {
    if (!isFileTypeAllowed(mimeType, filename, env.ALLOWED_FILE_TYPES)) {
      throw new FileServiceError(
        `File type not allowed: ${mimeType}`,
        FileErrorCode.INVALID_FILE_TYPE,
      );
    }

    const maxSizeBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (size > maxSizeBytes) {
      throw new FileServiceError(
        `File too large. Maximum size is ${env.MAX_FILE_SIZE_MB}MB.`,
        FileErrorCode.FILE_TOO_LARGE,
      );
    }
  }

  /** Create a File entity with the given parameters. */
  private createFileEntity(
    id: string,
    filename: string,
    storageKey: string,
    mimeType: string,
    size: number,
    visibility: FileVisibility,
    status: FileStatus,
    company: UploadFileParams['company'],
    user: UploadFileParams['user'],
    options: {
      thumbnailKey?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): File {
    const file = new File();
    file.id = id;
    file.filename = filename;
    file.storageKey = storageKey;
    file.mimeType = mimeType;
    file.size = size;
    file.visibility = visibility;
    file.status = status;
    file.company = company;
    file.uploadedBy = user;

    if (options.thumbnailKey) file.thumbnailKey = options.thumbnailKey;
    if (options.description) file.description = options.description;
    if (options.metadata) file.metadata = options.metadata;

    return file;
  }
}
