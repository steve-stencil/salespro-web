/**
 * AWS S3 storage adapter for production file storage.
 * Supports both direct uploads and presigned URLs for client-side uploads.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type {
  PresignedUpload,
  PresignDownloadParams,
  PresignParams,
  S3StorageConfig,
  StorageAdapter,
  UploadParams,
  UploadResult,
} from './types';
import type { Readable } from 'stream';

/** Default presigned upload URL expiration (15 minutes) */
const DEFAULT_UPLOAD_EXPIRES_IN = 900;

/** Default presigned download URL expiration (1 hour) */
const DEFAULT_DOWNLOAD_EXPIRES_IN = 3600;

/**
 * AWS S3 storage adapter.
 * Implements the StorageAdapter interface for S3 operations.
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3StorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
  }

  /**
   * Upload a file to S3.
   */
  async upload(params: UploadParams): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.mimeType,
      Metadata: params.metadata,
    });

    const result = await this.client.send(command);

    const uploadResult: UploadResult = {
      key: params.key,
      size: params.buffer.length,
    };

    if (result.ETag) {
      uploadResult.etag = result.ETag.replace(/"/g, '');
    }

    return uploadResult;
  }

  /**
   * Download a file from S3 as a readable stream.
   */
  async download(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error(`Failed to download file: ${key}`);
    }

    // The Body is a Readable stream in Node.js
    return response.Body as Readable;
  }

  /**
   * Delete a file from S3.
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Check if a file exists in S3.
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      // NotFound error means the file doesn't exist
      if ((error as { name?: string }).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get a presigned URL for downloading a file.
   */
  async getSignedDownloadUrl(params: PresignDownloadParams): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ...(params.filename && {
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(params.filename)}"`,
      }),
    });

    return await getSignedUrl(this.client, command, {
      expiresIn: params.expiresIn ?? DEFAULT_DOWNLOAD_EXPIRES_IN,
    });
  }

  /**
   * Generate a presigned URL for direct upload to S3.
   * This allows clients to upload files directly to S3 without going through the API server.
   */
  async generatePresignedUpload(
    params: PresignParams,
  ): Promise<PresignedUpload> {
    const expiresIn = params.expiresIn ?? DEFAULT_UPLOAD_EXPIRES_IN;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.mimeType,
      ...(params.maxSize && { ContentLength: params.maxSize }),
    });

    const url = await getSignedUrl(this.client, command, { expiresIn });

    return {
      url,
      method: 'PUT',
      headers: {
        'Content-Type': params.mimeType,
      },
      key: params.key,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }
}
