/**
 * Types and interfaces for file operations.
 */

import type { FileVisibility } from '../../entities';
import type { Company, User } from '../../entities';

/**
 * Parameters for uploading a file.
 */
export interface UploadFileParams {
  /** File buffer (from multer) */
  buffer: Buffer;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** User uploading the file */
  user: User;
  /** Company the file belongs to */
  company: Company;
  /** Optional file visibility (defaults to COMPANY) */
  visibility?: FileVisibility;
  /** Optional description */
  description?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for requesting a presigned upload URL.
 */
export interface PresignUploadParams {
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** User uploading the file */
  user: User;
  /** Company the file belongs to */
  company: Company;
  /** Optional file visibility (defaults to COMPANY) */
  visibility?: FileVisibility;
  /** Optional description */
  description?: string;
}

/**
 * Result of requesting a presigned upload URL.
 */
export interface PresignUploadResult {
  /** The file ID (for confirmation) */
  fileId: string;
  /** Presigned upload URL */
  uploadUrl: string;
  /** HTTP method to use */
  method: 'PUT' | 'POST';
  /** Headers to include */
  headers: Record<string, string>;
  /** Expiration timestamp */
  expiresAt: Date;
}

/**
 * Parameters for updating a file.
 */
export interface UpdateFileParams {
  /** New filename (optional) */
  filename?: string;
  /** New visibility (optional) */
  visibility?: FileVisibility;
  /** New description (optional) */
  description?: string;
  /** Updated metadata (optional) */
  metadata?: Record<string, unknown>;
}

/**
 * Error codes for file operations.
 */
export enum FileErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PRESIGN_NOT_SUPPORTED = 'PRESIGN_NOT_SUPPORTED',
  ACCESS_DENIED = 'ACCESS_DENIED',
}

/**
 * File service error class.
 */
export class FileServiceError extends Error {
  constructor(
    message: string,
    public readonly code: FileErrorCode,
  ) {
    super(message);
    this.name = 'FileServiceError';
  }
}
