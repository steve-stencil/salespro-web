/**
 * Validation schemas for mobile routes.
 */
import { z } from 'zod';

/**
 * Schema for template listing query parameters.
 * Based on iOS: ContractObjectSelectionCollectionViewController loadContracts
 */
export const listTemplatesQuerySchema = z.object({
  /** Filter by template type (e.g., 'contract', 'proposal') */
  type: z.string().optional(),

  /** Filter by customer state (2-letter code) */
  state: z.string().length(2).optional(),

  /** Filter by office ID */
  officeId: z.string().uuid().optional(),

  /** Sort mode: 'order' (default) or 'alphabetic' */
  sort: z.enum(['order', 'alphabetic']).default('order'),

  /** Whether to include templates marked as isTemplate=true (default: false) */
  includeTemplates: z
    .string()
    .optional()
    .transform(v => v === 'true')
    .default(false),
});

/**
 * Schema for template detail path parameters.
 */
export const templateIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Inferred types from schemas.
 */
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
export type TemplateIdParam = z.infer<typeof templateIdParamSchema>;
