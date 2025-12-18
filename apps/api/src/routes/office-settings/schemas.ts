/**
 * Zod schemas for office settings routes.
 */

import { z } from 'zod';

/** Schema for integration key parameter */
export const integrationKeySchema = z.object({
  key: z
    .string()
    .min(1, 'Integration key is required')
    .max(100, 'Integration key must be 100 characters or less')
    .regex(
      /^[a-z0-9_-]+$/,
      'Integration key must contain only lowercase letters, numbers, hyphens, and underscores',
    ),
});

/** Schema for creating/updating an integration */
export const upsertIntegrationSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(255, 'Display name must be 255 characters or less'),
  credentials: z.record(z.string(), z.unknown()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
});

/** Schema for listing integrations query */
export const listIntegrationsQuerySchema = z.object({
  enabledOnly: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});
