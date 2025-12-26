/**
 * Migration Routes Validation Schemas
 */

import { z } from 'zod';

/**
 * Supported collection names for migration.
 */
export const SUPPORTED_COLLECTIONS = ['offices'] as const;
export type CollectionName = (typeof SUPPORTED_COLLECTIONS)[number];

/**
 * Validate collection parameter.
 */
export const collectionParamSchema = z.object({
  collection: z.enum(SUPPORTED_COLLECTIONS),
});

/**
 * Schema for batch import request.
 *
 * Supports two modes:
 * 1. Pagination mode: Uses skip/limit for bulk import
 * 2. Selective mode: Uses sourceIds to import specific items
 *
 * If sourceIds is provided, skip/limit are ignored.
 */
export const importBatchSchema = z.object({
  skip: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
  /** Optional list of specific source IDs to import */
  sourceIds: z.array(z.string()).optional(),
});
