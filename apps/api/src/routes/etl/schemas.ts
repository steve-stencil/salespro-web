/**
 * ETL Route Validation Schemas
 */

import { z } from 'zod';

/**
 * Schema for creating an import session.
 */
export const createImportSessionSchema = z.object({
  officeMapping: z.record(
    z.string(),
    z.union([z.string().uuid(), z.literal('create'), z.literal('none')]),
  ),
  typeMapping: z.record(
    z.string(),
    z.union([z.string().uuid(), z.literal('create')]),
  ),
});

/**
 * Schema for importing a batch.
 */
export const importBatchSchema = z.object({
  skip: z.number().int().min(0).optional().default(0),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type CreateImportSessionInput = z.infer<
  typeof createImportSessionSchema
>;
export type ImportBatchInput = z.infer<typeof importBatchSchema>;
