/**
 * Validation schemas for mobile routes.
 */
import { z } from 'zod';

/**
 * Parse comma-separated UUID string into array, or undefined if not provided.
 * Returns empty array for empty string.
 */
function parseUuidArray(
  value: string | undefined,
): { provided: false } | { provided: true; ids: string[] } {
  if (value === undefined) {
    return { provided: false };
  }
  if (value === '') {
    return { provided: true, ids: [] };
  }
  return { provided: true, ids: value.split(',').map(id => id.trim()) };
}

/**
 * Schema for template listing query parameters.
 * Based on iOS: ContractObjectSelectionCollectionViewController loadContracts
 */
export const listTemplatesQuerySchema = z.object({
  /** Filter by customer state (2-letter code) */
  state: z.string().length(2).optional(),

  /**
   * Filter by office ID(s) - comma-separated UUIDs.
   * - Not provided: no office filter applied
   * - Empty string: return templates with NO offices assigned
   * - UUIDs: return templates assigned to any of these offices
   */
  officeIds: z
    .string()
    .optional()
    .transform(v => parseUuidArray(v)),

  /**
   * Filter by document type ID(s) - comma-separated UUIDs.
   * - Not provided: no document type filter applied
   * - Empty string: throws error (all templates must have a document type)
   * - UUIDs: return templates with any of these document types
   */
  documentTypeIds: z
    .string()
    .optional()
    .transform(v => parseUuidArray(v)),

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
