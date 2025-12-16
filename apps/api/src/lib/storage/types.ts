/**
 * Storage adapter types and interfaces for file storage operations.
 * Supports both local filesystem and S3 storage backends.
 */

import type { Readable } from 'stream';

// Re-export FileVisibility from entity types for convenience
export { FileVisibility } from '../../entities/types';

/**
 * Parameters for uploading a file to storage.
 */
export interface UploadParams {
  /** The storage key (path) where the file will be stored */
  key: string;
  /** File content as a Buffer */
  buffer: Buffer;
  /** MIME type of the file */
  mimeType: string;
  /** Optional metadata to store with the file */
  metadata?: Record<string, string>;
}

/**
 * Result of a successful file upload.
 */
export interface UploadResult {
  /** The storage key where the file was stored */
  key: string;
  /** Size of the uploaded file in bytes */
  size: number;
  /** ETag or hash of the file (for S3 compatibility) */
  etag?: string;
}

/**
 * Parameters for generating a presigned upload URL.
 */
export interface PresignParams {
  /** The storage key (path) where the file will be stored */
  key: string;
  /** MIME type of the file to be uploaded */
  mimeType: string;
  /** Expiration time in seconds (default: 900 = 15 minutes) */
  expiresIn?: number;
  /** Maximum file size allowed in bytes */
  maxSize?: number;
}

/**
 * Result of generating a presigned upload URL.
 */
export interface PresignedUpload {
  /** The presigned URL for direct upload */
  url: string;
  /** HTTP method to use (typically PUT) */
  method: 'PUT' | 'POST';
  /** Headers to include with the upload request */
  headers: Record<string, string>;
  /** The storage key where the file will be stored */
  key: string;
  /** Expiration timestamp */
  expiresAt: Date;
}

/**
 * Parameters for generating a presigned download URL.
 */
export interface PresignDownloadParams {
  /** The storage key of the file to download */
  key: string;
  /** Expiration time in seconds (default: 3600 = 1 hour) */
  expiresIn?: number;
  /** Optional filename for Content-Disposition header */
  filename?: string;
}

/**
 * Storage adapter interface.
 * Implementations must provide these methods for file operations.
 */
export interface StorageAdapter {
  /**
   * Upload a file to storage.
   * @param params Upload parameters including key, buffer, and mimeType
   * @returns Upload result with storage key and size
   */
  upload(params: UploadParams): Promise<UploadResult>;

  /**
   * Download a file from storage as a readable stream.
   * @param key The storage key of the file
   * @returns Readable stream of the file content
   */
  download(key: string): Promise<Readable>;

  /**
   * Delete a file from storage.
   * @param key The storage key of the file to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists in storage.
   * @param key The storage key to check
   * @returns True if the file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get a signed URL for downloading a file.
   * @param params Download parameters including key and optional expiry
   * @returns Signed URL for downloading the file
   */
  getSignedDownloadUrl(params: PresignDownloadParams): Promise<string>;

  /**
   * Generate a presigned URL for direct upload to storage.
   * Only supported by S3 adapter - local adapter will throw.
   * @param params Presign parameters including key and mimeType
   * @returns Presigned upload details
   */
  generatePresignedUpload(params: PresignParams): Promise<PresignedUpload>;
}

/**
 * Configuration for S3 storage adapter.
 */
export interface S3StorageConfig {
  /** S3 bucket name */
  bucket: string;
  /** AWS region */
  region: string;
  /** Optional endpoint URL (for S3-compatible services) */
  endpoint?: string;
}

/**
 * Configuration for local storage adapter.
 */
export interface LocalStorageConfig {
  /** Base path for local file storage */
  basePath: string;
  /** Base URL for serving files (for local dev server) */
  baseUrl?: string;
}
