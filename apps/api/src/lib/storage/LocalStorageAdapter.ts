/**
 * Local filesystem storage adapter for development.
 * Mirrors S3 structure for consistency between environments.
 */

import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import type {
  LocalStorageConfig,
  PresignedUpload,
  PresignDownloadParams,
  PresignParams,
  StorageAdapter,
  UploadParams,
  UploadResult,
} from './types';

/**
 * Local filesystem storage adapter.
 * Uses the same key structure as S3 for consistency.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(config: LocalStorageConfig) {
    this.basePath = path.resolve(config.basePath);
    this.baseUrl = config.baseUrl ?? `http://localhost:4000/uploads`;
  }

  /**
   * Upload a file to local filesystem.
   */
  async upload(params: UploadParams): Promise<UploadResult> {
    const filePath = this.getFilePath(params.key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, params.buffer);

    return {
      key: params.key,
      size: params.buffer.length,
    };
  }

  /**
   * Download a file as a readable stream.
   */
  async download(key: string): Promise<Readable> {
    const filePath = this.getFilePath(key);

    // Check if file exists
    await this.assertFileExists(filePath);

    return Readable.from(createReadStream(filePath));
  }

  /**
   * Delete a file from local filesystem.
   */
  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if a file exists.
   */
  async exists(key: string): Promise<boolean> {
    const filePath = this.getFilePath(key);

    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a URL for downloading a file.
   * For local storage, this returns a direct URL to the file.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getSignedDownloadUrl(params: PresignDownloadParams): Promise<string> {
    // For local dev, we just return a direct URL
    // In production, the API would serve the file through a route
    return `${this.baseUrl}/${params.key}`;
  }

  /**
   * Generate presigned upload URL.
   * Local storage doesn't support presigned uploads - throws an error.
   * Use server-side upload for local development.
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async generatePresignedUpload(
    _params: PresignParams,
  ): Promise<PresignedUpload> {
    throw new Error(
      'Presigned uploads are not supported with local storage. ' +
        'Use server-side upload or configure S3 for presigned URL support.',
    );
  }

  /**
   * Stream upload from a readable stream to local filesystem.
   * Useful for piping uploads directly without buffering.
   */
  async uploadStream(key: string, stream: Readable): Promise<UploadResult> {
    const filePath = this.getFilePath(key);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Pipe stream to file
    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);

    // Get file size
    const stats = await fs.stat(filePath);

    return {
      key,
      size: stats.size,
    };
  }

  /**
   * Get the full filesystem path for a storage key.
   */
  private getFilePath(key: string): string {
    // Prevent path traversal attacks
    const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.basePath, normalizedKey);
  }

  /**
   * Assert that a file exists, throwing a descriptive error if not.
   */
  private async assertFileExists(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }
  }
}
