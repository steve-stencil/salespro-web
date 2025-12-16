/**
 * Storage module exports and adapter factory.
 * Automatically selects the appropriate storage adapter based on environment.
 */

import { env } from '../../config/env';

import { LocalStorageAdapter } from './LocalStorageAdapter';
import { S3StorageAdapter } from './S3StorageAdapter';

import type { StorageAdapter } from './types';

// Re-export types and utilities
export * from './types';
export * from './utils';
export { LocalStorageAdapter } from './LocalStorageAdapter';
export { S3StorageAdapter } from './S3StorageAdapter';

/** Singleton storage adapter instance */
let storageAdapter: StorageAdapter | null = null;

/**
 * Get the configured storage adapter.
 * Returns S3 adapter if S3_BUCKET is configured, otherwise local storage.
 *
 * @returns The storage adapter instance
 */
export function getStorageAdapter(): StorageAdapter {
  if (storageAdapter) {
    return storageAdapter;
  }

  if (env.S3_BUCKET) {
    storageAdapter = new S3StorageAdapter({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION ?? env.AWS_REGION,
    });
  } else {
    storageAdapter = new LocalStorageAdapter({
      basePath: './uploads',
      baseUrl: `${env.APP_URL}/api/files`,
    });
  }

  return storageAdapter;
}

/**
 * Check if S3 storage is configured.
 * Useful for determining if presigned uploads are available.
 */
export function isS3Configured(): boolean {
  return !!env.S3_BUCKET;
}

/**
 * Reset the storage adapter singleton.
 * Primarily used for testing.
 */
export function resetStorageAdapter(): void {
  storageAdapter = null;
}
