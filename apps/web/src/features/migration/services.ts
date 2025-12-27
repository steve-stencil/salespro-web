/**
 * Migration API Services
 *
 * Generic service functions that work with any collection.
 * Pass the collection name as the first parameter.
 */

import { apiClient } from '../../lib/api-client';

import type {
  BatchImportResult,
  MigrationSession,
  SourceItem,
  SourceItemsResponse,
} from './types';

/**
 * Supported collection names for migration.
 */
export type CollectionName = 'offices';

/**
 * Get count of source items in legacy database.
 */
export async function getSourceCount(
  collection: CollectionName,
): Promise<number> {
  const response = await apiClient.get<{ data: { count: number } }>(
    `/migration/${collection}/source-count`,
  );
  return response.data.count;
}

/**
 * Get source items from legacy database for preview.
 */
export async function getSourceItems(
  collection: CollectionName,
  skip = 0,
  limit = 100,
): Promise<SourceItemsResponse<SourceItem>> {
  return apiClient.get<SourceItemsResponse<SourceItem>>(
    `/migration/${collection}/source?skip=${skip}&limit=${limit}`,
  );
}

/**
 * Create a new migration session.
 */
export async function createSession(
  collection: CollectionName,
): Promise<MigrationSession> {
  const response = await apiClient.post<{ data: MigrationSession }>(
    `/migration/${collection}/sessions`,
  );
  return response.data;
}

/**
 * Get migration session status.
 */
export async function getSession(
  collection: CollectionName,
  sessionId: string,
): Promise<MigrationSession> {
  const response = await apiClient.get<{ data: MigrationSession }>(
    `/migration/${collection}/sessions/${sessionId}`,
  );
  return response.data;
}

/**
 * Import next batch of items.
 */
export async function importBatch(
  collection: CollectionName,
  sessionId: string,
  skip: number,
  limit: number,
): Promise<BatchImportResult> {
  const response = await apiClient.post<{ data: BatchImportResult }>(
    `/migration/${collection}/sessions/${sessionId}/batch`,
    { skip, limit },
  );
  return response.data;
}

/**
 * Import specific items by source IDs.
 */
export async function importSelectedItems(
  collection: CollectionName,
  sessionId: string,
  sourceIds: string[],
): Promise<BatchImportResult> {
  const response = await apiClient.post<{ data: BatchImportResult }>(
    `/migration/${collection}/sessions/${sessionId}/batch`,
    { sourceIds },
  );
  return response.data;
}

/**
 * Check which source IDs have already been imported.
 */
export async function getImportedStatus(
  collection: CollectionName,
  sourceIds: string[],
): Promise<string[]> {
  const response = await apiClient.post<{
    data: { importedSourceIds: string[] };
  }>(`/migration/${collection}/imported-status`, { sourceIds });
  return response.data.importedSourceIds;
}

// =============================================================================
// Collection-specific convenience exports
// =============================================================================

/**
 * Pre-configured service functions for offices collection.
 * Use these for simpler imports in office-specific components.
 */
export const officeServices = {
  getSourceCount: () => getSourceCount('offices'),
  getSourceItems: (skip?: number, limit?: number) =>
    getSourceItems('offices', skip, limit),
  createSession: () => createSession('offices'),
  getSession: (sessionId: string) => getSession('offices', sessionId),
  importBatch: (sessionId: string, skip: number, limit: number) =>
    importBatch('offices', sessionId, skip, limit),
  importSelectedItems: (sessionId: string, sourceIds: string[]) =>
    importSelectedItems('offices', sessionId, sourceIds),
  getImportedStatus: (sourceIds: string[]) =>
    getImportedStatus('offices', sourceIds),
};

// Future collections can add their own convenience exports:
// export const customerServices = { ... }
// export const contractServices = { ... }
